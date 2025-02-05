import fs from 'fs';
import crypto from 'crypto';
import FormData from 'form-data';
import { RecognizedSong } from '../types/types';
import { BaseMusicRecognizer } from './BaseMusicRecognizer ';

export class ARCMusicRecognizer extends BaseMusicRecognizer {
    private apiAccessKey: string = process.env.ACRCLOUD_ACCESS_KEY || '';
    private apiHost: string = process.env.ACRCLOUD_HOST || '';
    private apiSecretKey: string = process.env.ACRCLOUD_SECRET_KEY || '';
    
    private defaultOptions: {
        host: string;
        endpoint: string;
        signature_version: string;
        data_type: string;
        secure: boolean;
        access_key: string;
        access_secret: string;
    };

    constructor() {
        super();
        this.defaultOptions = {
            host: this.apiHost,
            endpoint: '/v1/identify',
            signature_version: '1',
            data_type: 'audio',
            secure: true,
            access_key: this.apiAccessKey,
            access_secret: this.apiSecretKey,
        };
    }

    protected displayResult(result: any): void {
        if (result.metadata.music) {
            console.log('ARC Cloud result:', result.metadata.music[0].title);
        } else if (result.metadata.humming) {
            console.log('ARC Cloud result:', result.metadata.humming[0].title);
        }
        else {
            console.log('ARC Cloud result empty:', result);
        }
    }

    private async buildStringToSign(
        method: string,
        uri: string,
        accessKey: string,
        dataType: string,
        signatureVersion: string,
        timestamp: number
    ): Promise<string> {
        return [method, uri, accessKey, dataType, signatureVersion, timestamp].join('\n');
    }

    private sign(signString: string, accessSecret: string): string {
        return crypto
            .createHmac('sha1', accessSecret)
            .update(Buffer.from(signString, 'utf-8'))
            .digest('base64');
    }

    /**
     * Identifies a sample of bytes
     */
    public async recognizeSong(audioFilePath: string): Promise<RecognizedSong | null> {
        try {
            const bitmap = fs.readFileSync(audioFilePath);
            const data = Buffer.from(bitmap);
            const currentData = new Date();
            const timestamp = Math.floor(currentData.getTime() / 1000);

            const stringToSign = await this.buildStringToSign(
                'POST',
                this.defaultOptions.endpoint,
                this.defaultOptions.access_key,
                this.defaultOptions.data_type,
                this.defaultOptions.signature_version,
                timestamp
            );

            const signature = this.sign(stringToSign, this.defaultOptions.access_secret);

            const form = new FormData();
            form.append('sample', data, { filename: 'sample.mp3' });
            form.append('sample_bytes', data.length.toString());
            form.append('access_key', this.defaultOptions.access_key);
            form.append('data_type', this.defaultOptions.data_type);
            form.append('signature_version', this.defaultOptions.signature_version);
            form.append('signature', signature);
            form.append('timestamp', timestamp.toString());

            const options = {
                method: 'POST',
                url: `http://${this.defaultOptions.host}${this.defaultOptions.endpoint}`,
                headers: {
                    ...form.getHeaders(),
                },
                data: form
            };

            /*const response = await axios.post(
                `http://${this.defaultOptions.host}${this.defaultOptions.endpoint}`,
                form,
                {
                    headers: {
                        ...form.getHeaders(),
                    },
                }
            );*/
            const responseData = await this.sendRequest(options);
        
            this.displayResult(responseData);

            if (responseData.metadata.music) {
                return {
                    title: responseData.metadata.music[0].title,
                    artist: responseData.metadata.music[0].artists[0].name,
                    timestamp: new Date(),
                    confidence: 0.3 // Shazam API doesn't provide confidence score
                };
            }

            if (responseData.metadata.humming) {
                return {
                    title: responseData.metadata.humming[0].title,
                    artist: responseData.metadata.humming[0].artists[0].name,
                    timestamp: new Date(),
                    confidence: 0.3 // Shazam API doesn't provide confidence score
                };
            }
            return null;
        } catch (error) {
            console.error('Error recognizing song:', error);
            return null;
        }
    }
}
