import axios from 'axios';
import { RecognizedSong } from '../types/types';

export abstract class BaseMusicRecognizer {

    constructor() {
    }

    protected async sendRequest(options: any): Promise<any | null> {
        try {
            const response = await axios.request(options);
            return response.data;
        } catch (error) {
            console.error('Error recognizing song:', error);
            return null;
        }
    }

    // Implémentation par défaut de la méthode displayResult
    protected displayResult(result: any): void {
        console.log('Default display result:', result);
    }

    abstract recognizeSong(audioFilePath: string): Promise<RecognizedSong | null>;
}