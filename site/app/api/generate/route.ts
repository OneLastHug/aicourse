import { NextResponse } from "next/server";
import { jobManager } from "@/lib/server/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRepoUrl(u: string): boolean {
  const s = u.trim();
  return /^https?:\/\/[^\s]+/.test(s) || /^git@[^\s]+:[^\s]+/.test(s);
}

export async function POST(req: Request) {
  let body: { repoUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const repoUrl = (body.repoUrl ?? "").trim();
  if (!repoUrl) return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });
  if (!isRepoUrl(repoUrl)) {
    return NextResponse.json(
      { error: "please provide a full git URL, e.g. https://github.com/owner/repo" },
      { status: 400 },
    );
  }
  const id = jobManager.create(repoUrl);
  const state = jobManager.get(id)!;
  return NextResponse.json({ id, repoId: state.repoId });
}
