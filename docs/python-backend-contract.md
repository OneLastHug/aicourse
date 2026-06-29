# Python Backend API Contract

This document records the browser-facing contract preserved by the Python
backend migration. The frontend should continue to call `/api/*`; in local
development those requests can be proxied by Next.js to FastAPI through
`PY_BACKEND_URL`.

Concrete examples are stored next to this document:

- `docs/course-schema.example.json`
- `docs/progress-events.example.json`

## Environment

```bash
R2L_DATA_DIR=/var/lib/aicourse
R2L_MOCK=1
R2L_CODEX_BINARY=codex
R2L_CODEX_MODEL=gpt-5.5
R2L_CODEX_REASONING_EFFORT=xhigh
R2L_CODEX_CONCURRENCY=5
R2L_ASSISTANT_PROVIDER=codex
R2L_ASSISTANT_BASE_URL=
R2L_ASSISTANT_API_KEY=
R2L_ASSISTANT_MODEL=
PY_BACKEND_URL=http://127.0.0.1:8000
```

`R2L_MOCK=1` uses the Python mock generator. `R2L_MOCK=0` uses the Python
repo-ingest/Codex pipeline.

The non-mock pipeline is Chinese-first, matching the v2 TypeScript generation
contract:

```text
ingest -> analyze -> curriculum(ZhOutline) -> lessons(ZhLesson) -> spine
  -> validate1(Zh schema) -> validate2(repo alignment) -> translate(Bi Course)
  -> done
```

Only the final translated `Course` JSON is persisted and returned to the
frontend. Intermediate `ZhOutline` and `ZhLesson` drafts may appear in
`lessonDraft` progress events while generation is running.

## Endpoints

### `POST /api/generate`

Request:

```json
{
  "repoUrl": "https://github.com/owner/repo"
}
```

Course already exists:

```json
{
  "ready": true,
  "repoId": "repo-xxxxxx"
}
```

Job started or joined:

```json
{
  "ready": false,
  "id": "job-id",
  "repoId": "repo-xxxxxx"
}
```

Errors:

```json
{ "error": "invalid JSON body" }
{ "error": "repoUrl is required" }
{ "error": "please provide a full git URL, e.g. https://github.com/owner/repo" }
```

### `GET /api/dashboard`

Response:

```json
{
  "running": [
    {
      "id": "job-id",
      "repoId": "repo-xxxxxx",
      "repoUrl": "https://github.com/owner/repo",
      "stage": "lessons",
      "lessonsDone": 3,
      "lessonsTotal": 10,
      "startedAt": 1710000000000
    }
  ],
  "failed": [
    {
      "id": "job-id",
      "repoId": "repo-xxxxxx",
      "repoUrl": "https://github.com/owner/repo",
      "errorMsg": "message",
      "updatedAt": 1710000000000,
      "stage": "validate1",
      "lessonsDone": 3,
      "lessonsTotal": 10
    }
  ],
  "courses": [
    {
      "repoId": "repo-xxxxxx",
      "url": "https://github.com/owner/repo",
      "name": "repo",
      "title": "Course title",
      "createdAt": "2026-06-29T00:00:00.000Z",
      "lessonCount": 10
    }
  ]
}
```

### `GET /api/courses`

Response:

```json
{
  "courses": []
}
```

### `GET /api/courses/{repoId}`

Returns a complete `Course` JSON object:

```json
{
  "outline": {
    "course": {},
    "sections": [],
    "lessons": []
  },
  "lessons": {}
}
```

### `GET /api/jobs/{id}`

Response:

```json
{
  "id": "job-id",
  "repoUrl": "https://github.com/owner/repo",
  "repoId": "repo-xxxxxx",
  "status": "running",
  "stage": "lessons",
  "lessonsDone": 3,
  "lessonsTotal": 10,
  "events": [],
  "startedAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

### `GET /api/jobs/{id}/stream`

SSE stream:

```text
data: {"type":"stage","stage":"ingest","label":"Cloning & mapping the repo"}

data: {"type":"plan","total":10,"lessons":[]}

: ping
```

Response headers:

```http
content-type: text/event-stream; charset=utf-8
cache-control: no-cache, no-transform
connection: keep-alive
x-accel-buffering: no
```

### `GET /api/jobs/{id}/lessons/{lessonId}`

Returns the in-memory lesson draft emitted by `lessonDraft` progress events.

Not ready:

```json
{
  "error": "draft not ready"
}
```

### `POST /api/codex/query`

Used by the Codex AI teacher sidebar for selected-text explanation.

Request:

```json
{
  "question": "解释这段代码",
  "mode": "explain",
  "context": {
    "repoId": "repo-xxxxxx",
    "locale": "zh",
    "courseTitle": "Course title",
    "lessonId": "s01",
    "lessonTitle": "Agent 循环",
    "selectionText": "while true",
    "selectionKind": "code",
    "surroundingText": "nearby paragraph or code",
    "codeFile": "src/loop.ts",
    "codeLanguage": "ts",
    "activeStep": "判断结束"
  },
  "history": [
    { "role": "user", "content": "上一轮问题" },
    { "role": "assistant", "content": "上一轮回答" }
  ]
}
```

Response:

```json
{
  "answer": "中文教师式解释",
  "summary": "一句话总结",
  "highlights": ["关键点1", "关键点2"],
  "followUps": ["可以继续问的问题"],
  "references": [
    { "label": "s01 Agent 循环", "href": null }
  ],
  "provider": "codex"
}
```

Domestic/provider-friendly deployment can use any OpenAI-compatible endpoint:

```bash
R2L_ASSISTANT_PROVIDER=openai
R2L_ASSISTANT_BASE_URL=https://your-compatible-endpoint.example.com/v1
R2L_ASSISTANT_API_KEY=sk-...
R2L_ASSISTANT_MODEL=your-model-name
```

## Progress Events

The stream and `JobState.events` use the existing event contract:

```json
{ "type": "stage", "stage": "ingest", "label": "Cloning & mapping the repo" }
{ "type": "plan", "total": 10, "lessons": [] }
{ "type": "lesson", "id": "s01", "status": "start" }
{ "type": "lessonDraft", "id": "s01", "body": {} }
{ "type": "spine", "id": "s01", "status": "ok" }
{ "type": "validation", "round": 1, "passed": true, "issueCount": 0 }
{ "type": "log", "level": "info", "message": "..." }
{ "type": "error", "message": "..." }
```

The Python real pipeline emits stages in this order:

```text
ingest -> analyze -> curriculum -> lessons -> spine -> validate1 -> validate2 -> translate -> done
```

## Data Layout

The Python backend writes the same persistent layout as the current server:

```text
R2L_DATA_DIR/
├─ courses/{repoId}/course.json
├─ courses/{repoId}/meta.json
├─ jobs/{jobId}.json
├─ repos/
└─ cache/
```
