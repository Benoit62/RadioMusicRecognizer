import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AudioSample } from '../types/types';

export class AudioUtils {
    static async createDirectory(dirPath: string): Promise<void> {
        try {
            if (!fs.existsSync(dirPath)) {
                await fs.promises.mkdir(dirPath, { recursive: true });
            }
            else {
                    const files = await fs.promises.readdir(dirPath);
                    for (const file of files) {
                        const filePath = path.join(dirPath, file);
                        await fs.promises.unlink(filePath);
                    }
            }
        } catch (error) {
            console.error('Error creating directory:', error);
        }
    }

    static async cleanupOldSamples(directory: string, maxAgeHours: number): Promise<void> {
        const files = await fs.promises.readdir(directory);
        const now = new Date().getTime();

        for (const file of files) {
            const filePath = path.join(directory, file);
            const stats = await fs.promises.stat(filePath);
            // Calculate file age in hours
            const fileAge = (now - stats.mtime.getTime()) / (1000 * 60 * 60);

            if (fileAge > maxAgeHours) {
                await fs.promises.unlink(filePath);
            }
        }
    }
}