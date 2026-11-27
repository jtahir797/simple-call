import "server-only";
import { HttpError } from "./guard";
import { getJson, getNum, incr, setJson, storeBackend } from "./store";

// The organizers' LiteLLM key has $25 in total, no refill, and it must also cover the weeks of judging,
// plus a 60 requests/minute limit. This module keeps the live app inside both, and flips the app to the
// recorded Instant replay (0 tokens) instead of failing when the money or the gateway runs out.

const num = (v: string | undefined, d: number) => (v && isFinite(Number(v)) ? Number(v) : d);

/** Stop live AI at this many USD of total key spend (leaves headroom for testing and recording). */
export const spendCapUsd = () => num(process.env.SPEND_CAP_USD, 20);
/** Model calls per minute across the app (the key allows 60). */
export const modelRpm = () => num(process.env.MODEL_RPM, 55);
/** How long a request may wait for the next minute's capacity before giving up. */
const slotWaitMs = () => num(process.env.MODEL_SLOT_WAIT_MS, 20_000);

// USD per million tokens. Defaults are conservative estimates; set them to the gateway's real prices.
function price(tier: "main" | "fast") {
  return tier === "main"
    ? { in: num(process.env.PRICE_MAIN_IN, 3), out: num(process.env.PRICE_MAIN_OUT, 15) }
    : { in: num(process.env.PRICE_FAST_IN, 1), out: num(process.env.PRICE_FAST_OUT, 5) };
}

export function costUsd(tier: "main" | "fast", inTok: number, outTok: number): number {
  const p = price(tier);
  return (inTok * p.in + outTok * p.out) / 1_000_000;
}

const SPEND_KEY = "cp:usd:total"; // micro-dollars, kept for 60 days
const FLAG_KEY = "cp:ai:paused";

export async function recordSpend(usd: number) {
  if (usd > 0) await incr(SPEND_KEY, Math.round(usd * 1_000_000), 60 * 60 * 24 * 60);
}

/** Authoritative spend straight from LiteLLM (/key/info), cached for a minute. Null if not available. */
let gw: { at: number; spend: number | null; max: number | null } = { at: 0, spend: null, max: null };
export async function gatewaySpend(): Promise<{ spend: number | null; max: number | null }> {
  if (Date.now() - gw.at < 60_000) return gw;
  gw = { at: Date.now(), spend: gw.spend, max: gw.max };
  const base = (process.env.LITELLM_BASE_URL || "").replace(/\/v1\/?$/, "");
  if (!base || !process.env.LITELLM_API_KEY) return gw;
  try {
    const r = await fetch(`${base}/key/info`, {
      headers: { Authorization: `Bearer ${process.env.LITELLM_API_KEY}` },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (r.ok) {
      const j = (await r.json()) as { info?: { spend?: number; max_budget?: number | null } };
      const spend = typeof j.info?.spend === "number" ? j.info.spend : null;
      const max = typeof j.info?.max_budget === "number" ? j.info.max_budget : null;
      gw = { at: Date.now(), spend, max };
    }
  } catch {
    /* gateway info is optional */
  }
  return gw;
}

/** Spend we can trust most: the gateway's own figure, else our running estimate. */
export async function currentSpend(): Promise<{ usd: number; source: "gateway" | "estimate" }> {
  const g = await gatewaySpend();
  if (g.spend != null) return { usd: g.spend, source: "gateway" };
  return { usd: (await getNum(SPEND_KEY)) / 1_000_000, source: "estimate" };
}

/** Circuit breaker: after a budget or key error from the gateway, pause live AI for a while. */
export async function pauseAi(reason: string, minutes = 15) {
  await setJson(FLAG_KEY, { reason, until: Date.now() + minutes * 60_000 }, minutes * 60);
}

async function pausedReason(): Promise<string | null> {
  const f = await getJson<{ reason: string; until: number }>(FLAG_KEY);
  return f && f.until > Date.now() ? f.reason : null;
}

export async function assertBudget() {
  const paused = await pausedReason();
  if (paused) throw new HttpError(429, "budget", `Live AI is paused (${paused}). Instant replay still works.`);
  const s = await currentSpend();
  if (s.usd >= spendCapUsd()) {
    throw new HttpError(429, "budget", "The demo's AI budget is used up. Instant replay still works.");
  }
}

/**
 * Global model-call limiter so the app never trips the key's 60 requests/minute.
 * A burst waits for the next minute's capacity (up to MODEL_SLOT_WAIT_MS) instead of failing.
 */
export async function takeModelSlot() {
  const deadline = Date.now() + slotWaitMs();
  for (;;) {
    const minute = Math.floor(Date.now() / 60_000);
    const n = await incr(`cp:rpm:${minute}`, 1, 70);
    if (n <= modelRpm()) return;
    const nextMinute = (minute + 1) * 60_000 + 50;
    if (nextMinute > deadline) {
      throw new HttpError(429, "busy", "Many people are using the demo right now. Try again in a minute or use Instant replay.");
    }
    await new Promise((r) => setTimeout(r, nextMinute - Date.now()));
  }
}

export async function budgetStatus() {
  const s = await currentSpend();
  const cap = spendCapUsd();
  return {
    usedPct: Math.min(100, Math.round((s.usd / cap) * 100)),
    exhausted: s.usd >= cap || Boolean(await pausedReason()),
    source: s.source,
    backend: storeBackend,
  };
}

/**
 * Is this gateway error about money or the key (so retrying will not help)?
 * Only real gateway HTTP errors (the openai client sets a numeric `status`) count. Parse errors and other
 * local errors never do, even if their text mentions "budget".
 */
export function isFatalGatewayError(e: unknown): string | null {
  const status = (e as { status?: unknown })?.status;
  if (typeof status !== "number") return null;
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if ((status === 400 || status === 429) && /budget has been exceeded|exceededbudget|budget.*exceeded|exceeded.*budget/i.test(msg)) {
    return "budget reached";
  }
  if (status === 401 || status === 403) return "key rejected";
  return null;
}
