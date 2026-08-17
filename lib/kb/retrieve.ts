import { embedTexts } from "./embed";
import { faissSearch } from "./faiss";
import { bm25Search, rrfMerge } from "./bm25";
import { chunksByIds, getKbDoc, kbChunkCount, listKbChunks } from "./repo";
import { readFullStore } from "./qdrant";

export type KbHit = {
  id: string;
  heading: string;
  text: string;
  filename: string;
  score: number;
};

export async function hybridSearch(query: string, k = 8): Promise<KbHit[]> {
  const chunks = listKbChunks();
  if (!chunks.length) return [];

  const bm25 = bm25Search(
    query,
    chunks.map((c) => ({ id: c.id, text: `${c.heading}\n${c.text}` })),
    k,
  );

  let dense: Array<{ id: string; score: number }> = [];
  try {
    const [vec] = await embedTexts([query]);
    dense = await faissSearch(vec, k);
  } catch {
    dense = bruteForce(query, k);
  }

  const fused = rrfMerge([bm25, dense], k);
  const rows = chunksByIds(fused.map((f) => f.id));
  const docs = new Map(rows.map((r) => [r.id, r]));
  const scoreMap = new Map(fused.map((f) => [f.id, f.score]));

  return fused
    .map((f) => docs.get(f.id))
    .filter(Boolean)
    .map((c) => ({
      id: c!.id,
      heading: c!.heading,
      text: c!.text,
      filename: getKbDoc(c!.doc_id)?.filename || c!.doc_id,
      score: scoreMap.get(c!.id) || 0,
    }));
}

function bruteForce(query: string, k: number) {
  const points = readFullStore();
  if (!points.length) return [];
  const q = query.slice(0, 200);
  return points
    .map((p) => ({
      id: p.id,
      score: overlap(`${p.payload.heading} ${p.payload.text}`, q),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function overlap(a: string, b: string) {
  const A = new Set(a.slice(0, 400));
  let n = 0;
  for (const ch of b.slice(0, 80)) if (A.has(ch)) n += 1;
  return n;
}

export async function knowledgeContext(query: string) {
  if (!kbChunkCount()) return "";
  const hits = await hybridSearch(query, 10);
  if (!hits.length) return "";
  return hits
    .map((h, i) => `[档案${i + 1} · ${h.heading}]\n${h.text}`)
    .join("\n\n");
}
