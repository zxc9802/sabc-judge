import { nanoid } from "nanoid";
import { registrableDomain } from "./sources/types";
import type { Confidence, DimensionKey, EvidenceRecord, SearchHit } from "./types";

function fingerprint(text: string) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, "")
    .slice(0, 280);
}

function similar(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (shorter.length < 24) return longer.includes(shorter);
  let hit = 0;
  for (let i = 0; i < shorter.length - 8; i += 8) {
    if (longer.includes(shorter.slice(i, i + 12))) hit += 1;
  }
  return hit >= 3;
}

export function validateClaims(opts: {
  evaluationId: string;
  dimension: DimensionKey;
  claims: Array<{ claim: string; sourceUrls: string[] }>;
  hits: SearchHit[];
}): EvidenceRecord[] {
  const byUrl = new Map(opts.hits.map((h) => [h.url, h]));
  const out: EvidenceRecord[] = [];
  const fetchedAt = new Date().toISOString();

  for (const item of opts.claims) {
    const urls = [...new Set(item.sourceUrls.filter((u) => byUrl.has(u) || /^https?:\/\//.test(u)))];
    const sources = urls
      .map((u) => byUrl.get(u) || ({ url: u, title: u, snippet: "", sourceLevel: "unknown" as const }))
      .filter((s) => s.url);

    if (sources.length === 0) continue;

    const clusters: SearchHit[][] = [];
    for (const src of sources) {
      const fp = fingerprint(src.summary || src.snippet || src.title);
      const domain = registrableDomain(src.url);
      let placed = false;
      for (const cluster of clusters) {
        const sameWire = cluster.some((c) => {
          const sameDomain = registrableDomain(c.url) === domain;
          const sameContent = similar(fingerprint(c.summary || c.snippet || c.title), fp);
          return sameDomain || sameContent;
        });
        if (sameWire) {
          cluster.push(src);
          placed = true;
          break;
        }
      }
      if (!placed) clusters.push([src]);
    }

    const independent = clusters.map((c) => c[0]);
    const n = independent.length;
    let confidence: Confidence = "low";
    let crossValidated = false;
    if (n >= 2) {
      confidence = "high";
      crossValidated = true;
    }

    for (const src of independent) {
      out.push({
        id: `e_${nanoid(8)}`,
        evaluationId: opts.evaluationId,
        dimension: opts.dimension,
        claim: item.claim,
        sourceName: sourceLabel(src),
        sourceUrl: src.url,
        publishedAt: src.publishedAt ?? null,
        fetchedAt,
        snapshot: (src.summary || src.snippet || src.title).slice(0, 1800),
        crossValidated,
        confidence,
        sourceLevel: src.sourceLevel,
      });
    }
  }
  return out;
}

function hostnameLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "未知来源";
  }
}

function sourceLabel(src: SearchHit) {
  const name = src.siteName || hostnameLabel(src.url);
  const engines = src.providers?.length ? src.providers : src.provider ? [src.provider] : [];
  if (engines.length >= 2) return `${name} · 多引擎命中`;
  return name;
}
