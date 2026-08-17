import { chatJson } from "@/lib/llm";
import type {
  DimensionScore,
  EvidenceRecord,
  Grade,
  PanelOpinionRecord,
  VerdictPayload,
} from "./types";

export async function writeVerdict(opts: {
  brief: string;
  payload: VerdictPayload;
  evidence: EvidenceRecord[];
  opinions: PanelOpinionRecord[];
}): Promise<{ verdict: string; dimensions: DimensionScore[] }> {
  const gradeCopy: Record<Grade, string> = {
    S: "立即立项",
    A: "值得做，但有明确短板",
    B: "不建议做",
    C: "完全不可行",
  };

  const res = await chatJson<{
    verdict: string;
    dimensionConclusions: Array<{ key: string; conclusion: string }>;
    shortboard?: string;
    fatalFlaw?: string;
    roiCalc?: string;
  }>({
    temperature: 0.25,
    maxTokens: 2200,
    system: `你是立项裁判的主审书记员。根据已经算死的评级与证据，写裁决书语言。
语气：法院判决，不是 PPT，不是鸡汤。结论前置。禁止无证据的新事实。
一句话判决不超过 40 字，必须能被老板当众念出来。`,
    user: `评级 ${opts.payload.grade}（${gradeCopy[opts.payload.grade]}），加权 ${opts.payload.weighted}。
是否定制：${opts.payload.customized ? "是" : "否，市场判断非公司定制"}
提案：
${opts.brief}
各维分数：
${opts.payload.dimensions.map((d) => `${d.name} ${d.skipped ? "未评估" : d.score + "分"} ${d.confidence}`).join("\n")}
证据：
${opts.evidence
  .slice(0, 40)
  .map((e) => `[${e.id}] (${e.dimension}) ${e.claim} ← ${e.sourceName}`)
  .join("\n")}
合议纪要：
${opts.opinions
  .filter((o) => o.round === "synthesis" || o.round === "stance")
  .slice(0, 20)
  .map((o) => `${o.persona}: ${o.argument}`)
  .join("\n")}
输出 JSON：{
  "verdict":"一句话判决",
  "dimensionConclusions":[{"key":"market","conclusion":"该维结论，先判断后理由，引用证据编号"}],
  "shortboard":"A级必填",
  "fatalFlaw":"C级必填",
  "roiCalc":"B级必填测算依据"
}`,
  });

  const dimensions = opts.payload.dimensions.map((d) => {
    const found = res.dimensionConclusions?.find((x) => x.key === d.key);
    return found?.conclusion ? { ...d, conclusion: found.conclusion } : d;
  });

  return {
    verdict: res.verdict || `${opts.payload.grade}｜${gradeCopy[opts.payload.grade]}`,
    dimensions,
  };
}
