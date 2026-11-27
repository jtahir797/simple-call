"use client";

import { useEffect, useRef, useState } from "react";
import type { useCopilot } from "@/hooks/useCopilot";
import { setAccessCode } from "@/lib/client";
import { getMode, MODES } from "@/lib/modes";
import type { AgentEvent, AgentName, Brief, LogItem, Pulse, QuickAction, Suggestion, Workspace } from "@/lib/types";

// Live call screen. Design rule: one thing to read (the answer), everything else one click away.

type Copilot = ReturnType<typeof useCopilot>;
export interface Health {
  configured: boolean;
  model: string | null;
  accessCode: boolean;
  privateModel?: boolean;
  budget: { usedPct: number; exhausted: boolean };
  store: string;
}

const STEPS: { name: AgentName; label: string; tool?: boolean }[] = [
  { name: "Listener", label: "Listener" },
  { name: "Retriever", label: "Knowledge", tool: true },
  { name: "Answer", label: "Answer" },
  { name: "FactCheck", label: "FactCheck", tool: true },
  { name: "Verifier", label: "Verifier" },
  { name: "Revise", label: "Revise" },
  { name: "Pulse", label: "Psychology" },
  { name: "Risk", label: "Risk" },
];

const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

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
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const [compact, setCompact] = useState(false);
  const [sound, setSound] = useState(false);
  const [notify, setNotify] = useState(false);
  const [code, setCode] = useState("");
  const latestRef = useRef<Suggestion | undefined>(undefined);
  const latest = call.suggestions[call.suggestions.length - 1];
  latestRef.current = latest;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // sound cue and desktop notification on each new answer
  useEffect(() => {
    const s = latestRef.current;
    if (!s) return;
    if (sound) beep();
    if (notify && document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification(`They asked: ${s.question.slice(0, 80)}`, { body: s.sayThis.slice(0, 200), tag: "simplecall" });
    }
  }, [latest?.id, sound, notify]);

  // keyboard: C/M speaker, A/K/R/F quick actions, Y copy, S sound, V compact
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
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
  }, [cp]);

  const toggleNotify = async () => {
    if (notify) return setNotify(false);
    if (!("Notification" in window)) return;
    const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setNotify(p === "granted");
  };

  const live = cp.demo.on || cp.mic.on;
  const aiReady = Boolean(health?.configured && !health.budget.exhausted);
  const kbEmpty = !ws.knowledge.trim();
  const elapsed = call.startedAt ? (call.endedAt ?? now) - call.startedAt : 0;
  const pulse = call.pulses[call.pulses.length - 1] ?? null;
  const lastRun = [...call.runs].reverse().find((r) => r.events.Listener?.status === "ok" || r.events.Answer) ?? call.runs[call.runs.length - 1];

  const start = (what: "captions" | "demo" | "replay") => {
    setMenu(false);
    if (what === "captions") cp.mic.start();
    if (what === "demo") cp.demo.start();
    if (what === "replay") cp.demo.replay();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      {/* ── call bar ── */}
      <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${live ? "blink bg-brand-600" : call.lines.length ? "bg-amber-400" : "bg-slate-300"}`} />
          <span className="text-sm font-semibold">
            {cp.demo.on ? (call.replay ? "Recorded run playing" : "Demo call live") : cp.mic.on ? "Listening" : call.lines.length ? "Paused" : "Ready"}
          </span>
          <span className="font-mono text-sm text-slate-400">{fmtTime(elapsed)}</span>
        </div>

        <div className="relative">
          {live ? (
            <button className="btn btn-ghost" onClick={() => (cp.mic.on ? cp.mic.stop() : cp.demo.stop())}>
              ■ {cp.mic.on ? "Stop captions" : "Stop demo"}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setMenu(!menu)} disabled={kbEmpty}>
              ▶ Start ▾
            </button>
          )}
          {menu && !live && (
            <div className="pop absolute left-0 top-11 z-20 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <MenuItem title="Live captions" desc="Caption a real Teams, Meet or Zoom call" disabled={!aiReady || !cp.mic.supported} onClick={() => start("captions")} />
              <MenuItem title="Play demo US client call" desc="Scripted 90-second call, live agents" disabled={!aiReady} onClick={() => start("demo")} />
              {cp.recording && <MenuItem title="⚡ Instant replay" desc="A recorded real run, no AI cost" onClick={() => start("replay")} />}
            </div>
          )}
        </div>

        <span className="hidden text-xs text-slate-400 sm:inline">{getMode(ws.mode).label}</span>

        <div className="ml-auto flex items-center gap-2">
          <button className={`btn btn-ghost px-2.5 ${settings ? "bg-slate-100" : ""}`} onClick={() => setSettings(!settings)} title="Call settings">
            ⚙
          </button>
          <button className="btn btn-primary" onClick={props.onEnd} disabled={!call.lines.length || live}>
            End call → report
          </button>
        </div>
      </div>

      {settings && (
        <Settings
          ws={ws}
          setWs={props.setWs}
          cp={cp}
          compact={compact}
          setCompact={setCompact}
          sound={sound}
          setSound={setSound}
          notify={notify}
          toggleNotify={toggleNotify}
          stats={`${call.agentCalls} agent runs · ${call.tokens.toLocaleString()} tokens${call.cachedHits ? ` · ${call.cachedHits} cached` : ""}${call.replay ? " · recorded run, 0 tokens" : ""}`}
        />
      )}

      {/* ── notices ── */}
      {!aiReady && health && !live && (
        <Notice tone="amber">
          Live AI is {health.configured ? "paused: the spend cap is reached" : "not configured on this deployment"}.
          {cp.recording ? <> Use <b>Start → Instant replay</b> to see a recorded real run.</> : null}
        </Notice>
      )}
      {call.error && (
        <Notice tone={call.error.code === "fallback" ? "sky" : "rose"} onClose={cp.clearError}>
          {call.error.message}
          {call.error.code === "access_code" && (
            <span className="ml-2 inline-flex gap-2">
              <input className="input w-36 py-1" type="password" placeholder="Access code" value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn btn-primary py-1" onClick={() => { setAccessCode(code); cp.clearError(); }}>Save</button>
            </span>
          )}
        </Notice>
      )}

      {/* ── before the call ── */}
      {!call.lines.length && !compact && (
        <BriefCard brief={props.brief} state={props.briefState} onBrief={props.onBrief} disabled={kbEmpty || (!aiReady && !cp.recording)} />
      )}

      {/* ── the answer ── */}
      <AnswerCard s={latest} pending={call.pending} hasLines={call.lines.length > 0} interim={cp.interim?.speaker === "client" ? cp.interim.text : null} />

      {/* ── mood + risks ── */}
      <div className={`grid items-start gap-3 ${compact ? "" : "md:grid-cols-[1.6fr_1fr]"}`}>
        <MoodCard pulse={pulse} history={call.pulses} />
        {!compact && <RiskCard log={call.log} />}
      </div>

      {!compact && (
        <>
          <QuickActions cp={cp} />
          {call.assist && <AssistCard a={call.assist} onClose={cp.closeAssist} />}
          <AgentSteps run={lastRun} />
          <Drawer title={`Transcript (${call.lines.length})`} defaultOpen={false}>
            <Transcript ws={ws} cp={cp} />
          </Drawer>
          {call.suggestions.length > 1 && (
            <Drawer title={`Earlier answers (${call.suggestions.length - 1})`} defaultOpen={false}>
              <div className="divide-y divide-slate-100">
                {call.suggestions.slice(0, -1).reverse().map((s) => (
                  <div key={s.id} className="py-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Verdict v={s.verdict} small />
                      <span className="truncate">{s.question}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{s.sayThis}</p>
                  </div>
                ))}
              </div>
            </Drawer>
          )}
        </>
      )}

      <p className="pt-1 text-center text-xs text-slate-400">
        Tell the client an AI note-taker is in use. Keys: A answer · K clarify · R recap · F follow-up · Y copy · V beside the call
      </p>
    </div>
  );
}

// ─────────────────────────── small building blocks ───────────────────────────

function MenuItem({ title, desc, onClick, disabled }: { title: string; desc: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className="block w-full px-4 py-2.5 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      <div className="text-xs text-slate-500">{desc}</div>
    </button>
  );
}

function Notice({ tone, children, onClose }: { tone: "amber" | "rose" | "sky"; children: React.ReactNode; onClose?: () => void }) {
  const cls = { amber: "border-amber-200 bg-amber-50 text-amber-900", rose: "border-rose-200 bg-rose-50 text-rose-700", sky: "border-sky-200 bg-sky-50 text-sky-800" }[tone];
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm ${cls}`}>
      <span className="flex-1">{children}</span>
      {onClose && <button className="text-xs underline" onClick={onClose}>dismiss</button>}
    </div>
  );
}

