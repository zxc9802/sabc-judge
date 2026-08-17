import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { nowIso } from "@/lib/db";
import { parseBuffer } from "@/lib/parse";
import { sliceKnowledge } from "./chunk";
import { embedTexts } from "./embed";
import { faissAdd, faissRebuild } from "./faiss";
import { extractMediaText, fileKind } from "./media";
import { qdrantDeleteByDoc, qdrantUpsert, readFullStore } from "./qdrant";
import { deleteKbDoc, insertKbChunks, insertKbDoc, updateKbDoc } from "./repo";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export async function ingestKnowledgeFile(file: File) {
  const kind = fileKind(file.name);
  const id = nanoid(12);
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name).toLowerCase() || ".bin";
  const storedPath = path.join(UPLOAD_DIR, `${id}${ext}`);
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(storedPath, buf);

  insertKbDoc({
    id,
    filename: file.name,
    mime: file.type || "",
    kind,
    path: storedPath,
    status: "processing",
    error: null,
    summary: "",
    chunk_count: 0,
    created_at: nowIso(),
  });

  try {
    let text = "";
    if (kind === "image" || kind === "video") {
      text = await extractMediaText({ filename: file.name, storedPath, buf });
    } else {
      text = await parseBuffer(file.name, buf);
      if (!text) throw new Error("文档解析失败，请改贴文本或换一份可复制的文件");
    }
    if (!text.trim()) throw new Error("没有抽出可用文本");

    const drafts = await sliceKnowledge({ filename: file.name, kind, text });
    const vectors = await embedTexts(drafts.map((d) => `${d.heading}\n${d.text}`));
    const chunks = drafts.map((d, i) => ({
      id: crypto.randomUUID(),
      doc_id: id,
      ordinal: i,
      heading: d.heading,
      text: d.text,
      tags: JSON.stringify(d.tags || []),
      vector: vectors[i],
    }));

    insertKbChunks(chunks.map(({ vector: _v, ...row }) => row));
    await qdrantUpsert(
      chunks.map((c) => ({
        id: c.id,
        vector: c.vector,
        payload: {
          chunkId: c.id,
          docId: id,
          filename: file.name,
          heading: c.heading,
          text: c.text,
          tags: JSON.parse(c.tags),
        },
      })),
    );
    await faissAdd(chunks.map((c) => ({ id: c.id, vector: c.vector })));

    const summary = drafts
      .slice(0, 3)
      .map((d) => d.heading)
      .join(" · ");
    updateKbDoc(id, { status: "ready", summary, chunk_count: chunks.length, error: null });
    return { id, filename: file.name, kind, chunks: chunks.length, summary };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    updateKbDoc(id, { status: "failed", error: msg });
    throw err;
  }
}

export async function deleteKnowledgeDoc(id: string) {
  deleteKbDoc(id);
  await qdrantDeleteByDoc(id);
  const rest = readFullStore();
  await faissRebuild(rest.map((p) => ({ id: p.id, vector: p.vector })));
}
