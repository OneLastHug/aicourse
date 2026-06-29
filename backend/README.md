# AICourse Python Backend

This backend is the Python migration target for the existing Next.js API routes.
It keeps the browser-facing API contract stable:

- `POST /api/generate`
- `GET /api/dashboard`
- `GET /api/courses`
- `GET /api/courses/{repo_id}`
- `GET /api/jobs/{id}`
- `GET /api/jobs/{id}/stream`
- `GET /api/jobs/{id}/lessons/{lesson_id}`
- `POST /api/codex/query`

The first migration stage runs a mock generator that writes the same `course.json`
shape the existing frontend renders. With `R2L_MOCK=0`, the backend uses the
Python repo-ingest/Codex pipeline in `app/services/pipeline`.

The real pipeline is split into stage modules:

- `analyze.py`
- `curriculum.py`
- `spine.py`
- `lesson.py`
- `validate.py`
- `translate.py`
- `run.py`

Prompt builders live in `app/prompts/`, matching the migration plan's separation
between orchestration and prompt text.

The current Python implementation preserves the frontend/API contract and
produces schema-valid `Course` JSON through these stages:

```text
repo ingest -> analyze -> curriculum outline -> lesson bodies -> spine events -> validate -> translate/finalize
```

The old TypeScript pipeline still has deeper prompt specialization for lesson
read/write and Chinese-first translation. Those prompts can now be ported
stage-by-stage without changing the API routes or job manager.

## Development

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
R2L_MOCK=1 uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Use the existing Next.js frontend with:

```bash
cd ../site
PY_BACKEND_URL=http://127.0.0.1:8000 npm run dev
```

## Codex Teacher Sidebar

The course UI can call `POST /api/codex/query` for selected-text explanation.
By default it uses the local `codex exec` configuration. For domestic or
proxy-based deployments, point it at any OpenAI-compatible chat endpoint:

```bash
R2L_ASSISTANT_PROVIDER=openai
R2L_ASSISTANT_BASE_URL=https://your-compatible-endpoint.example.com/v1
R2L_ASSISTANT_API_KEY=sk-...
R2L_ASSISTANT_MODEL=your-model-name
R2L_ASSISTANT_TIMEOUT_MS=90000
```

`R2L_MOCK=1` keeps the route usable with a local teacher-style fallback, so the
frontend can be tested without a live model provider.

## Production Shape

Run FastAPI and Next.js as separate services:

```text
/api/* -> FastAPI 127.0.0.1:8000
/*     -> Next.js 127.0.0.1:3000
```

Use one FastAPI worker for the current in-memory job manager. A multi-worker
deployment should first move job state and SSE fanout to Redis or a database.
