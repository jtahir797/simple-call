"use client";

import { useCallback, useEffect, useState } from "react";
import LiveCall, { type Health } from "@/components/LiveCall";
import Report from "@/components/Report";
import Setup from "@/components/Setup";
import { emailMd, load, minutesMd, psychologyMd, questionsMd, raidMd, save, streamPost } from "@/lib/client";
import { DEMO_WORKSPACE } from "@/lib/demo";
import { playMsgs, useCopilot, type CallState } from "@/hooks/useCopilot";
import type { AgentEvent, AgentName, Brief, ReportSections, SavedCall, StreamMsg, Workspace } from "@/lib/types";

type Tab = "setup" | "live" | "report" | "history";
const EMPTY_REPORT: ReportSections = { minutes: "", psychology: "", raid: "", email: "" };

export default function Home() {
  const [tab, setTab] = useState<Tab>("setup");
  const [ws, setWsState] = useState<Workspace>(DEMO_WORKSPACE);
  const [history, setHistory] = useState<SavedCall[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const cp = useCopilot(ws);

  const [report, setReport] = useState<ReportSections | null>(null);
  const [repEvents, setRepEvents] = useState<Partial<Record<AgentName, AgentEvent>>>({});
  const [generating, setGenerating] = useState(false);
  const [repError, setRepError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefState, setBriefState] = useState<"idle" | "loading" | "error">("idle");
  const [briefTokens, setBriefTokens] = useState<number | null>(null);

  useEffect(() => {
    // First visit (e.g. an evaluator): the fictional demo project is preloaded so the demo is one click away.
    const stored = load<Workspace>("cp.ws", DEMO_WORKSPACE);
    setWsState(stored && typeof stored.knowledge === "string" ? { ...DEMO_WORKSPACE, ...stored } : DEMO_WORKSPACE);
    const h = load<SavedCall[]>("cp.history", []);
    setHistory(Array.isArray(h) ? h.filter((x) => x && Array.isArray(x.lines)) : []);
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
  }, []);

  const setWs = (w: Workspace) => {
    setWsState(w);
    save("cp.ws", w);
  };

  const generate = useCallback(
    async (c: CallState) => {
      setGenerating(true);
      setRepError(null);
      setPublished(false);
      setReport(null);
      setRepEvents({});
      const meta = { project: ws.projectName, client: `${ws.clientName}, ${ws.clientCompany}`, date: new Date(c.startedAt ?? Date.now()).toDateString() };
      let acc: ReportSections = { ...EMPTY_REPORT };
      const onMsg = (m: StreamMsg) => {
        if (m.type === "event") setRepEvents((e) => ({ ...e, [m.event.agent]: m.event }));
        if (m.type === "error") setRepError(m.message);
        if (m.type === "section") {
          const d = m.data as Record<string, unknown>;
          const md = m.key === "minutes" ? minutesMd(d, meta) + questionsMd(c.suggestions) : m.key === "psychology" ? psychologyMd(d) : m.key === "raid" ? raidMd(d) : emailMd(d);
          acc = { ...acc, [m.key]: md };
          setReport(acc);
        }
      };
      if (c.replay && cp.recording) await playMsgs(cp.recording.post, onMsg);
      else await streamPost("/api/postcall", { ws, lines: c.lines, pulses: c.pulses, log: c.log, date: meta.date }, onMsg);
      setGenerating(false);
    },
    [ws, cp.recording]
  );

  const prepare = useCallback(async (agenda: string) => {
    setBriefState("loading");
    setBriefTokens(null);
    let got = false;
    let tokens = 0;
    const onMsg = (m: StreamMsg) => {
      if (m.type === "brief") {
        setBrief(m.brief);
        got = true;
      }
      if (m.type === "event" && m.event.tokens != null) tokens += m.event.tokens;
    };
    const aiReady = health?.configured && !health.budget.exhausted;
    if (!aiReady && cp.recording?.brief?.length) {
      await playMsgs(cp.recording.brief, onMsg);
      tokens = 0;
    } else {
      const last = history[0]?.report;
      const notes = last ? `${last.psychology}\n\n${last.raid}`.slice(0, 4000) : "";
      await streamPost("/api/prep", { ws, lastCallNotes: notes, agenda }, onMsg);
    }
    setBriefTokens(tokens);
    setBriefState(got ? "idle" : "error");
  }, [ws, history, health, cp.recording]);

  const endCall = () => {
    cp.endCall();
    setTab("report");
    generate({ ...cp.call, endedAt: Date.now() });
  };

  const watchDemo = () => {
    if (!ws.knowledge.trim()) setWs(DEMO_WORKSPACE);
    setTab("live");
    const aiReady = health?.configured && !health.budget.exhausted;
    if (aiReady) cp.demo.start();
    else if (cp.recording) cp.demo.replay();
  };

  const publish = () => {
    const c = cp.call;
    const entry: SavedCall = {
      id: c.id,
      date: new Date(c.startedAt ?? Date.now()).toISOString(),
      projectName: ws.projectName,
      clientName: ws.clientName,
      durationSec: c.startedAt ? Math.round(((c.endedAt ?? Date.now()) - c.startedAt) / 1000) : 0,
      finalScore: c.pulses.length ? c.pulses[c.pulses.length - 1].score : null,
      published: true,
      lines: c.lines,
      pulses: c.pulses,
      log: c.log,
      suggestions: c.suggestions,
      report,
    };
    const next = [entry, ...history.filter((h) => h.id !== c.id)].slice(0, 25);
    setHistory(next);
    save("cp.history", next);
    setPublished(true);
  };

  const openSaved = (h: SavedCall) => {
    const start = new Date(h.date).getTime();
    cp.loadCall({
      id: h.id, startedAt: start, endedAt: start + h.durationSec * 1000, lines: h.lines, suggestions: h.suggestions,
      pulses: h.pulses, log: h.log, runs: [], agentCalls: 0, tokens: 0, cachedHits: 0, pending: null, error: null, replay: false, assist: null,
    });
    setReport(h.report);
    setRepEvents({});
    setPublished(h.published);
    setTab("report");
  };

  const delSaved = (id: string) => {
    const next = history.filter((h) => h.id !== id);
    setHistory(next);
    save("cp.history", next);
  };

  const clearAll = () => {
    try {
      localStorage.removeItem("cp.ws");
      localStorage.removeItem("cp.history");
      sessionStorage.removeItem("cp.code");
    } catch {}
    setHistory([]);
    setWsState(DEMO_WORKSPACE);
    cp.resetCall();
    setReport(null);
    setBrief(null);
  };

  const TABS: [Tab, string][] = [
    ["setup", "1. Knowledge"],
    ["live", "2. Live call"],
    ["report", "3. After-call report"],
    ["history", `History (${history.length})`],
  ];
  const aiReady = Boolean(health?.configured && !health.budget.exhausted);

  return (
    <div>
      <header className="no-print sticky top-0 z-10 border-b border-black bg-ink text-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center bg-brand-600 text-xs font-black tracking-tight">SC</div>
            <div>
              <div className="text-base font-bold leading-tight">Simple Call</div>
              <div className="text-[11px] leading-tight text-neutral-400">Multi-agent copilot for client calls</div>
            </div>
          </div>
          <nav className="flex flex-wrap gap-1">
            {TABS.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-white text-ink" : "text-neutral-300 hover:bg-neutral-800"}`}>
                {label}
                {k === "live" && (cp.demo.on || cp.mic.on) && <span className="blink ml-1.5 inline-block h-2 w-2 rounded-full bg-brand-500" />}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <a href="/present" className="rounded-md px-2 py-1 font-medium text-neutral-300 hover:bg-neutral-800">Presentation</a>
            {!cp.demo.on && (aiReady || cp.recording) && tab !== "live" && (
              <button className="btn bg-brand-600 py-1 text-white hover:bg-brand-700" onClick={watchDemo}>▶ Watch the 90-second demo</button>
            )}
            {health == null ? null : aiReady ? (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-300" title={`Rate limits and budget on ${health.store} store · ${health.budget.usedPct}% of today's AI budget used`}>
                ● {health.privateModel ? `Private mode: ${health.model} on this machine` : `${health.model} via LiteLLM · secured`}
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-300">● {health.configured ? "Daily AI budget reached" : "Live AI off"}{cp.recording ? " · replay available" : ""}</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 py-5">
        {ws.projectName && tab !== "setup" && (
          <div className="no-print mb-3 text-sm text-slate-500">
            <b className="text-slate-800">{ws.projectName}</b> · {ws.clientName} · {ws.clientCompany}
          </div>
        )}
        {tab === "setup" && <Setup ws={ws} setWs={setWs} onStart={() => setTab("live")} onClearAll={clearAll} privateModel={Boolean(health?.privateModel)} aiReady={aiReady} />}
        {tab === "live" && (
          <LiveCall ws={ws} setWs={setWs} cp={cp} health={health} onEnd={endCall} brief={brief} briefState={briefState} briefTokens={briefTokens} onBrief={prepare} />
        )}
        {tab === "report" && (
          <Report
            call={cp.call}
            projectName={ws.projectName}
            report={report}
            setReport={setReport}
            events={repEvents}
            generating={generating}
            error={repError}
            published={published}
            onGenerate={() => generate(cp.call)}
            onPublish={publish}
          />
        )}
        {tab === "history" && (
          <div className="card divide-y divide-slate-100">
            {history.length === 0 && <div className="px-6 py-16 text-center text-sm text-slate-500">Published call reports appear here (stored only in this browser).</div>}
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1">
                  <div className="font-semibold">{h.projectName || "Untitled project"} <span className="font-normal text-slate-500">· {h.clientName}</span></div>
                  <div className="text-xs text-slate-500">
                    {new Date(h.date).toLocaleString()} · {Math.floor(h.durationSec / 60)}m · {h.suggestions.length} answers · {h.log.length} items
                    {h.finalScore != null && ` · ending sentiment ${h.finalScore.toFixed(2)}`}
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={() => openSaved(h)}>Open</button>
                <button className="btn btn-ghost text-rose-600" onClick={() => delSaved(h.id)}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </main>
      <footer className="no-print pb-6 text-center text-xs text-slate-400">
        SSI Agent-A-Thon 2026 · Demo uses fictional data only · No transcript is stored on the server
      </footer>
    </div>
  );
}
