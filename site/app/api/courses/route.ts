import { NextResponse } from "next/server";
import { listCourses } from "@/lib/server/store";
import { proxyToPython, usePythonBackend } from "@/lib/server/python-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (usePythonBackend()) return proxyToPython(new Request("http://local/api/courses"), "/api/courses");

  return NextResponse.json({ courses: await listCourses() });
}
