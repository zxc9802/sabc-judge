import { chatJson } from "@/lib/llm";
import { searchWeb } from "./sources";
import { validateClaims } from "./validator";
import type { DimensionKey, EvidenceRecord, SearchHit } from "./types";
import { DIMENSION_META } from "./types";

const STANDARD: Record<DimensionKey, { questions: string[]; hint: string }> = {
  market: {
    questions: ["市场规模及统计口径", "近3年增速", "真实付费或销量证据"],
    hint: "行业报告公开摘要、统计局、上市公司财报、电商公开销量",
  },
  competition: {
    questions: ["头部玩家与份额", "近2年融资与新进入者", "差异化空隙"],
    hint: "公开报道、财报、企业信用信息公示",
  },
  timing: {
    questions: ["政策与监管动向", "渠道或技术红利变化", "需求热度拐点"],
    hint: "政府官网、百度指数、媒体报道",
  },
  fit: {
    questions: ["该赛道成功者的能力画像", "能力/渠道复用与红线冲突"],
    hint: "以公司知识库为主，公开报道为辅",
  },
  roi: {
    questions: ["获客成本/客单价/毛利基准", "可比项目回收期"],
    hint: "行业报告、财报、创始人公开访谈",
  },
};

const MAX_SEARCH = 40;
const PER_DIM = 8;

export async function researchDimension(opts: {
  evaluationId: string;
  dimension: DimensionKey;
  brief: string;
  remainingBudget: number;
  onEvent: (text: string, kind?: "search" | "evidence" | "warn") => Promise<void>;
  bumpSearch: () => number;
}): Promise<{ evidence: EvidenceRecord[]; hits: SearchHit[]; used: number; degraded?: string }> {
  const meta = DIMENSION_META[opts.dimension];
  const spec = STANDARD[opts.dimension];
  const budget = Math.min(PER_DIM, opts.remainingBudget);
  if (budget <= 0) {
    await opts.onEvent("搜索预算已耗尽，本维取证降级", "warn");
    return { evidence: [], hits: [], used: 0, degraded: "搜索预算耗尽" };
  }

  await opts.onEvent(`生成「${meta.name}」检索计划`);
  const plan = await chatJson<{ queries: string[] }>({
    temperature: 0.2,
    maxTokens: 800,
    system: "你是商业调研员。为单个评分维度生成中文检索词，官方源优先。只输出 JSON。",
    user: `维度：${meta.name}
标准问题：${spec.questions.join("；")}
信号源提示：${spec.hint}
提案：
${opts.brief}
生成 ${Math.min(4, budget)} 条可直接搜索的 query，短、具体、含品类或行业词。
输出 {"queries":["..."]}`,
  });

  const queries = (plan.queries || spec.questions).slice(0, Math.min(4, budget));
  const hits: SearchHit[] = [];
  let used = 0;
  let degraded: string | undefined;

  for (const query of queries) {
    if (used >= budget) break;
    const n = opts.bumpSearch();
    if (n > MAX_SEARCH) {
      degraded = "超过 40 次搜索上限，取证深度降级";
      await opts.onEvent(degraded, "warn");
      break;
    }
    used += 1;
    await opts.onEvent(`三源检索：${query}`, "search");
    try {
      const { hits: found, engines } = await searchWeb({ query, count: 6, freshness: "oneYear" });
      const tally = engines
        .map((e) => `${e.provider} ${e.hits.length}条${e.error ? `(${e.error.slice(0, 24)})` : ""}`)
        .join(" / ");
      await opts.onEvent(`交叉检索 ${tally} · 去重后 ${found.length} 条`, "search");
      hits.push(...found);
    } catch (err) {
      await opts.onEvent(`检索失败：${err instanceof Error ? err.message : String(err)}`, "warn");
    }
  }

  if (!hits.length) {
    await opts.onEvent(`「${meta.name}」未检索到可用来源，本维结论不得入报告`, "warn");
    return { evidence: [], hits: [], used, degraded: degraded || "无来源" };
  }

  const extracted = await chatJson<{ claims: Array<{ claim: string; sourceUrls: string[] }> }>({
    temperature: 0.2,
    maxTokens: 1800,
    system: `从检索结果抽取可验证的关键结论。每条 claim 必须能被至少一条 URL 支撑。禁止无来源断言。只输出 JSON。`,
    user: `维度：${meta.name}
提案：${opts.brief}
检索结果：
${hits
  .slice(0, 24)
  .map((h) => `- ${h.title}\n  URL: ${h.url}\n  级别: ${h.sourceLevel}\n  引擎: ${(h.providers || [h.provider]).filter(Boolean).join("+") || "unknown"}\n  ${h.summary || h.snippet}`)
  .join("\n")}
输出最多 5 条：{"claims":[{"claim":"...","sourceUrls":["https://..."]}]}
sourceUrls 必须来自上面的 URL。`,
  });

  const evidence = validateClaims({
    evaluationId: opts.evaluationId,
    dimension: opts.dimension,
    claims: extracted.claims || [],
    hits,
  });

  const high = evidence.filter((e) => e.crossValidated).length;
  const multiEngine = new Set(
    hits.filter((h) => (h.providers?.length || 0) >= 2).map((h) => h.url),
  ).size;
  await opts.onEvent(
    `「${meta.name}」落入 ${evidence.length} 条证据，交叉验证通过 ${high} 条；${multiEngine} 条被至少两家引擎同时命中`,
    "evidence",
  );
  return { evidence, hits, used, degraded };
}
