# Python Backend Deployment

This document describes the deployment shape for the `python` branch.

## Services

Run the Python backend and Next.js frontend as separate long-running services:

```text
/api/* -> FastAPI 127.0.0.1:8000
/*     -> Next.js 127.0.0.1:3000
```

Use one Python worker for now. The current job manager keeps live event
subscribers in memory; multi-worker deployment requires moving job state and SSE
fanout to Redis or a database first.

## Backend Setup

```bash
cd /opt/aicourse/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
R2L_DATA_DIR=/var/lib/aicourse R2L_MOCK=0 ./run.sh
```

Use `R2L_MOCK=1` for a no-Codex smoke test.

## Frontend Setup

```bash
cd /opt/aicourse
npm install
npm -w site run build
PY_BACKEND_URL=http://127.0.0.1:8000 npm -w site run start
```

## systemd Backend Unit

```ini
[Unit]
Description=AICourse Python Backend
After=network.target

[Service]
WorkingDirectory=/opt/aicourse/backend
Environment=R2L_DATA_DIR=/var/lib/aicourse
Environment=R2L_MOCK=0
Environment=R2L_CODEX_BINARY=codex
Environment=R2L_CODEX_MODEL=gpt-5.4
Environment=R2L_CODEX_REASONING_EFFORT=xhigh
Environment=R2L_CODEX_CONCURRENCY=10
Environment=R2L_CODEX_HOME=/var/lib/aicourse/codex/generation
Environment=R2L_ASSISTANT_ENDPOINT=<set-in-private-environment>
Environment=R2L_ASSISTANT_MODEL=gpt-5.4-mini
ExecStart=/opt/aicourse/backend/run.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## systemd Frontend Unit

```ini
[Unit]
Description=AICourse Next Frontend
After=network.target aicourse-backend.service

[Service]
WorkingDirectory=/opt/aicourse
Environment=PY_BACKEND_URL=http://127.0.0.1:8000
Environment=R2L_DATA_DIR=/var/lib/aicourse
ExecStart=/usr/bin/npm -w site run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Reverse Proxy

For Caddy:

```caddyfile
example.com {
  reverse_proxy /api/* 127.0.0.1:8000
  reverse_proxy 127.0.0.1:3000
}
```

For Nginx, disable buffering for SSE:

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:8000;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_buffering off;
}

location / {
  proxy_pass http://127.0.0.1:3000;
}
```
