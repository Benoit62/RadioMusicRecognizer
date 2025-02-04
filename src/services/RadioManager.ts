import EventEmitter from "events";
import { RecognizedSong } from "../types/types";
import { RadioListener } from "./RadioListener";
import path from 'path';


export class RadioManager extends EventEmitter {
    private radioListener: RadioListener;
    private radioUrl: string;
    private radioName: string;

    private lastSongs: RecognizedSong[] = [];

    constructor(radioUrl: string, radioName: string) {
        super();
        this.radioUrl = radioUrl;
        this.radioName = radioName;
        this.radioListener = new RadioListener(
            this.radioUrl,
            path.join('output\\' + this.sanitizedName + '\\samples'),
            path.join('output\\' + this.sanitizedName + '\\buffers'),
            60, // Sample every 60 seconds
            15,  // 15 second samples
            120, // Buffer 120 seconds of audio
        );
        this.initEventListeners();
    }

    get name(): string {
        return this.radioName;
    }

    get sanitizedName(): string {
        return this.radioName
            .toLowerCase() // Convert to lowercase
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/[^a-z0-9-]/g, ''); // Remove any non-alphanumeric characters except hyphens
    }


    private initEventListeners() {
        this.radioListener.on('sampleTaken', async (sampleId) => {
            console.log(`Sample taken on ${this.radioName}: ${sampleId}`);
        });

        this.radioListener.on('songRecognized', async (song) => {
            console.log(`Song recognized on ${this.radioName}: ${song.title}`);
            this.handleRecognizedSong(song);
        });

        this.radioListener.on('error', async (error) => {
            console.error('Error:', error);
        });

        this.radioListener.on('streamStart', async () => {
            console.log(`Radio stream started on ${this.radioName}`);
        });

        this.radioListener.on('streamEnd', async () => {
            console.log(`Radio stream ended on ${this.radioName}`);
        });
    }

    private handleRecognizedSong(song: RecognizedSong): void {
        if(this.lastSongs.length >= 1) {
            const lastSong = this.lastSongs[this.lastSongs.length - 1];
            if(lastSong.title.includes(song.title) || song.title.includes(lastSong.title)) {
                console.log(`Song already played on ${this.radioName}: ${song.title}. Reinforcing confidence...`);
                lastSong.confidence = parseFloat((lastSong.confidence + 0.3).toFixed(2));
                this.emit('tracksUpdated');
                return;
            }
        }
        this.lastSongs.push(song);
        this.emit('tracksUpdated');
    }

    public getLastSongs(offset: number = this.lastSongs.length): RecognizedSong[] {
        offset = Math.min(offset, this.lastSongs.length);
        return this.lastSongs.slice(-offset);
    }

    public getRecentTracks(): RecognizedSong[] {
        return this.getLastSongs(5);
    }

    static printSong(song: RecognizedSong): void {
        console.log(` - ${song.title} by ${song.artist} (Confidence: ${song.confidence}) at ${song.timestamp.toLocaleDateString()} ${song.timestamp.toLocaleTimeString()}`);
    }

    public async stop() {
        console.log(`Stopping radio listener on ${this.radioName}...`);
        await this.radioListener.stop();
    }

    public async start() {
        console.log(`Starting radio listener on ${this.radioName}...`);
        await this.radioListener.start();
    }

}