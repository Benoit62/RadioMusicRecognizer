import axios from 'axios';
import { createReadStream } from 'fs';
import { RecognizedSong } from '../types/types';
var FormData = require('form-data');

export class MusicRecognizer {
    private apiKey: string = process.env.SHAZAM_API_KEY || '';
    private apiHost: string;

    constructor() {
        this.apiHost = 'shazam-song-recognition-api.p.rapidapi.com';
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

        
        try {
            const response = await axios.request(options);
        
            if (response.data?.track) {
                return {
                    title: response.data.track.title,
                    artist: response.data.track.subtitle,
                    timestamp: new Date(),
                    confidence: 1 // Shazam API doesn't provide confidence score
                };
            }
            return null;
        } catch (error) {
            console.error('Error recognizing song:', error);
            return null;
        }
    }
}