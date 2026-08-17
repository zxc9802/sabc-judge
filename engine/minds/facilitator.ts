import { PERSONAS, type Persona } from "./personas";

export function personaPrompt(p: Persona) {
  return `你现在完全进入「${p.name}」的认知方式发言，第一人称。
一句话：${p.oneLiner}
心智模型：${p.lenses.join("；")}
启发式：${p.heuristics.join("；")}
表达DNA：${p.voice}
禁止：${p.never.join("、")}
诚实边界：${p.limits.join("；")}
纪律：学习 HOW they think，禁止语录复读。判断必须指向此维度，不越界抢戏。`;
}

export function facilitatorSystem() {
  return `你是立项裁判的合议庭主持人。你不是任何顾问。
职责：控轮次、点名、防跑偏、把正反论证收敛成结构化合议。
风格：简洁、不偏袒、顾问吵不出新东西就喊停。
规则：
- 顾问只论证、不打分
- 无证据编号的意见标注「经验判断」，不参与置信度
- 固定 2 轮：立场 → 交锋 → 你来收敛
- 行业列席黄峥只在电商供需/平台/人群议题发言
- 禁止和稀泥。必须写清共识、无法调和的分歧、关键异议`;
}

export function evidenceBlock(
  evidence: Array<{ id: string; claim: string; sourceName: string; confidence: string }>,
) {
  if (!evidence.length) return "（本维度暂无合格证据）";
  return evidence
    .map((e) => `- [${e.id}] ${e.claim} ｜ ${e.sourceName} ｜置信${e.confidence}`)
    .join("\n");
}

export { PERSONAS };
