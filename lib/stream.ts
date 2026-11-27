import "server-only";
import { isFatalGatewayError } from "./budget";
import { HttpError, publicError } from "./guard";
import type { AgentResult } from "./llm";
import type { AgentName, StreamMsg } from "./types";

/** NDJSON stream so the UI can show each agent finishing in real time. */
export function ndjsonStream(work: (send: (m: StreamMsg) => void) => Promise<void>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (m: StreamMsg) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(m) + "\n"));
        } catch {
          /* client went away */
        }
      };
      try {
        await work(send);
      } catch (e) {
        send({ type: "error", message: publicError(e) });
      }
      send({ type: "done" });
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

const shrink = (x: unknown) => {
  const s = JSON.stringify(x);
  return s && s.length > 4000 ? JSON.parse(JSON.stringify({ truncated: s.slice(0, 4000) })) : x;
};

/** Run an AI agent and report start, finish, tokens and output (for the Agent X-ray) to the UI. */
export async function tracedAgent<T>(
  send: (m: StreamMsg) => void,
  agent: AgentName,
  fn: () => Promise<AgentResult<T>>,
  note?: (r: T) => string
): Promise<T | null> {
  const t0 = Date.now();
  send({ type: "event", event: { agent, status: "running" } });
  try {
    const r = await fn();
    send({
      type: "event",
      event: { agent, status: "ok", ms: Date.now() - t0, note: note?.(r.data), tokens: r.tokens, cached: r.cached, detail: shrink(r.data) },
    });
    return r.data;
  } catch (e) {
    // Server log for diagnosis: agent, error type, status and finish_reason only. Never the message, reply text, key or headers.
    const x = e as { name?: unknown; status?: unknown; finishReason?: unknown };
    const part = (k: string, v: unknown) => (v === undefined || v === null ? "" : ` ${k}=${String(v).replace(/[^\w.-]/g, "").slice(0, 40)}`);
    console.error(`[agent-failed] agent=${agent}${part("error", x?.name ?? typeof e)}${typeof x?.status === "number" ? part("status", x.status) : ""}${part("finish_reason", x?.finishReason)}`);
    send({ type: "event", event: { agent, status: "error", ms: Date.now() - t0, note: publicError(e) } });
    // Money, key or capacity problems: tell the UI once so it can switch to Instant replay.
    const fatal = isFatalGatewayError(e);
    if (fatal || (e instanceof HttpError && e.code === "busy") || (e as { status?: number })?.status === 429) {
      send({ type: "error", message: fatal ? `Live AI unavailable: ${fatal}` : publicError(e), code: fatal ? "budget" : "busy" });
    }
    return null;
  }
}

/** Run a deterministic tool step (no model cost) with the same tracing. */
export function tracedTool<T>(send: (m: StreamMsg) => void, agent: AgentName, fn: () => T, note?: (r: T) => string): T {
  const t0 = Date.now();
  const r = fn();
  send({ type: "event", event: { agent, status: "ok", ms: Date.now() - t0, note: note?.(r), tokens: 0, detail: shrink(r) } });
  return r;
}

export const uid = () => crypto.randomUUID().slice(0, 8);
