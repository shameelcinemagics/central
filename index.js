const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// HTTP Server
const server = app.listen(PORT, () => {
  console.log(`🌐 Backend server running on port ${PORT}`);
});

// WebSocket Server
const wss = new WebSocketServer({ server });

// Map to track machines: machineId => ws
const machineConnections = new Map();

function heartbeat() {
  this.isAlive = true;
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      // Register machine
      if (message.type === 'register') {
        const { machineId } = message;
        machineConnections.set(machineId, ws);
        console.log(`✅ Registered machine: ${machineId}`);
      }

      // Optional: frontend sends dispense command
      if (message.type === 'dispense') {
        const { machineId, slotNumber, products } = message;
        const machineSocket = machineConnections.get(machineId);
        if (machineSocket) {
          machineSocket.send(JSON.stringify({ type: 'dispense', slotNumber, products }));
          console.log(`✅ Dispense sent to ${machineId} slot ${slot\number}`);
        } else {
          console.log(`⚠️ Machine not connected: ${machineId}`);
        }
      }
    } catch (err) {
      console.error('❌ Error parsing message:', err);
    }
  });

  ws.on('close', () => {
    for (const [id, socket] of machineConnections.entries()) {
      if (socket === ws) {
        machineConnections.delete(id);
        console.log(`❌ Machine disconnected: ${id}`);
      }
    }
  });

  ws.on('error', (err) => console.error('❌ WebSocket error:', err));
});

// Ping every 30s to keep connections alive
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Optional: webhook endpoint (e.g., from Tap Payments)
app.post('/webhook', (req, res) => {
  const event = req.body;
  const machineId = event.metadata?.machineId;
  const slot = event.metadata?.slot;
  const products = event.metadata?.products;

  if (event.status === 'CAPTURED' && machineId && slot) {
    const ws = machineConnections.get(machineId);
    if (ws) {
      ws.send(JSON.stringify({ type: 'dispense', slot, products }));
      console.log(`✅ Dispense via webhook to ${machineId} slot ${slot}`);
    } else {
      console.log(`⚠️ Machine not connected: ${machineId}`);
    }
  }

  res.sendStatus(200);
});
