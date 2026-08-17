import { classifySource, type SearchQuery, type SourceAdapter } from "./types";
import type { SearchHit } from "../types";

function parseJina(md: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const blocks = md.split(/\n(?=\[\d+\])/);
  for (const block of blocks) {
    const titleUrl = block.match(/\[(\d+)\]\s+(.+?)\s+[—\-]\s+(https?:\/\/\S+)/);
    const alt = block.match(/Title:\s*(.+)\nURL Source:\s*(https?:\/\/\S+)/i);
    const mdLink = block.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
    let title = "";
    let url = "";
    if (titleUrl) {
      title = titleUrl[2].trim();
      url = titleUrl[3].trim();
    } else if (alt) {
      title = alt[1].trim();
      url = alt[2].trim();
    } else if (mdLink) {
      title = mdLink[1].trim();
      url = mdLink[2].trim();
    }
    if (!url) continue;
    const snippet = block.replace(/https?:\/\/\S+/g, "").replace(/\[[^\]]+\]/g, "").slice(0, 500).trim();
    hits.push({
      title: title || url,
      url,
      snippet,
      summary: snippet,
      sourceLevel: classifySource(url),
      provider: "jina",
    });
  }
  return hits;
}

export class JinaAdapter implements SourceAdapter {
  name = "jina";

  async search(q: SearchQuery): Promise<SearchHit[]> {
    const query = q.include ? `${q.query} site:${q.include.split("|")[0]}` : q.query;
    const url = `https://s.jina.ai/${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { Accept: "text/plain" },
    });
    if (!res.ok) throw new Error(`Jina 搜索失败 ${res.status}`);
    const md = await res.text();
    return parseJina(md).slice(0, q.count ?? 8);
  }
}

export class DuckDuckGoAdapter implements SourceAdapter {
  name = "duckduckgo";

  async search(q: SearchQuery): Promise<SearchHit[]> {
    const query = q.include ? `${q.query} site:${q.include.split("|")[0]}` : q.query;
    const body = new URLSearchParams({ q: query, kl: "cn-zh" });
    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 SABC-Judge/0.1",
      },
      body,
    });
    if (!res.ok) throw new Error(`DuckDuckGo 失败 ${res.status}`);
    const html = await res.text();
    const hits: SearchHit[] = [];
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snipRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/td>/g;
    let m: RegExpExecArray | null;
    const snips: string[] = [];
    while ((m = snipRe.exec(html))) {
      snips.push(m[1].replace(/<[^>]+>/g, "").trim());
    }
    let i = 0;
    while ((m = re.exec(html))) {
      const url = decodeDuckUrl(m[1]);
      if (!url.startsWith("http")) continue;
      const title = m[2].replace(/<[^>]+>/g, "").trim();
      hits.push({
        title,
        url,
        snippet: snips[i] || "",
        summary: snips[i] || "",
        sourceLevel: classifySource(url),
        provider: "duckduckgo",
      });
      i += 1;
      if (hits.length >= (q.count ?? 8)) break;
    }
    return hits;
  }
}

function decodeDuckUrl(href: string) {
  try {
    const u = new URL(href, "https://html.duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : href;
  } catch {
    return href;
  }
}
