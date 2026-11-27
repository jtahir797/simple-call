"use client";

import { useMemo, useState } from "react";
import { streamPost } from "@/lib/client";
import { buildPrompt, CHECKLIST, coverage, parseFilled } from "@/lib/checklist";
import type { Workspace } from "@/lib/types";

type Panel = null | "ai" | "docs" | "self";

export default function KnowledgeCoach({ ws, setWs, aiReady, privateModel }: { ws: Workspace; setWs: (w: Workspace) => void; aiReady: boolean; privateModel: boolean }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [gaps, setGaps] = useState<{ item: string; question: string }[]>([]);
  const [undo, setUndo] = useState<Workspace | null>(null);
  const cov = useMemo(() => coverage(ws), [ws]);
  const prompt = useMemo(() => buildPrompt(), []);

  const apply = (next: Workspace, note: string) => {
    setUndo(ws);
    setWs(next);
    setMsg(note);
  };

  const build = async () => {
    setBusy(true);
    setMsg(null);
    setGaps([]);
    let done = false;
    await streamPost("/api/knowledge", { raw, ws }, (m) => {
      if (m.type === "knowledge") {
        done = true;
        const d = m.data;
        apply({ ...ws, ...d, knowledge: d.knowledge || ws.knowledge }, "Knowledge Builder filled your knowledge. Review it below.");
        setGaps(d.gaps);
      }
      if (m.type === "error") setMsg(m.message);
    });
    if (!done) setMsg((x) => x ?? "The Knowledge Builder could not finish. Try a shorter paste.");
    setBusy(false);
  };

  const pct = Math.round((cov.score / cov.total) * 100);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-start gap-4 border-b border-slate-100 bg-brand-50 px-5 py-4">
        <div className="flex-1">
          <div className="text-sm font-bold text-brand-800">Better knowledge, better answers</div>
          <p className="mt-1 text-sm text-slate-700">
            A complete example project is loaded below so you can see what good looks like. To use your own project you do not have to write anything from scratch:
            let Claude or ChatGPT fill the checklist from your status report, or paste your documents here. Five minutes, once per project.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {privateModel
              ? "Private mode: documents you paste here are processed by the model on this machine."
              : "This is the public demo: paste only fictional or public material here. Use private mode for real client documents."}
          </p>
        </div>
        <div className="w-56">
          <div className="flex items-baseline justify-between text-xs font-semibold text-slate-600">
            <span>Knowledge score</span>
            <span className="text-lg font-black text-slate-900">{cov.score}/{cov.total}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded bg-white">
            <div className={`h-full ${cov.essentialsDone ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
          </div>
          <div className={`mt-1 text-xs font-semibold ${cov.essentialsDone ? "text-emerald-700" : "text-amber-700"}`}>
            {cov.essentialsDone ? (cov.score === cov.total ? "Complete" : "Ready to start; fill the rest over time") : "Fill the 3 essentials to start"}
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-5 py-4 md:grid-cols-3">
        {([
          ["ai", "1. Fill it with Claude or ChatGPT", "Copy our prompt, attach your status report or SOW, answer its few questions, paste the result back."],
          ["docs", "2. Paste documents here", "The Knowledge Builder agent structures your material and tells you what is missing."],
          ["self", "3. Answer the checklist yourself", "11 short topics with example answers. Only 3 are essential."],
        ] as [Panel, string, string][]).map(([id, t, d]) => (
          <button
            key={id}
            onClick={() => setPanel(panel === id ? null : id)}
            className={`rounded-lg border px-4 py-3 text-left transition hover:shadow ${panel === id ? "border-brand-400 bg-brand-50" : "border-slate-200 bg-white"}`}
          >
            <div className="text-sm font-bold text-slate-800">{t}</div>
            <div className="mt-0.5 text-xs text-slate-500">{d}</div>
          </button>
        ))}
      </div>

      {panel === "ai" && (
        <div className="grid gap-4 border-t border-slate-100 px-5 py-4 md:grid-cols-2">
          <div>
            <div className="label">Step 1: copy this prompt into Claude or ChatGPT, attach your project material</div>
            <textarea readOnly className="input h-56 font-mono text-[11px]" value={prompt} />
            <div className="mt-2 flex items-center gap-2">
              <button className="btn btn-primary" onClick={() => { navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                {copied ? "Copied" : "Copy prompt"}
              </button>
              <span className="text-xs text-slate-500">Use your company-approved AI account for real client material.</span>
            </div>
          </div>
          <div>
            <div className="label">Step 2: paste the AI&apos;s final answer (from === SIMPLE CALL === to === END ===)</div>
            <textarea className="input h-56 font-mono text-[11px]" value={pasted} onChange={(e) => setPasted(e.target.value)} maxLength={80_000} placeholder="=== SIMPLE CALL ===&#10;PROJECT: ...&#10;--- PROFILE ---&#10;..." />
            <button
              className="btn btn-primary mt-2"
              disabled={pasted.trim().length < 50}
              onClick={() => { apply(parseFilled(pasted, ws), "Applied. Your project, profile, guardrails and knowledge were updated."); setPasted(""); }}
            >
              Apply to my knowledge
            </button>
          </div>
        </div>
      )}

      {panel === "docs" && (
        <div className="border-t border-slate-100 px-5 py-4">
          <div className="label">Paste status reports, SOW, plan, recent client emails or meeting notes (up to 40,000 characters)</div>
          <textarea className="input h-48 text-xs" value={raw} onChange={(e) => setRaw(e.target.value)} maxLength={40_000} placeholder="Paste your project material here…" />
          <div className="mt-2 flex items-center gap-3">
            <button className="btn btn-primary" disabled={busy || raw.trim().length < 200 || !aiReady} onClick={build}>
              {busy ? <span className="blink">Knowledge Builder working…</span> : "Build my knowledge"}
            </button>
            <span className="text-xs text-slate-500">{raw.length.toLocaleString()} characters{!aiReady && " · live AI is off on this deployment"}</span>
          </div>
          {gaps.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <div className="font-semibold text-amber-900">Answer these to complete your knowledge (add them in the boxes below):</div>
              <ul className="mt-1 list-disc pl-5 text-amber-900">{gaps.map((g, i) => <li key={i}><b>{g.item}:</b> {g.question}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {panel === "self" && (
        <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
          Click any topic in the checklist below to see its questions and an example answer, then write yours in the boxes underneath.
        </div>
      )}

      {msg && (
        <div className="flex items-center gap-3 border-t border-slate-100 bg-emerald-50 px-5 py-2 text-sm text-emerald-800">
          {msg}
          {undo && <button className="text-xs font-semibold underline" onClick={() => { setWs(undo); setUndo(null); setMsg("Undone."); }}>Undo</button>}
        </div>
      )}

      <div className="border-t border-slate-100 px-5 py-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Knowledge checklist · click a topic for its questions and an example</div>
        <div className="flex flex-wrap gap-1.5">
          {CHECKLIST.map((c) => {
            const ok = cov.done.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setOpen(open === c.id ? null : c.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : c.essential ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-500"} ${open === c.id ? "ring-2 ring-brand-300" : ""}`}
              >
                {ok ? "✓" : "○"} {c.title}{c.essential && !ok ? " (essential)" : ""}
              </button>
            );
          })}
        </div>
        {open && (() => {
          const c = CHECKLIST.find((x) => x.id === open)!;
          const where = c.field === "profile" ? "the “About you” box" : c.field === "guardrails" ? "the “Guardrails” box" : `the project knowledge under “## ${c.heading}”`;
          return (
            <div className="pop mt-3 grid gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm md:grid-cols-2">
              <div>
                <div className="label">Answer these (goes in {where})</div>
                <ul className="list-disc pl-5 text-slate-700">{c.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                {c.field === "knowledge" && !cov.done.has(c.id) && (
                  <button className="btn btn-ghost mt-2 py-1 text-xs" onClick={() => setWs({ ...ws, knowledge: `${ws.knowledge.trim()}\n\n## ${c.heading}\n- ` })}>
                    Add this heading to my knowledge
                  </button>
                )}
              </div>
              <div>
                <div className="label">Example answer</div>
                <p className="whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{c.sample}</p>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
