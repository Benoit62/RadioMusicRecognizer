// services/SocketServer.ts
import { Server } from 'socket.io';
import http from 'http';
import { RadioManager } from '../RadioManager';

export class SocketServer {
    private io: Server;
    private radioManagers: RadioManager[];

    constructor(server: http.Server, radioManagers: RadioManager[]) {
        this.io = new Server(server);
        this.radioManagers = radioManagers;
        this.setupSocket();
    }

    private setupSocket() {
        this.radioManagers.forEach((manager) => {
            manager.on('tracksUpdated', () => {
                this.io.emit('radioData', [{
                    name: manager.name,
                    recentTracks: manager.getRecentTracks(),
                }]);
            });
        });

        this.io.on('connection', (socket) => {
            console.log('A client connected');

            // Send initial data to the client
            this.sendRadioData(socket);

            // Set up periodic updates
            const interval = setInterval(() => {
                this.sendRadioData(socket);
            }, 60000); // Send data every 60 seconds

            // Handle client disconnection
            socket.on('disconnect', () => {
                console.log('A client disconnected');
                clearInterval(interval);
            });
        });
    }

    private sendRadioData(socket: any) {
        const radioData = this.radioManagers.map((manager) => ({
            name: manager.name,
            recentTracks: manager.getRecentTracks(),
        }));
        socket.emit('radioData', radioData);
    }
}