import fs from "node:fs";
import path from "node:path";

export type QdrantPoint = {
  id: string;
  vector: number[];
  payload: {
    chunkId: string;
    docId: string;
    filename: string;
    heading: string;
    text: string;
    tags: string[];
  };
};

const FULL_PATH = path.join(process.cwd(), "data", "kb", "qdrant-full.jsonl");
const COLLECTION = "sabc_kb";

function qdrantUrl() {
  return (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(/\/$/, "");
}

function appendFull(points: QdrantPoint[]) {
  fs.mkdirSync(path.dirname(FULL_PATH), { recursive: true });
  const lines = points.map((p) => JSON.stringify(p)).join("\n") + "\n";
  fs.appendFileSync(FULL_PATH, lines);
}

export function readFullStore(): QdrantPoint[] {
  if (!fs.existsSync(FULL_PATH)) return [];
  return fs
    .readFileSync(FULL_PATH, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as QdrantPoint);
}

export function rewriteFullStore(points: QdrantPoint[]) {
  fs.mkdirSync(path.dirname(FULL_PATH), { recursive: true });
  fs.writeFileSync(FULL_PATH, points.map((p) => JSON.stringify(p)).join("\n") + (points.length ? "\n" : ""));
}

async function qdrantUp() {
  try {
    const res = await fetch(`${qdrantUrl()}/collections`, { signal: AbortSignal.timeout(800) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureCollection(dim: number) {
  await fetch(`${qdrantUrl()}/collections/${COLLECTION}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vectors: { size: dim, distance: "Cosine" } }),
  }).catch(() => null);
}

export async function qdrantUpsert(points: QdrantPoint[]) {
  if (!points.length) return { qdrant: false };
  appendFull(points);
  const live = await qdrantUp();
  if (!live) return { qdrant: false };
  await ensureCollection(points[0].vector.length);
  const res = await fetch(`${qdrantUrl()}/collections/${COLLECTION}/points?wait=true`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Qdrant upsert ${res.status}: ${t.slice(0, 200)}`);
  }
  return { qdrant: true };
}

export async function qdrantDeleteByDoc(docId: string) {
  const kept = readFullStore().filter((p) => p.payload.docId !== docId);
  rewriteFullStore(kept);
  const live = await qdrantUp();
  if (!live) return;
  await fetch(`${qdrantUrl()}/collections/${COLLECTION}/points/delete?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filter: { must: [{ key: "docId", match: { value: docId } }] } }),
  }).catch(() => null);
}
