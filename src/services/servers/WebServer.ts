// services/WebServer.ts
import http from 'http';
import fs from 'fs';
import path from 'path';

export class WebServer {
    private server: http.Server;

    constructor(port: number) {
        this.server = http.createServer((req, res) => {
            if (req.url === '/') {
                const filePath = path.join('public', 'index.html');
                fs.readFile(filePath, (err, data) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Error loading index.html');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(data);
                    }
                });
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        this.server.listen(port, () => {
            console.log(`Web server is running on http://localhost:${port}`);
        });
    }

    public getServer(): http.Server {
        return this.server;
    }
}