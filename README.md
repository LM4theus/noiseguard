# NoiseGuard MVP

Monitor de ruído em tempo real para ambientes internos (salas de aula, hospitais, escritórios).

---

## Como rodar

### 1. Instalar dependências e iniciar o servidor

```bash
cd back
npm install
npm start
```

Acesse o dashboard em **<http://localhost:3000>**

### 2. Capturar áudio pelo microfone (principal)

No dashboard, clique no botão **🎤 Microfone**. O browser solicita permissão de áudio e começa a enviar leituras ao servidor a cada 500 ms via Web Audio API.

### 3. Modo simulador (fallback sem microfone)

Com o servidor já rodando, execute em outro terminal:

```bash
npm run simulate
```

Envia leituras aleatórias via HTTP POST a cada 750 ms. Útil para testes sem microfone disponível.

### 4. Integração com ESP32

Configure o firmware do ESP32 com:

| Campo | Valor |
|---|---|
| URL | `http://<IP_DA_MÁQUINA>:3000/api/noise` |
| Método | POST |
| Content-Type | application/json |
| Body | `{"db": <LEITURA_DO_SENSOR>}` |
| Intervalo | 500 ms |

Para descobrir o IP da máquina na rede Wi-Fi: `ip a` (Linux/Mac) ou `ipconfig` (Windows).

### Teste rápido via curl

```bash
curl -X POST http://localhost:3000/api/noise \
  -H "Content-Type: application/json" \
  -d '{"db": 112}'
# {"status":"ok","level":"CRITICO"}
```

---

## Como o projeto funciona

### Arquitetura geral

```text
front/          ← interface web (HTML + JS puro, sem build)
back/
  server/
    index.js    ← servidor Express + WebSocket + SSE
    routes/
      noise.js  ← rotas REST (/api/noise, /api/history)
    store.js    ← buffer circular em memória (120 pontos)
    alerts.js   ← classificação dos níveis de ruído
    simulator.js← gerador de leituras fake (fallback)
```

O servidor Express (porta 3000) serve os arquivos de `front/` como arquivos estáticos. Não há processo separado para o frontend.

### Fluxo de uma leitura

```text
Fonte (microfone / ESP32 / curl)
        │
        ▼
POST /api/noise  {"db": 97.3}
        │
        ▼
classify(db) → "ATENCAO"
        │
        ▼
store.add(point)  → buffer circular (máx. 120 pontos, sem persistência)
        │
        ▼
emitter.emit('data', point)
        │
   ┌────┴────┐
   ▼         ▼
SSE         WebSocket
/events     /ws
   │
   ▼
Dashboard atualiza gauge, gráfico e tabela de eventos
```

### Captura de áudio no browser

`front/js/microphone.js` usa a Web Audio API:

1. Solicita acesso ao microfone (`getUserMedia`)
2. Lê o buffer de tempo de domínio via `AnalyserNode` a cada 500 ms
3. Calcula o RMS do sinal e converte para dB SPL com offset de calibração (+94)
4. Envia `POST /api/noise` com o valor calculado

### Transporte em tempo real

`front/js/api.js` usa SSE como transporte principal:

- Abre `EventSource /events` — o servidor mantém a conexão aberta e envia cada ponto novo
- Se o SSE falhar 3 vezes seguidas, cai em modo de **polling HTTP** (GET `/api/history` a cada 1 s)
- Ao reconectar o SSE, o polling é cancelado automaticamente

### Buffer e histórico

`store.js` mantém um buffer circular de 120 pontos em memória. Os dados são perdidos ao reiniciar o servidor. `GET /api/history` retorna todos os pontos na ordem cronológica.

### Classificação de níveis

Definida em `server/alerts.js`:

| Nível | Faixa | Cor |
|---|---|---|
| OK | < 94 dB | Verde |
| ATENÇÃO | 94 – 110 dB | Amarelo |
| CRÍTICO | > 110 dB | Vermelho |

### API

| Endpoint | Método | Descrição |
| --- | --- | --- |
| `/api/noise` | POST | Recebe leitura `{ "db": 97.3 }` |
| `/api/history` | GET | Retorna os últimos 120 pontos |
| `/events` | GET | Server-Sent Events (stream ao vivo) |
| `/ws` | WS | WebSocket (ESP32 envia `{"db": ...}`) |
