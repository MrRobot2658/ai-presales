# Docker Compose Guide

Multi-service deployment: Hermes Agent gateway (API server) + Web UI + presales stack. No host Hermes install required.

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Enough disk for `nousresearch/hermes-agent` and the Web UI image

## Quick Start

### 1. Configure (optional)

```bash
cp .env.example .env
```

Edit `.env` to set `API_SERVER_KEY` (generate with `openssl rand -hex 32`) and adjust ports or data paths if needed.

First-time Hermes setup (API keys, profiles):

```bash
mkdir -p ./hermes_data
docker compose run --rm hermes-agent setup
```

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
| `npm run deploy:hot` | Build + copy `dist/` into running container + restart (fast iteration) |
| `npm run deploy:hot:fast` | Same as `deploy:hot` but skip build (reuse existing `dist/`) |

## Hot Deploy (local iteration)

When Docker Compose is already running, push code changes into the live container without rebuilding the image:

```bash
npm run deploy:hot
```

This runs `npm run build`, copies `dist/client/` and `dist/server/index.js` into `hermes-webui`, restarts `hermes-webui` (and `presales-worker` when its bundle exists), then waits for `/health`.

Coding agents should run this after runnable client/server changes unless the user opts out.

## Service

| Service | Description |
|---|---|
| `postgres` | PostgreSQL 16 for presales knowledge base metadata |
| `redis` | Redis 7 for presales knowledge ingest queue (BullMQ) |
| `hermes-agent` | Hermes gateway + OpenAI-compatible API server (`gateway run`) |
| `hermes-bridge` | Agent bridge broker (chat + presales generation) |
| `hermes-webui` | Web UI BFF; attaches to `hermes-bridge` and proxies to `hermes-agent` |
| `presales-worker` | Background worker: Agent cleans uploaded knowledge files |

The Web UI does **not** start its own gateway or agent bridge in Compose. It attaches to `hermes-bridge:18765` (chat) and proxies API routes to `hermes-agent:8642`.

## Environment Variables

Set in `.env` or the shell. Compose passes them into the container where noted.

| Variable | Default | Scope | Description |
|---|---|---|---|
| `WEBUI_IMAGE` | `hermes-web-ui-local:latest` | Compose | Image to run. Use `ekkoye8888/hermes-web-ui` for pre-built. |
| `HERMES_AGENT_IMAGE` | `nousresearch/hermes-agent:latest` | Compose + build | Hermes Agent image; also Dockerfile `BASE_IMAGE` when building locally |
| `HERMES_AGENT_CONTAINER_NAME` | `hermes-agent` | Compose | Hermes gateway container name |
| `WEBUI_CONTAINER_NAME` | `hermes-webui` | Compose | Web UI container name |
| `PORT` | `6060` | Host + container | Web UI listen and host mapping |
| `HERMES_GATEWAY_PORT` | `8642` | Host | Hermes API server host mapping |
| `GATEWAY_HOST` | `hermes-agent` | Web UI container | Compose hostname for upstream Hermes gateway |
| `API_SERVER_ENABLED` | `true` | Hermes Agent | Enable OpenAI-compatible API server |
| `API_SERVER_KEY` | (required) | Hermes Agent | Bearer token for API server (min 8 chars) |
| `BIND_HOST` | `0.0.0.0` | Container | Web UI bind address (`::` for IPv6) |
| `HERMES_BIN` | `/opt/hermes/.venv/bin/hermes` | Container | Hermes CLI path |
| `HERMES_DATA_DIR` | `./hermes_data` | Host | Persistent Hermes state (shared by all services) |
| `HERMES_PROFILE_NAME` | `jingdigital` | Compose | Hermes profile for presales content mount |
| `HERMES_PROFILE_CONTENT_DIR` | `./hermes_data/profiles/jingdigital/content` | Host | Profile `content/` bind mount (PPT, knowledge, drafts) |
| `POSTGRES_USER` | `aipresales` | Postgres | Database user |
| `POSTGRES_PASSWORD` | `aipresales` | Postgres | Database password (change in production) |
| `POSTGRES_DB` | `aipresales` | Postgres | Database name |
| `POSTGRES_PORT` | `5432` | Host | Postgres host mapping |
| `PG_DATA_DIR` | `./pg_data` | Host | Postgres data volume |
| `DATABASE_URL` | see `.env.example` | Container | Web UI BFF connection string |
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
| `${HERMES_GATEWAY_PORT}` (8642) | Hermes API server (OpenAI-compatible) |
| `${HERMES_BRIDGE_PORT}` (18765) | Hermes agent bridge (chat / presales) |
| `${POSTGRES_PORT}` (5432) | PostgreSQL (presales knowledge base) |
| `${REDIS_PORT}` (6380) | Redis (presales ingest queue; default 6380 if 6379 is taken) |
| 8651 | Update preview frontend (optional feature) |
| 56121 | xAI OAuth redirect callback |

