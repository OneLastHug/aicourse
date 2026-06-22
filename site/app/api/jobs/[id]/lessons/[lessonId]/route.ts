import { NextResponse } from "next/server";
import { jobManager } from "@/lib/server/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  const draft = jobManager.getDraft(id, lessonId);
  if (!draft) return NextResponse.json({ error: "draft not ready" }, { status: 404 });
  return NextResponse.json(draft);
}
