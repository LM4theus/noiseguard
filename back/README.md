# NoiseGuard MVP

Monitor de ruído em tempo real para ambientes internos (salas de aula, hospitais, escritórios).

---

## Como rodar (Docker — recomendado)

Tudo sobe com Docker Compose (Node + PostgreSQL) a partir da raiz do repositório:

```bash
docker compose up -d --build
```

Acesse o dashboard em **<http://localhost:3000>**. O banco é criado e populado
(seed) automaticamente no primeiro boot; os dados ficam no volume `pgdata` e
sobrevivem a reinícios.

### Popular com dados (simulador de dispositivos)

Sem ESP32 físico, suba o simulador (perfil `dev`), que envia leituras **reais**
para todos os dispositivos cadastrados:

```bash
docker compose --profile dev up -d
```

Para parar tudo: `docker compose down` (ou `down -v` para zerar o banco também).

> **Rodar sem Docker:** é preciso um PostgreSQL acessível e a variável
> `DATABASE_URL` (ex.: `postgres://noiseguard:noiseguard@localhost:5432/noiseguard`).
> Então `cd back && npm install && npm start`. O Docker já cuida disso.

### Capturar áudio pelo microfone

No monitor de um dispositivo, clique em **🎤 Microfone**. O browser pede permissão
de áudio e passa a enviar leituras (com o `deviceId` daquela tela) a cada 500 ms.

### Integração com ESP32

Configure o firmware do ESP32 com:

| Campo | Valor |
|---|---|
| URL | `http://<IP_DA_MÁQUINA>:3000/api/noise` |
| Método | POST |
| Content-Type | application/json |
| Body | `{"deviceid": <ID_NUMÉRICO>, "db": <LEITURA>, "timestamp": <EPOCH_MS>}` |
| Intervalo | 500 ms |

Exemplo de payload enviado pelo dispositivo:

```json
{"deviceid":10034,"db":72.4,"timestamp":1700000000000}
```

- `deviceid` (numérico) deve corresponder a um dispositivo cadastrado na tela **⚙️ Dispositivos** (o id pode ser numérico, ex.: `10034`). Se omitido → dispositivo virtual `default`; se informado e não existir no registro → **404**.
- `timestamp` é o momento em que o **dispositivo** gerou a leitura (epoch em ms); o servidor armazena esse valor. Se ausente/ inválido, usa a hora do servidor.
- A leitura é classificada pelos limiares (`warnThreshold`/`critThreshold`) daquele dispositivo.

Para descobrir o IP da máquina na rede Wi-Fi: `ip a` (Linux/Mac) ou `ipconfig` (Windows).

### Teste rápido via curl

```bash
curl -X POST http://localhost:3000/api/noise \
  -H "Content-Type: application/json" \
  -d '{"deviceid": 10034, "db": 72.4, "timestamp": 1700000000000}'
# {"status":"ok","deviceId":"10034","level":"ATENCAO"}
```

---

## Como o projeto funciona

### Arquitetura geral

```text
docker-compose.yml ← db (PostgreSQL) + server + simulator (perfil dev)
back/
  Dockerfile
  server/
    index.js        ← Express + WebSocket + SSE (init do banco no boot)
    db/
      pool.js       ← conexão com o Postgres (DATABASE_URL)
      init.js       ← cria o schema e faz o seed inicial (idempotente)
    routes/
      noise.js        ← leituras (/api/noise, /api/history, /api/readings/latest)
      devices.js      ← CRUD de dispositivos (/api/registry, /api/devices)
      organizations.js← CRUD de organizações (/api/organizations)
      environments.js ← CRUD de ambientes (/api/environments)
    ingest.js   ← ingestão compartilhada (valida + resolve deviceId + classifica)
    registry.js ← cadastro (organizações → ambientes → dispositivos) no Postgres
    store.js    ← leituras (série temporal) no Postgres + emitter p/ tempo real
    alerts.js   ← classificação dos níveis (limiares por dispositivo)
    simulator.js← envia leituras reais p/ todos os dispositivos (perfil dev)
front/          ← interface web (HTML + JS puro, sem build)
```

O servidor Express (porta 3000) serve os arquivos de `front/` como arquivos estáticos e persiste tudo (cadastro + leituras) no PostgreSQL. Não há processo separado para o frontend.

### Fluxo de uma leitura

```text
Fonte (microfone / ESP32 / curl)
        │
        ▼
POST /api/noise  {"deviceid": 10034, "db": 72.4, "timestamp": 1700000000000}
        │
        ▼
ingest() → resolve deviceid no registro → classify(db, limiares do dispositivo) → "ATENCAO"
        │
        ▼
store.add(deviceId, point)  → INSERT na tabela readings (Postgres, persistido)
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

### Persistência e histórico

Tudo é persistido no **PostgreSQL** (tabelas `organizations`, `environments`, `devices`, `readings`), no volume Docker `pgdata` — sobrevive a reinícios. `GET /api/history?deviceId=<id>` retorna os últimos 120 pontos daquele dispositivo (ordem cronológica) e `GET /api/readings/latest` retorna a última leitura de cada dispositivo (consumido pelas telas de lista para mostrar **dB real**).

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
| `/api/noise` | POST | Recebe leitura `{ "deviceid": 10034, "db": 72.4, "timestamp": 1700000000000 }` (deviceid opcional → `default`; timestamp do dispositivo é respeitado) |
| `/api/history` | GET | Retorna os pontos do dispositivo (`?deviceId=<id>`) |
| `/api/registry` | GET | Organizações + ambientes + dispositivos cadastrados |
| `/api/organizations` | GET/POST | Lista (com contagens) / cria organização |
| `/api/organizations/:id` | PUT/DELETE | Edita / remove organização (409 se tiver ambientes) |
| `/api/environments` | GET/POST | Lista (`?orgId=` filtra) / cria ambiente |
| `/api/environments/:id` | PUT/DELETE | Edita / remove ambiente (409 se tiver dispositivos) |
| `/api/devices` | GET/POST | Lista / cria dispositivo |
| `/api/devices/:id` | PUT/DELETE | Edita / remove dispositivo |
| `/events` | GET | Server-Sent Events ao vivo (`?deviceId=<id>` para filtrar) |
| `/ws` | WS | WebSocket — ESP32 envia `{"deviceid": 10034, "db": ..., "timestamp": ...}` |