## Data Persistence

| Host path | Container path(s) | Contents |
|---|---|---|
| `${HERMES_DATA_DIR}` | Web UI: `/home/agent/.hermes`; Agent: `/opt/data` | Hermes sessions, profiles, config (shared) |
| `${HERMES_DATA_DIR}/hermes-web-ui` | `/home/agent/.hermes-web-ui` | Web UI auth token, Web UI state |
| `${HERMES_PROFILE_CONTENT_DIR}` | Web UI/worker: `/home/agent/.hermes/profiles/${HERMES_PROFILE_NAME}/content`; Agent: `/opt/data/profiles/${HERMES_PROFILE_NAME}/content` | Presales content (PPT, knowledge, drafts) |
| `${PG_DATA_DIR}` | `/var/lib/postgresql/data` | PostgreSQL data (knowledge metadata) |

Knowledge base **files** (PDF/PPT/DOCX) live under `${HERMES_DATA_DIR}/profiles/{profile}/content/knowledge/raw/{assetId}/` (processed output in `.../processed/{assetId}/`); **metadata** lives in Postgres. See [presales/knowledge-base-schema.md](./presales/knowledge-base-schema.md).

- Auth token is created on first run and printed to logs.
- Delete `./hermes_data/hermes-web-ui/.token` and restart to rotate the token.

## Runtime Notes

- `HERMES_BIN` is read by `packages/server/src/services/hermes-cli.ts`; if unset, the server falls back to `hermes` on `PATH`.
- Compose disables in-container gateway autostart; `hermes-agent` owns the gateway, `hermes-bridge` owns chat/agent workers.
- Web UI sets `HERMES_AGENT_BRIDGE_EXTERNAL=1` and only attaches to `hermes-bridge` — **no host Hermes install required**.
- Set the same `API_SERVER_KEY` in `.env` and in profile `.env` under `${HERMES_DATA_DIR}/profiles/{profile}/.env` if the proxy needs to authenticate upstream.
- Health checks: Web UI `GET /health` on `${PORT}`; Hermes Agent `GET /health` on port 8642.

## Common Operations

```bash
# Recreate after .env or compose changes
docker compose up -d --force-recreate

# Shell inside containers
docker compose exec hermes-webui bash
docker compose exec hermes-agent bash

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
| Gateway proxy 503 | `docker compose logs hermes-agent`; confirm `curl -fsS http://127.0.0.1:8642/health` |
| Agent cannot read content files | Confirm `${HERMES_PROFILE_CONTENT_DIR}` exists on host and matches `HERMES_PROFILE_NAME` |
| Chat websocket error after stopping host Hermes | Use full Compose stack (`hermes-agent` + `hermes-bridge` + `hermes-webui`); do not rely on macOS IPC bridge at `/tmp/hermes-agent-bridge.sock` |
| Lost login token | `cat ./hermes_data/hermes-web-ui/.token` or grep container logs |

## Local dev against Docker Hermes

Run the Web UI on the host while Hermes gateway stays in Compose:

```bash
docker compose up -d hermes-agent hermes-bridge postgres redis
npm run dev
```

`nodemon.json` points the dev server at `127.0.0.1:18765` (bridge) and `127.0.0.1:8642` (gateway). Use `http://localhost:8649` for the Vite client, or the full stack at `http://localhost:6060`.

## 中文速查

```bash
cp .env.example .env          # 可选：复制环境变量模板
npm run docker:up             # 拉取预构建镜像并启动（推荐）
npm run docker:build          # 从源码构建并启动
npm run docker:logs           # 查看日志（含首次登录 token）
```

访问 `http://localhost:6060`，数据目录 `./hermes_data`，详细变量见上文表格。
