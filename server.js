const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

const THRESHOLDS = {
  MAX_AT: 32.0,
  MIN_PE: 410.0,
  MAX_V: 72.0
};

// Serve static assets
app.use('/docs', express.static(path.join(__dirname, 'docs')));
app.use('/ml', express.static(path.join(__dirname, 'ml')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'dashboard')));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', project: 'RefinAI', region: 'ap-south-1' });
});

wss.on('connection', (ws) => {
  console.log('[RefinAI] WebSocket client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      let alerts = [];
      if (data.AT && data.AT > THRESHOLDS.MAX_AT) alerts.push(`CRITICAL: High Temp (${data.AT}°C)`);
      if (data.PE && data.PE < THRESHOLDS.MIN_PE) alerts.push(`WARNING: Low Output (${data.PE} MW)`);
      if (data.V && data.V > THRESHOLDS.MAX_V) alerts.push(`CRITICAL: High Vacuum (${data.V} cm Hg)`);

      const maxPossiblePe = 480.0 - (1.8 * (data.AT || 25.0));
      const efficiency = data.PE ? ((data.PE / maxPossiblePe) * 100).toFixed(1) : 81.7;

      const enrichedPayload = JSON.stringify({
        ...data,
        efficiency: efficiency,
        riskIndex: alerts.length > 0 ? 85 : 15,
        status: alerts.length > 0 ? 'ELEVATED_MONITORING' : 'OPTIMAL',
        alerts: alerts,
        timestamp: new Date().toLocaleTimeString()
      });

      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(enrichedPayload);
        }
      });
    } catch (e) {
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message.toString());
        }
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`[RefinAI Server] Running on http://localhost:3000`);
});
