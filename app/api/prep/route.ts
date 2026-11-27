import { strategistAgent } from "@/lib/agents";
import { gate } from "@/lib/api";
import { cleanWorkspace, errorResponse } from "@/lib/guard";
import { ndjsonStream, tracedAgent } from "@/lib/stream";
import type { Workspace } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Pre-call Strategist: likely hard questions with grounded answers, landmines and an opening line. */
export async function POST(req: Request) {
  let ws: Workspace;
  let notes = "";
  let agenda = "";
  try {
    const b = (await gate(req, "prep", 4)) as Record<string, unknown>;
    ws = cleanWorkspace(b.ws);
    notes = typeof b.lastCallNotes === "string" ? b.lastCallNotes.slice(0, 4000) : "";
    agenda = typeof b.agenda === "string" ? b.agenda.slice(0, 2000) : "";
  } catch (e) {
    return errorResponse(e);
  }
  return ndjsonStream(async (send) => {
    const brief = await tracedAgent(send, "Strategist", () => strategistAgent(ws, notes, agenda), (r) => `${r.likelyQuestions.length} questions`);
    if (brief) send({ type: "brief", brief });
  });
}
