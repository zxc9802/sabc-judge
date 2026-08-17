import { listProjects } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ projects: listProjects() });
}
