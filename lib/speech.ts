"use client";

// Browser speech recognition with on-device processing (Chrome / Edge 139+): audio never leaves the laptop.
// Also recognises a MediaStreamTrack, so the call's own audio (a shared Teams / Meet tab) can be captioned
// as the client while the microphone is captioned as you.

export type SpeechLocal = "unknown" | "checking" | "available" | "downloadable" | "downloading" | "unavailable" | "unsupported";
export type CaptionSource = "mic" | "call+mic" | "call";

export interface SRResultList {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
export interface SR {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  processLocally?: boolean;
  onresult: ((e: SRResultList) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  start: (track?: MediaStreamTrack) => void;
  stop: () => void;
}
type SRStatic = {
  new (): SR;
  available?: (o: { langs: string[]; processLocally?: boolean; quality?: string }) => Promise<string>;
  install?: (o: { langs: string[]; processLocally?: boolean; quality?: string }) => Promise<boolean>;
};

export function speechCtor(): SRStatic | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRStatic; webkitSpeechRecognition?: SRStatic };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const LANG = ["en-US"];

/** Is on-device English recognition ready on this browser? */
export async function localSpeechStatus(): Promise<SpeechLocal> {
  const C = speechCtor();
  if (!C || !C.available || !("processLocally" in C.prototype)) return "unsupported";
  // Automated/headless browsers have no speech components (and some crash on this call): skip them.
  if (navigator.webdriver) return "unsupported";
  for (const opts of [{ langs: LANG, processLocally: true, quality: "conversation" }, { langs: LANG, processLocally: true }]) {
    try {
      const r = await C.available(opts);
      if (r === "available" || r === "downloadable" || r === "downloading" || r === "unavailable") return r;
    } catch {
      /* older builds reject the quality option: retry without it */
    }
  }
  return "unsupported";
}

/** Download the on-device English language pack (one time, done by the browser). */
export async function installLocalSpeech(): Promise<boolean> {
  const C = speechCtor();
  if (!C?.install) return false;
  try {
    return await C.install({ langs: LANG, processLocally: true });
  } catch {
    return false;
  }
}

/** Ask the user to share the call's tab or screen with audio; returns the audio track. */
export async function captureCallAudio(): Promise<{ track: MediaStreamTrack; stream: MediaStream }> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    // Chrome hints: offer the current-tab / system audio options
    ...({ systemAudio: "include", selfBrowserSurface: "exclude", preferCurrentTab: false } as Record<string, unknown>),
  } as DisplayMediaStreamOptions);
  const track = stream.getAudioTracks()[0];
  if (!track) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('No audio was shared. Pick the Teams or Meet tab and tick "Share tab audio" (on Windows you can share the whole screen with system audio).');
  }
  return { track, stream };
}
