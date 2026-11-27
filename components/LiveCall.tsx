"use client";

import { useEffect, useRef, useState } from "react";
import type { useCopilot } from "@/hooks/useCopilot";
import { setAccessCode } from "@/lib/client";
import { MODES } from "@/lib/modes";
import type { AgentEvent, AgentName, Brief, LogItem, Pulse, QuickAction, Suggestion, Workspace } from "@/lib/types";

type Copilot = ReturnType<typeof useCopilot>;
export interface Health {
  configured: boolean;
  model: string | null;
  accessCode: boolean;
  privateModel?: boolean;
  budget: { usedPct: number; exhausted: boolean };
  store: string;
}

const PIPE: { name: AgentName; label: string; kind: "ai" | "tool" | "core" }[] = [
  { name: "Conductor", label: "Conductor", kind: "core" },
  { name: "Listener", label: "Listener + Planner", kind: "ai" },
  { name: "Retriever", label: "Knowledge tool", kind: "tool" },
  { name: "Answer", label: "Answer", kind: "ai" },
  { name: "FactCheck", label: "FactCheck tool", kind: "tool" },
  { name: "Verifier", label: "Verifier", kind: "ai" },
  { name: "Revise", label: "Answer ↺ revise", kind: "ai" },
  { name: "Pulse", label: "Psychology", kind: "ai" },
  { name: "Risk", label: "Risk", kind: "ai" },
];

function fmtTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
const fmtTok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export default function LiveCall(props: {
  ws: Workspace;
  setWs: (w: Workspace) => void;
  cp: Copilot;
  health: Health | null;
  onEnd: () => void;
  brief: Brief | null;
  briefState: "idle" | "loading" | "error";
  briefTokens: number | null;
  onBrief: (agenda: string) => void;
}) {
  const { ws, cp, health } = props;
  const { call } = cp;
  const [now, setNow] = useState(Date.now());
  const [xray, setXray] = useState<AgentName | null>(null);
  const [code, setCode] = useState("");
  const [compact, setCompact] = useState(false);
  const [sound, setSound] = useState(false);
  const [notify, setNotify] = useState(false);
  const latestId = call.suggestions[call.suggestions.length - 1]?.id;
  const latestRef = useRef<Suggestion | undefined>(undefined);
  latestRef.current = call.suggestions[call.suggestions.length - 1];

  // Sound cue and desktop notification when a new answer arrives (useful while the call window has focus).
  useEffect(() => {
    const s = latestRef.current;
    if (!s) return;
    if (sound) beep();
    if (notify && typeof document !== "undefined" && document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification(`They asked: ${s.question.slice(0, 80)}`, { body: s.sayThis.slice(0, 220), tag: "simple-call" });
    }
  }, [latestId, sound, notify]);

  const toggleNotify = async () => {
    if (notify) return setNotify(false);
    if (!("Notification" in window)) return;
    const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setNotify(p === "granted");
  };

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "c") cp.mic.setSpeaker("client");
      if (k === "m") cp.mic.setSpeaker("me");
      if (k === "v") setCompact((x) => !x);
      if (k === "s") setSound((x) => !x);
      if (k === "y" && latestRef.current) navigator.clipboard?.writeText(latestRef.current.sayThis);
      const qa: Record<string, QuickAction> = { a: "answer", k: "clarify", r: "recap", f: "followup" };
      if (qa[k]) cp.quickAction(qa[k]);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [cp.mic]);

  const live = cp.demo.on || cp.mic.on;
  const aiReady = Boolean(health?.configured && !health.budget.exhausted);
  const elapsed = call.startedAt ? (call.endedAt ?? now) - call.startedAt : 0;
  const lastRun = [...call.runs].reverse().find((r) => r.events.Listener?.status === "ok" || r.events.Answer) ?? call.runs[call.runs.length - 1];
  const latest = call.suggestions[call.suggestions.length - 1];
  const earlier = call.suggestions.slice(0, -1).reverse();
  const pulse = call.pulses[call.pulses.length - 1] ?? null;
  const kbEmpty = !ws.knowledge.trim();
  const xev = xray ? lastRun?.events[xray] : undefined;

  return (
    <div className="space-y-4">
      {/* control bar */}
      <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2 pr-2">
          <span className={`h-2.5 w-2.5 rounded-full ${live ? "blink bg-rose-500" : call.lines.length ? "bg-amber-400" : "bg-slate-300"}`} />
          <span className="text-sm font-semibold">
            {cp.demo.on ? (call.replay ? "Recorded run playing" : "Demo call live") : cp.mic.on ? "Listening" : call.lines.length ? "Paused" : "Ready"}
          </span>
          <span className="font-mono text-sm text-slate-500">{fmtTime(elapsed)}</span>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        {cp.demo.on ? (
          <button className="btn btn-ghost" onClick={cp.demo.stop}>Stop demo</button>
        ) : (
          <>
            <button className="btn btn-primary" onClick={cp.demo.start} disabled={cp.mic.on || kbEmpty || !aiReady} title={!aiReady ? "Live AI unavailable right now" : ""}>
              ▶ Play demo US client call
            </button>
            {cp.recording && (
              <button className="btn btn-ghost" onClick={cp.demo.replay} disabled={cp.mic.on} title={`Real agent outputs recorded ${new Date(cp.recording.recordedAt).toDateString()} with ${cp.recording.model}`}>
                ⚡ Instant replay (0 tokens)
              </button>
            )}
          </>
        )}
        {cp.mic.on ? (
          <button className="btn btn-danger" onClick={cp.mic.stop}>■ Stop captions</button>
        ) : (
          <button
            className="btn btn-ghost"
            onClick={cp.mic.start}
            disabled={!cp.mic.supported || cp.demo.on || kbEmpty || !aiReady}
            title={!cp.mic.supported ? "Use Chrome or Edge for live captions" : "Caption a real Teams, Meet or Zoom call"}
          >
            ● Live captions
          </button>
        )}
        {cp.mic.source === "mic" && (
          <div className="flex overflow-hidden rounded-lg border border-slate-300 text-xs font-semibold">
            {(["client", "me"] as const).map((s) => (
              <button
                key={s}
                onClick={() => cp.mic.setSpeaker(s)}
                className={`px-3 py-1.5 ${cp.mic.speaker === s ? (s === "client" ? "bg-brand-600 text-white" : "bg-charcoal text-white") : "bg-white text-slate-600"}`}
                title={`Who is speaking in mic-only mode (key: ${s === "client" ? "C" : "M"})`}
              >
                {s === "client" ? "Client (C)" : "Me (M)"}
              </button>
            ))}
          </div>
        )}
        <select
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
          value={ws.mode ?? "client"}
          onChange={(e) => props.setWs({ ...ws, mode: e.target.value })}
          title="Call mode: changes how every agent answers"
        >
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        <div className="flex gap-1 text-xs">
          <button className={`rounded-md border px-2 py-1.5 font-semibold ${compact ? "border-charcoal bg-charcoal text-white" : "border-slate-300 text-slate-600"}`} onClick={() => setCompact(!compact)} title="Beside-the-call view (V)">Beside call (V)</button>
          <button className={`rounded-md border px-2 py-1.5 font-semibold ${sound ? "border-charcoal bg-charcoal text-white" : "border-slate-300 text-slate-600"}`} onClick={() => setSound(!sound)} title="Sound cue on each new answer (S)">Sound (S)</button>
          <button className={`rounded-md border px-2 py-1.5 font-semibold ${notify ? "border-charcoal bg-charcoal text-white" : "border-slate-300 text-slate-600"}`} onClick={toggleNotify} title="Desktop notification when Simple Call is behind your call window">Notify</button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right text-xs leading-tight text-slate-500">
            <div><b className="text-slate-800">{call.agentCalls}</b> agent runs · <b className="text-slate-800">{fmtTok(call.tokens)}</b> tokens</div>
            <div>{call.cachedHits > 0 ? <span className="text-emerald-700">{call.cachedHits} served from cache</span> : call.replay ? <span className="text-emerald-700">recorded run, 0 tokens</span> : cp.busy ? <span className="blink text-brand-600">agents working</span> : <span>&nbsp;</span>}</div>
          </div>
          <button className="btn btn-ghost" onClick={cp.resetCall} disabled={live || !call.lines.length}>Reset</button>
          <button className="btn btn-primary" onClick={props.onEnd} disabled={!call.lines.length || live}>End call → report</button>
        </div>
      </div>

      <CaptionBar cp={cp} />

      {kbEmpty && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          No project knowledge loaded. Go to <b>1. Knowledge</b> and load the demo project or paste your own.
        </div>
      )}
      {!aiReady && health && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Live AI is {health.budget.exhausted ? "paused: today's spend cap is reached" : "not configured on this deployment"}.{" "}
          {cp.recording ? <>Use <b>⚡ Instant replay</b> to see a recorded real run.</> : "Add the LiteLLM environment variables."}
        </div>
      )}
      {call.error && (
        <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2 text-sm ${call.error.code === "fallback" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          <span>{call.error.message}</span>
          {call.error.code === "access_code" && (
            <span className="flex gap-2">
              <input className="input w-40 py-1" type="password" placeholder="Access code" value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn btn-primary py-1" onClick={() => { setAccessCode(code); cp.clearError(); }}>Save</button>
            </span>
          )}
          {cp.recording && ["budget", "busy", "rate_limited", "ai_off", "not_configured", "network"].includes(call.error.code ?? "") && (
            <button className="btn btn-ghost py-1" onClick={cp.demo.replay}>⚡ Switch to Instant replay</button>
          )}
          <button className="ml-auto text-xs underline" onClick={cp.clearError}>dismiss</button>
        </div>
      )}

      {compact ? (
        <div className="mx-auto max-w-2xl space-y-3">
          <QuickActions cp={cp} />
          {call.assist && <AssistCard a={call.assist} onClose={cp.closeAssist} />}
          <AnswerCard s={latest} pending={call.pending} hasLines={call.lines.length > 0} />
          <PulseCard pulse={pulse} history={call.pulses} />
          <p className="text-center text-xs text-slate-400">Keys: A answer · K clarify · R recap · F follow-up · Y copy · S sound · V full view</p>
        </div>
      ) : (
        <>
      <BriefCard brief={props.brief} state={props.briefState} tokens={props.briefTokens} onBrief={props.onBrief} disabled={kbEmpty || (!aiReady && !cp.recording)} collapsed={call.lines.length > 0} />

      {/* agent trace + X-ray */}
      <div className="card px-4 py-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <span>Agent orchestration · latest client question</span>
          <span className="normal-case tracking-normal text-slate-400">
            Click any step for its Agent X-ray. <span className="text-brand-600">AI agent</span> · <span className="text-sky-700">tool (no model cost)</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PIPE.map((p, i) => {
            const ev = lastRun?.events[p.name];
            const st = ev?.status;
            const cls =
              st === "running"
                ? "border-brand-300 bg-brand-50 text-brand-700"
                : st === "ok"
                ? p.kind === "tool" ? "border-sky-300 bg-sky-50 text-sky-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"
                : st === "error"
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : st === "skipped"
                ? "border-slate-200 bg-slate-50 text-slate-400 line-through"
                : "border-dashed border-slate-200 bg-white text-slate-400";
            return (
              <div key={p.name} className="flex items-center gap-1.5">
                {i === 7 && <span className="mx-1 font-bold text-slate-300">‖</span>}
                <button
                  className={`rounded-lg border px-2.5 py-1 text-left text-xs transition hover:shadow ${cls} ${xray === p.name ? "ring-2 ring-brand-300" : ""}`}
                  onClick={() => setXray(xray === p.name ? null : p.name)}
                  title={ev?.note}
                >
                  <span className={`font-semibold ${st === "running" ? "blink" : ""}`}>{p.label}</span>
                  {ev?.ms != null && <span className="ml-1.5 font-mono text-[10px] opacity-70">{(ev.ms / 1000).toFixed(1)}s</span>}
                  {ev?.cached && <span className="ml-1 text-[10px] font-semibold text-emerald-700">cached</span>}
                  {ev?.note && st !== "running" && <span className="ml-1.5 hidden text-[10px] opacity-80 xl:inline">{ev.note}</span>}
                </button>
                {i < 6 && i !== 6 && <span className="text-slate-300">→</span>}
              </div>
            );
          })}
        </div>
        {xray && <XRay name={xray} ev={xev} onClose={() => setXray(null)} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Transcript ws={ws} cp={cp} />
        <div className="space-y-4 lg:col-span-5">
          <QuickActions cp={cp} />
          {call.assist && <AssistCard a={call.assist} onClose={cp.closeAssist} />}
          <AnswerCard s={latest} pending={call.pending} hasLines={call.lines.length > 0} />
          {earlier.length > 0 && (
            <div className="card">
              <div className="card-h">Earlier answers ({earlier.length})</div>
              <div className="max-h-72 divide-y divide-slate-100 overflow-auto">
                {earlier.map((s) => (
                  <div key={s.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Verdict v={s.verdict} small />
                      <span className="truncate">{s.question}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{s.sayThis}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4 lg:col-span-3">
          <PulseCard pulse={pulse} history={call.pulses} />
          <LogCard log={call.log} />
        </div>
      </div>
        </>
      )}
      <p className="text-center text-xs text-slate-400">
        Let the client know an AI assistant is taking notes. Several US states require consent from everyone on a recorded call.
      </p>
    </div>
  );
}

// ---------------- captions: source and privacy ----------------
function CaptionBar({ cp }: { cp: Copilot }) {
  const m = cp.mic;
  const local = m.localStatus === "available";
  const pill = m.on
    ? m.processing === "on-device"
      ? ["Audio stays on this laptop (on-device speech)", "bg-emerald-50 text-emerald-800 border-emerald-200"]
      : ["Captions use the browser's cloud speech service", "bg-amber-50 text-amber-800 border-amber-200"]
    : local
    ? ["On-device speech ready: audio will not leave this laptop", "bg-emerald-50 text-emerald-800 border-emerald-200"]
    : m.localStatus === "downloadable"
    ? ["On-device speech pack not downloaded yet", "bg-slate-50 text-slate-600 border-slate-200"]
    : m.localStatus === "downloading"
    ? ["Downloading the on-device speech pack…", "bg-slate-50 text-slate-600 border-slate-200"]
    : m.localStatus === "unknown" || m.localStatus === "checking"
    ? ["On-device speech not checked yet", "bg-slate-50 text-slate-600 border-slate-200"]
    : ["This browser has no on-device speech (needs Chrome or Edge 139+)", "bg-slate-50 text-slate-600 border-slate-200"];
  return (
    <div className="card flex flex-wrap items-center gap-3 px-4 py-2 text-xs">
      <span className="font-semibold uppercase tracking-wider text-slate-500">Live captions</span>
      <select
        className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700"
        value={m.source}
        disabled={m.on}
        onChange={(e) => m.setSource(e.target.value as typeof m.source)}
      >
        <option value="call+mic">Call audio = client, my mic = me (headphones)</option>
        <option value="call">Call audio only (on speakers)</option>
        <option value="mic">Mic only, I switch speakers (C / M)</option>
      </select>
      <label className="flex items-center gap-1.5 font-semibold text-slate-700">
        <input type="checkbox" checked={m.strictLocal} disabled={m.on} onChange={(e) => m.setStrictLocal(e.target.checked)} />
        On-device only
      </label>
      <span className={`rounded-full border px-2.5 py-0.5 font-semibold ${pill[1]}`}>{pill[0]}</span>
      {m.localStatus === "unknown" && (
        <button className="btn btn-ghost py-0.5 text-xs" onClick={m.checkLocal}>Check this browser</button>
      )}
      {m.localStatus === "downloadable" && (
        <button className="btn btn-ghost py-0.5 text-xs" onClick={m.installLocal}>Download speech pack</button>
      )}
      <span className="ml-auto text-slate-400">{m.source !== "mic" ? "You will be asked to share the Teams or Meet tab: tick \"Share tab audio\"." : ""}</span>
    </div>
  );
}

// ---------------- quick actions ----------------
const QA: { a: QuickAction; label: string; key: string; hint: string }[] = [
  { a: "answer", label: "Answer now", key: "A", hint: "Answer the latest client line even if no alert fired" },
  { a: "clarify", label: "Clarify", key: "K", hint: "What did they just ask, in plain words" },
  { a: "recap", label: "Recap", key: "R", hint: "The last 5 minutes in bullets" },
  { a: "followup", label: "Follow-up Qs", key: "F", hint: "Good questions to ask them now" },
];

function QuickActions({ cp }: { cp: Copilot }) {
  const disabled = !cp.call.lines.length || cp.call.replay;
  return (
    <div className="flex flex-wrap gap-1.5">
      {QA.map((q) => (
        <button key={q.a} className="btn btn-ghost flex-1 justify-center py-1 text-xs" disabled={disabled || (cp.call.assist?.busy ?? false)} onClick={() => cp.quickAction(q.a)} title={q.hint}>
          {q.label} <kbd className="rounded border border-slate-300 px-1 font-mono text-[10px] text-slate-400">{q.key}</kbd>
        </button>
      ))}
    </div>
  );
}

function AssistCard({ a, onClose }: { a: NonNullable<Copilot["call"]["assist"]>; onClose: () => void }) {
  const title = { answer: "Answer", clarify: "Clarify", recap: "Recap: last 5 minutes", followup: "Questions to ask them" }[a.action];
  return (
    <div className="card pop border-l-4 border-l-charcoal">
      <div className="card-h">
        <span>{title}</span>
        <button className="normal-case tracking-normal text-slate-400 hover:text-slate-700" onClick={onClose}>close</button>
      </div>
      <div className="whitespace-pre-line px-4 py-3 text-[15px] leading-relaxed text-slate-800">{a.busy ? <span className="blink text-slate-400">Assist agent thinking…</span> : a.text}</div>
    </div>
  );
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.26);
  } catch {}
}

// ---------------- Agent X-ray ----------------
function XRay({ name, ev, onClose }: { name: AgentName; ev?: AgentEvent; onClose: () => void }) {
  return (
    <div className="pop mt-3 rounded-lg border border-slate-200 bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs">
        <span className="font-semibold">
          Agent X-ray: {name}
          {ev?.status && <span className="ml-2 font-normal text-slate-400">{ev.status}{ev.ms != null ? ` in ${(ev.ms / 1000).toFixed(2)}s` : ""}{ev.tokens != null ? ` · ${ev.tokens} tokens` : ""}{ev.cached ? " · served from cache" : ""}</span>}
        </span>
        <button className="text-slate-400 hover:text-white" onClick={onClose}>close</button>
      </div>
      <pre className="max-h-64 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-emerald-200">
        {ev?.detail !== undefined ? JSON.stringify(ev.detail, null, 2) : ev?.note ?? "This step has not run for the latest line yet."}
      </pre>
    </div>
  );
}

// ---------------- pre-call brief ----------------
function BriefCard(props: { brief: Brief | null; state: string; tokens: number | null; onBrief: (agenda: string) => void; disabled: boolean; collapsed: boolean }) {
  const [open, setOpen] = useState(true);
  const [agenda, setAgenda] = useState("");
  const { brief } = props;
  useEffect(() => {
    if (props.collapsed) setOpen(false);
  }, [props.collapsed]);
  return (
    <div className="card">
      <div className="card-h">
        <button className="flex items-center gap-2 uppercase" onClick={() => setOpen(!open)}>
          <span>{open ? "▾" : "▸"}</span> Pre-call brief <span className="normal-case tracking-normal text-slate-400">Strategist agent predicts the hard questions before you dial in</span>
        </button>
        <button className="btn btn-ghost py-1 text-xs normal-case tracking-normal" onClick={() => { setOpen(true); props.onBrief(agenda); }} disabled={props.disabled || props.state === "loading"}>
          {props.state === "loading" ? <span className="blink">Preparing…</span> : brief ? "Refresh brief" : "Prepare me for this call"}
        </button>
      </div>
      {open && brief && (
        <div className="grid gap-4 px-4 py-3 md:grid-cols-3">
          <div className="space-y-2 text-sm">
            <div><div className="label">Objective</div>{brief.objective}</div>
            <div className="rounded-lg bg-charcoal px-3 py-2 text-white"><div className="text-[11px] font-semibold uppercase text-brand-300">Open with</div>{brief.openingLine}</div>
            <div><div className="label">Mood forecast</div>{brief.moodForecast}</div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="label">Likely hard questions</div>
            {brief.likelyQuestions.map((q, i) => (
              <div key={i} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className={`chip mt-0.5 ${q.risk === "high" ? "bg-rose-100 text-rose-700" : q.risk === "medium" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{q.risk}</span>
                  <b className="flex-1">{q.q}</b>
                  {q.defer && <span className="chip bg-rose-100 text-rose-700">defer</span>}
                </div>
                <p className="mt-1 text-slate-600">{q.answer}</p>
              </div>
            ))}
            <div className="grid gap-3 pt-1 text-sm sm:grid-cols-2">
              <div><div className="label">Landmines</div><ul className="list-disc pl-5 text-slate-600">{brief.landmines.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
              <div><div className="label">Must say</div><ul className="list-disc pl-5 text-slate-600">{brief.mustSay.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            </div>
            {brief.questionsToAsk?.length > 0 && (
              <div className="text-sm"><div className="label">Questions to ask them</div><ul className="list-disc pl-5 text-slate-600">{brief.questionsToAsk.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            )}
            {props.tokens != null && <div className="text-right text-[11px] text-slate-400">{props.tokens === 0 ? "served from cache or recording, 0 tokens" : `${fmtTok(props.tokens)} tokens`}</div>}
          </div>
        </div>
      )}
      {open && (
        <div className="border-b border-slate-100 px-4 py-2">
          <input className="input py-1.5 text-xs" maxLength={2000} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="Optional: agenda and who is joining (e.g. Weekly status; Megan Carter VP Ops, Jason Lee IT Director)" />
        </div>
      )}
      {open && !brief && props.state !== "loading" && (
        <div className="px-4 py-3 text-sm text-slate-500">{props.state === "error" ? "The Strategist could not prepare a brief. Try again." : "Get the 5 questions this client is most likely to ask, with grounded answers, landmines and an opening line."}</div>
      )}
    </div>
  );
}

// ---------------- transcript ----------------
function Transcript({ ws, cp }: { ws: Workspace; cp: Copilot }) {
  const { call, interim } = cp;
  const box = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [who, setWho] = useState<"client" | "me">("client");
  const clientFirst = (ws.clientName.split(",")[0] || "Client").split(" ")[0];
  const asked = new Set(call.suggestions.map((s) => s.lineId));

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [call.lines.length, interim?.text]);

  const submit = (direct: boolean) => {
    if (!text.trim()) return;
    cp.addLine(direct ? "client" : who, text, direct);
    setText("");
  };

  return (
    <div className="card flex h-[640px] flex-col lg:col-span-4">
      <div className="card-h">
        <span>Live transcript</span>
        <span className="normal-case tracking-normal text-slate-400">{call.lines.length} lines</span>
      </div>
      <div ref={box} className="flex-1 space-y-2.5 overflow-auto px-4 py-3">
        {call.lines.length === 0 && !interim && (
          <div className="mt-16 px-4 text-center text-sm text-slate-400">
            Press <b className="text-slate-600">▶ Play demo</b> for a 90-second scripted call with a frustrated US client, start Live captions during a Teams or Meet call, or type a line below.
          </div>
        )}
        {call.lines.map((l) => (
          <div key={l.id} className={`pop flex ${l.speaker === "me" ? "justify-end" : ""}`}>
            <div className={`max-w-[88%] rounded-xl px-3 py-2 text-sm ${l.speaker === "client" ? "bg-brand-50 text-slate-800" : "bg-slate-100 text-slate-700"}`}>
              <div className="mb-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                {l.speaker === "client" ? clientFirst : "You"}
                <span className="font-mono font-normal">{Math.floor(l.t / 60000)}:{String(Math.floor((l.t / 1000) % 60)).padStart(2, "0")}</span>
                {asked.has(l.id) && <span className="chip bg-brand-600 text-white">Q</span>}
              </div>
              {l.text}
            </div>
          </div>
        ))}
        {interim && (
          <div className={`flex ${interim.speaker === "me" ? "justify-end" : ""}`}>
            <div className="max-w-[88%] rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm italic text-slate-500">
              <div className="mb-0.5 text-[10px] font-bold uppercase not-italic tracking-wide text-slate-400">
                {interim.speaker === "client" ? clientFirst : "You"} <span className="blink">●</span>
              </div>
              {interim.text}
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-slate-100 p-3">
        <div className="flex gap-2">
          <select className="input w-24 px-2" value={who} onChange={(e) => setWho(e.target.value as "client" | "me")}>
            <option value="client">{clientFirst}</option>
            <option value="me">You</option>
          </select>
          <input
            className="input"
            placeholder="Type what was said, Enter to add"
            maxLength={1200}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit(false)}
          />
        </div>
        <button className="mt-2 text-xs font-semibold text-brand-600 hover:underline disabled:opacity-40" disabled={!text.trim()} onClick={() => submit(true)}>
          Ask copilot directly (treat as a client question) →
        </button>
      </div>
    </div>
  );
}

// ---------------- suggested answer ----------------
function Verdict({ v, small }: { v: Suggestion["verdict"]; small?: boolean }) {
  const map: Record<Suggestion["verdict"], [string, string]> = {
    verified: ["Verified", "bg-emerald-100 text-emerald-800"],
    revised: ["Revised after Verifier review", "bg-sky-100 text-sky-800"],
    caution: ["Check before saying", "bg-amber-100 text-amber-800"],
    defer: ["Defer: outside your authority", "bg-rose-100 text-rose-700"],
    pending: ["Verifying…", "bg-slate-100 text-slate-500 blink"],
  };
  const [label, cls] = map[v];
  return <span className={`chip ${cls} ${small ? "text-[10px]" : ""}`}>{small ? label.split(":")[0].replace(" after Verifier review", "") : label}</span>;
}

function AnswerCard({ s, pending, hasLines }: { s?: Suggestion; pending: { question: string; intent: string } | null; hasLines: boolean }) {
  const [showOrig, setShowOrig] = useState(false);
  const [copied, setCopied] = useState(false);
  if (pending) {
    return (
      <div className="card pop border-brand-200">
        <div className="card-h">
          <span>Suggested answer</span>
          <span className="chip bg-brand-100 text-brand-700">{pending.intent}</span>
        </div>
        <div className="px-5 py-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Client asked</div>
          <p className="mt-1 text-sm font-medium text-slate-700">{pending.question}</p>
          <div className="mt-4 space-y-2">
            <div className="blink h-3 w-11/12 rounded bg-slate-200" />
            <div className="blink h-3 w-10/12 rounded bg-slate-200" />
            <div className="blink h-3 w-7/12 rounded bg-slate-200" />
          </div>
          <p className="mt-3 text-xs text-brand-600">Planner searching project knowledge, Answer agent drafting…</p>
        </div>
      </div>
    );
  }
  if (!s) {
    return (
      <div className="card">
        <div className="card-h">Suggested answer</div>
        <div className="px-5 py-14 text-center text-sm text-slate-400">
          {hasLines ? "Listening for the next client question…" : "When the client asks something, a fact-checked answer appears here within seconds."}
        </div>
      </div>
    );
  }
  const border = s.verdict === "verified" ? "border-emerald-300" : s.verdict === "defer" ? "border-rose-300" : s.verdict === "revised" ? "border-sky-300" : s.verdict === "caution" ? "border-amber-300" : "border-slate-200";
  const c = s.check;
  return (
    <div key={s.id} className={`card pop border-2 ${border}`}>
      <div className="card-h">
        <span>Suggested answer</span>
        <div className="flex items-center gap-1.5">
          <span className="chip bg-slate-100 text-slate-600">{s.intent}</span>
          {s.urgency === "high" && <span className="chip bg-rose-100 text-rose-700">urgent</span>}
          <Verdict v={s.verdict} />
        </div>
      </div>
      <div className="px-5 py-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Client asked</div>
        <p className="mt-1 text-sm font-medium text-slate-600">{s.question}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">Say this</span>
          <button className="text-[11px] font-semibold text-slate-400 hover:text-slate-700" onClick={() => { navigator.clipboard.writeText(s.sayThis); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
            {copied ? "copied" : "copy"}
          </button>
        </div>
        <p className="mt-1 text-[17px] leading-relaxed text-slate-900">{s.sayThis}</p>
        {s.keyPoints.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {s.keyPoints.map((k, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none bg-brand-500" />
                {k}
              </li>
            ))}
          </ul>
        )}
        {s.followUp && (
          <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
            <b>Ask back:</b> {s.followUp}
          </p>
        )}
        {c && c.calendar.length > 0 && (
          <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
            <b>US calendar tool:</b> {c.calendar.map((x) => `${x.date} (${x.iso}) is ${x.issue}`).join("; ")}. Worth mentioning before the client notices.
          </div>
        )}
        {s.issues.length > 0 && s.verdict !== "verified" && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <b>Verifier:</b> {s.issues.join(" · ")}
            {s.original && (
              <button className="ml-2 font-semibold underline" onClick={() => setShowOrig((x) => !x)}>
                {showOrig ? "hide" : "see"} first draft
              </button>
            )}
            {showOrig && s.original && <p className="mt-1 italic text-amber-800 line-through decoration-amber-400">{s.original}</p>}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          {c && (
            <span className={`chip ${c.grounded === c.total ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`} title={c.facts.map((f) => `${f.fact}: ${f.grounded ? "found in knowledge" : "NOT found"}`).join("\n")}>
              {c.total === 0 ? "no hard facts" : `${c.grounded}/${c.total} facts grounded`}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            Confidence
            <span className="inline-block h-1.5 w-14 overflow-hidden rounded bg-slate-200">
              <span className="block h-full bg-brand-500" style={{ width: `${Math.round(s.confidence * 100)}%` }} />
            </span>
            {Math.round(s.confidence * 100)}%
          </span>
          {s.sources.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {s.sources.slice(0, 3).map((x) => (
                <span key={x} className="chip bg-slate-100 font-medium text-slate-600">{x}</span>
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- psychology pulse ----------------
function scoreColor(s: number) {
  if (s <= -0.4) return "#b91f2a";
  if (s < -0.1) return "#d97706";
  if (s < 0.2) return "#64748b";
  return "#059669";
}

function PulseCard({ pulse, history }: { pulse: Pulse | null; history: Pulse[] }) {
  const pts = history.map((p) => p.score);
  const W = 240;
  const H = 44;
  const path = pts
    .map((v, i) => `${i === 0 ? "M" : "L"}${pts.length === 1 ? W / 2 : (i / (pts.length - 1)) * W},${H / 2 - (v * H) / 2.2}`)
    .join(" ");
  return (
    <div className="card">
      <div className="card-h">
        <span>Client psychology</span>
        {pulse && <span className={`chip ${pulse.trust === "high" ? "bg-emerald-100 text-emerald-800" : pulse.trust === "low" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>trust {pulse.trust}</span>}
      </div>
      {!pulse ? (
        <div className="px-4 py-8 text-center text-sm text-slate-400">Reads the client&apos;s mood after each thing they say.</div>
      ) : (
        <div key={pulse.lineId} className="pop px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black capitalize" style={{ color: scoreColor(pulse.score) }}>{pulse.emotion}</span>
            <span className="font-mono text-sm text-slate-500">{pulse.score > 0 ? "+" : ""}{pulse.score.toFixed(2)}</span>
          </div>
          <div className="relative mt-2 h-2 rounded-full" style={{ background: "linear-gradient(90deg,#b91f2a,#f59e0b,#cbd5e1,#10b981)" }}>
            <span className="absolute -top-1 h-4 w-1.5 -translate-x-1/2 rounded bg-slate-900 transition-all duration-500" style={{ left: `${((pulse.score + 1) / 2) * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>negative</span><span>intensity {Math.round(pulse.intensity * 100)}%</span><span>positive</span></div>
          {pts.length > 1 && (
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-11 w-full" aria-label="Sentiment over the call">
              <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#e2e8f0" strokeDasharray="3 3" />
              <path d={path} fill="none" stroke="#b91f2a" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          )}
          {pulse.need && <p className="mt-2 text-sm"><span className="font-semibold text-slate-500">Needs: </span>{pulse.need}</p>}
          {pulse.tip && (
            <p className="mt-2 rounded-lg bg-charcoal px-3 py-2 text-sm text-white">
              <span className="font-semibold text-brand-300">Respond: </span>{pulse.tip}
            </p>
          )}
          {pulse.cues.length > 0 && (
            <div className="mt-2 space-y-1">
              {pulse.cues.map((c, i) => (
                <div key={i} className="border-l-2 border-slate-300 pl-2 text-xs italic text-slate-500">&ldquo;{c}&rdquo;</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------- live risk / issue / action log ----------------
const TYPE_CLS: Record<LogItem["type"], string> = {
  risk: "bg-rose-100 text-rose-700",
  issue: "bg-amber-100 text-amber-800",
  action: "bg-sky-100 text-sky-800",
  commitment: "bg-emerald-100 text-emerald-800",
};

function LogCard({ log }: { log: LogItem[] }) {
  const items = [...log].reverse();
  return (
    <div className="card">
      <div className="card-h">
        <span>Risks, issues & actions</span>
        <span className="normal-case tracking-normal text-slate-400">{log.length}</span>
      </div>
      <div className="max-h-[380px] divide-y divide-slate-100 overflow-auto">
        {items.length === 0 && <div className="px-4 py-8 text-center text-sm text-slate-400">Captured automatically as they come up.</div>}
        {items.map((i) => (
          <div key={i.id} className="pop px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className={`chip ${TYPE_CLS[i.type]}`}>{i.type}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${i.severity === "high" ? "bg-rose-500" : i.severity === "medium" ? "bg-amber-400" : "bg-slate-300"}`} title={`${i.severity} severity`} />
              {i.owner && <span className="ml-auto text-[10px] text-slate-400">{i.owner}</span>}
            </div>
            <div className="mt-1 text-sm font-medium text-slate-800">{i.title}</div>
            {i.detail && <div className="text-xs text-slate-500">{i.detail}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
