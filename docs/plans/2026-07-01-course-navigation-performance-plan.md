# Course Navigation Performance Plan

## Goal

Optimize page switching and course chapter switching without changing the
existing user-facing functionality, without breaking the Python backend
contract, and without interrupting tutorials that are currently generating.

The immediate product target is: clicking a course or lesson should give
instant feedback and feel responsive, even when the target lesson still needs
server rendering or client hydration work.

## Current Evidence

Measured on the running local production services:

- `aiwiki-course.service`: active, Next.js on `127.0.0.1:12834`.
- `aiwiki-course-backend.service`: active, FastAPI on `127.0.0.1:8000`.
- Completed course payloads in `/var/lib/aicourse/courses/*/course.json` are
  roughly `339KB` to `382KB`.
- Direct backend `/api/courses/:repoId` reads are fast, usually about `5-9ms`.
- Lesson page HTML responses through Next are usually about `60-170ms`, with
  larger lessons around `250KB` HTML.
- There is no route-level `loading.tsx` under `site/app`, so client navigation
  keeps the old page visible until the new route payload is ready.

Representative measurements:

```text
/en/c/autogen-1d8515/lessons/s01  ttfb=0.079s total=0.091s size=176KB
/en/c/autogen-1d8515/lessons/s02  ttfb=0.053s total=0.063s size=172KB
/en/c/cc-haha-74b2a1/lessons/s07 ttfb=0.120s total=0.132s size=252KB
/api/courses/autogen-1d8515      ttfb=0.004s total=0.005s
```

The measured server path is not slow enough to explain a multi-second stall by
itself. The observed "卡卡的" feeling is more likely caused by a combination of
missing navigation feedback, repeated full-course fetch/render work, and
client-side hydration/rendering work after the route arrives.

## Current Flow

Course and lesson pages currently use server components.

For every lesson navigation:

1. `site/app/[locale]/c/[repoId]/lessons/[id]/page.tsx` calls `getCourse(repoId)`.
2. `getCourse` calls the Python backend via `fetchPythonJson("/api/courses/:repoId")`.
3. The backend returns the full course JSON, not only the outline or lesson.
4. The server page finds the active lesson in that full course payload.
5. The lesson page renders the whole `CourseShell`.
6. The server highlights all `howItWorks` code blocks for that lesson with
   Shiki.
7. The client hydrates `Mermaid`, `StepSimulator`, `CodexTeacher`, and other
   client components.

This keeps the implementation simple, but it means chapter switching repeats
work that is mostly stable across lessons: outline/sidebar data, course title,
teacher shell props, and full-course JSON transfer.

## Constraints

The plan must preserve these behaviors:

- Existing course URLs stay valid:
  - `/:locale/c/:repoId`
  - `/:locale/c/:repoId/lessons/:id`
- Generated course JSON stays compatible with current stored files.
- The Python backend remains the source of truth for generated courses.
- Jobs currently running in `/var/lib/aicourse/jobs` must continue unaffected.
- Course generation writes the same durable artifacts first; any new derived
  read model must be optional or rebuildable.
- The Codex sidebar stays available and keeps using the active lesson context.
- Do not introduce a database migration as a prerequisite for the first
  performance improvement.

## Diagnosis

The main performance issues are architectural rather than a broken endpoint:

- No route-level loading UI means a click can look like it did nothing.
- Lesson navigation refetches the full course payload, even though most of the
  payload is not needed for the target lesson.
- `generateMetadata` also calls `getCourse(repoId)`, creating another full
  course read path for the same route.
- The whole `CourseShell` receives the full `course` object on each lesson page,
  so stable navigation UI is coupled to lesson content loading.
- Shiki highlighting happens during lesson page render. This is correct but
  adds per-navigation CPU work.
- Mermaid is dynamically imported and rendered client-side on each page that
  has diagrams.
- The homepage/running list polling can add background noise, but it is not the
  primary cause of chapter switching latency.

