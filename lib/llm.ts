import "server-only";
import { createHash } from "crypto";
import OpenAI from "openai";
import { costUsd, isFatalGatewayError, pauseAi, recordSpend, takeModelSlot } from "./budget";
import { getJson, setJson } from "./store";

// All model calls go through SSI's LiteLLM gateway (OpenAI-compatible).
// Keys live only in server-side env vars; this module can never be bundled into the browser.

let cached: OpenAI | null = null;

function client(): OpenAI {
  const apiKey = process.env.LITELLM_API_KEY;
  const baseURL = process.env.LITELLM_BASE_URL;
  if (!apiKey || !baseURL) throw new Error("Model gateway not configured");
  if (!cached) cached = new OpenAI({ apiKey, baseURL, timeout: 45_000, maxRetries: 1 });
  return cached;
}

export function modelFor(tier: "main" | "fast"): string {
  // Organizer models: claude-sonnet-5-5 for reasoning, claude-haiku for quick steps.
  const main = process.env.LITELLM_MODEL || "claude-sonnet-5-5";
  if (tier === "fast") return process.env.LITELLM_FAST_MODEL || "claude-haiku";
  return main;
}

/** True when the model runs on this machine (e.g. Ollama): nothing leaves the laptop. */
export function isPrivateModel(): boolean {
  try {
    const h = new URL(process.env.LITELLM_BASE_URL || "").hostname;
    return ["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"].includes(h);
  } catch {
    return false;
  }
}

export function isConfigured(): boolean {
  return Boolean(process.env.LITELLM_API_KEY && process.env.LITELLM_BASE_URL);
}

/** Extract the first JSON object from a model reply (handles ```json fences and stray prose). */
export function parseJson<T>(text: string): T {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Agent did not return JSON");
  return JSON.parse(s.slice(start, end + 1)) as T;
}

export interface AgentResult<T> {
  data: T;
  tokens: number; // prompt + completion tokens actually billed (0 when cached)
  cached: boolean;
}

const CACHE_TTL = 60 * 60 * 24 * 7; // identical inputs (e.g. the scripted demo) cost nothing after the first run

/** Run one agent: system prompt + user content, JSON out. Cached by exact input. */
export async function runAgent<T>(opts: {
  system: string;
  user: string;
  tier?: "main" | "fast";
  maxTokens?: number;
}): Promise<AgentResult<T>> {
  const model = modelFor(opts.tier ?? "main");
  const system = opts.system + "\n\nRespond with a single valid JSON object only. No markdown, no commentary.";
  const key = "cp:ai:" + createHash("sha256").update(`${model}\n${system}\n${opts.user}`).digest("hex").slice(0, 40);

  const hit = await getJson<T>(key);
  if (hit) return { data: hit, tokens: 0, cached: true };

  const baseMax = opts.maxTokens ?? 900;
  const call = async (maxTokens: number): Promise<Completion> => {
    await takeModelSlot(); // a retry also counts against the per-minute limit
    let res;
    try {
      res = await client().chat.completions.create({
        model,
        max_tokens: maxTokens,
        // Small local models (Ollama) follow JSON far better with JSON mode; set LLM_JSON_MODE=1 to enable.
        ...(process.env.LLM_JSON_MODE === "1" ? { response_format: { type: "json_object" as const } } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: opts.user },
        ],
      });
    } catch (e) {
      const fatal = isFatalGatewayError(e);
      if (fatal) await pauseAi(fatal);
      throw e;
    }
    return {
      content: res.choices?.[0]?.message?.content ?? "",
      finish: res.choices?.[0]?.finish_reason,
      inTok: res.usage?.prompt_tokens ?? Math.ceil((system.length + opts.user.length) / 4),
      outTok: res.usage?.completion_tokens ?? Math.ceil(maxTokens / 2),
    };
  };
  const { data, tokens } = await completeJson<T>(call, baseMax, (c) =>
    recordSpend(costUsd(opts.tier ?? "main", c.inTok, c.outTok))
  );
  await setJson(key, data, CACHE_TTL);
  return { data, tokens, cached: false };
}

export interface Completion {
  content: string;
  finish: string | null | undefined;
  inTok: number;
  outTok: number;
}

const RETRY_FACTOR = 1.6;
const RETRY_CAP = 3500;

/** max_tokens for the one automatic retry after a cut-off reply; null when raising it would not help. */
export function retryMaxTokens(current: number): number | null {
  const next = Math.min(RETRY_CAP, Math.ceil(current * RETRY_FACTOR));
  return next > current ? next : null;
}

/**
 * Call the model and parse its JSON. If the reply was cut off (finish_reason "length") and cannot be parsed,
 * retry once with a larger max_tokens; throw only if the retry is also cut off. Every attempt's usage is reported.
 */
export async function completeJson<T>(
  call: (maxTokens: number) => Promise<Completion>,
  maxTokens: number,
  onUsage: (c: Completion) => Promise<void> | void = () => {}
): Promise<{ data: T; tokens: number }> {
  let max = maxTokens;
  let tokens = 0;
  for (let attempt = 0; ; attempt++) {
    const c = await call(max);
    tokens += c.inTok + c.outTok;
    await onUsage(c);
    try {
      return { data: parseJson<T>(c.content), tokens };
    } catch (e) {
      const next = retryMaxTokens(max);
      if (c.finish === "length" && attempt === 0 && next) {
        max = next;
        continue;
      }
      // Attach why the model stopped so callers can log it without ever logging the reply text.
      throw Object.assign(e as Error, { finishReason: c.finish ?? null });
    }
  }
}
