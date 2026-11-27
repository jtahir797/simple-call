import { knowledgeBuilderAgent } from "@/lib/agents";
import { gate } from "@/lib/api";
import { CHECKLIST } from "@/lib/checklist";
import { errorResponse, HttpError } from "@/lib/guard";
import { ndjsonStream, tracedAgent } from "@/lib/stream";
import type { Workspace } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const MAX_RAW = 40_000;
const str = (x: unknown, n: number) => (typeof x === "string" ? x.slice(0, n) : "");

/** Knowledge Builder: raw project documents in, structured knowledge plus missing-item questions out. */
export async function POST(req: Request) {
  let raw: string, current: Workspace;
  try {
    const b = (await gate(req, "knowledge", 3)) as Record<string, unknown>;
    raw = typeof b.raw === "string" ? b.raw : "";
    if (raw.trim().length < 200) throw new HttpError(400, "too_short", "Paste at least a few paragraphs of project material.");
    if (raw.length > MAX_RAW) throw new HttpError(413, "too_large", `Paste up to ${MAX_RAW.toLocaleString()} characters at a time.`);
    const w = (b.ws ?? {}) as Record<string, unknown>;
    current = {
      projectName: str(w.projectName, 200), clientName: str(w.clientName, 200), clientCompany: str(w.clientCompany, 200),
      clientLocation: str(w.clientLocation, 200), profile: str(w.profile, 4000), guardrails: str(w.guardrails, 4000),
      knowledge: "", myName: str(w.myName, 120),
    };
  } catch (e) {
    return errorResponse(e);
  }
  const checklist = CHECKLIST.map((c) => `- ${c.title}${c.heading ? ` (heading "## ${c.heading}")` : ` (goes in "${c.field}")`}: ${c.questions.join(" ")}`).join("\n");
  return ndjsonStream(async (send) => {
    const r = await tracedAgent(send, "KnowledgeBuilder", () => knowledgeBuilderAgent(raw, checklist, current), (d) => `${d.gaps.length} gaps`);
    if (r) send({ type: "knowledge", data: r });
  });
}
