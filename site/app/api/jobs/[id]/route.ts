import { NextResponse } from "next/server";
import { proxyToPython, usePythonBackend } from "@/lib/server/python-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (usePythonBackend()) return proxyToPython(_req, "/api/jobs/" + encodeURIComponent(id));
  return NextResponse.json({ error: "PY_BACKEND_URL is required for job state" }, { status: 503 });
}
