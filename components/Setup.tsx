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
      <div className="card overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[1.1fr_1fr]">
          <div className="bg-ink px-6 py-6 text-white">
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-300">How Simple Call works</div>
            <h2 className="mt-2 text-xl font-bold leading-snug">Feed it your project once. During the client call, a team of agents listens, answers, reads the room and logs risks.</h2>
            <p className="mt-2 text-sm text-slate-300">
              Built for delivery teams in Lahore talking to clients in the US and elsewhere: accurate answers in seconds, no over-promising, and editable minutes when the call ends.
            </p>
            <div className="mt-6 space-y-2 text-xs">
              {[
                ["Call audio", "On-device captions of both sides of a Teams / Meet / Zoom call (or typed lines)"],
                ["Every line", "Conductor → Listener/Planner → Knowledge → Answer → FactCheck → Verifier (sends weak drafts back), in parallel with Psychology + Risk"],
                ["On screen", "Verified answer to say, client mood + how to respond, live risk log"],
                ["Call ends", "Scribe + Psychologist + Risk Officer + Follow-up write the report in parallel"],
                ["You", "Edit, approve and publish minutes, RAID and recap email"],
              ].map(([k, v], i) => (
                <div key={k} className="flex items-start gap-3">
                  <span className="grid h-5 w-5 flex-none place-items-center bg-brand-600 text-[10px] font-bold">{i + 1}</span>
                  <span><b className="text-white">{k}:</b> <span className="text-slate-300">{v}</span></span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-6 border-t border-slate-700 pt-4">
              {[["12", "AI agents"], ["4", "deterministic tools"], ["100%", "answers fact-checked"], ["0", "keys in the browser"]].map(([n, l]) => (
                <div key={l}><div className="text-2xl font-black text-white">{n}</div><div className="text-[11px] text-slate-400">{l}</div></div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-6 py-5 text-xs">
            <div className="col-span-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Before and during the call</div>
            {AGENTS_LIVE.map(([n, d]) => (
              <div key={n}><b className="text-slate-800">{n}</b><div className="text-slate-500">{d}</div></div>
            ))}
            <div className="col-span-2 mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">After the call</div>
            {AGENTS_POST.map(([n, d]) => (
              <div key={n}><b className="text-slate-800">{n}</b><div className="text-slate-500">{d}</div></div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={() => setWs(DEMO_WORKSPACE)}>Reload the example project (fictional)</button>
        <button className="btn btn-ghost" onClick={() => setWs(EMPTY_WORKSPACE)}>Start blank</button>
        <button className="btn btn-ghost text-rose-600" onClick={onClearAll}>Delete all my data</button>
        <span className="text-xs text-slate-500">Stored only in this browser, never on the server. Use public or made-up data on this public demo.</span>
        <button className="btn btn-primary ml-auto" onClick={onStart} disabled={!ws.knowledge.trim()}>Go to live call →</button>
      </div>

      <KnowledgeCoach ws={ws} setWs={setWs} aiReady={aiReady} privateModel={privateModel} />

      <div className="card grid gap-0 divide-y divide-slate-100 text-xs md:grid-cols-4 md:divide-x md:divide-y-0">
        <div className="px-4 py-3">
          <div className="label">Where your data goes</div>
          <p className="text-slate-500">Simple Call is local-first. Pick private mode for real client calls.</p>
        </div>
        <div className="px-4 py-3">
          <div className="font-semibold text-slate-800">Audio</div>
          <p className="text-slate-500">On-device speech in Chrome or Edge: never leaves this laptop. No meeting bot joins the call.</p>
        </div>
        <div className="px-4 py-3">
          <div className="font-semibold text-slate-800">Knowledge, transcripts, reports</div>
          <p className="text-slate-500">Stored only in this browser. Never saved or logged on the server. Delete any time.</p>
        </div>
        <div className="px-4 py-3">
          <div className="font-semibold text-slate-800">AI model</div>
          <p className={privateModel ? "font-semibold text-emerald-700" : "text-slate-500"}>
            {privateModel
              ? "Private mode: the model runs on this machine. Nothing leaves the laptop."
              : "SSI LiteLLM gateway (public demo: fictional data only). Run private mode with a local model for real client data."}
          </p>
        </div>
      </div>

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
    </div>
  );
}
