const http = require('http');
const path = require('path');
const express = require('express');
const WebSocket = require('ws');
const store = require('./store');
const noiseRouter = require('./routes/noise');

const PORT = process.env.PORT || 3000;
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', '..', 'front')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'front', 'index.html'));
});
app.use('/api', noiseRouter);

// SSE clients list
const sseClients = [];

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// Broadcast to SSE and WebSocket clients on every new reading
store.emitter.on('data', (point) => {
  const payload = JSON.stringify(point);

  for (const client of sseClients) {
    client.write(`data: ${payload}\n\n`);
  }

  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN && ws._isBrowser) {
      ws.send(payload);
    }
  }
});

const server = http.createServer(app);

const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  // Distinguish browser clients (no custom header) from ESP32 by query param
  const url = new URL(req.url, `http://localhost`);
  const isBrowser = url.searchParams.get('client') === 'browser';
  ws._isbrowser = isBrowser;

  ws.on('message', (raw) => {
    try {
      const { db, timestamp } = JSON.parse(raw.toString());
      if (typeof db !== 'number' || db < 0 || db > 140) return;

      const { classify } = require('./alerts');
      const level = classify(db);
      const point = { db, timestamp: timestamp || Date.now(), level };
      store.add(point);
    } catch (_) {}
  });
});

server.listen(PORT, () => {
  console.log(`NoiseGuard server running at http://localhost:${PORT}`);
});
