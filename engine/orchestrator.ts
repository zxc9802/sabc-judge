import { chatJson } from "@/lib/llm";
import { formatBrief } from "./intake";
import { convenePanel } from "./minds/panel";
import { researchDimension } from "./researcher";
import { writeVerdict } from "./reporter";
import { applyPenalties, decideGrade, emptySkippedFit } from "./scorer";
import type {
  AssumedFields,
  DimensionKey,
  DimensionScore,
  Essentials,
  EvidenceRecord,
  PanelOpinionRecord,
} from "./types";
import { DIMENSIONS, DIMENSION_META } from "./types";
import {
  appendLog,
  companyText,
  getEvaluation,
  getProject,
  hasKnowledge,
  insertEvidence,
  insertOpinions,
  listEvidence,
  listOpinions,
  saveVerdict,
  setEvaluation,
} from "@/lib/store";
import { knowledgeContext } from "@/lib/kb/retrieve";

const running = new Map<string, Promise<void>>();

export function ensureEvaluationRunning(id: string) {
  const existing = running.get(id);
  if (existing) return existing;
  const ev = getEvaluation(id);
  if (!ev) throw new Error("评级不存在");
  if (ev.status === "done" || ev.status === "failed") return Promise.resolve();
  if (ev.status === "collecting") return Promise.resolve();
  const task = runEvaluation(id).finally(() => running.delete(id));
  running.set(id, task);
  return task;
}

export async function startResearch(id: string) {
  const ev = getEvaluation(id);
  if (!ev) throw new Error("评级不存在");
  if (ev.status === "done") return;
  setEvaluation(id, { status: "researching", error: null });
  return ensureEvaluationRunning(id);
}

async function log(id: string, text: string, kind: "system" | "search" | "evidence" | "panel" | "score" | "warn" = "system") {
  appendLog(id, kind, text);
}

export async function runEvaluation(id: string) {
  const ev = getEvaluation(id);
  if (!ev) throw new Error("评级不存在");
  const project = getProject(ev.projectId);
  if (!project) throw new Error("提案不存在");

  try {
    setEvaluation(id, { status: "researching" });
    await log(id, "立案完成，启动五维取证");

    const essentials: Essentials = {
      what: project.what,
      targetCustomer: project.targetCustomer,
      revenueModel: project.revenueModel,
      budget: project.budget,
      timeline: project.timeline,
    };
    const assumed = JSON.parse(project.assumed || "[]") as AssumedFields;
    const customized = Boolean(ev.companyId) && hasKnowledge();
    let archive = companyText();
    if (customized) {
      const retrieved = await knowledgeContext(
        [project.title, essentials.what, essentials.targetCustomer, essentials.revenueModel]
          .filter(Boolean)
          .join("\n"),
      );
      if (retrieved) archive = `${archive}\n\n检索到的档案切片：\n${retrieved}`.trim();
      await log(id, "已用 BM25 + FAISS 从公司知识库抽切片，并入公司匹配度", "system");
    }
    const brief = formatBrief(project.title, essentials, customized ? archive : "");

    let searchCount = ev.searchCount || 0;
    const bumpSearch = () => {
      searchCount += 1;
      setEvaluation(id, { searchCount });
      return searchCount;
    };

    const dimOrder: DimensionKey[] = customized
      ? [...DIMENSIONS]
      : DIMENSIONS.filter((d) => d !== "fit");

    if (!customized) {
      await log(id, "未读取公司知识库：公司匹配度将灰显「未评估」——这是市场判断，不是为你公司定制的判断", "warn");
    }

    const allEvidence: EvidenceRecord[] = [];
    const allOpinions: PanelOpinionRecord[] = [];
    const degraded: string[] = [];

    for (const dim of dimOrder) {
      const result = await researchDimension({
        evaluationId: id,
        dimension: dim,
        brief,
        remainingBudget: 40 - searchCount,
        bumpSearch,
        onEvent: (text, kind) => log(id, text, kind || "search"),
      });
      allEvidence.push(...result.evidence);
      insertEvidence(result.evidence);
      if (result.degraded) degraded.push(`${DIMENSION_META[dim].name}: ${result.degraded}`);

      const opinions = await convenePanel({
        evaluationId: id,
        dimension: dim,
        projectBrief: brief,
        evidence: result.evidence,
        onEvent: (text) => log(id, text, "panel"),
      });
      allOpinions.push(...opinions);
      insertOpinions(opinions);
    }

    setEvaluation(id, { status: "scoring" });
    await log(id, "取证结束，主审按固定 rubric 打分（顾问不打分）", "score");

    const rawScores = await scoreDimensions({
      brief,
      dims: dimOrder,
      evidence: allEvidence,
      opinions: allOpinions,
    });

    let dimensions: DimensionScore[] = rawScores;
    if (!customized) dimensions = [...rawScores, emptySkippedFit()];
    dimensions = applyPenalties(dimensions, allEvidence, assumed);

    const decided = decideGrade(dimensions, customized);
    const payload = {
      ...decided,
      verdict: decided.verdict || "",
      degraded: degraded.length ? degraded.join("；") : null,
      dimensions,
    };

    const written = await writeVerdict({
      brief,
      payload,
      evidence: allEvidence.length ? allEvidence : listEvidence(id).map(asEvidence),
      opinions: allOpinions.length ? allOpinions : listOpinions(id).map(asOpinion),
    });
    payload.verdict = written.verdict;
    payload.dimensions = written.dimensions;
    if (written.dimensions) payload.dimensions = written.dimensions;

    saveVerdict(id, payload);
    await log(id, `宣判 ${payload.grade}｜${payload.verdict}`, "score");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setEvaluation(id, { status: "failed", error: msg });
    await log(id, `取证中断：${msg}`, "warn");
  }
}

