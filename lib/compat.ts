import OpenAI from "openai";

let client: OpenAI | null = null;

export function createOpenAI() {
  if (client) return client;
  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL || "https://api.openlux.ai/v1";
  if (!apiKey) {
    throw new Error("缺少 LLM_API_KEY。请在 .env.local 中配置。");
  }
  client = new OpenAI({ apiKey, baseURL });
  return client;
}
