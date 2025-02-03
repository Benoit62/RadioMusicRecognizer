export interface AudioSample {
    id: string;
    timestamp: Date;
    filePath: string;
    duration: number;
}

export interface RecognizedSong {
    title: string;
    artist: string;
    timestamp: Date;
    confidence: number;
}