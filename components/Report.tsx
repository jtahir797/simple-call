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
  const [more, setMore] = useState(false);

  const dur = call.startedAt ? Math.round(((call.endedAt ?? Date.now()) - call.startedAt) / 1000) : 0;
  const verified = call.suggestions.filter((s) => s.verdict === "verified").length;
  const first = call.pulses[0]?.score;
  const last = call.pulses[call.pulses.length - 1]?.score;
  const stats = [
    ["Duration", `${Math.floor(dur / 60)}m ${dur % 60}s`],
        ["Answers", String(call.suggestions.length)],
    ["Verified", call.suggestions.length ? `${Math.round((verified / call.suggestions.length) * 100)}%` : "-"],
    ["Sentiment", first != null && last != null ? `${first.toFixed(2)} → ${last.toFixed(2)}` : "-"],
    ["Logged", String(call.log.length)],
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
      <div className="card no-print px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <div className="text-lg font-bold text-slate-900">After-call report</div>
            <div className="text-xs text-slate-500">
              {stats.filter(([, v]) => v !== "-").map(([k, v]) => `${k}: ${v}`).join(" · ")}
            </div>
          </div>
          <button className="btn btn-ghost" disabled={!report} onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy all"}</button>
          <button className="btn btn-ghost" disabled={!report} onClick={openEmail}>Email draft</button>
          <div className="relative">
            <button className="btn btn-ghost px-2.5" onClick={() => setMore(!more)} title="More">⋯</button>
            {more && (
              <div className="pop absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl" onClick={() => setMore(false)}>
                <button className="block w-full px-4 py-2 text-left hover:bg-slate-50 disabled:opacity-40" disabled={!report} onClick={() => download(fname, text)}>Download .md</button>
                <button className="block w-full px-4 py-2 text-left hover:bg-slate-50 disabled:opacity-40" disabled={!report} onClick={() => window.print()}>Print or save PDF</button>
                <button className="block w-full px-4 py-2 text-left hover:bg-slate-50 disabled:opacity-40" disabled={generating} onClick={props.onGenerate}>{report ? "Regenerate" : "Generate"}</button>
              </div>
            )}
          </div>
          <button className="btn btn-primary" disabled={!report || generating} onClick={props.onPublish}>{props.published ? "Published ✓" : "Approve & publish"}</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          {SECTIONS.map((s) => {
            const ev = events[s.agent];
            const dot = ev?.status === "running" ? "blink bg-brand-500" : ev?.status === "ok" ? "bg-emerald-500" : ev?.status === "error" ? "bg-rose-500" : "bg-slate-200";
            return (
              <span key={s.agent} className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-slate-600" title={ev?.note}>
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                {s.agent === "RiskOfficer" ? "Risk Officer" : s.agent === "FollowUp" ? "Follow-up" : s.agent}
                {ev?.ms != null && <span className="font-mono text-[10px] text-slate-400">{(ev.ms / 1000).toFixed(1)}s</span>}
              </span>
            );
          })}
          {report && !props.published && <span className="ml-auto text-amber-700">Draft: review and edit, then approve to save it to History.</span>}
        </div>
      </div>
      {props.error && <div className="no-print rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{props.error}</div>}
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
