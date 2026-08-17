import { createOpenAI } from "./compat";

const MODEL = process.env.LLM_MODEL || "gpt-5.6-sol";

export function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  const aStart = trimmed.indexOf("[");
  const aEnd = trimmed.lastIndexOf("]");
  if (aStart >= 0 && aEnd > aStart) return trimmed.slice(aStart, aEnd + 1);
  return trimmed;
}

export async function chatText(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const client = createOpenAI();
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 2500,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

export async function chatJson<T>(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const client = createOpenAI();
  const system = `${opts.system}\n\n你必须只输出合法 JSON 对象，不要 markdown，不要解释。`;
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 3500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: opts.user },
      ],
    });
    const text = res.choices[0]?.message?.content ?? "{}";
    return JSON.parse(extractJson(text)) as T;
  } catch {
    const res = await client.chat.completions.create({
      model: MODEL,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 3500,
      messages: [
        { role: "system", content: system },
        { role: "user", content: opts.user },
      ],
    });
    const text = res.choices[0]?.message?.content ?? "{}";
    return JSON.parse(extractJson(text)) as T;
  }
}
