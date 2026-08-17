import { classifySource, type SearchQuery, type SourceAdapter } from "./types";
import type { SearchHit } from "../types";

export class BochaAdapter implements SourceAdapter {
  name = "bocha";

  async search(q: SearchQuery): Promise<SearchHit[]> {
    const key = process.env.BOCHA_API_KEY;
    if (!key) return [];
    const res = await fetch("https://api.bochaai.com/v1/web-search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: q.query,
        freshness: q.freshness ?? "noLimit",
        summary: true,
        count: q.count ?? 8,
        include: q.include,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`博查搜索失败 ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      data?: { webPages?: { value?: Array<Record<string, string>> } };
    };
    const values = json.data?.webPages?.value ?? [];
    return values
      .filter((v) => v.url)
      .map((v) => ({
        title: v.name || v.title || "",
        url: v.url,
        snippet: v.snippet || "",
        summary: v.summary || v.snippet || "",
        siteName: v.siteName,
        publishedAt: v.datePublished || null,
        sourceLevel: classifySource(v.url, v.siteName),
        provider: "bocha",
      }));
  }
}
