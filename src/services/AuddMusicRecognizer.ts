import { createReadStream } from 'fs';
import { RecognizedSong } from '../types/types';
import FormData from 'form-data';
import { BaseMusicRecognizer } from './BaseMusicRecognizer ';

export class AuddMusicRecognizer extends BaseMusicRecognizer {
    private apiToken: string = process.env.AUDD_API_TOKEN || '';

    constructor() {
        super();
    }

    protected displayResult(result: any): void {
        if (result?.result) {
            console.log('AudD result:', result.result.title);
        }
        else {
            console.log('AudD result empty:', result);
        }
    }

    async recognizeSong(audioFilePath: string): Promise<RecognizedSong | null> {
        const data = new FormData();
        data.append('file', createReadStream(audioFilePath));
        data.append('api_token', this.apiToken);


        const options = {
            method: 'POST',
            url: 'https://api.audd.io/',
            headers: { 'Content-Type': 'multipart/form-data' },
            data: data
        };

        
        const responseData = await this.sendRequest(options);
        
        this.displayResult(responseData);
        
        if (responseData?.result) {
            return {
                title: responseData?.result.title,
                artist: responseData?.result.artist,
                timestamp: new Date(),
                confidence: 0.3 // Shazam API doesn't provide confidence score
            };
        }
        return null;
    }
}