# Docker Compose Guide

Single-container deployment: Hermes Web UI + integrated Hermes Agent runtime.

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Enough disk for the base image (`nousresearch/hermes-agent`) when building from source

## Quick Start

### 1. Configure (optional)

```bash
cp .env.example .env
```

Edit `.env` if you need a custom port or data directory. Defaults work for a first run.

### 2. Start

**Pre-built image (recommended):**

```bash
npm run docker:up
# or
docker compose pull && docker compose up -d
```

**Build from source:**

```bash
npm run docker:build
# or
docker compose up -d --build
```

### 3. Open and authenticate

- Dashboard: `http://localhost:6060` (or `http://localhost:${PORT}`)
- First-run auth token: container logs or `./hermes_data/hermes-web-ui/.token`

```bash
npm run docker:logs
# or
docker compose logs -f hermes-webui
docker compose logs hermes-webui | grep -i token
```

## npm Scripts

| Script | Action |
|---|---|
| `npm run docker:up` | Start detached (Compose pulls missing images) |
| `npm run docker:pull` | Pull configured image before restart |
| `npm run docker:build` | Build image from source and start |
| `npm run docker:logs` | Follow `hermes-webui` logs |
| `npm run docker:down` | Stop and remove container |
| `npm run docker:recreate` | Force recreate container |

## Service

| Service | Description |
|---|---|
| `postgres` | PostgreSQL 16 for presales knowledge base metadata |
| `redis` | Redis 7 for presales knowledge ingest queue (BullMQ) |
| `hermes-webui` | Web UI + Hermes Agent (from pre-built image or local build) |
| `presales-worker` | Background worker: Agent cleans uploaded knowledge files |

Built on `nousresearch/hermes-agent`. Web UI performs startup gateway checks for profiles; this compose file does **not** expose Hermes gateway ports.

## Environment Variables

Set in `.env` or the shell. Compose passes them into the container where noted.

| Variable | Default | Scope | Description |
|---|---|---|---|
| `WEBUI_IMAGE` | `hermes-web-ui-local:latest` | Compose | Image to run. Use `ekkoye8888/hermes-web-ui` for pre-built. |
| `HERMES_AGENT_IMAGE` | `nousresearch/hermes-agent:latest` | Build | Dockerfile `BASE_IMAGE` when building locally |
| `WEBUI_CONTAINER_NAME` | `hermes-webui` | Compose | Container name |
| `PORT` | `6060` | Host + container | Web UI listen and host mapping |
| `BIND_HOST` | `0.0.0.0` | Container | Web UI bind address (`::` for IPv6) |
| `HERMES_BIN` | `/opt/hermes/.venv/bin/hermes` | Container | Hermes CLI path |
| `HERMES_DATA_DIR` | `./hermes_data` | Host | Persistent data mount |
| `POSTGRES_USER` | `aipresales` | Postgres | Database user |
| `POSTGRES_PASSWORD` | `aipresales` | Postgres | Database password (change in production) |
| `POSTGRES_DB` | `aipresales` | Postgres | Database name |
| `POSTGRES_PORT` | `5432` | Host | Postgres host mapping |
| `PG_DATA_DIR` | `./pg_data` | Host | Postgres data volume |
| `DATABASE_URL` | see `.env.example` | Container | Web UI BFF connection string (when PG client is wired) |
| `PREVIEW_FRONTEND_PORT` | `8651` | Host | In-app update preview (Vite) |
| `XAI_OAUTH_PORT` | `56121` | Host | xAI OAuth callback |

Examples:

```bash
PORT=16060 docker compose up -d
HERMES_DATA_DIR=/data/hermes docker compose up -d
```

## Port Mapping

| Port | Description |
|---|---|
| `${PORT}` (6060) | Web UI dashboard |
| `${POSTGRES_PORT}` (5432) | PostgreSQL (presales knowledge base) |
| `${REDIS_PORT}` (6380) | Redis (presales ingest queue; default 6380 if 6379 is taken) |
| 8651 | Update preview frontend (optional feature) |
| 56121 | xAI OAuth redirect callback |

No Hermes gateway ports are published by this compose file.

## Data Persistence

| Host path | Container path | Contents |
|---|---|---|
| `${HERMES_DATA_DIR}` | `/home/agent/.hermes` | Hermes sessions, profiles, config |
| `${HERMES_DATA_DIR}/hermes-web-ui` | `/home/agent/.hermes-web-ui` | Web UI auth token, Web UI state |
| `${PG_DATA_DIR}` | `/var/lib/postgresql/data` | PostgreSQL data (knowledge metadata) |

Knowledge base **files** (PDF/PPT/DOCX) will live under `${HERMES_DATA_DIR}/hermes-web-ui/knowledge/` once the presales API is implemented; **metadata** lives in Postgres. See [presales/knowledge-base-schema.md](./presales/knowledge-base-schema.md).

- Auth token is created on first run and printed to logs.
- Delete `./hermes_data/hermes-web-ui/.token` and restart to rotate the token.

## Runtime Notes

- `HERMES_BIN` is read by `packages/server/src/services/hermes-cli.ts`; if unset, the server falls back to `hermes` on `PATH`.
- Docker uses managed gateway mode: startup gateway checks only, no periodic recovery loop.
- Health check: `GET /health` on the Web UI port (see `docker-compose.yml`).

## Common Operations

```bash
# Recreate after .env or compose changes
docker compose up -d --force-recreate

# Shell inside container
docker compose exec hermes-webui bash

# Stop and remove container (keeps ./hermes_data)
docker compose down
```

## Troubleshooting

| Symptom | Things to check |
|---|---|
| Port already in use | Change `PORT` in `.env` |
| Cannot open UI from Windows/WSL | Keep `BIND_HOST=0.0.0.0`; use `http://127.0.0.1:${PORT}` |
| Build OOM | Ensure Docker has ≥ 8 GB RAM; image build sets `NODE_OPTIONS=--max-old-space-size=4096` |
| Stale image after pull | `docker compose pull && docker compose up -d --force-recreate` |
| Lost login token | `cat ./hermes_data/hermes-web-ui/.token` or grep container logs |

## 中文速查

```bash
cp .env.example .env          # 可选：复制环境变量模板
npm run docker:up             # 拉取预构建镜像并启动（推荐）
npm run docker:build          # 从源码构建并启动
npm run docker:logs           # 查看日志（含首次登录 token）
```

访问 `http://localhost:6060`，数据目录 `./hermes_data`，详细变量见上文表格。
