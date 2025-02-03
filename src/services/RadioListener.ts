import { EventEmitter } from 'events';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import { AudioSample, RecognizedSong } from '../types/types';
import { RadioEvents } from '../types/events';
import { SampleManager } from './SampleManager';
import { MusicRecognizer } from './MusicRecognizer';
import { MusicRecognizerV2 } from './MusicRecognizerV2';
import { buffer } from 'stream/consumers';
import { AudioUtils } from '../utils/AudioUtils';

export class RadioListener extends EventEmitter {
    private streamUrl: string;
    private sampleManager: SampleManager;
    private musicRecognizer: MusicRecognizer;
    private musicRecognizerV2: MusicRecognizerV2;
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
        this.musicRecognizer = new MusicRecognizer();
        this.musicRecognizerV2 = new MusicRecognizerV2();
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
            // TO-DO : Read the new buffer if enought data is available
            const sampleBufferIndex = (this.currentBufferIndex - 1 + this.BUFFER_COUNT) % this.BUFFER_COUNT;
            const bufferPath = this.getBufferPath(sampleBufferIndex);

            // Wait for buffer file to exist and be non-empty
            await new Promise<void>((resolve, reject) => {
                const checkBuffer = async () => {
                    if (fs.existsSync(bufferPath)) {
                        const stats = await fs.promises.stat(bufferPath);
                        if (stats.size > 0) {
                            resolve();
                            return;
                        }
                    }
                    setTimeout(checkBuffer, 1000);
                };
                checkBuffer();
            });

            // Extract sample from the buffer
            await new Promise<void>((resolve, reject) => {
                ffmpeg(bufferPath)
                    .setStartTime(this.bufferDuration / 1000 - this.sampleDuration / 1000) // Take from end of buffer
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
                const sample = await this.takeSample();
                if (sample) {
                    this.emit('sampleTaken', sample.id);
                    const recognizedSong = await this.musicRecognizer.recognizeSong(sample.filePath);
                    const recognizedSongV2 = await this.musicRecognizerV2.identify(sample.filePath);
                    
                    if (recognizedSong) {
                        this.handleRecognizedSong(recognizedSong);
                    }
                }
                // Wait for next sample interval
                await new Promise(resolve => setTimeout(resolve, this.sampleInterval));
            } catch (error) {
                this.emit('error', error as Error);
            }
        }
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