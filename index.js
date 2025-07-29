const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Create an HTTP server
const server = app.listen(PORT, () => {
  console.log(`🌐 Backend server running on port ${PORT}`);
});

// WebSocket setup
const wss = new WebSocketServer({ server });

// In-memory map to keep track of connected machines
const machineConnections = new Map(); // machineId => socket

wss.on('connection', (ws, req) => {
  console.log('🔌 WebSocket connected');

  // Log headers for debugging
  console.log('Connection headers:', req.headers);

  // Handle incoming messages from clients (vending machines)
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'register') {
        const { machineId } = message;
        machineConnections.set(machineId, ws);
        console.log(`✅ Registered machine: ${machineId}`);
      }
    } catch (err) {
      console.error('❌ Error parsing message:', err);
    }
  });

  // Handle connection close
  ws.on('close', () => {
    for (const [id, socket] of machineConnections.entries()) {
      if (socket === ws) {
        machineConnections.delete(id);
        console.log(`❌ Machine disconnected: ${id}`);
        break;
      }
    }
  });

  // Handle any errors
  ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err);
  });
});

// Endpoint to receive webhooks
app.post('/webhook', (req, res) => {
  const event = req.body;
  console.log('📥 Received webhook:', event);

  const machineId = event.metadata?.machineId;
  const slot = event.metadata?.slot;
  const products = event.metadata?.products;

  if (event.status === 'CAPTURED' && machineId && slot && products) {
    const socket = machineConnections.get(machineId);
    if (socket) {
      socket.send(JSON.stringify({ type: 'dispense', slot, products }));
      console.log(`✅ Sent dispense command to machine ${machineId}, slot ${slot}`);
    } else {
      console.log(`⚠️ No machine connected with ID ${machineId}`);
    }
  }

  res.sendStatus(200);
});
