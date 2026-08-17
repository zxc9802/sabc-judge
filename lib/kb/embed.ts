const BASE = process.env.LLM_BASE_URL || "https://api.openlux.ai/v1";
const KEY = () => process.env.LLM_API_KEY || "";
const MODEL = process.env.EMBEDDING_MODEL || "gemini-embedding-2-preview";
const GEMINI_EMBED_URL =
  process.env.EMBEDDING_URL ||
  "https://api.openlux.ai/v1beta/models/gemini-embedding-2-preview:embedContent";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  try {
    return await embedOpenAI(texts);
  } catch {
    const out: number[][] = [];
    for (const t of texts) out.push(await embedGeminiNative(t));
    return out;
  }
}

async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${BASE.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });
  const json = (await res.json()) as {
    data?: Array<{ embedding: number[] }>;
    error?: { message?: string };
  };
  if (!res.ok || !json.data?.length) {
    throw new Error(json.error?.message || `embedding ${res.status}`);
  }
  return json.data.sort((a, b) => 0).map((d) => d.embedding);
}

async function embedGeminiNative(text: string): Promise<number[]> {
  const res = await fetch(GEMINI_EMBED_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  });
  const json = (await res.json()) as {
    embedding?: { values?: number[] };
    error?: { message?: string };
  };
  const values = json.embedding?.values;
  if (!res.ok || !values?.length) {
    throw new Error(json.error?.message || `gemini embed ${res.status}`);
  }
  return values;
}

export function embeddingDim(vec: number[]) {
  return vec.length;
}
