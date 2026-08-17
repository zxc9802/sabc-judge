import { getEvaluation, listEvidence, listLogs, listOpinions } from "@/lib/store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const ev = getEvaluation(id);
  if (!ev) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    evaluation: ev,
    evidence: listEvidence(id),
    opinions: listOpinions(id),
    logs: listLogs(id),
  });
}
