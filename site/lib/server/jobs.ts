import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { ProgressEvent } from "repo2learn/src/types";
import { generateCourse } from "./generate";
import {
  repoIdFor, saveCourse, removeCourse, saveJobRecord, listJobRecords,
  type CourseMeta, type JobRecord,
} from "./store";

export type JobStatus = "running" | "done" | "error";

/** In-memory job state (adds the live event buffer to the persisted record). */
export interface JobState extends JobRecord {
  events: ProgressEvent[];
}

interface Job { state: JobState; emitter: EventEmitter; }

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
        }
      }
    } catch {
      // ignore — fresh install has no records
    }
  }

  create(repoUrl: string, repoId: string): string {
    const id = randomUUID();
    const now = Date.now();
    const state: JobState = {
      id, repoUrl, repoId, status: "running", stage: "queued",
      lessonsTotal: 0, lessonsDone: 0, events: [],
      startedAt: now, updatedAt: now,
    };
    const emitter = new EventEmitter();
    emitter.setMaxListeners(100);
    this.jobs.set(id, { state, emitter });
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

  listRunning(): JobState[] {
    return [...this.jobs.values()].map((j) => j.state).filter((s) => s.status === "running");
  }

  get(id: string): JobState | undefined {
    return this.jobs.get(id)?.state;
  }

  emitter(id: string): EventEmitter | undefined {
    return this.jobs.get(id)?.emitter;
  }

  private emit(id: string, e: ProgressEvent): void {
    const job = this.jobs.get(id);
    if (!job) return;
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
      await removeCourse(repoId).catch(() => {});
      job.state.status = "error";
      job.state.error = (e as Error).message;
      this.emit(id, { type: "error", message: (e as Error).message });
      await saveJobRecord(job.state);
    } finally {
      this.runningByRepo.delete(repoId);
    }
  }
}

export const jobManager = new JobManager();
