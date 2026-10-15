const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'dashboard')));
app.use('/docs', express.static(path.join(__dirname, 'docs')));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', project: 'RefinAI', region: 'ap-south-1' });
});

wss.on('connection', (ws) => {
  console.log('[RefinAI] WebSocket client connected');
  ws.on('message', (message) => {
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`[RefinAI Server] Running on http://localhost:${PORT}`);
});