function Drawer({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="card">
      <button className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-slate-600" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="border-t border-slate-100 px-4 py-3">{children}</div>}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${on ? "border-charcoal bg-charcoal text-white" : "border-slate-300 text-slate-600"}`}>
      {children}
    </button>
  );
}

// ─────────────────────────── settings (captions, mode, alerts) ───────────────────────────

function Settings(p: {
  ws: Workspace;
  setWs: (w: Workspace) => void;
  cp: Copilot;
  compact: boolean;
  setCompact: (b: boolean) => void;
  sound: boolean;
  setSound: (b: boolean) => void;
  notify: boolean;
  toggleNotify: () => void;
  stats: string;
}) {
  const m = p.cp.mic;
  const speech =
    m.processing === "on-device" ? "Audio stays on this laptop" : m.processing ? "Using the browser's cloud speech" :
    m.localStatus === "available" ? "On-device speech ready" : m.localStatus === "downloadable" ? "Speech pack not downloaded" :
    m.localStatus === "unsupported" ? "No on-device speech in this browser" : "Not checked yet";
  return (
    <div className="card pop grid gap-4 px-4 py-4 text-sm md:grid-cols-3">
      <div className="space-y-2">
        <div className="label">Call mode</div>
        <select className="input py-1.5" value={p.ws.mode ?? "client"} onChange={(e) => p.setWs({ ...p.ws, mode: e.target.value })}>
          {MODES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
        <p className="text-xs text-slate-500">{getMode(p.ws.mode).purpose}</p>
      </div>
      <div className="space-y-2">
        <div className="label">Live captions</div>
        <select className="input py-1.5" value={m.source} disabled={m.on} onChange={(e) => m.setSource(e.target.value as typeof m.source)}>
          <option value="call+mic">Headphones: call audio = client, mic = me</option>
          <option value="call">Speakers: call audio only</option>
          <option value="mic">Mic only, I switch speakers (C / M)</option>
        </select>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={m.strictLocal} disabled={m.on} onChange={(e) => m.setStrictLocal(e.target.checked)} /> On-device only
          <span className="font-normal text-slate-500">· {speech}</span>
        </label>
        <div className="flex gap-2">
          {m.localStatus === "unknown" && <button className="btn btn-ghost py-0.5 text-xs" onClick={m.checkLocal}>Check this browser</button>}
          {m.localStatus === "downloadable" && <button className="btn btn-ghost py-0.5 text-xs" onClick={m.installLocal}>Download speech pack</button>}
          {m.source === "mic" && (
            <span className="flex overflow-hidden rounded-md border border-slate-300 text-xs font-semibold">
              {(["client", "me"] as const).map((s) => (
                <button key={s} onClick={() => m.setSpeaker(s)} className={`px-2 py-0.5 ${m.speaker === s ? "bg-charcoal text-white" : "bg-white text-slate-600"}`}>
                  {s === "client" ? "Client (C)" : "Me (M)"}
                </button>
              ))}
            </span>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <div className="label">Alerts and view</div>
        <div className="flex flex-wrap gap-1.5">
          <Toggle on={p.compact} onClick={() => p.setCompact(!p.compact)}>Beside the call (V)</Toggle>
          <Toggle on={p.sound} onClick={() => p.setSound(!p.sound)}>Sound (S)</Toggle>
          <Toggle on={p.notify} onClick={p.toggleNotify}>Desktop alert</Toggle>
        </div>
        <p className="text-xs text-slate-400">{p.stats}</p>
        <button className="text-xs font-semibold text-slate-500 hover:underline disabled:opacity-40" onClick={p.cp.resetCall} disabled={p.cp.demo.on || p.cp.mic.on || !p.cp.call.lines.length}>
          Clear this call
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── pre-call brief ───────────────────────────

function BriefCard(props: { brief: Brief | null; state: string; onBrief: (agenda: string) => void; disabled: boolean }) {
  const [agenda, setAgenda] = useState("");
  const { brief } = props;
  return (
    <div className="card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold text-slate-700">Before the call</div>
        <input className="input min-w-[16rem] flex-1 py-1.5 text-xs" maxLength={2000} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="Optional: agenda and who is joining" />
        <button className="btn btn-ghost py-1.5 text-xs" onClick={() => props.onBrief(agenda)} disabled={props.disabled || props.state === "loading"}>
          {props.state === "loading" ? <span className="blink">Preparing…</span> : brief ? "Refresh brief" : "Prepare me for this call"}
        </button>
      </div>
      {props.state === "error" && <p className="mt-2 text-xs text-rose-600">The brief could not be prepared. Try again.</p>}
      {brief && (
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-[1fr_1.4fr]">
          <div className="space-y-2">
            <div className="rounded-lg bg-charcoal px-3 py-2 text-white"><div className="text-[11px] font-semibold uppercase text-brand-300">Open with</div>{brief.openingLine}</div>
            <p><span className="label inline">Mood: </span>{brief.moodForecast}</p>
            {brief.landmines.length > 0 && <p><span className="label inline">Avoid: </span>{brief.landmines.join(" · ")}</p>}
          </div>
          <div>
            <div className="label">Likely hard questions</div>
            <ul className="space-y-1.5">
              {brief.likelyQuestions.map((q, i) => (
                <li key={i} className="rounded-md bg-slate-50 px-3 py-1.5">
                  <b>{q.q}</b> {q.defer && <span className="chip ml-1 bg-rose-100 text-rose-700">defer</span>}
                  <div className="text-slate-600">{q.answer}</div>
                </li>
              ))}
            </ul>
            {brief.questionsToAsk?.length > 0 && <p className="mt-2 text-xs text-slate-600"><b>Ask them:</b> {brief.questionsToAsk.join(" · ")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── answer ───────────────────────────

function Verdict({ v, small }: { v: Suggestion["verdict"]; small?: boolean }) {
  const map: Record<Suggestion["verdict"], [string, string]> = {
    verified: ["Verified", "bg-emerald-100 text-emerald-800"],
    revised: ["Revised", "bg-sky-100 text-sky-800"],
    caution: ["Check first", "bg-amber-100 text-amber-800"],
    defer: ["Defer", "bg-rose-100 text-rose-700"],
    pending: ["Checking…", "bg-slate-100 text-slate-500 blink"],
  };
  const [label, cls] = map[v];
  return <span className={`chip ${cls} ${small ? "text-[10px]" : "px-2.5 py-1 text-xs"}`}>{label}</span>;
}

function AnswerCard({ s, pending, hasLines, interim }: { s?: Suggestion; pending: { question: string; intent: string } | null; hasLines: boolean; interim: string | null }) {
  const [details, setDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const border = !s || pending ? "border-slate-200" : s.verdict === "verified" ? "border-emerald-300" : s.verdict === "defer" ? "border-rose-300" : s.verdict === "revised" ? "border-sky-300" : "border-amber-300";

  if (pending) {
    return (
      <div className="card pop border-2 border-brand-200 px-6 py-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">They asked</div>
        <p className="mt-1 text-base text-slate-700">{pending.question}</p>
        <div className="mt-4 space-y-2"><div className="blink h-4 w-10/12 rounded bg-slate-200" /><div className="blink h-4 w-7/12 rounded bg-slate-200" /></div>
      </div>
    );
  }
  if (!s) {
    return (
      <div className="card px-6 py-10 text-center">
        {interim ? (
          <p className="text-base italic text-slate-500">“{interim}”</p>
        ) : (
          <p className="text-sm text-slate-400">{hasLines ? "Listening for the next question…" : "Press Start. When the client asks something, the answer to say appears here."}</p>
        )}
      </div>
    );
  }
  const c = s.check;
  return (
    <div key={s.id} data-shot="answer" className={`card pop border-2 ${border} px-6 py-5`}>
      <div className="flex items-start gap-3">
        <p className="flex-1 text-sm text-slate-500"><span className="font-semibold uppercase tracking-wide text-slate-400">They asked · </span>{s.question}</p>
        <Verdict v={s.verdict} />
      </div>
      <p className="mt-3 text-[22px] font-medium leading-snug text-slate-900">{s.sayThis}</p>
      {c && c.calendar.length > 0 && (
        <p className="mt-3 text-xs text-sky-800">📅 {c.calendar.map((x) => `${x.date}: ${x.issue}`).join("; ")}</p>
      )}
      {s.verdict === "defer" && <p className="mt-2 text-xs text-rose-700">Don&apos;t commit on the call: pass it to the owner named above.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {c && <span className={c.grounded === c.total ? "text-emerald-700" : "text-amber-700"}>{c.total === 0 ? "No hard facts" : `${c.grounded}/${c.total} facts checked`}</span>}
        <button className="font-semibold text-slate-600 hover:underline" onClick={() => { navigator.clipboard.writeText(s.sayThis); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>{copied ? "Copied" : "Copy"}</button>
        <button className="font-semibold text-slate-600 hover:underline" onClick={() => setDetails(!details)}>{details ? "Hide details" : "Details"}</button>
      </div>
      {details && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-700">
          {s.keyPoints.length > 0 && <ul className="list-disc pl-5">{s.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul>}
          {s.followUp && <p><b>Ask back:</b> {s.followUp}</p>}
          {s.issues.length > 0 && <p className="text-amber-800"><b>Verifier:</b> {s.issues.join(" · ")}</p>}
          {s.original && <p className="text-slate-400 line-through">{s.original}</p>}
          <p className="text-xs text-slate-400">Confidence {Math.round(s.confidence * 100)}%{s.sources.length ? ` · Sources: ${s.sources.slice(0, 3).join(", ")}` : ""}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── mood and risks ───────────────────────────

const moodColor = (s: number) => (s <= -0.4 ? "#b91f2a" : s < -0.1 ? "#d97706" : s < 0.2 ? "#64748b" : "#059669");

function MoodCard({ pulse, history }: { pulse: Pulse | null; history: Pulse[] }) {
  if (!pulse) return <div className="card px-4 py-4 text-sm text-slate-400">Client mood appears after they speak.</div>;
  const pts = history.map((p) => p.score);
  const W = 120, H = 28;
  const path = pts.map((v, i) => `${i ? "L" : "M"}${pts.length === 1 ? W / 2 : (i / (pts.length - 1)) * W},${H / 2 - (v * H) / 2.2}`).join(" ");
  return (
    <div key={pulse.lineId} className="card pop px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold capitalize" style={{ color: moodColor(pulse.score) }}>{pulse.emotion}</span>
        <span className="chip bg-slate-100 text-slate-600">trust {pulse.trust}</span>
        {pts.length > 1 && (
          <svg viewBox={`0 0 ${W} ${H}`} className="ml-auto h-7 w-28" aria-label="Mood over the call">
            <path d={path} fill="none" stroke="#b91f2a" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      {pulse.tip && <p className="mt-1.5 text-sm text-slate-700"><b className="text-slate-500">Respond: </b>{pulse.tip}</p>}
    </div>
  );
}

const TYPE: Record<LogItem["type"], string> = { risk: "bg-rose-100 text-rose-700", issue: "bg-amber-100 text-amber-800", action: "bg-sky-100 text-sky-800", commitment: "bg-emerald-100 text-emerald-800" };

function RiskCard({ log }: { log: LogItem[] }) {
  const [open, setOpen] = useState(false);
  const count = (t: LogItem["type"]) => log.filter((l) => l.type === t).length;
  return (
    <div className="card px-4 py-3">
      <button className="flex w-full items-center gap-1.5 text-left" onClick={() => setOpen(!open)} disabled={!log.length}>
        <span className="mr-1 text-sm font-semibold text-slate-600">Logged</span>
        {log.length === 0 && <span className="text-xs text-slate-400">nothing yet</span>}
        {(["risk", "issue", "action", "commitment"] as const).map((t) => count(t) > 0 && <span key={t} className={`chip whitespace-nowrap ${TYPE[t]}`}>{count(t)} {t}{count(t) > 1 ? "s" : ""}</span>)}
        {log.length > 0 && <span className="ml-auto text-slate-400">{open ? "▾" : "▸"}</span>}
      </button>
      {open && (
        <ul className="mt-2 max-h-60 space-y-1.5 overflow-auto text-sm">
          {[...log].reverse().map((i) => (
            <li key={i.id}><span className={`chip mr-1.5 ${TYPE[i.type]}`}>{i.type}</span>{i.title}{i.owner && <span className="text-xs text-slate-400"> · {i.owner}</span>}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────── quick actions ───────────────────────────

const QA: { a: QuickAction; label: string; key: string }[] = [
  { a: "answer", label: "Answer now", key: "A" },
  { a: "clarify", label: "Clarify", key: "K" },
  { a: "recap", label: "Recap", key: "R" },
  { a: "followup", label: "Questions to ask", key: "F" },
];

function QuickActions({ cp }: { cp: Copilot }) {
  const disabled = !cp.call.lines.length || cp.call.replay || (cp.call.assist?.busy ?? false);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {QA.map((q) => (
        <button key={q.a} className="btn btn-ghost justify-center py-1.5 text-xs" disabled={disabled} onClick={() => cp.quickAction(q.a)}>
          {q.label} <kbd className="rounded border border-slate-200 px-1 font-mono text-[10px] text-slate-400">{q.key}</kbd>
        </button>
      ))}
    </div>
  );
}

function AssistCard({ a, onClose }: { a: NonNullable<Copilot["call"]["assist"]>; onClose: () => void }) {
  const title = { answer: "Answer", clarify: "Clarify", recap: "Recap: last 5 minutes", followup: "Questions to ask them" }[a.action];
  return (
    <div className="card pop border-l-4 border-l-charcoal px-4 py-3">
      <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
        <button className="normal-case text-slate-400 hover:text-slate-700" onClick={onClose}>close</button>
      </div>
      <div className="whitespace-pre-line text-[15px] text-slate-800">{a.busy ? <span className="blink text-slate-400">Thinking…</span> : a.text}</div>
    </div>
  );
}

// ─────────────────────────── agent steps (how the answer was made) ───────────────────────────

function AgentSteps({ run }: { run?: { events: Partial<Record<AgentName, AgentEvent>> } }) {
  const [sel, setSel] = useState<AgentName | null>(null);
  const ev = sel ? run?.events[sel] : undefined;
  return (
    <div className="card px-4 py-2.5" data-shot="steps">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="mr-1 font-semibold text-slate-500">Agent steps</span>
        {STEPS.map((p) => {
          const st = run?.events[p.name]?.status;
          const dot = st === "ok" ? (p.tool ? "bg-sky-500" : "bg-emerald-500") : st === "running" ? "blink bg-brand-500" : st === "error" ? "bg-rose-500" : "bg-slate-200";
          return (
            <button key={p.name} onClick={() => setSel(sel === p.name ? null : p.name)} className={`flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-slate-100 ${sel === p.name ? "bg-slate-100 ring-1 ring-slate-300" : ""} ${st === "skipped" || !st ? "text-slate-400" : "text-slate-700"}`} title={run?.events[p.name]?.note}>
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              {p.label}
            </button>
          );
        })}
        <span className="ml-auto text-[11px] text-slate-400">click a step to see what it decided</span>
      </div>
      {sel && (
        <div className="pop mt-2 rounded-lg bg-slate-950 text-slate-100">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5 text-xs">
            <span className="font-semibold">Agent X-ray: {sel}{ev?.ms != null && <span className="ml-2 font-normal text-slate-400">{(ev.ms / 1000).toFixed(1)}s{ev.tokens != null ? ` · ${ev.tokens} tokens` : ""}{ev.cached ? " · cached" : ""}</span>}</span>
            <button className="text-slate-400 hover:text-white" onClick={() => setSel(null)}>close</button>
          </div>
          <pre className="max-h-56 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-emerald-200">
            {ev?.detail !== undefined ? JSON.stringify(ev.detail, null, 2) : ev?.note ?? "This step has not run for the latest line yet."}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── transcript ───────────────────────────

function Transcript({ ws, cp }: { ws: Workspace; cp: Copilot }) {
  const { call, interim } = cp;
  const box = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [who, setWho] = useState<"client" | "me">("client");
  const first = (ws.clientName.split(",")[0] || "Client").split(" ")[0];
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [call.lines.length, interim?.text]);
  const submit = (direct: boolean) => {
    if (!text.trim()) return;
    cp.addLine(direct ? "client" : who, text, direct);
    setText("");
  };
  return (
    <div>
      <div ref={box} className="max-h-80 space-y-1.5 overflow-auto text-sm">
        {call.lines.length === 0 && <p className="text-slate-400">Nothing said yet.</p>}
        {call.lines.map((l) => (
          <p key={l.id}><b className={l.speaker === "client" ? "text-brand-700" : "text-slate-500"}>{l.speaker === "client" ? first : "You"}:</b> {l.text}</p>
        ))}
        {interim && <p className="italic text-slate-400"><b>{interim.speaker === "client" ? first : "You"}:</b> {interim.text}</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <select className="input w-24 px-2" value={who} onChange={(e) => setWho(e.target.value as "client" | "me")}>
          <option value="client">{first}</option>
          <option value="me">You</option>
        </select>
        <input className="input" placeholder="Type what was said, Enter to add" maxLength={1200} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit(false)} />
        <button className="btn btn-ghost whitespace-nowrap text-xs" disabled={!text.trim()} onClick={() => submit(true)}>Ask</button>
      </div>
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
