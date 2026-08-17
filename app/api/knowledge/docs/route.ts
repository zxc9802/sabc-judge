import { listKbDocs } from "@/lib/kb/repo";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ docs: listKbDocs() });
}
