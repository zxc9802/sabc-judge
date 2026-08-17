import { getEvaluation } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const a = url.searchParams.get("a");
  const b = url.searchParams.get("b");
  if (!a || !b) return NextResponse.json({ error: "需要两个评级 id" }, { status: 400 });
  const left = getEvaluation(a);
  const right = getEvaluation(b);
  if (!left || !right) return NextResponse.json({ error: "评级不存在" }, { status: 404 });
  return NextResponse.json({ left, right });
}
