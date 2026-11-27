import { assistAgent } from "@/lib/agents";
import { gate } from "@/lib/api";
import { cleanLines, cleanWorkspace, errorResponse, HttpError } from "@/lib/guard";
import { ndjsonStream, tracedAgent } from "@/lib/stream";
import type { Line, QuickAction, Workspace } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ACTIONS = ["clarify", "recap", "followup"] as const;

/** Quick actions: Clarify (K), Recap (R), Follow-up questions (F). "Answer now" (A) reuses the full Conductor chain. */
export async function POST(req: Request) {
  let ws: Workspace, lines: Line[], action: Exclude<QuickAction, "answer">;
  try {
    const b = (await gate(req, "action", 12)) as Record<string, unknown>;
    if (!ACTIONS.includes(b.action as (typeof ACTIONS)[number])) throw new HttpError(400, "bad_action", "Unknown action.");
    action = b.action as (typeof ACTIONS)[number];
    ws = cleanWorkspace(b.ws);
    lines = cleanLines(b.lines, action === "recap" ? 60 : 12);
    if (!lines.length) throw new HttpError(400, "no_transcript", "Nothing said yet.");
  } catch (e) {
    return errorResponse(e);
  }
  return ndjsonStream(async (send) => {
    const r = await tracedAgent(send, "Assist", () => assistAgent(ws, lines, action), () => action);
    if (r) send({ type: "assist", action, text: r.text });
  });
}
