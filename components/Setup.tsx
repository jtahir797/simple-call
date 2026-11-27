"use client";

import { useMemo, useRef } from "react";
import { DEMO_WORKSPACE, EMPTY_WORKSPACE, KNOWLEDGE_TEMPLATE } from "@/lib/demo";
import { getMode, MODES } from "@/lib/modes";
import KnowledgeCoach from "./KnowledgeCoach";
import { chunkKnowledge } from "@/lib/retrieve";
import type { Workspace } from "@/lib/types";

const AGENTS_LIVE = [
  ["Knowledge Builder", "Setup: turns your documents into knowledge"],
  ["Strategist", "Before the call: predicts the 5 hardest questions"],
  ["Conductor", "Orchestrates every transcript line across the agents"],
  ["Listener + Planner", "Detects real questions and plans the searches"],
  ["Answer", "Drafts a short, grounded answer in US business style"],
  ["Verifier", "Reviews with tool results and sends drafts back"],
  ["Psychology", "Reads mood, trust and what the client needs now"],
  ["Risk", "Logs risks, issues, actions and commitments live"],
  ["Tools", "Alert rules, knowledge search, FactCheck, US holidays"],
  ["Assist", "Quick actions: Answer, Clarify, Recap, Follow-up"],
];
const AGENTS_POST = [
  ["Scribe", "Meeting minutes, decisions and action items"],
  ["Psychologist", "Emotional arc, drivers and next-call plan"],
  ["Risk Officer", "RAID log, RAG status and escalations"],
  ["Follow-up", "Recap email ready to edit and send"],
];

const KB_LIMIT = 60_000;

