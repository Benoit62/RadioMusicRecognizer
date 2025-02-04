import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

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

    static deleteFile(filePath: string): Promise<void> {
        return fs.promises.unlink(filePath);
    }

    static async getFileDuration(filePath: string): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            try {
                if(fs.existsSync(filePath)) {
                    const stats = await fs.promises.stat(filePath);
                    if (stats.size > 0) {
                        ffmpeg.ffprobe(filePath, (err, data) => {
                            if (err) {
                                reject(err);
                            } else {
                                const duration = data.streams[0]?.duration;
                                if (typeof duration === 'number') {
                                    console.log(`Duration of ${filePath}: ${duration}`);
                                    resolve(duration);
                                } else {
                                    reject(new Error('Duration is undefined or not a number'));
                                }
                            }
                        });
                    } else {
                        reject(new Error('File is empty'));
                    }
                } else {
                    reject(new Error('File doesn\'t exist'));
                }
            } catch (error) {
                console.error('Error getting file duration:', error);
                reject(error);
                
            }
        });
    }
}