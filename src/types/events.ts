import { RecognizedSong } from './types';

export interface RadioEvents {
    'songRecognized': (song: RecognizedSong) => void;
    'sampleTaken': (sampleId: string) => void;
    'error': (error: Error) => void;
    'streamStart': () => void;
    'streamEnd': () => void;
}