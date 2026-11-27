import "server-only";

// Tiny key-value layer used for rate limits, the token budget and the response cache.
// Uses Upstash Redis (free tier, REST) when UPSTASH_REDIS_REST_URL/TOKEN are set, so limits hold
// across all Vercel instances. Falls back to per-instance memory otherwise.

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
export const storeBackend: "upstash" | "memory" = URL_ && TOKEN ? "upstash" : "memory";

type Cmd = (string | number)[];

async function redis(cmds: Cmd[]): Promise<unknown[] | null> {
  if (storeBackend !== "upstash") return null;
  try {
    const r = await fetch(`${URL_}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds.map((c) => c.map(String))),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { result?: unknown; error?: string }[];
    return j.map((x) => x.result ?? null);
  } catch {
    return null; // never let the store take the app down
  }
}

// ---------- memory fallback with expiry ----------
const mem = new Map<string, { v: string; exp: number }>();
function memGet(k: string) {
  const e = mem.get(k);
  if (!e) return null;
  if (e.exp < Date.now()) {
    mem.delete(k);
    return null;
  }
  return e.v;
}
function memSet(k: string, v: string, ttlSec: number) {
  if (mem.size > 5000) {
    // drop oldest entries
    const drop = Array.from(mem.keys()).slice(0, 1000);
    drop.forEach((d) => mem.delete(d));
  }
  mem.set(k, { v, exp: Date.now() + ttlSec * 1000 });
}

/** Atomically add n to a counter that expires after ttlSec. Returns the new value. */
export async function incr(key: string, n: number, ttlSec: number): Promise<number> {
  const r = await redis([
    ["INCRBY", key, n],
    ["EXPIRE", key, ttlSec, "NX"],
  ]);
  if (r && typeof r[0] === "number") return r[0];
  const cur = Number(memGet(key) ?? 0) + n;
  const e = mem.get(key);
  memSet(key, String(cur), e ? Math.max(1, Math.round((e.exp - Date.now()) / 1000)) : ttlSec);
  return cur;
}

export async function getNum(key: string): Promise<number> {
  const r = await redis([["GET", key]]);
  if (r) return Number(r[0] ?? 0);
  return Number(memGet(key) ?? 0);
}

export async function getJson<T>(key: string): Promise<T | null> {
  const r = await redis([["GET", key]]);
  const raw = r ? (r[0] as string | null) : memGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJson(key: string, value: unknown, ttlSec: number): Promise<void> {
  const s = JSON.stringify(value);
  if (s.length > 50_000) return;
  const r = await redis([["SET", key, s, "EX", ttlSec]]);
  if (!r) memSet(key, s, ttlSec);
}
