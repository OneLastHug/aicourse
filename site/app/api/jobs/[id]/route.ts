import { NextResponse } from "next/server";
import { jobManager } from "@/lib/server/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = jobManager.get(id);
  if (!state) return NextResponse.json({ error: "job not found" }, { status: 404 });
  return NextResponse.json(state);
}
