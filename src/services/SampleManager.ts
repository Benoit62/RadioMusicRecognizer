import { AudioSample } from '../types/types';
import { AudioUtils } from '../utils/AudioUtils';
import path from 'path';

export class SampleManager {
    private samples: Map<string, AudioSample>;
    private sampleDirectory: string;
    private maxSampleAge: number;

    constructor(sampleDirectory: string, maxSampleAgeHours: number = 1) {
        this.samples = new Map();
        this.sampleDirectory = sampleDirectory;
        this.maxSampleAge = maxSampleAgeHours;
        this.initialize();
    }

    public getSampleDirectory(): string {
        return this.sampleDirectory;
    }

    private async initialize(): Promise<void> {
        await AudioUtils.createDirectory(this.sampleDirectory);
        // Cleanup once at startup
        await this.cleanup();
        // Start periodic cleanup
        setInterval(() => {
            this.cleanup();
        }, 1000 * 60 * 60); // Run cleanup every hour
    }

    async addSample(sample: AudioSample): Promise<void> {
        this.samples.set(sample.id, sample);
    }

    async removeSample(id: string): Promise<void> {
        console.log(`Removing sample: ${id}`);
        // Cleanup file
        const filePath = path.join(this.sampleDirectory, `${id}.mp3`);
        await AudioUtils.deleteFile(filePath);
        
        this.samples.delete(id);
    }

    async getSample(id: string): Promise<AudioSample | undefined> {
        return this.samples.get(id);
    }

    async getLastSample(): Promise<AudioSample | undefined> {
        const keys = Array.from(this.samples.keys());
        if (keys.length > 0) {
            return this.samples.get(keys[keys.length - 1]);
        }
        return undefined;
    }

    async cleanup(): Promise<void> {
        await AudioUtils.cleanupOldSamples(this.sampleDirectory, this.maxSampleAge);
        
        // Cleanup memory references
        const now = new Date().getTime();
        for (const [id, sample] of this.samples.entries()) {
            const age = (now - sample.timestamp.getTime()) / (1000 * 60 * 60);
            if (age > this.maxSampleAge) {
                this.samples.delete(id);
            }
        }
    }
}