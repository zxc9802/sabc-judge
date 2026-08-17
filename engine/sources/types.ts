import type { SearchHit, SourceLevel } from "../types";

export type SearchQuery = {
  query: string;
  freshness?: "noLimit" | "oneYear" | "oneMonth";
  count?: number;
  include?: string;
  tag?: string;
  params?: Record<string, string>;
};

export interface SourceAdapter {
  name: string;
  search(q: SearchQuery): Promise<SearchHit[]>;
}

export function classifySource(url: string, siteName?: string): SourceLevel {
  const host = hostnameOf(url);
  const official = [
    "stats.gov.cn",
    "www.stats.gov.cn",
    "data.stats.gov.cn",
    "cninfo.com.cn",
    "www.cninfo.com.cn",
    "sse.com.cn",
    "szse.cn",
    "pbc.gov.cn",
    "ndrc.gov.cn",
    "miit.gov.cn",
    "samr.gov.cn",
    "gov.cn",
    "index.baidu.com",
    "iresearch.com.cn",
    "www.iresearch.com.cn",
  ];
  if (official.some((d) => host === d || host.endsWith(`.${d}`) || host.endsWith("gov.cn"))) {
    return "official";
  }
  const media = [
    "caixin.com",
    "yicai.com",
    "36kr.com",
    "latepost.com",
    "ft.com",
    "wsj.com",
    "reuters.com",
    "bloomberg.com",
    "thepaper.cn",
    "jiemian.com",
    "eeo.com.cn",
    "nbd.com.cn",
    "cls.cn",
    "stcn.com",
    "cs.com.cn",
  ];
  if (media.some((d) => host === d || host.endsWith(`.${d}`))) return "media";
  const ugc = ["weixin.qq.com", "mp.weixin.qq.com", "zhihu.com", "weibo.com", "toutiao.com", "xiaohongshu.com", "bilibili.com"];
  if (ugc.some((d) => host === d || host.endsWith(`.${d}`))) return "ugc";
  if (siteName?.includes("统计局") || siteName?.includes("巨潮")) return "official";
  return "unknown";
}

export function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function registrableDomain(url: string) {
  const host = hostnameOf(url);
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  const last2 = parts.slice(-2).join(".");
  const multi = ["com.cn", "gov.cn", "org.cn", "net.cn", "co.uk"];
  if (multi.includes(last2) && parts.length >= 3) return parts.slice(-3).join(".");
  return last2;
}
