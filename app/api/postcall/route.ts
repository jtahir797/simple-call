import { followUpAgent, fmtLines, psychologistAgent, riskOfficerAgent, scribeAgent, type PostInput } from "@/lib/agents";
import { gate } from "@/lib/api";
import { cleanLines, cleanLog, cleanPulses, cleanWorkspace, errorResponse, HttpError, LIMITS } from "@/lib/guard";
import { ndjsonStream, tracedAgent } from "@/lib/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Post-call: four specialist agents run in parallel and stream their sections back. */
export async function POST(req: Request) {
  let input: PostInput;
  try {
    const b = (await gate(req, "postcall", 4)) as Record<string, unknown>;
    const ws = cleanWorkspace(b.ws);
    const lines = cleanLines(b.lines, LIMITS.postLines);
    if (!lines.length) throw new HttpError(400, "no_transcript", "No transcript to summarise.");
    input = {
      ws,
      transcript: fmtLines(lines, ws),
      pulses: cleanPulses(b.pulses),
      log: cleanLog(b.log),
      date: String(b.date ?? "").slice(0, 40),
    };
  } catch (e) {
    return errorResponse(e);
  }

  return ndjsonStream(async (send) => {
    const t0 = Date.now();
    send({ type: "event", event: { agent: "Conductor", status: "running", note: "post-call" } });
    await Promise.all([
      tracedAgent(send, "Scribe", () => scribeAgent(input)).then((d) => d && send({ type: "section", key: "minutes", data: d })),
      tracedAgent(send, "Psychologist", () => psychologistAgent(input)).then((d) => d && send({ type: "section", key: "psychology", data: d })),
      tracedAgent(send, "RiskOfficer", () => riskOfficerAgent(input)).then((d) => d && send({ type: "section", key: "raid", data: d })),
      tracedAgent(send, "FollowUp", () => followUpAgent(input)).then((d) => d && send({ type: "section", key: "email", data: d })),
    ]);
    send({ type: "event", event: { agent: "Conductor", status: "ok", ms: Date.now() - t0 } });
  });
}