export default function Setup({
  ws,
  setWs,
  onStart,
  onClearAll,
  privateModel,
  aiReady,
}: {
  ws: Workspace;
  setWs: (w: Workspace) => void;
  onStart: () => void;
  onClearAll: () => void;
  privateModel: boolean;
  aiReady: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const chunks = useMemo(() => chunkKnowledge(ws.knowledge), [ws.knowledge]);
  const set = (k: keyof Workspace) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setWs({ ...ws, [k]: e.target.value });

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    let add = "";
    for (const f of Array.from(files)) {
      if (f.size > 1_500_000) continue;
      const text = await f.text();
      add += `\n\n## ${f.name.replace(/\.[^.]+$/, "")}\n${text}`;
    }
    setWs({ ...ws, knowledge: (ws.knowledge + add).trim().slice(0, KB_LIMIT) });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-5">
      <div className="card px-6 py-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-[18rem] flex-1">
            <h2 className="text-xl font-bold text-slate-900">Know what to say on every client call.</h2>
            <p className="mt-1 text-sm text-slate-600">
              Add your project once. During the call, Simple Call shows a short, fact-checked answer to say, how the client is feeling, and the risks raised. After the call, it writes the minutes, RAID log and follow-up email for you to edit.
            </p>
          </div>
          <button className="btn btn-primary" onClick={onStart} disabled={!ws.knowledge.trim()}>Go to live call →</button>
        </div>
        <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          {[
            ["Add knowledge", "Paste notes or files below, or use the example project."],
            ["Start the call", "Live captions of Teams, Meet or Zoom, or the demo call."],
            ["Publish the report", "Review, edit, copy or email the after-call report."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="grid h-5 w-5 flex-none place-items-center bg-brand-600 text-[11px] font-bold text-white">{i + 1}</span>
              <span><b className="text-slate-800">{t}</b><span className="block text-xs text-slate-500">{d}</span></span>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
          <button className="btn btn-ghost py-1 text-xs" onClick={() => setWs(DEMO_WORKSPACE)}>Load example project</button>
          <button className="btn btn-ghost py-1 text-xs" onClick={() => setWs(EMPTY_WORKSPACE)}>Start blank</button>
          <button className="btn btn-ghost py-1 text-xs text-rose-600" onClick={onClearAll}>Delete all my data</button>
          <span className={`ml-auto ${privateModel ? "font-semibold text-emerald-700" : "text-slate-500"}`}>
            {privateModel
              ? "Private mode: the AI model runs on this machine. Nothing leaves the laptop."
              : "Your data stays in this browser. Audio is captioned on-device where supported. Use fictional data on the public demo."}
          </span>
        </div>
      </div>

      <KnowledgeCoach ws={ws} setWs={setWs} aiReady={aiReady} privateModel={privateModel} />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card space-y-4 p-5">
          <div className="text-sm font-bold">Call context</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Project</label><input className="input" value={ws.projectName} onChange={set("projectName")} placeholder="e.g. FleetTrack 2.0" /></div>
            <div><label className="label">Client contact</label><input className="input" value={ws.clientName} onChange={set("clientName")} placeholder="Name, title" /></div>
            <div><label className="label">Client company</label><input className="input" value={ws.clientCompany} onChange={set("clientCompany")} /></div>
            <div><label className="label">Client location / time zone</label><input className="input" value={ws.clientLocation} onChange={set("clientLocation")} placeholder="e.g. Austin, TX (Central)" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Call mode</label>
              <select className="input" value={ws.mode ?? "client"} onChange={(e) => setWs({ ...ws, mode: e.target.value })}>
                {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">{getMode(ws.mode).purpose}</p>
            </div>
            <div>
              <label className="label">Your name and how captions mishear it</label>
              <input className="input" value={ws.myName ?? ""} onChange={set("myName")} placeholder="Sara|Sarah|Zara" maxLength={120} />
              <p className="mt-1 text-[11px] text-slate-500">A client line with your name always reaches the Listener.</p>
            </div>
          </div>
          <div>
            <label className="label">Project words that always count as a question for you</label>
            <input className="input" value={ws.topics ?? ""} onChange={set("topics")} placeholder="UAT, go-live, CR-03" maxLength={600} />
          </div>
          <div>
            <label className="label">About you: role, authority limits, escalation contacts, style</label>
            <textarea className="input h-40 font-mono text-xs" value={ws.profile} onChange={set("profile")} placeholder="Who you are, what you can and cannot commit to on a call, who to escalate to." />
          </div>
          <div>
            <label className="label">Guardrails: what must never be said or promised</label>
            <textarea className="input h-36 font-mono text-xs" value={ws.guardrails} onChange={set("guardrails")} placeholder="- Never quote prices on a call&#10;- Don't commit to new dates" />
          </div>
        </div>

        <div className="card flex flex-col p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-bold">Project knowledge</div>
            <div className="flex items-center gap-2">
              <span className="chip bg-brand-50 text-brand-700">{chunks.length} sections indexed</span>
              <span className={`chip ${ws.knowledge.length > KB_LIMIT * 0.9 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>{ws.knowledge.length.toLocaleString()} / {KB_LIMIT.toLocaleString()}</span>
              {!ws.knowledge.trim() && <button className="btn btn-ghost py-1 text-xs" onClick={() => setWs({ ...ws, knowledge: KNOWLEDGE_TEMPLATE })}>Start from template</button>}
              <button className="btn btn-ghost py-1 text-xs" onClick={() => fileRef.current?.click()}>+ Add .md / .txt files</button>
              <input ref={fileRef} type="file" multiple accept=".md,.txt,.csv,.json" className="hidden" onChange={(e) => onFiles(e.target.files)} />
            </div>
          </div>
          <p className="mb-2 text-xs text-slate-500">Scope, milestones, current status, known bugs, change request process, FAQs, team. Use <code>## Headings</code> so the Knowledge agent can cite sections.</p>
          <textarea className="input min-h-[460px] flex-1 font-mono text-xs leading-relaxed" maxLength={KB_LIMIT} value={ws.knowledge} onChange={set("knowledge")} placeholder="## Current status&#10;..." />
        </div>
      </div>

      <details className="card px-5 py-3 text-xs">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600">How it works: 12 agents and 4 tools</summary>
        <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...AGENTS_LIVE, ...AGENTS_POST].map(([n, d]) => (
            <div key={n}><b className="text-slate-800">{n}</b><span className="text-slate-500"> · {d}</span></div>
          ))}
        </div>
      </details>
    </div>
  );
}
