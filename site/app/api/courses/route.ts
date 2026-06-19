import { NextResponse } from "next/server";
import { listCourses } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ courses: await listCourses() });
}
