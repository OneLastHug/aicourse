import { NextResponse } from "next/server";
import { localTeacherAnswer, type CodexAssistantRequest } from "@/lib/codex-assistant";
import { proxyToPython, usePythonBackend } from "@/lib/server/python-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (usePythonBackend()) return proxyToPython(req, "/api/codex/query");

  let body: CodexAssistantRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  return NextResponse.json(localTeacherAnswer(body));
}

