import path from 'path';
import { RadioListener } from "./services/RadioListener";
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    const radioUrl = 'http://europe2.lmn.fm/europe2.mp3';
    const sampleDirectory = path.join(__dirname, 'samples');
    const bufferDirectory = path.join(__dirname, 'buffers');
    
    const radioListener = new RadioListener(
        radioUrl,
        sampleDirectory,
        bufferDirectory,
        60, // Sample every 60 seconds
        15,  // 15 second samples
        120, // Buffer 120 seconds of audio
    );

    console.log(`API key: ${process.env.SHAZAM_API_KEY}`);

    radioListener.on('sampleTaken', async (sampleId) => {
        console.log('Sample taken:', sampleId);
    });

    radioListener.on('songRecognized', async (song) => {
        console.log('Song recognized:', song);
    });

    radioListener.on('error', async (error) => {
        console.error('Error:', error);
    });

    radioListener.on('streamStart', async () => {
        console.log('Radio stream started');
    });

    radioListener.on('streamEnd', async () => {
        console.log('Radio stream ended');
    });



    // Handle process termination
    process.on('SIGINT', async () => {
        console.log('Stopping radio listener...');
        await radioListener.stop();
        process.exit(0);
    });

    console.log('Starting radio listener...');
    await radioListener.start();
}

main().catch(console.error);