async function scoreDimensions(opts: {
  brief: string;
  dims: DimensionKey[];
  evidence: EvidenceRecord[];
  opinions: PanelOpinionRecord[];
}) {
  const rubric = `锚点（0-10）：
市场空间 10=百亿级且年增>20%多源验证；7=十亿-百亿或稳定增长；5=亿级或增速平缓；3=萎缩或天花板<亿；0=伪需求无付费证据
竞争格局 10=CR3<30%且壁垒可越；7=有强者但有错位空隙；5=红海分散；3=CR3>70%；0=巨头腹地无差异化
入场时机 10=红利拐点刚启动；7=上行中段；5=窗口模糊；3=红利尾声；0=窗口关闭
公司匹配度 10=能力渠道直接复用；7=多数可复用；5=一半新建；3=无协同；0=触碰红线
投入产出比 10=回收<6月且最坏可承受；7=6-18月；5=18-36月或乐观假设；3=测算为负或>36月；0=最坏威胁生存
0 分档即致命标记。只根据证据与合议论证打分，禁止发明数字。`;

  const res = await chatJson<{
    scores: Array<{
      key: DimensionKey;
      score: number;
      fatal: boolean;
      conclusion: string;
    }>;
  }>({
    temperature: 0.2,
    maxTokens: 2200,
    system: `你是立项裁判的打分官。严格按 rubric 给 0-10 分。顾问意见只作论证参考，不得直接当分数。只输出 JSON。`,
    user: `${rubric}
提案：
${opts.brief}
证据：
${opts.evidence.map((e) => `[${e.id}] ${e.dimension} ${e.claim} (${e.confidence} ${e.sourceName})`).join("\n")}
合议：
${opts.opinions
  .filter((o) => o.round === "synthesis")
  .map((o) => `${o.dimension}: ${o.argument}`)
  .join("\n")}
只对 ${opts.dims.join(",")} 打分。
输出 {"scores":[{"key":"market","score":6.5,"fatal":false,"conclusion":"..."}]}`,
  });

  const byKey = new Map((res.scores || []).map((s) => [s.key, s]));
  return opts.dims.map((key) => {
    const s = byKey.get(key);
    const score = Math.max(0, Math.min(10, Number(s?.score ?? 5)));
    return {
      key,
      name: DIMENSION_META[key].name,
      score: Math.round(score * 10) / 10,
      confidence: "high" as const,
      conclusion: s?.conclusion || "待书记员撰写",
      fatal: Boolean(s?.fatal) || score <= 0,
    };
  });
}

function asEvidence(row: ReturnType<typeof listEvidence>[number]): EvidenceRecord {
  return {
    id: row.id,
    evaluationId: row.evaluationId,
    dimension: row.dimension as EvidenceRecord["dimension"],
    claim: row.claim,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    publishedAt: row.publishedAt,
    fetchedAt: row.fetchedAt,
    snapshot: row.snapshot,
    crossValidated: Boolean(row.crossValidated),
    confidence: row.confidence as EvidenceRecord["confidence"],
    sourceLevel: (row.sourceLevel as EvidenceRecord["sourceLevel"]) || "unknown",
  };
}

function asOpinion(row: ReturnType<typeof listOpinions>[number]): PanelOpinionRecord {
  return {
    id: row.id,
    evaluationId: row.evaluationId,
    dimension: row.dimension as PanelOpinionRecord["dimension"],
    persona: row.persona,
    stance: row.stance as PanelOpinionRecord["stance"],
    argument: row.argument,
    evidenceRefs: JSON.parse(row.evidenceRefs || "[]"),
    round: row.round as PanelOpinionRecord["round"],
    experiential: Boolean(row.experiential),
  };
}
