import { answerAgent, listenerAgent, pulseAgent, riskAgent, verifierAgent, type AnswerOut } from "@/lib/agents";
import { gate } from "@/lib/api";
import { cleanLines, cleanPulse, cleanStrings, cleanWorkspace, errorResponse, HttpError, LIMITS } from "@/lib/guard";
import { retrieveMulti } from "@/lib/retrieve";
import { ndjsonStream, tracedAgent, tracedTool, uid } from "@/lib/stream";
import { alertRule, factCheck, isSmallTalk, policyScan, usCalendar, wordCount } from "@/lib/tools";
import type { FactCheckResult, Pulse, Workspace } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function runFactCheck(ws: Workspace, ans: AnswerOut): FactCheckResult {
  const text = `${ans.sayThis} ${ans.keyPoints.join(". ")}`;
  // Ground against the whole knowledge base (the source of truth), not only the excerpts retrieved.
  const source = ws.knowledge + "\n" + ws.profile + "\n" + ws.guardrails;
  const fc = factCheck(text, source);
  return { ...fc, policy: ans.defer ? [] : policyScan(ans.sayThis), calendar: usCalendar(text, ws.knowledge) };
}

/**
 * CONDUCTOR: runs on every new transcript line.
 *  client line -> Listener/Planner -> Knowledge tool -> Answer -> FactCheck tool -> Verifier -> (loop back: Answer revises -> FactCheck)
 *                 in parallel with Psychology (Pulse) and Risk
 *  employee line -> Risk only (captures commitments the employee makes)
 */
