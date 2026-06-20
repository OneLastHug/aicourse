import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { ProgressEvent } from "repo2learn/src/types";
import { generateCourse } from "./generate";
import { repoIdFor, saveCourse, removeCourse, type CourseMeta } from "./store";

export type JobStatus = "running" | "done" | "error";

export interface JobState {
  id: string;
  repoUrl: string;
  repoId: string;
  status: JobStatus;
  stage: string;
  lessonsTotal: number;
  lessonsDone: number;
  events: ProgressEvent[];
  repoTitle?: string;
  error?: string;
  startedAt: number;
  updatedAt: number;
}

interface Job { state: JobState; emitter: EventEmitter; }

class JobManager {
  private jobs = new Map<string, Job>();
  /** repoId -> running jobId, for dedupe (one job per repo at a time). */
  private runningByRepo = new Map<string, string>();

  create(repoUrl: string, repoId: string): string {
    const id = randomUUID();
    const state: JobState = {
      id, repoUrl, repoId, status: "running", stage: "queued",
      lessonsTotal: 0, lessonsDone: 0, events: [],
      startedAt: Date.now(), updatedAt: Date.now(),
    };
    const emitter = new EventEmitter();
    emitter.setMaxListeners(100);
    this.jobs.set(id, { state, emitter });
    this.runningByRepo.set(repoId, id);
    void this.run(id, repoId);
    return id;
  }

  /** If a job is already running for this repo, return its id (dedupe). */
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
      const meta: CourseMeta = {
        repoId, url: job.state.repoUrl, name: course.outline.course.repo.name,
        title: course.outline.course.title.en, createdAt: new Date().toISOString(),
        lessonCount: course.outline.lessons.length,
      };
      await saveCourse(repoId, course, meta);
      job.state.status = "done";
    } catch (e) {
      // Clean any partial course so the frontend is as before generation.
      await removeCourse(repoId).catch(() => {});
      job.state.status = "error";
      job.state.error = (e as Error).message;
      this.emit(id, { type: "error", message: (e as Error).message });
    } finally {
      this.runningByRepo.delete(repoId);
    }
  }
}

export const jobManager = new JobManager();
