import { NextResponse } from "next/server";
import { proxyToPython, usePythonBackend } from "@/lib/server/python-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  if (usePythonBackend()) return proxyToPython(_req, "/api/jobs/" + encodeURIComponent(id) + "/lessons/" + encodeURIComponent(lessonId));
  return NextResponse.json(
    { error: "PY_BACKEND_URL is required for lesson drafts" },
    { status: 503 },
  );
}
