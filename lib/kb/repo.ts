import { all, get, nowIso, run } from "@/lib/db";

export type KbDocRow = {
  id: string;
  filename: string;
  mime: string;
  kind: string;
  path: string;
  status: string;
  error: string | null;
  summary: string;
  chunk_count: number;
  created_at: string;
};

export type KbChunkRow = {
  id: string;
  doc_id: string;
  ordinal: number;
  heading: string;
  text: string;
  tags: string;
  created_at: string;
};

export function insertKbDoc(row: KbDocRow) {
  run(
    `INSERT INTO kb_docs (id, filename, mime, kind, path, status, error, summary, chunk_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.filename,
      row.mime,
      row.kind,
      row.path,
      row.status,
      row.error,
      row.summary,
      row.chunk_count,
      row.created_at,
    ],
  );
}

export function updateKbDoc(
  id: string,
  patch: Partial<{ status: string; error: string | null; summary: string; chunk_count: number }>,
) {
  const cur = getKbDoc(id);
  if (!cur) return;
  run(
    `UPDATE kb_docs SET status=?, error=?, summary=?, chunk_count=? WHERE id=?`,
    [
      patch.status ?? cur.status,
      patch.error === undefined ? cur.error : patch.error,
      patch.summary ?? cur.summary,
      patch.chunk_count ?? cur.chunk_count,
      id,
    ],
  );
}

export function getKbDoc(id: string) {
  return get<KbDocRow>("SELECT * FROM kb_docs WHERE id = ?", [id]);
}

export function listKbDocs() {
  return all<KbDocRow>("SELECT * FROM kb_docs ORDER BY created_at DESC");
}

export function insertKbChunks(
  rows: Array<{
    id: string;
    doc_id: string;
    ordinal: number;
    heading: string;
    text: string;
    tags: string;
  }>,
) {
  for (const r of rows) {
    run(
      `INSERT INTO kb_chunks (id, doc_id, ordinal, heading, text, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.doc_id, r.ordinal, r.heading, r.text, r.tags, nowIso()],
    );
  }
}

export function listKbChunks() {
  return all<KbChunkRow>("SELECT * FROM kb_chunks ORDER BY created_at ASC");
}

export function chunksByIds(ids: string[]) {
  if (!ids.length) return [] as KbChunkRow[];
  const map = new Map(listKbChunks().map((c) => [c.id, c]));
  return ids.map((id) => map.get(id)).filter((c): c is KbChunkRow => Boolean(c));
}

export function deleteKbDoc(id: string) {
  run("DELETE FROM kb_chunks WHERE doc_id = ?", [id]);
  run("DELETE FROM kb_docs WHERE id = ?", [id]);
}

export function kbChunkCount() {
  const row = get<{ n: number }>("SELECT COUNT(*) as n FROM kb_chunks");
  return Number(row?.n || 0);
}
