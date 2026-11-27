"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { streamPost, uid } from "@/lib/client";
import { DEMO_SCRIPT } from "@/lib/demo";
import { captureCallAudio, installLocalSpeech, localSpeechStatus, speechCtor, type CaptionSource, type SpeechLocal, type SR } from "@/lib/speech";
import type { AgentEvent, AgentName, Line, LogItem, Pulse, QuickAction, Recording, Speaker, StreamMsg, Suggestion, Workspace } from "@/lib/types";

export interface Run {
  lineId: string;
  events: Partial<Record<AgentName, AgentEvent>>;
}

export interface CallState {
  id: string;
  startedAt: number | null;
  endedAt: number | null;
  lines: Line[];
  suggestions: Suggestion[];
  pulses: Pulse[];
  log: LogItem[];
  runs: Run[];
  agentCalls: number;
  tokens: number;
  cachedHits: number;
  pending: { lineId: string; question: string; intent: string } | null;
  error: { message: string; code?: string } | null;
  replay: boolean;
  assist: { action: QuickAction; text: string; busy: boolean } | null;
}

export const emptyCall = (): CallState => ({
  id: uid(),
  startedAt: null,
  endedAt: null,
  lines: [],
  suggestions: [],
  pulses: [],
  log: [],
  runs: [],
  agentCalls: 0,
  tokens: 0,
  cachedHits: 0,
  pending: null,
  error: null,
  replay: false,
  assist: null,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FALLBACK_CODES = ["budget", "busy", "rate_limited", "ai_off", "not_configured", "network", "503", "429"];

/** Feed recorded stream messages with realistic pacing (uses each agent's recorded duration). */
export async function playMsgs(msgs: StreamMsg[], onMsg: (m: StreamMsg) => void, stop?: () => boolean) {
  for (const m of msgs) {
    if (stop?.()) return;
    if (m.type === "event" && m.event.status === "ok" && m.event.ms && m.event.agent !== "Conductor") {
      await sleep(Math.min(1400, Math.max(120, m.event.ms * 0.45)));
    } else await sleep(30);
    onMsg(m);
  }
}

export function useCopilot(ws: Workspace) {
  const [call, setCall] = useState<CallState>(emptyCall);
  const ref = useRef<CallState>(call);
  const wsRef = useRef(ws);
  useEffect(() => {
    wsRef.current = ws;
  }, [ws]);

  const update = useCallback((fn: (c: CallState) => CallState) => {
    ref.current = fn(ref.current);
    setCall(ref.current);
  }, []);

  const queue = useRef<Promise<void>>(Promise.resolve());
  const [busy, setBusy] = useState(0);
  const [interim, setInterim] = useState<{ speaker: Speaker; text: string } | null>(null);

  // ---------- recorded run (zero-cost replay and automatic fallback) ----------
  const [recording, setRecording] = useState<Recording | null>(null);
  useEffect(() => {
    fetch("/demo-recording.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && Array.isArray(j.steps) && j.steps.length && setRecording(j))
      .catch(() => {});
  }, []);

  /** Apply one streamed message from the Conductor to the call state. */
  const handler = useCallback(
    (lineId: string) => (m: StreamMsg) => {
      switch (m.type) {
        case "event":
          update((c) => ({
            ...c,
            agentCalls: c.agentCalls + (m.event.status === "ok" && m.event.tokens !== undefined && !["Retriever", "FactCheck"].includes(m.event.agent) ? 1 : 0),
            tokens: c.tokens + (c.replay ? 0 : m.event.tokens ?? 0),
            cachedHits: c.cachedHits + (m.event.cached ? 1 : 0),
            runs: c.runs.map((r) => (r.lineId === lineId ? { ...r, events: { ...r.events, [m.event.agent]: m.event } } : r)),
          }));
          break;
        case "question":
          update((c) => ({ ...c, pending: { lineId, question: m.question, intent: m.intent } }));
          break;
        case "suggestion":
          update((c) => ({ ...c, pending: null, suggestions: [...c.suggestions, m.suggestion] }));
          break;
        case "verdict":
          update((c) => ({
            ...c,
            suggestions: c.suggestions.map((s) =>
              s.id === m.id
                ? {
                    ...s,
                    verdict: m.verdict,
                    issues: m.issues,
                    check: m.check ?? s.check,
                    ...(m.sayThis ? { original: s.sayThis, sayThis: m.sayThis, keyPoints: m.keyPoints ?? s.keyPoints, confidence: m.confidence ?? s.confidence } : {}),
                  }
                : s
            ),
          }));
          break;
        case "pulse":
          update((c) => ({ ...c, pulses: [...c.pulses, m.pulse] }));
          break;
        case "log":
          update((c) => ({ ...c, log: [...c.log, ...m.items] }));
          break;
        case "error":
          update((c) => ({ ...c, error: { message: m.message, code: m.code } }));
          break;
      }
    },
    [update]
  );

  // ---------- one Conductor run per transcript line ----------
  const process = useCallback(
    async (lineId: string, direct = false) => {
      const c = ref.current;
      const idx = c.lines.findIndex((l) => l.id === lineId);
      if (idx < 0) return;
      const window = c.lines.slice(Math.max(0, idx - 13), idx + 1);
      const prevPulse = c.pulses.length ? c.pulses[c.pulses.length - 1] : null;
      const existing = c.log.map((l) => `${l.type}: ${l.title}`);
      update((c) => ({ ...c, runs: [...c.runs, { lineId, events: {} }].slice(-30) }));
      setBusy((b) => b + 1);
      try {
        await streamPost("/api/orchestrate", { ws: wsRef.current, lines: window, latestId: lineId, existing, prevPulse, direct }, handler(lineId));
      } finally {
        update((c) => (c.pending?.lineId === lineId ? { ...c, pending: null } : c));
        setBusy((b) => b - 1);
      }
    },
    [update, handler]
  );

  const pushLine = useCallback(
    (speaker: Speaker, text: string, id = uid()) => {
      update((c) => {
        const startedAt = c.startedAt ?? Date.now();
        return { ...c, startedAt, endedAt: null, lines: [...c.lines, { id, speaker, text, t: Date.now() - startedAt }] };
      });
      return id;
    },
    [update]
  );

  /** Add a finished transcript line and queue it for the agents. Resolves when agents finish. */
  const addLine = useCallback(
    (speaker: Speaker, text: string, direct = false): Promise<void> => {
      const t = text.trim().slice(0, 1200);
      if (!t) return Promise.resolve();
      update((c) => ({ ...c, error: null }));
      const id = pushLine(speaker, t);
      const p = queue.current.then(() => process(id, direct));
      queue.current = p.catch(() => {});
      return p;
    },
    [process, pushLine, update]
  );

  // ---------- scripted demo call: live agents, or recorded replay ----------
  const [demoOn, setDemoOn] = useState(false);
  const demoStop = useRef(false);

  const typeOut = useCallback(async (speaker: Speaker, text: string) => {
    const words = text.split(" ");
    for (let i = 1; i <= words.length; i++) {
      if (demoStop.current) return;
      setInterim({ speaker, text: words.slice(0, i).join(" ") });
      await sleep(50);
    }
    setInterim(null);
  }, []);

  const startReplay = useCallback(async (notice?: unknown) => {
    if (!recording) return;
    demoStop.current = false;
    setDemoOn(true);
    ref.current = { ...emptyCall(), replay: true, error: typeof notice === "string" ? { message: notice, code: "fallback" } : null };
    setCall(ref.current);
    for (const s of recording.steps) {
      if (demoStop.current) break;
      await typeOut(s.speaker, s.text);
      if (demoStop.current) break;
      pushLine(s.speaker, s.text, s.lineId);
      update((c) => ({ ...c, runs: [...c.runs, { lineId: s.lineId, events: {} }] }));
      setBusy((b) => b + 1);
      await playMsgs(s.msgs, handler(s.lineId), () => demoStop.current);
      setBusy((b) => b - 1);
      await sleep(s.speaker === "client" ? 1800 : 500);
    }
    setInterim(null);
    setDemoOn(false);
  }, [recording, typeOut, pushLine, update, handler]);

  const startDemo = useCallback(async () => {
    demoStop.current = false;
    setDemoOn(true);
    ref.current = emptyCall();
    setCall(ref.current);
    queue.current = Promise.resolve();
    for (const s of DEMO_SCRIPT) {
      if (demoStop.current) break;
      await typeOut(s.speaker, s.text);
      if (demoStop.current) break;
      const done = addLine(s.speaker, s.text);
      if (s.speaker === "client") {
        await done;
        const err = ref.current.error;
        if (err && FALLBACK_CODES.includes(err.code ?? "")) {
          // Live AI unavailable (budget, rate limit, gateway): continue with the recorded run instead.
          if (recording) {
            setDemoOn(false);
            setInterim(null);
            await startReplay(`${err.message.replace(/\.+$/, "")}. Showing a recorded real run instead (0 tokens).`);
            return;
          }
          break;
        }
        await sleep(2200);
      } else {
        await sleep(700);
      }
    }
    setInterim(null);
    setDemoOn(false);
  }, [addLine, typeOut, recording, startReplay, update]);

  const stopDemo = useCallback(() => {
    demoStop.current = true;
    setDemoOn(false);
    setInterim(null);
  }, []);

  // ---------- live captions: on-device speech, mic and/or the call's own audio ----------
  const [micOn, setMicOn] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [micSpeaker, setMicSpeaker] = useState<Speaker>("client");
  const micSpeakerRef = useRef<Speaker>("client");
  useEffect(() => {
    micSpeakerRef.current = micSpeaker;
  }, [micSpeaker]);
  const [source, setSource] = useState<CaptionSource>("mic");
  const [strictLocal, setStrictLocal] = useState(true);
  const [localStatus, setLocalStatus] = useState<SpeechLocal>("unknown");
  const [processing, setProcessing] = useState<"on-device" | "browser cloud" | null>(null);
  const recs = useRef<SR[]>([]);
  const streams = useRef<MediaStream[]>([]);
  const micWanted = useRef(false);

  // Checked lazily (on the first captions action), never on page load.
  const refreshLocal = useCallback(async () => {
    setLocalStatus("checking");
    const st = await localSpeechStatus();
    setLocalStatus(st);
    return st;
  }, []);
  useEffect(() => {
    setMicSupported(Boolean(speechCtor()));
  }, []);

  const installLocal = useCallback(async () => {
    setLocalStatus("downloading");
    await installLocalSpeech();
    await refreshLocal();
  }, [refreshLocal]);

  const stopMic = useCallback(() => {
    micWanted.current = false;
    recs.current.forEach((r) => {
      try {
        r.stop();
      } catch {}
    });
    recs.current = [];
    streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streams.current = [];
    setMicOn(false);
    setProcessing(null);
    setInterim(null);
  }, []);

  const startMic = useCallback(async () => {
    const C = speechCtor();
    if (!C) return;
    const status = localStatus === "unknown" ? await refreshLocal() : localStatus;
    const local = status === "available";
    if (strictLocal && !local) {
      update((c) => ({
        ...c,
        error: { message: "On-device speech is not ready on this browser. Download the speech pack (Chrome or Edge 139+), or allow browser cloud captions.", code: "speech_local" },
      }));
      return;
    }
    // speaker: fixed per stream when the call audio is captured, manual toggle in mic-only mode
    const make = (speaker: () => Speaker, track?: MediaStreamTrack) => {
      const rec = new C();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      if ("processLocally" in rec) rec.processLocally = local;
      rec.onresult = (e) => {
        let partial = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) {
            setInterim(null);
            addLine(speaker(), r[0].transcript);
          } else partial += r[0].transcript;
        }
        if (partial) setInterim({ speaker: speaker(), text: partial });
      };
      rec.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        const msg =
          e.error === "not-allowed"
            ? "Microphone permission was blocked in the browser."
            : e.error === "language-not-supported"
            ? "The on-device English speech pack is not installed yet."
            : e.error === "network"
            ? "The browser's cloud speech service is unreachable. Switch on On-device only and download the speech pack."
            : `Captions stopped (${e.error}). Try again or switch caption source.`;
        stopMic();
        update((c) => ({ ...c, error: { message: msg, code: "speech" } }));
      };
      rec.onend = () => {
        if (!micWanted.current) return;
        if (track && track.readyState !== "live") return stopMic(); // user stopped sharing
        try {
          if (track) rec.start(track);
          else rec.start();
        } catch {}
      };
      recs.current.push(rec);
      if (!track) return rec.start();
      try {
        rec.start(track);
      } catch {
        throw new Error("This browser cannot caption shared call audio yet (needs a recent Chrome or Edge). Use \"Mic only\" instead.");
      }
    };

    try {
      micWanted.current = true;
      if (source !== "mic") {
        const { track, stream } = await captureCallAudio();
        streams.current.push(stream);
        track.addEventListener("ended", () => stopMic());
        make(() => "client", track);
      }
      if (source !== "call") make(() => (source === "mic" ? micSpeakerRef.current : "me"));
      setProcessing(local ? "on-device" : "browser cloud");
      setMicOn(true);
    } catch (e) {
      stopMic();
      const msg = e instanceof Error && e.name !== "NotAllowedError" ? e.message : "Screen or tab sharing was cancelled.";
      update((c) => ({ ...c, error: { message: msg, code: "speech" } }));
    }
  }, [addLine, update, source, strictLocal, localStatus, stopMic, refreshLocal]);

  useEffect(() => () => {
    micWanted.current = false;
    recs.current.forEach((r) => {
      try {
        r.stop();
      } catch {}
    });
    streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
  }, []);

  const endCall = useCallback(() => {
    stopDemo();
    stopMic();
    update((c) => ({ ...c, endedAt: Date.now() }));
  }, [stopDemo, stopMic, update]);

  const resetCall = useCallback(() => {
    stopDemo();
    stopMic();
    ref.current = emptyCall();
    setCall(ref.current);
  }, [stopDemo, stopMic]);

  const loadCall = useCallback((c: CallState) => {
    ref.current = c;
    setCall(c);
  }, []);

  const clearError = useCallback(() => update((c) => ({ ...c, error: null })), [update]);

  // ---------- quick actions: Answer now (A), Clarify (K), Recap (R), Follow-up (F) ----------
  const quickAction = useCallback(
    async (action: QuickAction) => {
      const c = ref.current;
      if (!c.lines.length) return;
      if (action === "answer") {
        // Re-run the full chain (Knowledge, Answer, FactCheck, Verifier) on the latest client line.
        const last = [...c.lines].reverse().find((l) => l.speaker === "client");
        if (!last) return;
        update((c) => ({ ...c, assist: null }));
        const p = queue.current.then(() => process(last.id, true));
        queue.current = p.catch(() => {});
        return;
      }
      const lastT = c.lines[c.lines.length - 1].t;
      const lines = action === "recap" ? c.lines.filter((l) => lastT - l.t <= 5 * 60_000).slice(-60) : c.lines.slice(-12);
      update((c) => ({ ...c, assist: { action, text: "", busy: true } }));
      let text = "";
      await streamPost("/api/action", { ws: wsRef.current, lines, action }, (m) => {
        if (m.type === "assist") text = m.text;
        if (m.type === "error") update((c) => ({ ...c, error: { message: m.message, code: m.code } }));
        if (m.type === "event") update((c) => ({ ...c, tokens: c.tokens + (m.event.tokens ?? 0), cachedHits: c.cachedHits + (m.event.cached ? 1 : 0) }));
      });
      update((c) => ({ ...c, assist: text ? { action, text, busy: false } : null }));
    },
    [process, update]
  );
  const closeAssist = useCallback(() => update((c) => ({ ...c, assist: null })), [update]);

  return {
    call,
    busy: busy > 0,
    interim,
    addLine,
    recording,
    demo: { on: demoOn, start: startDemo, replay: startReplay, stop: stopDemo },
    mic: {
      supported: micSupported,
      on: micOn,
      start: startMic,
      stop: stopMic,
      speaker: micSpeaker,
      setSpeaker: setMicSpeaker,
      source,
      setSource,
      strictLocal,
      setStrictLocal,
      localStatus,
      installLocal,
      checkLocal: refreshLocal,
      processing,
    },
    endCall,
    resetCall,
    loadCall,
    clearError,
    quickAction,
    closeAssist,
  };
}