export async function POST(req: Request) {
  let ws: Workspace, lines, latestId: string, existing: string[], prevPulse: Pulse | null, direct: boolean;
  try {
    const body = (await gate(req, "orchestrate", 40)) as Record<string, unknown>;
    ws = cleanWorkspace(body.ws);
    lines = cleanLines(body.lines, LIMITS.liveLines);
    latestId = String(body.latestId ?? "");
    existing = cleanStrings(body.existing, LIMITS.existing);
    prevPulse = cleanPulse(body.prevPulse);
    direct = body.direct === true;
  } catch (e) {
    return errorResponse(e);
  }
  const latest = lines.find((l) => l.id === latestId);
  if (!latest || !latest.text.trim()) return errorResponse(new HttpError(400, "bad_line", "Latest line missing."));

  const recent = lines.slice(-12);
  const tail = lines.slice(-4);

  return ndjsonStream(async (send) => {
    const t0 = Date.now();
    const isClient = latest.speaker === "client" || direct;
    const small = !direct && isSmallTalk(latest.text);
    const words = wordCount(latest.text);
    // Deterministic alert rules decide if the line looks addressed to the employee before any model is called.
    const rule = direct ? "asked directly" : isClient && !small ? alertRule(latest.text, ws.myName, ws.topics) : null;
    send({
      type: "event",
      event: {
        agent: "Conductor",
        status: "running",
        note: small ? "small talk: model calls skipped" : !isClient ? "employee spoke" : rule ? `alert: ${rule}` : "no question signal",
      },
    });

    // --- Psychology (Pulse) ---
    const pulseP: Promise<Pulse | null> =
      isClient && !direct && words >= 3
        ? tracedAgent(send, "Pulse", () => pulseAgent(ws, recent, latest, prevPulse), (r) => `${r.emotion} ${r.score.toFixed(2)}`).then((r) => {
            if (!r) return null;
            const p: Pulse = { ...r, lineId: latest.id };
            send({ type: "pulse", pulse: p });
            return p;
          })
        : Promise.resolve(null);

    // --- Risk & issue log: client lines only (its window also covers the employee's last reply), skip short lines ---
    const riskP =
      isClient && words >= 6 && !small
        ? tracedAgent(send, "Risk", () => riskAgent(ws, tail, existing), (r) => `${r.length} new`).then((items) => {
            if (items && items.length) send({ type: "log", items: items.map((i) => ({ ...i, id: uid(), lineId: latest.id })) });
          })
        : Promise.resolve(send({ type: "event", event: { agent: "Risk", status: "skipped", note: isClient ? "short line" : "runs on the next client line" } }));

    // --- Assist chain ---
    const assistP = (async () => {
      if (!isClient || small || !rule) {
        send({ type: "event", event: { agent: "Listener", status: "skipped", note: small ? "small talk" : !isClient ? "employee line" : "no question signal" } });
        return;
      }
      let question = latest.text;
      let intent = "other";
      let urgency = "medium";
      let queries: string[] = [];
      let sensitive: string[] = [];
      if (!direct) {
        const heard = await tracedAgent(send, "Listener", () => listenerAgent(ws, recent, latest), (r) =>
          r.needsAnswer ? `${r.intent}, ${r.searchQueries.length} searches planned` : "no question"
        );
        if (!heard || !heard.needsAnswer) return;
        ({ question, intent, urgency } = heard);
        queries = heard.searchQueries;
        sensitive = heard.sensitive;
      }
      send({ type: "question", question, intent, urgency });

      const chunks = tracedTool(send, "Retriever", () => retrieveMulti(ws.knowledge, [question, ...queries, latest.text], 6), (r) =>
        `${queries.length + 1} queries, ${r.length} sections`
      );

      const mood = await Promise.race([pulseP, new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
      const ans = await tracedAgent(send, "Answer", () => answerAgent(ws, recent, question, chunks, mood ?? prevPulse), (r) =>
        `confidence ${Math.round(r.confidence * 100)}%`
      );
      if (!ans) return;
      const id = uid();
      send({ type: "suggestion", suggestion: { id, lineId: latest.id, question, intent, urgency, ...ans, verdict: "pending", issues: [] } });

      const check = tracedTool(send, "FactCheck", () => runFactCheck(ws, ans), (r) =>
        `${r.grounded}/${r.total} grounded${r.policy.length ? `, policy: ${r.policy.join(",")}` : ""}${r.calendar.length ? `, ${r.calendar.length} calendar flag` : ""}`
      );

      const ver = await tracedAgent(send, "Verifier", () => verifierAgent(ws, question, ans, chunks, check, sensitive), (r) => r.verdict);
      if (!ver) {
        send({ type: "verdict", id, verdict: "caution", issues: ["Verifier unavailable: double-check before saying"], check });
        return;
      }
      if (ver.verdict === "verified") {
        // An approved deferral is still a deferral: the user must not commit on the call.
        send({ type: "verdict", id, verdict: ans.defer ? "defer" : "verified", issues: ver.issues, check });
        return;
      }

      // Loop back once: the Answer agent revises its own draft using the Verifier's issues and the tool results.
      const rev = await tracedAgent(
        send,
        "Revise",
        () => answerAgent(ws, recent, question, chunks, mood ?? prevPulse, { draft: ans.sayThis, issues: ver.issues, check }),
        () => "draft revised"
      );
      if (!rev) {
        send({ type: "verdict", id, verdict: "caution", issues: ver.issues, check });
        return;
      }
      const check2 = tracedTool(send, "FactCheck", () => runFactCheck(ws, rev), (r) => `re-check ${r.grounded}/${r.total} grounded`);
      const clean = check2.grounded === check2.total && check2.policy.length === 0;
      send({
        type: "verdict",
        id,
        verdict: ver.verdict === "defer" || rev.defer ? "defer" : clean ? "revised" : "caution",
        issues: clean ? ver.issues : [...ver.issues, "Re-check still found ungrounded facts: confirm before saying"],
        sayThis: rev.sayThis,
        keyPoints: rev.keyPoints,
        confidence: rev.confidence,
        check: check2,
      });
    })();

    await Promise.all([pulseP, riskP, assistP]);
    send({ type: "event", event: { agent: "Conductor", status: "ok", ms: Date.now() - t0 } });
  });
}
