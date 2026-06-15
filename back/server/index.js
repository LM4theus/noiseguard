const http = require('http');
const path = require('path');
const express = require('express');
const WebSocket = require('ws');
const store = require('./store');
const { ingest } = require('./ingest');
const noiseRouter = require('./routes/noise');
const devicesRouter = require('./routes/devices');
const organizationsRouter = require('./routes/organizations');
const environmentsRouter = require('./routes/environments');

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
app.use('/api', devicesRouter);
app.use('/api', organizationsRouter);
app.use('/api', environmentsRouter);

// SSE clients list
const sseClients = [];

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Sem ?deviceId, o cliente recebe leituras de todos os dispositivos.
  res.deviceId = req.query.deviceId || null;
  sseClients.push(res);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// Broadcast por dispositivo para clientes SSE e WebSocket (browser).
store.emitter.on('data', ({ deviceId, point }) => {
  const payload = JSON.stringify(point);

  for (const client of sseClients) {
    if (!client.deviceId || client.deviceId === deviceId) {
      client.write(`data: ${payload}\n\n`);
    }
  }

  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN && ws._isBrowser &&
        (!ws._deviceId || ws._deviceId === deviceId)) {
      ws.send(payload);
    }
  }
});

const server = http.createServer(app);

// Mantém conexões keep-alive vivas bem mais que o intervalo de envio da ESP32.
// O padrão do Node (5s) colide com loops de envio de ~5s: o servidor fecha o
// socket ocioso no exato momento em que a ESP tenta reusá-lo, causando
// ESP_ERR_HTTP_CONNECT / "select() timeout" / "sock < 0" no cliente.
server.keepAliveTimeout = 65000; // 65s
server.headersTimeout   = 66000; // deve ser > keepAliveTimeout

const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  // Distingue clientes browser (apenas recebem) dos dispositivos (enviam).
  const url = new URL(req.url, `http://localhost`);
  ws._isBrowser = url.searchParams.get('client') === 'browser';
  ws._deviceId  = url.searchParams.get('deviceId') || null;

  ws.on('message', (raw) => {
    if (ws._isBrowser) return; // browser não ingere leituras
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (_) { return; }
    // deviceid pode vir na mensagem (numérico) ou na query da conexão.
    ingest({
      deviceId: msg.deviceid ?? msg.deviceId ?? ws._deviceId,
      db: msg.db,
      timestamp: msg.timestamp,
    }).catch(() => {}); // ingestão por WS é best-effort
  });
});

// Error handler (captura rejeições dos handlers async via async-handler).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// O schema/seed é responsabilidade das migrações (db/migrate.py), executadas
// antes do servidor (serviço "migrate" no docker-compose). Aqui só escutamos.
server.listen(PORT, () => {
  console.log(`NoiseGuard server running at http://localhost:${PORT}`);
});
