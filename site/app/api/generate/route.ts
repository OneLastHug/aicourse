import { NextResponse } from "next/server";
import { jobManager } from "@/lib/server/jobs";
import { getCourse, repoIdFor } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRepoUrl(u: string): boolean {
  const s = u.trim();
  return /^https?:\/\/[^\s]+/.test(s) || /^git@[^\s]+:[^\s]+/.test(s);
}

export async function POST(req: Request) {
  try {
    let body: { repoUrl?: string };
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
    }
    const repoUrl = (body.repoUrl ?? "").trim();
    if (!repoUrl) return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });
    if (!isRepoUrl(repoUrl)) {
      return NextResponse.json({ error: "please provide a full git URL, e.g. https://github.com/owner/repo" }, { status: 400 });
    }

    const repoId = repoIdFor(repoUrl);

    // Dedupe: already generated -> go straight to the course.
    if (await getCourse(repoId)) return NextResponse.json({ ready: true, repoId });

    // Dedupe: a job is already running for this repo -> join it.
    const running = await jobManager.runningIdFor(repoId);
    if (running) return NextResponse.json({ ready: false, id: running, repoId });

    const id = jobManager.create(repoUrl, repoId);
    return NextResponse.json({ ready: false, id, repoId });
  } catch (e) {
    return NextResponse.json({ error: "internal error: " + (e as Error).message }, { status: 500 });
  }
}
