export type Bm25Doc = { id: string; text: string };

function tokenize(text: string) {
  const lower = text.toLowerCase();
  const tokens: string[] = lower.match(/[a-z0-9]+/g) || [];
  const cjk = [...lower].filter((ch) => /[\u4e00-\u9fa5]/.test(ch)).join("");
  for (let i = 0; i < cjk.length; i += 1) {
    tokens.push(cjk[i]);
    if (i + 1 < cjk.length) tokens.push(cjk.slice(i, i + 2));
  }
  return tokens.filter(Boolean);
}

export function bm25Search(query: string, docs: Bm25Doc[], k = 8) {
  const qTokens = tokenize(query);
  if (!qTokens.length || !docs.length) return [] as Array<{ id: string; score: number }>;
  const N = docs.length;
  const tfDocs = docs.map((d) => {
    const tf = new Map<string, number>();
    const toks = tokenize(d.text);
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    return { id: d.id, tf, len: toks.length || 1 };
  });
  const avgdl = tfDocs.reduce((s, d) => s + d.len, 0) / N;
  const df = new Map<string, number>();
  for (const t of new Set(qTokens)) {
    df.set(t, tfDocs.filter((d) => d.tf.has(t)).length);
  }
  const k1 = 1.5;
  const b = 0.75;
  const scored = tfDocs.map((d) => {
    let score = 0;
    for (const t of qTokens) {
      const n = df.get(t) || 0;
      if (!n) continue;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const f = d.tf.get(t) || 0;
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (d.len / avgdl))));
    }
    return { id: d.id, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}

export function rrfMerge(
  lists: Array<Array<{ id: string; score: number }>>,
  k = 12,
  rrfK = 60,
) {
  const acc = new Map<string, number>();
  for (const list of lists) {
    list.forEach((item, i) => {
      acc.set(item.id, (acc.get(item.id) || 0) + 1 / (rrfK + i + 1));
    });
  }
  return [...acc.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id, score]) => ({ id, score }));
}
