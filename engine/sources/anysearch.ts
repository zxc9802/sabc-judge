import { classifySource, type SearchQuery, type SourceAdapter } from "./types";
import type { SearchHit } from "../types";

type AnySearchResult = {
  title?: string;
  url?: string;
  snippet?: string;
  content?: string;
  siteName?: string;
  publishedAt?: string;
  date?: string;
};

export class AnySearchAdapter implements SourceAdapter {
  name = "anysearch";

  async search(q: SearchQuery): Promise<SearchHit[]> {
    const key = process.env.ANYSEARCH_API_KEY;
    if (!key) return [];
    const query = q.include ? `${q.query} site:${q.include.split("|")[0]}` : q.query;
    const body: Record<string, unknown> = {
      query,
      count: q.count ?? 8,
    };
    if (q.tag) {
      body.tag = q.tag;
      body.params = q.params || {};
    }
    const res = await fetch("https://api.anysearch.com/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AnySearch 失败 ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      code?: number;
      message?: string;
      data?: { results?: AnySearchResult[] };
    };
    if (json.code !== 0 && json.code !== undefined) {
      throw new Error(`AnySearch: ${json.message || "unknown error"}`);
    }
    return (json.data?.results || [])
      .filter((v) => v.url)
      .map((v) => ({
        title: v.title || "",
        url: v.url as string,
        snippet: v.snippet || "",
        summary: v.content || v.snippet || "",
        siteName: v.siteName,
        publishedAt: v.publishedAt || v.date || null,
        sourceLevel: classifySource(v.url as string, v.siteName),
        provider: "anysearch",
      }));
  }
}
