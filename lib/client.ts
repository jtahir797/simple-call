"use client";

import type { ReportSections, StreamMsg, Suggestion } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

/** POST JSON and read the NDJSON stream, invoking onMsg for each message. */
export function getAccessCode(): string {
  try {
    return sessionStorage.getItem("cp.code") || "";
  } catch {
    return "";
  }
}
export function setAccessCode(code: string) {
  try {
    sessionStorage.setItem("cp.code", code);
  } catch {}
}

export async function streamPost(url: string, body: unknown, onMsg: (m: StreamMsg) => void, signal?: AbortSignal) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-access-code": getAccessCode() },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    onMsg({ type: "error", message: "Network error", code: "network" });
    onMsg({ type: "done" });
    return;
  }
  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status})`;
    let code = String(res.status);
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
      if (j?.code) code = j.code;
    } catch {}
    onMsg({ type: "error", message: msg, code });
    onMsg({ type: "done" });
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        onMsg(JSON.parse(line) as StreamMsg);
      } catch {}
    }
  }
}

// ---- per-browser persistence (wrapped: storage can be unavailable) ----
export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ---- turn agent JSON into editable markdown ----
type AnyObj = Record<string, unknown>;
const list = (x: unknown): AnyObj[] => (Array.isArray(x) ? (x as AnyObj[]) : []);
const strs = (x: unknown): string[] => (Array.isArray(x) ? x.map(String) : []);
const s = (x: unknown) => (x == null ? "" : String(x));
const bullets = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- None noted");

export function minutesMd(d: AnyObj, meta: { project: string; client: string; date: string }): string {
  const actions = list(d.actions);
  return [
    `## ${s(d.title) || "Meeting minutes"}`,
    `**Project:** ${meta.project}  \n**Client:** ${meta.client}  \n**Date:** ${meta.date}`,
    `**Attendees:** ${strs(d.attendees).join(", ") || "-"}`,
    `### Summary\n${s(d.summary)}`,
    `### Discussion`,
    list(d.topics)
      .map((t) => `**${s(t.topic)}**\n${bullets(strs(t.points))}`)
      .join("\n\n"),
    `### Decisions\n${bullets(strs(d.decisions))}`,
    `### Action items\n${
      actions.length
        ? actions.map((a) => `- [ ] ${s(a.action)} (Owner: ${s(a.owner) || "TBD"}${s(a.due) ? `, Due: ${s(a.due)}` : ""})`).join("\n")
        : "- None"
    }`,
    s(d.nextSteps) ? `### Next steps\n${s(d.nextSteps)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function psychologyMd(d: AnyObj): string {
  const num = (x: unknown) => (typeof x === "number" ? x.toFixed(2) : "-");
  return [
    `## Client sentiment and psychology read`,
    `**Overall:** ${s(d.overall)}`,
    `**Sentiment:** ${num(d.startScore)} at start to ${num(d.endScore)} at end  \n**Trust trend:** ${s(d.trustTrend)}  \n**Relationship risk:** ${s(d.relationshipRisk)}`,
    `### Emotional arc\n${
      list(d.arc).length ? list(d.arc).map((a) => `- **${s(a.emotion)}** - "${s(a.moment).replace(/^["“'\s]+|["”'\s]+$/g, "")}": ${s(a.note)}`).join("\n") : "- -"
    }`,
    `### What is driving the client\n${bullets(strs(d.drivers))}`,
    `### Communication style shown\n${bullets(strs(d.communicationStyle))}`,
    `### What landed well\n${bullets(strs(d.whatLanded))}`,
    `### What to avoid\n${bullets(strs(d.whatToAvoid))}`,
    `### Plan for the next call\n${bullets(strs(d.nextCallPlan))}`,
    `_Based on observable language only. Not a personality or clinical assessment._`,
  ].join("\n\n");
}

export function raidMd(d: AnyObj): string {
  const rag = s(d.rag).toUpperCase();
  const issues = list(d.issues);
  const comm = list(d.commitments);
  const esc = list(d.escalations);
  const risks = list(d.risks);
  return [
    `## Risks, issues and commitments`,
    rag ? `**Project RAG after this call:** ${rag}${s(d.ragReason) ? ` (${s(d.ragReason)})` : ""}` : "",
    `### Risks`,
    risks.length
      ? `| Risk | Severity | Likelihood | Mitigation | Owner |\n|---|---|---|---|---|\n` +
        risks.map((r) => `| ${s(r.title)} | ${s(r.severity)} | ${s(r.likelihood)} | ${s(r.mitigation)} | ${s(r.owner)} |`).join("\n")
      : "- None",
    `### Issues`,
    issues.length
      ? `| Issue | Impact | Action | Owner |\n|---|---|---|---|\n` +
        issues.map((r) => `| ${s(r.title)} | ${s(r.impact)} | ${s(r.action)} | ${s(r.owner)} |`).join("\n")
      : "- None",
    `### Commitments made\n${comm.length ? comm.map((c) => `- ${s(c.what)} (by ${s(c.by) || "TBD"}, owner ${s(c.owner) || "TBD"})`).join("\n") : "- None"}`,
    `### Dependencies\n${bullets(strs(d.dependencies))}`,
    `### Escalate\n${esc.length ? esc.map((e) => `- **${s(e.item)}** to ${s(e.to)}: ${s(e.why)}`).join("\n") : "- Nothing to escalate"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function emailMd(d: AnyObj): string {
  return `## Follow-up email\n\n**Subject:** ${s(d.subject)}\n\n${s(d.body)}`;
}

export function fullReport(r: ReportSections): string {
  return [r.minutes, r.psychology, r.raid, r.email].filter(Boolean).join("\n\n---\n\n");
}

export function download(name: string, text: string, type = "text/markdown") {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Deterministic section: every question the client asked and the answer Simple Call suggested (no model cost). */
export function questionsMd(suggestions: Suggestion[]): string {
  if (!suggestions.length) return "";
  const label: Record<Suggestion["verdict"], string> = { verified: "verified", revised: "revised by Verifier", caution: "check", defer: "deferred", pending: "unverified" };
  return (
    "\n\n### Questions you were asked\n" +
    suggestions.map((s) => `- **${s.question}** _(${label[s.verdict]})_ ${s.sayThis}`).join("\n")
  );
}
