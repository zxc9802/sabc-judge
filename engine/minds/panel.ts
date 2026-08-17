import { nanoid } from "nanoid";
import { chatJson } from "@/lib/llm";
import type { DimensionKey, EvidenceRecord, PanelOpinionRecord, Stance } from "../types";
import { DIMENSION_META } from "../types";
import { PANEL_ROSTER, PERSONAS } from "./personas";
import { evidenceBlock, facilitatorSystem, personaPrompt } from "./facilitator";

export async function convenePanel(opts: {
  evaluationId: string;
  dimension: DimensionKey;
  projectBrief: string;
  evidence: EvidenceRecord[];
  onEvent: (text: string) => Promise<void>;
}): Promise<PanelOpinionRecord[]> {
  const roster = PANEL_ROSTER[opts.dimension];
  const dimName = DIMENSION_META[opts.dimension].name;
  const a = PERSONAS[roster.chairs[0]];
  const b = PERSONAS[roster.chairs[1]];
  const ind = PERSONAS[roster.industry];
  const ev = evidenceBlock(opts.evidence);
  const evIds = opts.evidence.map((e) => e.id);

  await opts.onEvent(`合议庭就座：${a.name} × ${b.name}，列席 ${ind.name}。张力：${roster.tension}`);

  const stance = await chatJson<{
    opinions: Array<{
      persona: string;
      stance: Stance;
      argument: string;
      evidenceRefs: string[];
    }>;
  }>({
    temperature: 0.4,
    maxTokens: 2200,
    system: `${facilitatorSystem()}
两名顾问必须用各自表达DNA、第一人称、150-220字。必须给出 support / oppose / caveat。
引用证据用方括号编号，如 [e_xxx]。没有引用则 evidenceRefs 为空数组。
黄峥仅当议题涉及电商供需、平台生态或人群时发言；否则 argument 写「本议题非我专长，沉默。」stance=caveat。`,
    user: `维度：${dimName}
提案：
${opts.projectBrief}

证据：
${ev}

顾问A：${a.name}（id=${a.id}）
${personaPrompt(a)}
签名拷问：${a.questions[opts.dimension] || a.questions[Object.keys(a.questions)[0]]}

顾问B：${b.name}（id=${b.id}）
${personaPrompt(b)}
签名拷问：${b.questions[opts.dimension] || b.questions[Object.keys(b.questions)[0]]}

列席：${ind.name}（id=${ind.id}）
${personaPrompt(ind)}

输出 JSON：{"opinions":[{"persona":"${a.id}|${b.id}|${ind.id}","stance":"support|oppose|caveat","argument":"...","evidenceRefs":["${evIds[0] || ""}"]}]}
必须恰好 3 条，persona 分别为 ${a.id}, ${b.id}, ${ind.id}。`,
  });

  const round1 = (stance.opinions || []).slice(0, 3).map((o) => toRecord(opts, o, "stance", evIds));
  for (const o of round1) {
    const p = PERSONAS[o.persona];
    const tag = o.stance === "support" ? "支持" : o.stance === "oppose" ? "反对" : "警告";
    await opts.onEvent(`${p?.name || o.persona} 表态：${tag}。${clip(o.argument)}`);
  }

  const clash = await chatJson<{
    replies: Array<{ persona: string; argument: string; evidenceRefs: string[] }>;
    insight: string;
  }>({
    temperature: 0.4,
    maxTokens: 1800,
    system: `${facilitatorSystem()}
进入交锋轮。每人针对对方论点回应，不超过 120 字，必须仍用其表达DNA。禁止重复立场稿。`,
    user: `维度：${dimName}
第一轮发言：
${round1.map((o) => `${PERSONAS[o.persona]?.name}: [${o.stance}] ${o.argument}`).join("\n\n")}
证据：
${ev}
输出 JSON：{"replies":[{"persona":"${a.id}","argument":"...","evidenceRefs":[]},{"persona":"${b.id}","argument":"...","evidenceRefs":[]}],"insight":"主持人标注的一句关键洞察"}`,
  });

  const round2 = (clash.replies || []).map((o) =>
    toRecord(
      opts,
      {
        persona: o.persona,
        stance: round1.find((r) => r.persona === o.persona)?.stance || "caveat",
        argument: o.argument,
        evidenceRefs: o.evidenceRefs,
      },
      "clash",
      evIds,
    ),
  );
  for (const o of round2) {
    const p = PERSONAS[o.persona];
    await opts.onEvent(`交锋 · ${p?.name || o.persona}：${clip(o.argument)}`);
  }
  if (clash.insight) await opts.onEvent(`主持人标注：${clash.insight}`);

  const synth = await chatJson<{
    consensus: string[];
    dissent: string;
    objection: string;
    synthesis: string;
  }>({
    temperature: 0.2,
    maxTokens: 1200,
    system: facilitatorSystem(),
    user: `请收敛「${dimName}」合议。不要打分。
立场：${JSON.stringify(round1.map((o) => ({ persona: o.persona, stance: o.stance, argument: o.argument })))}
交锋：${JSON.stringify(round2.map((o) => ({ persona: o.persona, argument: o.argument })))}
洞察：${clash.insight || ""}
输出 JSON：{"consensus":["..."],"dissent":"...","objection":"...","synthesis":"120字内主持人结论，供打分官参考，仍不打分"}`,
  });

  const host: PanelOpinionRecord = {
    id: `p_${nanoid(8)}`,
    evaluationId: opts.evaluationId,
    dimension: opts.dimension,
    persona: "facilitator",
    stance: "caveat",
    argument: `共识：${(synth.consensus || []).join("；")}。分歧：${synth.dissent || "无"}。关键异议：${synth.objection || "无"}。收敛：${synth.synthesis}`,
    evidenceRefs: [],
    round: "synthesis",
    experiential: true,
  };
  await opts.onEvent(`主持人收敛：${clip(synth.synthesis || host.argument)}`);
  return [...round1, ...round2, host];
}

function toRecord(
  opts: { evaluationId: string; dimension: DimensionKey },
  o: { persona: string; stance: Stance; argument: string; evidenceRefs: string[] },
  round: PanelOpinionRecord["round"],
  legalIds: string[],
): PanelOpinionRecord {
  const refs = (o.evidenceRefs || []).filter((id) => legalIds.includes(id));
  return {
    id: `p_${nanoid(8)}`,
    evaluationId: opts.evaluationId,
    dimension: opts.dimension,
    persona: o.persona,
    stance: o.stance,
    argument: o.argument,
    evidenceRefs: refs,
    round,
    experiential: refs.length === 0,
  };
}

function clip(s: string) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > 72 ? `${t.slice(0, 72)}…` : t;
}
