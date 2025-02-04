import path from 'path';    
import dotenv from 'dotenv';
import { RadioManager } from './services/RadioManager';
import fs from 'fs';
import { CommandManager } from './services/CommandManager';
import { WebServer } from './services/servers/WebServer';
import { SocketServer } from './services/servers/SocketServer';
import { Rules } from './types/types';

dotenv.config();

// Validation function
function validateConfig(config: any): boolean {
    // Check if the top-level key 'radios' exists
    if (!config.radios) {
        throw new Error('Missing "radios" key in the config.');
    }

    // Check if 'radios' is an array
    if (!Array.isArray(config.radios)) {
        throw new Error('"radios" must be an array.');
    }

    // Validate each radio object in the array
    config.radios.forEach((radio: any, index: number) => {
        if (!radio.name || typeof radio.name !== 'string') {
            throw new Error(`Radio at index ${index} is missing a valid "name" property.`);
        }
        if (!radio.streamUrl || typeof radio.streamUrl !== 'string') {
            throw new Error(`Radio at index ${index} is missing a valid "streamUrl" property.`);
        }
        if(!radio.rules || !Array.isArray(radio.rules)) {
            throw new Error(`Radio at index ${index} is missing a valid "rules" property.`);
        }
    });

    console.log('Config validated!');
    return true;
}

async function main() {
    const configPath = 'config.json';
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log('Config loaded!');

    const radioManagers: RadioManager[] = [];

    // Validate the config
    validateConfig(config);

    // Create a radio manager for each radio
    config.radios.forEach((radio: any) => {
        const radioManager = new RadioManager(radio.streamUrl, radio.name, radio.rules as Rules[]);
        radioManagers.push(radioManager);
    });

    // Start the command manager
    const commandManager = new CommandManager(radioManagers);
    commandManager.start();

    // Start the web server
    const webServer = new WebServer(3000);

    // Start the socket server
    const socketServer = new SocketServer(webServer.getServer(), radioManagers);

    // Handle process termination
    // More robust signal handling
    process.on('SIGINT', async () => {
        console.log('Gracefully shutting down...');
        
        try {
            // Set a timeout to force exit if graceful shutdown takes too long
            const forceExitTimeout = setTimeout(() => {
                console.error('Force exiting after timeout');
                process.exit(1);
            }, 5000); // 5 seconds timeout
            
            // Track all stop operations
            const stopPromises = radioManagers.map(async (manager) => {
                try {
                    await manager.stop();
                    console.log(`Successfully stopped manager: ${manager.name}`);
                } catch (error) {
                    console.error(`Error stopping manager: ${manager.name}`, error);
                    // Continue with other managers even if one fails
                }
            });
            
            // Wait for all managers to stop
            await Promise.all(stopPromises);
            
            // Clear the timeout since we've completed gracefully
            clearTimeout(forceExitTimeout);
            
            console.log('All managers stopped successfully');
            process.exit(0);
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    });

    // Start all services
    await startServices(radioManagers);
}


async function startServices(radioManagers : RadioManager[]) {
    console.log('Démarrage des services radio...');
    
    try {
        // Démarrage en parallèle avec tracking des erreurs
        const startResults = await Promise.allSettled(
            radioManagers.map(async (manager) => {
                try {
                    await manager.start();
                    return {
                        managerId: manager.sanitizedName,
                        success: true,
                        error: "none"
                    };
                } catch (error) {
                    return {
                        managerId: manager.sanitizedName,
                        success: false,
                        error: (error as Error).message
                    };
                }
            })
        );
        
        // Analyse des résultats
        const failed = startResults.filter(result => 
            result.status === 'fulfilled' && !result.value.success
        );
        
        if (failed.length > 0) {
            console.error('Erreurs lors du démarrage des services:');
            failed.forEach(f => {
                if (f.status === 'fulfilled') {
                    console.error(`- Service ${f.value.managerId}: ${f.value.error}`);
                }
            });
            
            // Décider si on continue ou non selon votre logique métier
            if (failed.length === radioManagers.length) {
                throw new Error('Aucun service n\'a pu démarrer');
            }
        }
        
        const successful = startResults.filter(result => 
            result.status === 'fulfilled' && result.value.success
        ).length;
        
        console.log(`${successful}/${radioManagers.length} services démarrés avec succès`);
        
        return startResults;
    } catch (error) {
        console.error('Erreur critique lors du démarrage des services:', error);
        throw error; // Propager l'erreur pour la gestion au niveau supérieur
    }
}

main().catch(console.error);