## Optimization Strategy

Use a staged approach. Each phase is independently deployable and should not
interrupt active generation jobs.

### Phase 1: Instant Navigation Feedback

Purpose: make clicks feel immediate with minimal behavioral risk.

Changes:

- Add route-level `loading.tsx` for:
  - `site/app/[locale]/c/[repoId]/loading.tsx`
  - `site/app/[locale]/c/[repoId]/lessons/[id]/loading.tsx`
- Keep the loading UI visually aligned with the current course layout:
  - stable top bar area
  - fixed sidebar placeholder on desktop
  - lesson title/content skeleton in the main column
- Add pending styling for lesson links only if it can be done without converting
  the entire sidebar into an expensive client component.
- Avoid changing route contracts or backend APIs in this phase.

Expected impact:

- Clicking a chapter immediately shows a transition state.
- Does not reduce backend work, but removes the "did my click register?"
  feeling.

Risk:

- Low. This is UI-only and does not touch generation or data format.

Verification:

- `npm run typecheck`
- `npm run site:build`
- Manual click between lessons on desktop and mobile width.
- Confirm active generation job state remains unchanged before/after deploy.

### Phase 2: Split Outline And Lesson Reads

Purpose: stop fetching the full course for every chapter switch.

Add backend read endpoints:

```text
GET /api/courses/:repoId/outline
GET /api/courses/:repoId/lessons/:lessonId
```

Suggested response shape:

```ts
type CourseOutlineResponse = {
  repoId: string;
  outline: Course["outline"];
};

type CourseLessonResponse = {
  repoId: string;
  lessonId: string;
  lesson: Course["lessons"][string];
  meta: Course["outline"]["lessons"][number];
  prev?: Course["outline"]["lessons"][number];
  next?: Course["outline"]["lessons"][number];
  total: number;
  index: number;
};
```

Keep the existing `GET /api/courses/:repoId` endpoint unchanged for backward
compatibility.

Next-side changes:

- Add `getCourseOutline(repoId)` and `getCourseLesson(repoId, lessonId)`.
- Course home can use outline only.
- Lesson page should load outline plus only the active lesson.
- `CourseShell` should accept a smaller outline-oriented prop rather than the
  entire `Course` object.

Expected impact:

- Lesson navigation avoids transferring/parsing `339-382KB` of course JSON on
  every click.
- Sidebar/course shell becomes stable data based on outline.
- Backend can continue storing only `course.json`; the new endpoints can read
  and slice the existing JSON at request time first.

Risk:

- Medium. This touches data access and route rendering, but can be introduced
  additively because the existing full-course endpoint remains available.

Verification:

- Existing course pages render from old generated `course.json` files.
- Existing `/api/courses/:repoId` still returns the same payload.
- New outline endpoint returns no lesson bodies.
- New lesson endpoint returns exactly one lesson body plus neighbors.
- `npm run typecheck`
- `npm run site:build`
- Backend pytest.

### Phase 3: Cache Server-Side Course Reads

Purpose: avoid repeated disk read/JSON parse/backend proxy work for stable
completed courses.

Options:

- In Python backend, add a small in-process cache keyed by `(repoId, mtime)`.
- In Next, add request-level caching for `fetchPythonJson` where safe.
- Prefer Python-side cache first because Python is the source of truth and is
  also used by API calls outside Next.

Invalidation:

- Completed course files are immutable for normal reads.
- If a course is regenerated, `course.json` mtime changes, invalidating the
  cache.
- Running jobs should not read from this cache until course save completes.

Expected impact:

- Faster repeated route transitions.
- Lower CPU from repeated JSON parsing.

Risk:

- Low to medium. The main risk is stale reads after regeneration; mtime-based
  invalidation addresses that without a manual cache clear.

Verification:

- Unit test cache invalidates after file mtime/content change.
- Manual regenerate same repo and confirm final course is visible.
- Confirm no change to job record behavior.

