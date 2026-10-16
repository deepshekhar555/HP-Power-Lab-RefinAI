const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Operational Safe Thresholds
const THRESHOLDS = {
  MAX_AT: 32.0,   // Max Ambient Temperature (°C)
  MIN_PE: 410.0,  // Min Net Power Output (MW)
  MAX_V: 72.0     // Max Exhaust Vacuum (cm Hg)
};

app.use(express.static(path.join(__dirname, 'dashboard')));
app.use('/docs', express.static(path.join(__dirname, 'docs')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', project: 'RefinAI', region: 'ap-south-1' });
});

// WebSocket stream processing & alert relay
wss.on('connection', (ws) => {
  console.log('[RefinAI] WebSocket client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      // Calculate risk index & trigger alerts if telemetry exceeds limits
      let alerts = [];
      if (data.AT && data.AT > THRESHOLDS.MAX_AT) {
        alerts.push(`CRITICAL: Ambient Temp high (${data.AT}°C)`);
      }
      if (data.PE && data.PE < THRESHOLDS.MIN_PE) {
        alerts.push(`WARNING: Low power output yield (${data.PE} MW)`);
      }
      if (data.V && data.V > THRESHOLDS.MAX_V) {
        alerts.push(`CRITICAL: High exhaust vacuum pressure (${data.V} cm Hg)`);
      }

      const enrichedPayload = JSON.stringify({
        ...data,
        riskIndex: alerts.length > 0 ? 85 : 15,
        status: alerts.length > 0 ? 'ELEVATED_MONITORING' : 'OPTIMAL',
        alerts: alerts
      });

      // Broadcast payload to all connected dashboard frontend clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(enrichedPayload);
        }
      });
    } catch (e) {
      // Fallback plain string passthrough
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message.toString());
        }
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`[RefinAI Server] Running on http://localhost:${PORT}`);
});
