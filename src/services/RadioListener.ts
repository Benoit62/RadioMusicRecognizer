import { EventEmitter } from 'events';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import { AudioSample, RecognizedSong } from '../types/types';
import { RadioEvents } from '../types/events';
import { SampleManager } from './SampleManager';
import { ShazamMusicRecognizer } from './ShazamMusicRecognizer ';
import { ARCMusicRecognizer } from './ARCMusicRecognizer';
import { AudioUtils } from '../utils/AudioUtils';
import { AuddMusicRecognizer } from './AuddMusicRecognizer';

export class RadioListener extends EventEmitter {
    private streamUrl: string;
    private sampleManager: SampleManager;
    private shazamMusicRecognizer: ShazamMusicRecognizer;
    private arcMusicRecognizer: ARCMusicRecognizer;
    private auddMusicRecognizer: AuddMusicRecognizer;
    private sampleInterval: number;
    private sampleDuration: number;
    private bufferDirectory: string;
    private bufferDuration: number;
    private isListening: boolean;
    private currentStream: any;
    private streamProcess: any;
    private currentBufferIndex: number;
    private readonly BUFFER_COUNT = 2;

    constructor(
        streamUrl: string,
        sampleDirectory: string,
        bufferDirectory: string,
        sampleIntervalSeconds: number = 60,
        sampleDurationSeconds: number = 15,
        bufferDurationSeconds: number = 30,
    ) {
        super();
        this.streamUrl = streamUrl;
        this.sampleManager = new SampleManager(sampleDirectory);
        this.shazamMusicRecognizer = new ShazamMusicRecognizer();
        this.arcMusicRecognizer = new ARCMusicRecognizer();
        this.auddMusicRecognizer = new AuddMusicRecognizer();
        this.sampleInterval = sampleIntervalSeconds * 1000;
        this.sampleDuration = sampleDurationSeconds * 1000;
        this.bufferDirectory = bufferDirectory;
        this.bufferDuration = bufferDurationSeconds * 1000;
        this.isListening = false;
        this.currentBufferIndex = 0;
    }

    private getBufferPath(index: number): string {
        // Get the current buffer file path
        return path.join(this.bufferDirectory, `buffer_${index}.mp3`);
    }

    private async initializeStream(): Promise<void> {
        AudioUtils.createDirectory(this.bufferDirectory);

        // Start stream processing
        await this.rotateBuffer();
    }

    private async rotateBuffer(): Promise<void> {
        // Kill existing stream process if any
        if (this.streamProcess) {
            this.streamProcess.kill();
        }

        // Increment and wrap buffer index
        this.currentBufferIndex = (this.currentBufferIndex + 1) % this.BUFFER_COUNT;
        const currentBufferPath = this.getBufferPath(this.currentBufferIndex);

        // Start new stream process
        this.streamProcess = ffmpeg(this.streamUrl)
            .audioFrequency(44100)
            .audioChannels(2)
            .audioBitrate('128k')
            .duration(this.bufferDuration / 1000) // Limit the duration of each buffer file
            .format('mp3')
            .on('error', (error) => this.emit('error', error))
            .on('end', () => {
                if (this.isListening) {
                    this.rotateBuffer(); // Start next buffer when current one is full
                }
            });

        // Save to current buffer file
        this.currentStream = this.streamProcess.save(currentBufferPath);
    }

