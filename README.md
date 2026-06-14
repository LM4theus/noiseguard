# NoiseGuard

Monitor de ruído em tempo real para ambientes internos (salas de aula, hospitais, escritórios), com hierarquia **Organização → Ambiente → Dispositivo** e leituras reais persistidas em PostgreSQL.

## Início rápido (Docker)

A partir da raiz do repositório:

```bash
docker compose up -d --build          # sobe PostgreSQL + servidor
docker compose --profile dev up -d    # (opcional) simulador, popula dados reais
```

Acesse **<http://localhost:3000>**. O banco é criado e populado automaticamente no primeiro boot; os dados ficam no volume `pgdata`.

Parar: `docker compose down` (ou `down -v` para zerar o banco).

## Estrutura

```text
docker-compose.yml   ← PostgreSQL + servidor + simulador (perfil dev)
back/                ← API Express + camada de dados (Postgres)
front/               ← interface web (HTML/CSS/JS puro, sem build)
materials/           ← documentos do projeto (canvas, fluxograma, sprints)
```

## Telas

- **Organizações** → **Ambientes** → **Planta baixa** → **Monitor do dispositivo** (gauge, gráfico e eventos em tempo real).
- Telas de gestão: 🏢 Organizações, 📍 Ambientes, ⚙️ Dispositivos.
- Tema Dark/White.

## Documentação completa

Detalhes de execução, arquitetura, banco de dados, formato de envio do ESP32 e referência da API estão em **[back/README.md](back/README.md)**.
