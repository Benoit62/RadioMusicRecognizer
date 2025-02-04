import { createReadStream } from 'fs';
import { RecognizedSong } from '../types/types';
import FormData from 'form-data';
import { BaseMusicRecognizer } from './BaseMusicRecognizer ';

export class ShazamMusicRecognizer extends BaseMusicRecognizer {
    private apiKey: string = process.env.SHAZAM_API_KEY || '';
    private apiHost: string = 'shazam-song-recognition-api.p.rapidapi.com';

    constructor() {
        super();
    }

    protected displayResult(result: any): void {
        if (result?.track) {
            console.log('Shazam result:', result.track.title);
        }
        else {
            console.log('Shazam result empty:', result);
        }
    }

    async recognizeSong(audioFilePath: string): Promise<RecognizedSong | null> {
        const data = new FormData();
        data.append('file', createReadStream(audioFilePath));

        const options = {
            method: 'POST',
            url: 'https://shazam-song-recognition-api.p.rapidapi.com/recognize/file',
            headers: {
              'x-rapidapi-key': this.apiKey,
              'x-rapidapi-host': this.apiHost,
              ...data.getHeaders(),
            },
            data: data
        };

        
        const responseData = await this.sendRequest(options);
        
        this.displayResult(responseData);
        
        if (responseData?.track) {
            return {
                title: responseData.track.title,
                artist: responseData.track.subtitle,
                timestamp: new Date(),
                confidence: 0.3 // Shazam API doesn't provide confidence score
            };
        }
        return null;
    }
}