import { startResearch } from "@/engine/orchestrator";
import { resetEvaluationArtifacts } from "@/lib/reset";
import { getEvaluation, setEvaluation } from "@/lib/store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const ev = getEvaluation(id);
  if (!ev) return NextResponse.json({ error: "not found" }, { status: 404 });
  resetEvaluationArtifacts(id);
  setEvaluation(id, { status: "researching", error: null, searchCount: 0, grade: null, verdict: null });
  void startResearch(id);
  return NextResponse.json({ ok: true });
}
