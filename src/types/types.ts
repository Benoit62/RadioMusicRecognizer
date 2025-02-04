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

export interface Track {
    title: string;
    artist: string;
}

export interface Rules {
    tracks?: Track[];
    artists?: string[];
    keepOrder: boolean;
}