import { NextResponse } from "next/server";
import { proxyToPython, usePythonBackend } from "@/lib/server/python-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (usePythonBackend()) return proxyToPython(req, "/api/generate");
  return NextResponse.json(
    { error: "PY_BACKEND_URL is required for course generation" },
    { status: 503 },
  );
}
