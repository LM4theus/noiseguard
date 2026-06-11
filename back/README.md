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
| Body | `{"deviceId": "<DEVICE_ID>", "db": <LEITURA_DO_SENSOR>}` |
| Intervalo | 500 ms |

O `deviceId` deve corresponder a um dispositivo cadastrado na tela **⚙️ Dispositivos**. A leitura é roteada para aquele dispositivo e classificada pelos limiares dele. Se o `deviceId` for omitido, a leitura cai no dispositivo virtual `default` (compatibilidade com firmware legado); se for informado mas não existir no registro, a resposta é **404**.

Para descobrir o IP da máquina na rede Wi-Fi: `ip a` (Linux/Mac) ou `ipconfig` (Windows).

### Teste rápido via curl

```bash
curl -X POST http://localhost:3000/api/noise \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "comp", "db": 97}'
# {"status":"ok","deviceId":"comp","level":"CRITICO"}
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
      noise.js  ← rotas de leitura (/api/noise, /api/history)
      devices.js← CRUD do registro (/api/registry, /api/devices)
    ingest.js   ← ingestão compartilhada (valida + resolve deviceId + classifica)
    registry.js ← registro persistente de ambientes/dispositivos (data/registry.json)
    store.js    ← buffer circular em memória, por dispositivo (120 pontos cada)
    alerts.js   ← classificação dos níveis (limiares por dispositivo)
    simulator.js← gerador de leituras fake (fallback; aceita DEVICE_ID)
```

O servidor Express (porta 3000) serve os arquivos de `front/` como arquivos estáticos. Não há processo separado para o frontend.

### Fluxo de uma leitura

```text
Fonte (microfone / ESP32 / curl)
        │
        ▼
POST /api/noise  {"deviceId": "comp", "db": 97.3}
        │
        ▼
ingest() → resolve deviceId no registro → classify(db, limiares do dispositivo) → "CRITICO"
        │
        ▼
store.add(deviceId, point)  → buffer circular POR dispositivo (máx. 120 pontos, sem persistência)
        │
        ▼
emitter.emit('data', { deviceId, point })
        │
   ┌────┴────┐
   ▼         ▼
SSE         WebSocket
/events     /ws
(filtrados por ?deviceId)
   │
   ▼
Monitor do dispositivo atualiza gauge, gráfico e tabela de eventos
```

### Captura de áudio no browser

`front/js/microphone.js` usa a Web Audio API:

1. Solicita acesso ao microfone (`getUserMedia`)
2. Lê o buffer de tempo de domínio via `AnalyserNode` a cada 500 ms
3. Calcula o RMS do sinal e converte para dB SPL com offset de calibração (+94)
4. Envia `POST /api/noise` com o valor calculado

### Transporte em tempo real

`front/js/api.js` usa SSE como transporte principal:

- Abre `EventSource /events?deviceId=<id>` — o servidor mantém a conexão aberta e envia cada ponto novo daquele dispositivo
- Se o SSE falhar 3 vezes seguidas, cai em modo de **polling HTTP** (GET `/api/history?deviceId=<id>` a cada 1 s)
- Ao reconectar o SSE, o polling é cancelado automaticamente

### Buffer e histórico

`store.js` mantém um buffer circular de 120 pontos **por dispositivo** em memória. Os dados são perdidos ao reiniciar o servidor. `GET /api/history?deviceId=<id>` retorna os pontos daquele dispositivo na ordem cronológica.

### Classificação de níveis

Definida em `server/alerts.js`. Cada dispositivo tem seus próprios limiares (`warnThreshold` / `critThreshold`), configuráveis na tela de gestão. Para leituras sem dispositivo registrado, usa-se o padrão global:

| Nível | Faixa (padrão) | Cor |
|---|---|---|
| OK | < 94 dB | Verde |
| ATENÇÃO | 94 – 110 dB | Amarelo |
| CRÍTICO | > 110 dB | Vermelho |

### API

| Endpoint | Método | Descrição |
| --- | --- | --- |
| `/api/noise` | POST | Recebe leitura `{ "deviceId": "comp", "db": 97.3 }` (deviceId opcional → `default`) |
| `/api/history` | GET | Retorna os pontos do dispositivo (`?deviceId=<id>`) |
| `/api/registry` | GET | Ambientes + dispositivos cadastrados |
| `/api/devices` | GET/POST | Lista / cria dispositivo |
| `/api/devices/:id` | PUT/DELETE | Edita / remove dispositivo |
| `/events` | GET | Server-Sent Events ao vivo (`?deviceId=<id>` para filtrar) |
| `/ws` | WS | WebSocket — ESP32 envia `{"deviceId": "...", "db": ...}` |
