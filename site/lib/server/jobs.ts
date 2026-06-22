import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { ProgressEvent } from "repo2learn/src/types";
import { generateCourse } from "./generate";
import {
  repoIdFor, saveCourse, removeCourse, removeRepoClone, getMeta,
  saveJobRecord, removeJobRecord, listJobRecords,
  type CourseMeta, type JobRecord,
} from "./store";

export type JobStatus = "running" | "done" | "error";

/** In-memory job state (adds the live event buffer to the persisted record). */
export interface JobState extends JobRecord {
  events: ProgressEvent[];
}

interface Job { state: JobState; emitter: EventEmitter; drafts: Record<string, unknown>; }

class JobManager {
  private jobs = new Map<string, Job>();
  /** repoId -> running jobId, for dedupe. */
  private runningByRepo = new Map<string, string>();

  constructor() {
    // Reconcile on startup: any "running" records belong to a dead process now.
    void this.reconcile();
  }

  private async reconcile(): Promise<void> {
    try {
      const recs = await listJobRecords();
      for (const r of recs) {
        if (r.status === "running") {
          r.status = "error";
          r.error = "interrupted (server restarted)";
          r.updatedAt = Date.now();
          await saveJobRecord(r);
          // Keep clone + cache so the job can be retried (manual or auto).
        }
      }
    } catch {
      // ignore — fresh install has no records
    }
  }

  create(repoUrl: string, repoId: string): string {
    // Clean up old failed records for this repo before starting fresh.
    void this.cleanupFailedForRepo(repoId);
    const id = randomUUID();
    const now = Date.now();
    const state: JobState = {
      id, repoUrl, repoId, status: "running", stage: "queued",
      lessonsTotal: 0, lessonsDone: 0, events: [],
      startedAt: now, updatedAt: now,
    };
    const emitter = new EventEmitter();
    emitter.setMaxListeners(100);
    this.jobs.set(id, { state, emitter, drafts: {} });
    this.runningByRepo.set(repoId, id);
    void saveJobRecord(state);
    void this.run(id, repoId);
    return id;
  }

  runningId(repoId: string): string | undefined {
    const id = this.runningByRepo.get(repoId);
    if (id && this.jobs.get(id)?.state.status === "running") return id;
    return undefined;
  }

  /** Dedupe lookup that also consults persisted records, so a repo whose job is
   *  tracked on disk (e.g. a different module instance, or before the in-memory
   *  map is warm) still joins the existing job instead of starting a new one. */
  async runningIdFor(repoId: string): Promise<string | undefined> {
    const inMem = this.runningId(repoId);
    if (inMem) return inMem;
    for (const r of await listJobRecords()) {
      if (r.repoId !== repoId || r.status !== "running") continue;
      const mem = this.get(r.id);
      if (!mem || mem.status === "running") return r.id;
    }
    return undefined;
  }

  listRunning(): JobState[] {
    return [...this.jobs.values()].map((j) => j.state).filter((s) => s.status === "running");
  }

  /** Running jobs for the dashboard, merging persisted records (durable, visible
   *  across instances and the source the homepage relies on) with in-memory
   *  state (freshest stage/progress). In-memory wins on conflict, and a job the
   *  live process knows has finished is dropped even if its record lags. */
  async listRunningMerged(): Promise<JobRecord[]> {
    const byId = new Map<string, JobRecord>();
    for (const r of await listJobRecords()) {
      if (r.status === "running") byId.set(r.id, r);
    }
    for (const s of this.listRunning()) byId.set(s.id, s);
    for (const [id] of byId) {
      const mem = this.get(id);
      if (mem && mem.status !== "running") byId.delete(id);
    }
    return [...byId.values()].sort((a, b) => b.startedAt - a.startedAt);
  }

  get(id: string): JobState | undefined {
    return this.jobs.get(id)?.state;
  }

  emitter(id: string): EventEmitter | undefined {
    return this.jobs.get(id)?.emitter;
  }

  getDraft(id: string, lessonId: string): unknown | undefined {
    return this.jobs.get(id)?.drafts[lessonId];
  }

  private emit(id: string, e: ProgressEvent): void {
    const job = this.jobs.get(id);
    if (!job) return;
    if (e.type === "lessonDraft") { job.drafts[e.id] = e.body; return; }
    job.state.events.push(e);
    if (e.type === "stage") job.state.stage = e.stage;
    else if (e.type === "plan") job.state.lessonsTotal = e.total;
    else if (e.type === "lesson" && (e.status === "ok" || e.status === "failed")) job.state.lessonsDone++;
    job.state.updatedAt = Date.now();
    job.emitter.emit("event", e);
    // Persist on meaningful state changes (not every event, to limit disk writes).
    if (
      e.type === "stage" ||
      e.type === "plan" ||
      (e.type === "lesson" && (e.status === "ok" || e.status === "failed")) ||
      e.type === "error"
    ) {
      void saveJobRecord(job.state);
    }
  }

