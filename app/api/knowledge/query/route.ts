import { hybridSearch } from "@/lib/kb/retrieve";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { q?: string };
  const q = (body.q || "").trim();
  if (!q) return NextResponse.json({ error: "请输入问题" }, { status: 400 });
  const hits = await hybridSearch(q, 8);
  return NextResponse.json({ hits });
}
