"use client";

import { useState } from "react";
import Markdown from "./Markdown";
import { download, fullReport } from "@/lib/client";
import type { AgentEvent, AgentName, ReportSections } from "@/lib/types";
import type { CallState } from "@/hooks/useCopilot";

const SECTIONS: { key: keyof ReportSections; title: string; agent: AgentName }[] = [
  { key: "minutes", title: "Meeting minutes", agent: "Scribe" },
  { key: "psychology", title: "Client sentiment & psychology", agent: "Psychologist" },
  { key: "raid", title: "Risks, issues & commitments", agent: "RiskOfficer" },
  { key: "email", title: "Follow-up email", agent: "FollowUp" },
];

export default function Report(props: {
  call: CallState;
  projectName: string;
  report: ReportSections | null;
  setReport: (r: ReportSections) => void;
  events: Partial<Record<AgentName, AgentEvent>>;
  generating: boolean;
  error: string | null;
  published: boolean;
  onGenerate: () => void;
  onPublish: () => void;
}) {
  const { call, report, events, generating } = props;
  const [editing, setEditing] = useState<Partial<Record<keyof ReportSections, boolean>>>({});
  const [copied, setCopied] = useState(false);

  const dur = call.startedAt ? Math.round(((call.endedAt ?? Date.now()) - call.startedAt) / 1000) : 0;
  const verified = call.suggestions.filter((s) => s.verdict === "verified").length;
  const first = call.pulses[0]?.score;
  const last = call.pulses[call.pulses.length - 1]?.score;
  const stats = [
    ["Duration", `${Math.floor(dur / 60)}m ${dur % 60}s`],
    ["Transcript lines", String(call.lines.length)],
    ["Questions answered", String(call.suggestions.length)],
    ["Verified as-is", call.suggestions.length ? `${Math.round((verified / call.suggestions.length) * 100)}%` : "-"],
    ["Sentiment", first != null && last != null ? `${first.toFixed(2)} → ${last.toFixed(2)}` : "-"],
    ["Items logged", String(call.log.length)],
  ];

  const text = report ? fullReport(report) : "";
  const fname = `${(props.projectName || "call").replace(/\W+/g, "-")}-${new Date(call.startedAt ?? Date.now()).toISOString().slice(0, 10)}.md`;

  const openEmail = () => {
    if (!report) return;
    const subj = report.email.match(/\*\*Subject:\*\*\s*(.*)/)?.[1] ?? "Follow-up";
    const body = report.email.replace(/^##.*\n/, "").replace(/\*\*Subject:\*\*.*\n/, "").trim();
    window.location.href = `mailto:?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
  };

  if (!call.lines.length) {
    return <div className="card px-6 py-16 text-center text-sm text-slate-500">No call yet. Run a live or demo call first, then come back here for the report.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card no-print grid grid-cols-3 divide-x divide-slate-100 md:grid-cols-6">
        {stats.map(([k, v]) => (
          <div key={k} className="px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k}</div>
            <div className="mt-0.5 text-lg font-bold text-slate-800">{v}</div>
          </div>
        ))}
      </div>

      <div className="card no-print flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Post-call agents</span>
        {SECTIONS.map((s) => {
          const ev = events[s.agent];
          const cls =
            ev?.status === "running" ? "border-brand-300 bg-brand-50 text-brand-700" : ev?.status === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : ev?.status === "error" ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-400";
          return (
            <span key={s.agent} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${cls}`} title={ev?.note}>
              <span className={ev?.status === "running" ? "blink" : ""}>{s.agent === "RiskOfficer" ? "Risk Officer" : s.agent === "FollowUp" ? "Follow-up" : s.agent}</span>
              {ev?.ms != null && <span className="ml-1.5 font-mono text-[10px] font-normal">{(ev.ms / 1000).toFixed(1)}s</span>}
              {ev?.status === "ok" && <span className="ml-1 text-[10px] font-normal">{ev.cached ? "cached" : ev.tokens ? `${(ev.tokens / 1000).toFixed(1)}k tok` : call.replay ? "recorded" : ""}</span>}
            </span>
          );
        })}
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={props.onGenerate} disabled={generating}>{report ? "Regenerate" : generating ? "Generating…" : "Generate report"}</button>
          <button className="btn btn-ghost" disabled={!report} onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy all"}</button>
          <button className="btn btn-ghost" disabled={!report} onClick={() => download(fname, text)}>Download .md</button>
          <button className="btn btn-ghost" disabled={!report} onClick={() => window.print()}>Print / PDF</button>
          <button className="btn btn-ghost" disabled={!report} onClick={openEmail}>Open email draft</button>
          <button className="btn btn-primary" disabled={!report || generating} onClick={props.onPublish}>{props.published ? "Published ✓ (update)" : "Approve & publish"}</button>
        </div>
      </div>
      {props.error && <div className="no-print rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{props.error}</div>}
      {report && !props.published && (
        <div className="no-print rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Draft. Review and edit each section, then <b>Approve & publish</b> to save it to History.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {SECTIONS.map((s) => {
          const val = report?.[s.key] ?? "";
          const isEdit = editing[s.key];
          const ev = events[s.agent];
          return (
            <div key={s.key} className="card">
              <div className="card-h">
                <span>{s.title}</span>
                {val && (
                  <button className="no-print normal-case tracking-normal text-brand-600 hover:underline" onClick={() => setEditing({ ...editing, [s.key]: !isEdit })}>
                    {isEdit ? "Done" : "Edit"}
                  </button>
                )}
              </div>
              <div className="px-5 py-4">
                {!val ? (
                  <div className="py-10 text-center text-sm text-slate-400">
                    {ev?.status === "running" ? <span className="blink">{s.agent} agent writing…</span> : ev?.status === "error" ? "This agent failed. Try Regenerate." : "Not generated yet."}
                  </div>
                ) : isEdit ? (
                  <textarea className="input h-[420px] font-mono text-xs leading-relaxed" value={val} onChange={(e) => props.setReport({ ...(report as ReportSections), [s.key]: e.target.value })} />
                ) : (
                  <Markdown text={val} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
