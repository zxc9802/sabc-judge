import { chatJson } from "@/lib/llm";
import type { AssumedFields, ChatMessage, Essentials } from "./types";
import { PERSONAS } from "./minds/personas";

const QUESTIONS: Record<keyof Essentials, string> = {
  what: "用一句话说清：这个项目做什么、以什么形态交付？",
  targetCustomer: "掏钱的人是谁？他们现在怎么解决这个问题？",
  revenueModel: "收费方式是什么？大致单价多少？",
  budget: "打算投多少钱、多少人？",
  timeline: "期望多久上线或见效？",
};

const ROUND2: Record<keyof Essentials, string> = {
  what: PERSONAS.jobs.questions.fit,
  targetCustomer: PERSONAS.nantian.questions.market,
  revenueModel: PERSONAS.huangzheng.questions.roi,
  budget: PERSONAS.mao.questions.fit,
  timeline: PERSONAS.pg.questions.timing,
};

export type IntakeResult = {
  title: string;
  essentials: Essentials;
  assumed: AssumedFields;
  missing: Array<keyof Essentials>;
  ready: boolean;
  assistantMessage: string;
};

function filled(v: string | null | undefined) {
  return Boolean(v && v.trim() && v.trim() !== "未知");
}

export async function runIntake(opts: {
  dialogue: ChatMessage[];
  latestUser: string;
  docsText: string;
  previous?: Essentials;
  round: number;
}): Promise<IntakeResult> {
  const extracted = await chatJson<{
    title: string;
    essentials: Essentials;
    notes: string;
  }>({
    temperature: 0.2,
    maxTokens: 1400,
    system: `你是立项裁判的书记员。从老板的口述和文档中抽取立项 5 要素。
要素：what / targetCustomer / revenueModel / budget / timeline。
不确定就填 null，不要编造。title 用不超过 18 字的项目名。
只输出 JSON。`,
    user: `已有抽取：${JSON.stringify(opts.previous || {})}
文档：
${opts.docsText.slice(0, 12000) || "（无）"}
对话：
${opts.dialogue.map((m) => `${m.role}: ${m.content}`).join("\n")}
最新补充：
${opts.latestUser}`,
  });

  const essentials = mergeEssentials(opts.previous, extracted.essentials);
  const missing = (Object.keys(QUESTIONS) as Array<keyof Essentials>).filter(
    (k) => !filled(essentials[k]),
  );
  const round = opts.round;
  let ready = missing.length === 0;
  let assumed: AssumedFields = [];
  let assistantMessage = "";

  if (ready) {
    assistantMessage = "五要素已收口。现在进入取证。请稍候，判决书会附上来源。";
    return { title: extracted.title || "未命名提案", essentials, assumed, missing, ready, assistantMessage };
  }

  if (round >= 2) {
    assumed = missing;
    ready = true;
    assistantMessage = `两轮追问后仍缺：${missing.map((k) => label(k)).join("、")}。将按「基于假设推算」降级相关维度置信度，启动评级。`;
    return { title: extracted.title || "未命名提案", essentials, assumed, missing: [], ready, assistantMessage };
  }

  const qs =
    round === 0
      ? missing.slice(0, 3).map((k) => QUESTIONS[k])
      : missing.slice(0, 2).map((k) => ROUND2[k] || QUESTIONS[k]);

  assistantMessage =
    (extracted.notes ? `${extracted.notes}\n\n` : "") +
    (round === 0
      ? "立案需要先把这几件事说清楚：\n"
      : "还有矛盾或缺项。请直接回答：\n") +
    qs.map((q, i) => `${i + 1}. ${q}`).join("\n");

  return {
    title: extracted.title || "未命名提案",
    essentials,
    assumed,
    missing,
    ready: false,
    assistantMessage,
  };
}

function mergeEssentials(prev: Essentials | undefined, next: Essentials): Essentials {
  const base: Essentials = {
    what: null,
    targetCustomer: null,
    revenueModel: null,
    budget: null,
    timeline: null,
    ...prev,
  };
  for (const k of Object.keys(base) as Array<keyof Essentials>) {
    if (filled(next?.[k])) base[k] = next[k];
  }
  return base;
}

function label(k: keyof Essentials) {
  return {
    what: "做什么",
    targetCustomer: "卖给谁",
    revenueModel: "怎么赚钱",
    budget: "预计投入",
    timeline: "上线时间",
  }[k];
}

export function formatBrief(title: string, e: Essentials, companyText?: string) {
  return `项目：${title}
做什么：${e.what || "（假设/未知）"}
卖给谁：${e.targetCustomer || "（假设/未知）"}
怎么赚钱：${e.revenueModel || "（假设/未知）"}
预计投入：${e.budget || "（假设/未知）"}
上线时间：${e.timeline || "（假设/未知）"}
${companyText ? `\n公司档案：\n${companyText}` : "\n（未提供公司知识库，公司匹配度将标为未评估）"}`;
}
