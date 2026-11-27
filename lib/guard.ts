import "server-only";
import { timingSafeEqual } from "crypto";
import { DEFAULT_MODE, MODES } from "./modes";
import { incr } from "./store";
import type { Line, LogItem, Pulse, Workspace } from "./types";

// ---------------- limits ----------------
export const LIMITS = {
  bodyBytes: 400_000,
  field: 200,
  profile: 4_000,
  guardrails: 4_000,
  knowledge: 60_000,
  lineChars: 1_200,
  liveLines: 40,
  postLines: 400,
  existing: 80,
  pulses: 200,
  log: 200,
};

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) {
    super(message);
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (e.retryAfter) headers["Retry-After"] = String(e.retryAfter);
    return Response.json({ error: e.message, code: e.code }, { status: e.status, headers });
  }
  return Response.json({ error: "Unexpected error", code: "internal" }, { status: 500 });
}

// ---------------- request checks ----------------
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  ).slice(0, 64);
}

/** Only accept browser calls from this site (stops other websites from spending our tokens). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!origin) {
    if (process.env.NODE_ENV !== "production") return; // local scripts and dev tools
    throw new HttpError(403, "origin", "Requests must come from the Simple Call app.");
  }
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "origin", "Bad origin.");
  }
  if (originHost === host || allowed.includes(origin)) return;
  throw new HttpError(403, "origin", "Cross-site requests are not allowed.");
}

/** Optional shared access code (set ACCESS_CODE on Vercel to lock the demo down if ever needed). */
export function assertAccess(req: Request) {
  const code = process.env.ACCESS_CODE;
  if (!code) return;
  const got = req.headers.get("x-access-code") || "";
  const a = Buffer.from(got);
  const b = Buffer.from(code);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(401, "access_code", "Access code required.");
  }
}

export async function readJson(req: Request): Promise<unknown> {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new HttpError(415, "content_type", "JSON only.");
  const len = Number(req.headers.get("content-length") || 0);
  if (len > LIMITS.bodyBytes) throw new HttpError(413, "too_large", "Request too large.");
  const text = await req.text();
  if (text.length > LIMITS.bodyBytes) throw new HttpError(413, "too_large", "Request too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "bad_json", "Invalid JSON.");
  }
}

// ---------------- rate limit + token budget ----------------
/** Fixed-window limiter per client IP and route. */
export async function rateLimit(req: Request, route: string, limit: number, windowSec: number) {
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const n = await incr(`cp:rl:${route}:${clientIp(req)}:${win}`, 1, windowSec + 5);
  if (n > limit) {
    throw new HttpError(429, "rate_limited", "Too many requests. Please slow down.", windowSec);
  }
}

// ---------------- input sanitising ----------------
const str = (x: unknown, max: number) => (typeof x === "string" ? x : "").replace(/\u0000/g, "").slice(0, max);

export function cleanWorkspace(x: unknown): Workspace {
  const w = (x ?? {}) as Record<string, unknown>;
  const knowledge = typeof w.knowledge === "string" ? w.knowledge : "";
  if (knowledge.length > LIMITS.knowledge) {
    throw new HttpError(413, "knowledge_too_large", `Project knowledge is limited to ${LIMITS.knowledge.toLocaleString()} characters.`);
  }
  const ws: Workspace = {
    projectName: str(w.projectName, LIMITS.field),
    clientName: str(w.clientName, LIMITS.field),
    clientCompany: str(w.clientCompany, LIMITS.field),
    clientLocation: str(w.clientLocation, LIMITS.field),
    profile: str(w.profile, LIMITS.profile),
    guardrails: str(w.guardrails, LIMITS.guardrails),
    knowledge: str(knowledge, LIMITS.knowledge),
    mode: MODES.some((m) => m.id === w.mode) ? (w.mode as string) : DEFAULT_MODE,
    myName: str(w.myName, 120),
    topics: str(w.topics, 600),
  };
  if (!ws.knowledge.trim()) throw new HttpError(400, "no_knowledge", "Add project knowledge first.");
  return ws;
}

export function cleanLines(x: unknown, max: number): Line[] {
  if (!Array.isArray(x)) throw new HttpError(400, "bad_lines", "Transcript missing.");
  return x.slice(-max).map((l) => {
    const o = (l ?? {}) as Record<string, unknown>;
    return {
      id: str(o.id, 40),
      speaker: o.speaker === "me" ? "me" : "client",
      text: str(o.text, LIMITS.lineChars),
      t: typeof o.t === "number" && isFinite(o.t) ? o.t : 0,
    } as Line;
  });
}

export function cleanPulse(x: unknown): Pulse | null {
  if (!x || typeof x !== "object") return null;
  const p = x as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0);
  return {
    lineId: str(p.lineId, 40),
    score: num(p.score, -1, 1),
    emotion: str(p.emotion, 40),
    intensity: num(p.intensity, 0, 1),
    trust: p.trust === "low" || p.trust === "high" ? p.trust : "medium",
    cues: [],
    need: str(p.need, 160),
    tip: "",
  };
}

export function cleanStrings(x: unknown, max: number, each = 200): string[] {
  return Array.isArray(x) ? x.slice(-max).map((s) => str(s, each)).filter(Boolean) : [];
}

export function cleanLog(x: unknown): LogItem[] {
  if (!Array.isArray(x)) return [];
  return x.slice(-LIMITS.log).map((i) => {
    const o = (i ?? {}) as Record<string, unknown>;
    const types = ["risk", "issue", "action", "commitment"];
    const sev = ["low", "medium", "high"];
    return {
      id: str(o.id, 40),
      lineId: str(o.lineId, 40),
      type: (types.includes(o.type as string) ? o.type : "risk") as LogItem["type"],
      title: str(o.title, 160),
      detail: str(o.detail, 400),
      severity: (sev.includes(o.severity as string) ? o.severity : "medium") as LogItem["severity"],
      owner: str(o.owner, 80),
    };
  });
}

export function cleanPulses(x: unknown): Pulse[] {
  return Array.isArray(x) ? (x.slice(-LIMITS.pulses).map(cleanPulse).filter(Boolean) as Pulse[]) : [];
}

/** Map any model/gateway failure to a safe, short message (no URLs, keys or stack traces). */
export function publicError(e: unknown): string {
  const status = (e as { status?: number })?.status;
  if (e instanceof HttpError) return e.message;
  if (status === 401 || status === 403) return "Model gateway rejected the key";
  if (status === 429) return "Model rate limit or spend cap reached";
  if (status && status >= 500) return "Model gateway error";
  const msg = e instanceof Error ? e.message : "";
  if (/timeout|timed out|abort/i.test(msg)) return "Model call timed out";
  if (/JSON/i.test(msg)) return "Agent returned an unreadable answer";
  return "Agent failed";
}
