/**
 * Records one REAL run of the scripted demo call through your own running app, so evaluators can
 * replay it instantly at zero model cost (and the app can fall back to it if the AI budget runs out).
 *
 *   npm run dev            (with your LITELLM_* values in .env.local)
 *   npm run record         (in a second terminal)  ->  writes public/demo-recording.json
 *
 * Commit public/demo-recording.json and redeploy.
 */
import { writeFileSync } from "fs";
import { DEMO_SCRIPT, DEMO_WORKSPACE } from "../lib/demo";
import type { Line, LogItem, Pulse, Recording, StreamMsg } from "../lib/types";

const BASE = process.env.SIMPLECALL_URL || "http://localhost:3000";

async function stream(path: string, body: unknown): Promise<StreamMsg[]> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE, "x-access-code": process.env.ACCESS_CODE || "" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text.split("\n").filter(Boolean).map((l) => JSON.parse(l) as StreamMsg);
}

async function main() {
  const health = await (await fetch(BASE + "/api/health")).json();
  if (!health.configured) throw new Error("Live AI is not configured on " + BASE);
  const lines: Line[] = [];
  const pulses: Pulse[] = [];
  const log: LogItem[] = [];
  const steps: Recording["steps"] = [];
  let tokens = 0;

  for (const [i, s] of DEMO_SCRIPT.entries()) {
    const line: Line = { id: `rec${i}`, speaker: s.speaker, text: s.text, t: i * 6000 };
    lines.push(line);
    const msgs = await stream("/api/orchestrate", {
      ws: DEMO_WORKSPACE,
      lines: lines.slice(-14),
      latestId: line.id,
      existing: log.map((l) => `${l.type}: ${l.title}`),
      prevPulse: pulses[pulses.length - 1] ?? null,
    });
    for (const m of msgs) {
      if (m.type === "pulse") pulses.push(m.pulse);
      if (m.type === "log") log.push(...m.items);
      if (m.type === "event") tokens += m.event.tokens ?? 0;
      if (m.type === "error") console.warn("  agent error:", m.message);
    }
    steps.push({ lineId: line.id, speaker: s.speaker, text: s.text, msgs });
    console.log(`${i + 1}/${DEMO_SCRIPT.length} ${s.speaker}: ${msgs.filter((m) => m.type === "event" && m.event.status === "ok").length} steps`);
  }

  console.log("post-call agents…");
  const post = await stream("/api/postcall", { ws: DEMO_WORKSPACE, lines, pulses, log, date: new Date().toDateString() });
  console.log("pre-call brief…");
  const brief = await stream("/api/prep", { ws: DEMO_WORKSPACE, lastCallNotes: "" });
  [...post, ...brief].forEach((m) => m.type === "event" && (tokens += m.event.tokens ?? 0));

  const rec: Recording = { recordedAt: new Date().toISOString(), model: health.model, steps, post, brief };
  writeFileSync("public/demo-recording.json", JSON.stringify(rec));
  console.log(`Saved public/demo-recording.json (${tokens.toLocaleString()} tokens used for this recording).`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
