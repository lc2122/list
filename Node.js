const WebSocket = require('ws');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  ws.on('message', message => {
    // Handle WebRTC signaling messages
    console.log(`Received message: ${message}`);
  });

  ws.send(JSON.stringify({ message: 'Hello from server!' }));
});

server.listen(8080, () => {
  console.log('Signaling server running on port 8080');
});
