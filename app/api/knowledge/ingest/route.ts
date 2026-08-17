import { ingestKnowledgeFile } from "@/lib/kb/ingest";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) return NextResponse.json({ error: "请拖入文件" }, { status: 400 });
    const results = [];
    for (const file of files) {
      try {
        results.push({ ok: true, ...(await ingestKnowledgeFile(file)) });
      } catch (err) {
        results.push({
          ok: false,
          filename: file.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
