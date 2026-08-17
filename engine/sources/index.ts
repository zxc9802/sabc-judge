import type { SearchQuery, SourceAdapter } from "./types";
import type { SearchHit } from "../types";
import { BochaAdapter } from "./bocha";
import { AnySearchAdapter } from "./anysearch";
import { DuckDuckGoAdapter, JinaAdapter } from "./web";

const OFFICIAL_SITES = [
  "stats.gov.cn",
  "cninfo.com.cn",
  "index.baidu.com",
];

export class OfficialAdapter implements SourceAdapter {
  name = "official";
  private inner: SourceAdapter;

  constructor(inner: SourceAdapter) {
    this.inner = inner;
  }

  async search(q: SearchQuery): Promise<SearchHit[]> {
    const include = OFFICIAL_SITES.join("|");
    return this.inner.search({ ...q, include, count: q.count ?? 5 });
  }
}

export type EngineResult = {
  provider: string;
  hits: SearchHit[];
  error?: string;
};

export function createPrimaryEngines(): SourceAdapter[] {
  const engines: SourceAdapter[] = [];
  if (process.env.BOCHA_API_KEY) engines.push(new BochaAdapter());
  if (process.env.ANYSEARCH_API_KEY) engines.push(new AnySearchAdapter());
  engines.push(new JinaAdapter());
  if (engines.length < 3) engines.push(new DuckDuckGoAdapter());
  return engines.slice(0, 3);
}

function mergeHits(groups: EngineResult[]): SearchHit[] {
  const byUrl = new Map<string, SearchHit>();
  for (const group of groups) {
    for (const hit of group.hits) {
      const key = hit.url.replace(/\/+$/, "").toLowerCase();
      const existing = byUrl.get(key);
      if (!existing) {
        byUrl.set(key, {
          ...hit,
          provider: group.provider,
          providers: [group.provider],
        });
        continue;
      }
      const providers = [...new Set([...(existing.providers || []), group.provider])];
      if ((hit.summary || "").length > (existing.summary || "").length) {
        existing.summary = hit.summary;
        existing.snippet = hit.snippet || existing.snippet;
      }
      existing.providers = providers;
      existing.provider = providers.join("+");
    }
  }
  return [...byUrl.values()];
}

async function runEngine(adapter: SourceAdapter, q: SearchQuery): Promise<EngineResult> {
  try {
    const hits = await adapter.search(q);
    return { provider: adapter.name, hits };
  } catch (err) {
    return {
      provider: adapter.name,
      hits: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** 三源并行检索。同一 URL 经多个引擎只算一条；交叉验证仍按独立域名判定。 */
export async function searchWeb(q: SearchQuery): Promise<{
  hits: SearchHit[];
  provider: string;
  engines: EngineResult[];
}> {
  const engines = createPrimaryEngines();
  const settled = await Promise.all(engines.map((adapter) => runEngine(adapter, q)));
  const hits = mergeHits(settled);
  const ok = settled.filter((e) => e.hits.length);
  if (!hits.length) {
    const errors = settled.map((e) => `${e.provider}: ${e.error || "empty"}`).join(" | ");
    throw new Error(`三源检索均无结果：${errors}`);
  }
  return {
    hits,
    provider: ok.map((e) => e.provider).join("+") || "none",
    engines: settled,
  };
}