### Phase 4: Precompute Highlighted Lesson HTML

Purpose: remove Shiki work from the route render path.

Current behavior:

- `LessonPage` highlights `howItWorks` snippets and spine changes during every
  page render.

Safer approach:

- Introduce a derived render cache under:
  - `/var/lib/aicourse/render-cache/:repoId/:locale/:lessonId.json`
- Cache only derived HTML for stable generated lessons.
- Key the cache by a hash of:
  - lesson body
  - locale
  - highlighter version/config
  - rendering code version if practical

Do not write this derived cache during active course generation as a required
step. It should be lazy and rebuildable on read, so current running jobs are
not affected.

Expected impact:

- Reduces server CPU per chapter switch.
- Makes large code-heavy lessons more consistent.

Risk:

- Medium. Cached HTML must stay safe and must invalidate correctly.

Verification:

- Snapshot compare generated highlighted HTML before/after cache introduction.
- Delete render cache and confirm pages rebuild it.
- Build and typecheck.

### Phase 5: Client-Side Lesson Shell Persistence

Purpose: make chapter changes feel like instant in-app navigation.

After the data split is stable:

- Keep `CourseShell`, `Sidebar`, and `CodexTeacher` mounted across lesson
  changes where possible.
- Use a client-side lesson reader island for the main lesson body.
- Prefetch neighboring lessons (`prev` and `next`) after idle.
- Keep URL changes canonical with Next router.

This is intentionally later because it changes the rendering architecture more
than the previous phases.

Expected impact:

- Fastest perceived chapter switching.
- Sidebar active state can update immediately.
- Neighbor navigation can be nearly instant after prefetch.

Risk:

- Medium to high. This touches hydration, selection context for CodexTeacher,
  scroll restoration, and accessibility.

Verification:

- Browser performance trace for repeated lesson switching.
- Confirm text selection to CodexTeacher still works after route changes.
- Confirm direct URL load still works without prior client state.
- Confirm mobile layout remains correct.

## Rollout Plan

1. Ship Phase 1 first. It is low-risk and improves perceived responsiveness.
2. Ship Phase 2 behind additive backend endpoints. Keep the full-course endpoint
   until all pages are migrated.
3. Add Phase 3 cache after Phase 2 is stable, because smaller endpoint responses
   make cache correctness easier to reason about.
4. Add Phase 4 derived render cache only after measuring Shiki as a meaningful
   server CPU cost in production.
5. Consider Phase 5 only if Phase 1-4 do not make navigation feel instant enough.

## Safety Checks For Active Generation

Before deploying each phase:

- Record current running jobs:

```bash
curl -sS http://127.0.0.1:8000/api/dashboard
```

- Deploy/restart only the service required by the phase.
- Recheck the same dashboard output after deploy.
- Confirm job records in `/var/lib/aicourse/jobs` are not deleted or rewritten
  except by the existing job manager lifecycle.
- Avoid changing generation output schema in these performance phases.

## Success Metrics

Track these before and after each phase:

- Route click feedback appears within `50ms`.
- Same-course lesson switch reaches first visual loading/active state within
  `100ms`.
- Lesson route TTFB stays under `200ms` for existing courses on the server.
- New outline endpoint response stays below `80KB`.
- New lesson endpoint response stays below `80KB` for typical lessons.
- No increase in failed generation jobs after deploy.
- No 404s for existing course and lesson URLs.

## Recommended First Implementation Slice

Start with:

1. Add route `loading.tsx` files for course and lesson pages.
2. Add backend `outline` and `lesson` read endpoints with tests.
3. Add Next data helpers for outline/lesson while keeping `getCourse`.
4. Migrate `CourseShell` to accept outline-level props.
5. Migrate lesson page to fetch outline + active lesson only.

This slice keeps generated data unchanged, keeps active jobs safe, and directly
addresses the two strongest causes of the current sluggish feel: no immediate
feedback and full-course reads on every chapter switch.
