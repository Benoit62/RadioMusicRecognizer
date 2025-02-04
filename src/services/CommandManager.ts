import readline from 'readline';
import { RadioManager } from '../services/RadioManager';

export class CommandManager {
    private radioManagers: RadioManager[];

    constructor(radioManagers: RadioManager[]) {
        this.radioManagers = radioManagers;
    }

    public start() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('Type "help" for a list of commands.');

        rl.on('line', (input) => {
            this.handleCommand(input.trim());
        });
    }

    private handleCommand(command: string) {
        const args = command.split(' ');
        const cmd = args[0].toLowerCase();

        switch (cmd) {
            case 'help':
                this.showHelp();
                break;
            case 'list':
                this.listRadios();
                break;
            case 'recent':
                if (args.length < 2) {
                    console.log('Usage: recent <radio_name>');
                } else {
                    const radioName = args.slice(1).join(' ');
                    this.showRecentTracks(radioName);
                }
                break;
            case 'exit':
                console.log('Exiting...');
                process.emit('SIGINT');
                break;
            default:
                console.log(`Unknown command: ${cmd}`);
                this.showHelp();
                break;
        }
    }

    private showHelp() {
        console.log(`
Available commands:
  help                - Show this help message
  list                - List all radios
  recent <radio_name> - Show recent tracks for a specific radio
  exit                - Exit the application
        `);
    }

    private listRadios() {
        console.log('Radios currently being listened to:');
        this.radioManagers.forEach((manager) => {
            console.log(`- ${manager.name} (${manager.sanitizedName})`);
        });
    }

    private showRecentTracks(radioSanitizedName: string) {
        const radioManager = this.radioManagers.find((manager) => manager.sanitizedName === radioSanitizedName);
        if (radioManager) {
            const recentTracks = radioManager.getRecentTracks();
            if (recentTracks.length > 0) {
                console.log(`Recent tracks for ${radioManager.name}:`);
                recentTracks.forEach((track) => {
                    RadioManager.printSong(track);
                });
            } else {
                console.log(`No recent tracks found for ${radioManager.name}.`);
            }
        } else {
            console.log(`Radio "${radioSanitizedName}" not found.`);
        }
    }
}