  private async run(id: string, repoId: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;
    try {
      const course = await generateCourse({
        repoUrl: job.state.repoUrl,
        onProgress: (e) => this.emit(id, e),
      });
      job.state.repoTitle = course.outline.course.title.en;
      job.state.lessonsTotal = course.outline.lessons.length;
      job.state.status = "done";
      const meta: CourseMeta = {
        repoId, url: job.state.repoUrl, name: course.outline.course.repo.name,
        title: course.outline.course.title.en, createdAt: new Date().toISOString(),
        lessonCount: course.outline.lessons.length,
      };
      await saveCourse(repoId, course, meta);
      await saveJobRecord(job.state);
    } catch (e) {
      // Keep the clone + cache so a retry can resume from the last checkpoint.
      job.state.status = "error";
      job.state.error = (e as Error).message;
      this.emit(id, { type: "error", message: (e as Error).message });
      await saveJobRecord(job.state);
    } finally {
      this.runningByRepo.delete(repoId);
    }
  }

  /** List failed jobs (persisted, within 24h) for the dashboard. */
  async listFailed(): Promise<JobRecord[]> {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return (await listJobRecords()).filter((r) => r.status === "error" && r.updatedAt > cutoff);
  }

  /** Auto-retry: every 10 min, retry failed jobs whose repo isn't already running/done. */
  /** Delete all failed job records for a given repo (avoid duplicates on retry). */
  private async cleanupFailedForRepo(repoId: string): Promise<void> {
    for (const r of await listJobRecords()) {
      if (r.repoId === repoId && r.status === "error") await removeJobRecord(r.id).catch(() => {});
    }
  }

  async autoRetry(): Promise<void> {
    const failed = await this.listFailed();
    if (failed.length === 0) return;

    // Group failed jobs by repoId.
    const byRepo = new Map<string, JobRecord[]>();
    for (const r of failed) {
      const arr = byRepo.get(r.repoId);
      if (arr) arr.push(r); else byRepo.set(r.repoId, [r]);
    }

    for (const [repoId, records] of byRepo) {
      // Case 1: a completed course already exists for this repo.
      // → All failed records are redundant. Delete them (keep the course).
      if (await getMeta(repoId)) {
        for (const r of records) await removeJobRecord(r.id).catch(() => {});
        continue; // don't retry — course is done
      }

      // Case 2: multiple failed jobs for the same repo.
      // → Keep the one that progressed the furthest, delete the rest.
      let keeper = records[0]!;
      if (records.length > 1) {
        records.sort((a, b) => this.progressScore(b) - this.progressScore(a));
        keeper = records[0]!;
        for (const r of records.slice(1)) await removeJobRecord(r.id).catch(() => {});
      }

      // Case 3: retry the keeper (if not already running).
      if (await this.runningIdFor(repoId)) continue;
      console.warn("[repo2learn] auto-retrying: " + keeper.repoUrl);
      this.create(keeper.repoUrl, repoId);
    }
  }

  /** Higher = more progress. Stage ordinal dominates; lessonsDone breaks ties. */
  private progressScore(r: JobRecord): number {
    const order = ["queued","ingest","analyze","curriculum","lessons","validate1","validate2","translate","done"];
    return (order.indexOf(r.stage) >= 0 ? order.indexOf(r.stage) : 0) * 1000 + r.lessonsDone;
  }

  /** Auto-cleanup: every 1h, remove jobs stale > 24h (no progress). */
  async autoCleanup(): Promise<void> {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const r of await listJobRecords()) {
      if (r.updatedAt < cutoff) {
        await removeJobRecord(r.id).catch(() => {});
        if (!(await getMeta(r.repoId))) {
          await removeRepoClone(r.repoUrl).catch(() => {});
          await removeCourse(r.repoId).catch(() => {});
        }
      }
    }
  }
}

export const jobManager = new JobManager();

// Background timers (single-process next start). Guard against HMR duplicates.
declare const globalThis: { __r2lTimers?: boolean };
if (!globalThis.__r2lTimers && process.env.NEXT_RUNTIME === "nodejs") {
  globalThis.__r2lTimers = true;
  setInterval(() => { void jobManager.autoRetry(); }, 10 * 60 * 1000);
  setInterval(() => { void jobManager.autoCleanup(); }, 60 * 60 * 1000);
  // Run once at startup (after 30s delay to let the server settle).
  setTimeout(() => { void jobManager.autoRetry(); }, 30_000);
}
