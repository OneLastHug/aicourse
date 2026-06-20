import { NextResponse } from "next/server";
import { jobManager } from "@/lib/server/jobs";
import { listCourses } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const running = jobManager.listRunning().map((s) => ({
    id: s.id, repoId: s.repoId, repoUrl: s.repoUrl, stage: s.stage,
    lessonsDone: s.lessonsDone, lessonsTotal: s.lessonsTotal, startedAt: s.startedAt,
  }));
  const courses = await listCourses();
  return NextResponse.json({ running, courses });
}
