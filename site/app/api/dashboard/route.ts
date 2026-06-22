import { NextResponse } from "next/server";
import { jobManager } from "@/lib/server/jobs";
import { listCourses } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const runningRecs = await jobManager.listRunningMerged();
  const running = runningRecs.map((s) => ({
    id: s.id, repoId: s.repoId, repoUrl: s.repoUrl, stage: s.stage,
    lessonsDone: s.lessonsDone, lessonsTotal: s.lessonsTotal, startedAt: s.startedAt,
  }));

  const failedRecs = await jobManager.listFailed();
  const failed = failedRecs.map((f) => ({
    id: f.id, repoId: f.repoId, repoUrl: f.repoUrl, errorMsg: f.error || "",
    updatedAt: f.updatedAt, stage: f.stage, lessonsDone: f.lessonsDone, lessonsTotal: f.lessonsTotal,
  }));

  const courses = await listCourses();
  return NextResponse.json({ running, failed, courses });
}
