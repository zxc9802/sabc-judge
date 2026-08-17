import { deleteKnowledgeDoc } from "@/lib/kb/ingest";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  await deleteKnowledgeDoc(id);
  return NextResponse.json({ ok: true });
}
