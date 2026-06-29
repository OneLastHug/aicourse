import { proxyToPython, usePythonBackend } from "@/lib/server/python-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Generations can take minutes; keep the stream open generously.
export const maxDuration = 18000; // 300 min

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (usePythonBackend()) return proxyToPython(_req, "/api/jobs/" + encodeURIComponent(id) + "/stream");
  return new Response("PY_BACKEND_URL is required for job streams", { status: 503 });
}
