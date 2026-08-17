import { extractJson } from "@/lib/llm";
import { createOpenAI } from "@/lib/compat";

const LUNA = process.env.KB_CHUNK_MODEL || "gpt-5.6-luna";

export type KbChunkDraft = {
  heading: string;
  text: string;
  tags: string[];
};

export async function lunaJson<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  const client = createOpenAI();
  const system = `${opts.system}\n\n你必须只输出合法 JSON。`;
  const res = await client.chat.completions.create({
    model: LUNA,
    temperature: 0.2,
    max_tokens: opts.maxTokens ?? 3500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: opts.user },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "{}";
  return JSON.parse(extractJson(text)) as T;
}

export async function sliceKnowledge(opts: {
  filename: string;
  kind: string;
  text: string;
}): Promise<KbChunkDraft[]> {
  const pieces = splitText(opts.text, 6000);
  const out: KbChunkDraft[] = [];
  for (const piece of pieces) {
    const res = await lunaJson<{ chunks: KbChunkDraft[] }>({
      system: `你是立项裁判的知识库切片员。把材料切成可检索的知识切片。
规则：
- 每片 120-400 字，一事一片，数字/主体/约束必须完整保留
- heading 不超过 24 字
- tags 只能来自：主营业务、团队能力、可投入资源、战略方向、红线、组织、财务、渠道、其他
- 不要发明材料里没有的事实
只输出 {"chunks":[{"heading":"...","text":"...","tags":["..."]}]}`,
      user: `文件：${opts.filename}（${opts.kind}）\n\n${piece}`,
      maxTokens: 2800,
    });
    for (const c of res.chunks || []) {
      const text = (c.text || "").trim();
      if (text.length < 20) continue;
      out.push({
        heading: (c.heading || opts.filename).slice(0, 40),
        text,
        tags: Array.isArray(c.tags) ? c.tags : [],
      });
    }
  }
  if (!out.length && opts.text.trim()) {
    out.push({
      heading: opts.filename,
      text: opts.text.slice(0, 1200),
      tags: ["其他"],
    });
  }
  return out;
}

function splitText(text: string, size: number) {
  if (text.length <= size) return [text];
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts.slice(0, 8);
}