    private async takeSample(): Promise<AudioSample | null> {
        const sampleId = uuidv4();
        const timestamp = new Date();
        const filePath = path.join(this.sampleManager.getSampleDirectory(), `${sampleId}.mp3`);
        
        try {
            // Calculate which buffer file to read from (previous buffer)
            // TO-DO : Read the new buffer if enought data is available,
            // otherwise, reading the previous buffer while second buffer is being filled
            // if bufferDuration is high, this might lead to loop sample from the end of the same finished buffer for a long time
            // Then, it adds a delay to the sample recognition
            //const sampleBufferIndex = (this.currentBufferIndex - 1 + this.BUFFER_COUNT) % this.BUFFER_COUNT;
            const sampleBufferIndex = this.currentBufferIndex % this.BUFFER_COUNT;
            const bufferPath = this.getBufferPath(sampleBufferIndex);

            let currentBufferDuration = 0

            // Wait for buffer file to exist and be non-empty and have enough duration
            await new Promise<void>((resolve, reject) => {
                const checkBuffer = async () => {
                    if (fs.existsSync(bufferPath)) {
                        const stats = await fs.promises.stat(bufferPath);
                        if (stats.size > 0) {
                            //Make sure the buffer has data to probe with ffmpeg
                            try {
                                currentBufferDuration = Math.round(await AudioUtils.getFileDuration(bufferPath)) * 1000;
                                if(currentBufferDuration >= this.sampleDuration) {
                                    resolve();
                                    return;
                                }
                            } catch (error) {
                                console.error('Error getting buffer duration:', error);
                                
                            }
                        }
                    }
                    setTimeout(checkBuffer, 1000);
                };
                checkBuffer();
            });

            // Extract sample from the buffer
            await new Promise<void>((resolve, reject) => {
                ffmpeg(bufferPath)
                    .setStartTime(currentBufferDuration / 1000 - this.sampleDuration / 1000) // Take from end of buffer
                    .duration(this.sampleDuration / 1000)
                    .audioFrequency(44100)
                    .audioChannels(2)
                    .audioBitrate('128k')
                    .format('mp3')
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .save(filePath);
            });

            const sample: AudioSample = {
                id: sampleId,
                timestamp,
                filePath,
                duration: this.sampleDuration
            };

            await this.sampleManager.addSample(sample);
            return sample;
        } catch (error) {
            this.emit('error', error as Error);
            return null;
        }
    }

    async start(): Promise<void> {
        if (this.isListening) return;
        this.isListening = true;

        try {
            await this.initializeStream();
            this.emit('streamStart');
            await this.startListening();
        } catch (error) {
            this.emit('error', error as Error);
            this.isListening = false;
        }
    }

    async stop(): Promise<void> {
        this.isListening = false;
        if (this.streamProcess) {
            this.streamProcess.kill();
        }
        this.emit('streamEnd');
    }

    private async startListening(): Promise<void> {
        while (this.isListening) {
            try {
                const lastSample = await this.sampleManager.getLastSample();
                const sample = await this.takeSample();
                if (sample) {
                    // Check if sample is similar to last sample
                    // This event occure iin the current implementation because sample 
                    // is taken from the same buffer, at the same position (end)
                    // while the second buffer is being filled
                    // Usefull to avoid API usage for the same sample
                    if(!await this.isSampleSimilar(sample, lastSample)) {
                        this.emit('sampleTaken', sample.id);
                        /*const recognizedSong = await this.shazamMusicRecognizer.recognizeSong(sample.filePath);
                        if (recognizedSong) {
                            this.handleRecognizedSong(recognizedSong);
                        }*/

                        const recognizedSongV2 = await this.arcMusicRecognizer.recognizeSong(sample.filePath);
                        if(recognizedSongV2) {
                            this.handleRecognizedSong(recognizedSongV2);
                        }
                        
                        /*const recognizedSongV3 = await this.auddMusicRecognizer.recognizeSong(sample.filePath);
                        if(recognizedSongV3) {
                            this.handleRecognizedSong(recognizedSongV3);
                        }*/
                    }
                }
                // Wait for next sample interval
                await new Promise(resolve => setTimeout(resolve, this.sampleInterval));
            } catch (error) {
                this.emit('error', error as Error);
            }
        }
    }

    private async isSampleSimilar(sample: AudioSample, lastSample: AudioSample | undefined): Promise<boolean> {
        if(!lastSample) {
            return false;
        }

        const sampleBuffer = fs.readFileSync(sample.filePath);
        const lastSampleBuffer = fs.readFileSync(lastSample.filePath);

        // Compare sample buffers
        if (Buffer.compare(sampleBuffer, lastSampleBuffer) === 0) {
            console.log(`Sample ${sample.id} is similar to last sample`);
            this.sampleManager.removeSample(sample.id);
            return true;
        }

        return false;
    }

    private handleRecognizedSong(song: RecognizedSong): void {
        this.emit('songRecognized', song);
    }

    on<K extends keyof RadioEvents>(event: K, listener: RadioEvents[K]): this {
        return super.on(event, listener);
    }

    emit<K extends keyof RadioEvents>(event: K, ...args: Parameters<RadioEvents[K]>): boolean {
        return super.emit(event, ...args);
    }
}