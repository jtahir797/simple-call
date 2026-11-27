export type Speaker = "client" | "me";

export interface Line {
  id: string;
  speaker: Speaker;
  text: string;
  t: number; // ms since call start
}

export interface Workspace {
  projectName: string;
  clientName: string;
  clientCompany: string;
  clientLocation: string;
  profile: string; // the employee's own profile, authority limits, style
  knowledge: string; // markdown knowledge base for the project
  guardrails: string; // what must never be said or committed on a call
  mode?: string; // call mode id (lib/modes.ts)
  myName?: string; // "Sara|Sarah|Zara": your name and how captions mishear it
  topics?: string; // comma separated project words that always count as a question for you
}

export type AgentName =
  | "Conductor"
  | "Listener"
  | "Retriever"
  | "Answer"
  | "FactCheck"
  | "Verifier"
  | "Revise"
  | "Strategist"
  | "Assist"
  | "KnowledgeBuilder"
  | "Pulse"
  | "Risk"
  | "Scribe"
  | "Psychologist"
  | "RiskOfficer"
  | "FollowUp";

export interface AgentEvent {
  agent: AgentName;
  status: "running" | "ok" | "skipped" | "error";
  ms?: number;
  note?: string;
  tokens?: number;
  cached?: boolean;
  detail?: unknown; // agent output, shown in the Agent X-ray panel
}

export interface FactCheckResult {
  facts: { fact: string; kind: "date" | "number"; grounded: boolean }[];
  grounded: number;
  total: number;
  policy: string[];
  calendar: { date: string; iso: string; issue: string }[];
}

export interface Suggestion {
  id: string;
  lineId: string;
  question: string;
  intent: string;
  urgency: string;
  sayThis: string;
  keyPoints: string[];
  sources: string[];
  confidence: number;
  defer: boolean;
  followUp: string;
  verdict: "verified" | "revised" | "caution" | "defer" | "pending";
  issues: string[];
  original?: string; // the Answer agent's first draft, if the Verifier sent it back
  check?: FactCheckResult;
}

export interface Brief {
  objective: string;
  openingLine: string;
  moodForecast: string;
  likelyQuestions: { q: string; answer: string; risk: "low" | "medium" | "high"; defer: boolean }[];
  landmines: string[];
  mustSay: string[];
  questionsToAsk: string[];
}

export type QuickAction = "answer" | "clarify" | "recap" | "followup";

export interface Pulse {
  lineId: string;
  score: number; // -1..1
  emotion: string;
  intensity: number; // 0..1
  trust: "low" | "medium" | "high";
  cues: string[];
  need: string;
  tip: string;
}

export interface LogItem {
  id: string;
  lineId: string;
  type: "risk" | "issue" | "action" | "commitment";
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
  owner: string;
}

export interface ReportSections {
  minutes: string;
  psychology: string;
  raid: string;
  email: string;
}

export interface SavedCall {
  id: string;
  date: string;
  projectName: string;
  clientName: string;
  durationSec: number;
  finalScore: number | null;
  published: boolean;
  lines: Line[];
  pulses: Pulse[];
  log: LogItem[];
  suggestions: Suggestion[];
  report: ReportSections | null;
}

// Streamed from API routes as NDJSON
export type StreamMsg =
  | { type: "event"; event: AgentEvent }
  | { type: "question"; question: string; intent: string; urgency: string }
  | { type: "suggestion"; suggestion: Suggestion }
  | { type: "verdict"; id: string; verdict: Suggestion["verdict"]; issues: string[]; sayThis?: string; keyPoints?: string[]; confidence?: number; check?: FactCheckResult }
  | { type: "brief"; brief: Brief }
  | { type: "assist"; action: QuickAction; text: string }
  | { type: "knowledge"; data: { projectName: string; clientName: string; clientCompany: string; clientLocation: string; myName: string; topics: string; profile: string; guardrails: string; knowledge: string; gaps: { item: string; question: string }[] } }
  | { type: "pulse"; pulse: Pulse }
  | { type: "log"; items: LogItem[] }
  | { type: "section"; key: keyof ReportSections; data: unknown }
  | { type: "error"; message: string; code?: string }
  | { type: "done" };

// Recorded real run of the scripted demo, replayed at zero model cost (see scripts/record-demo.ts)
export interface Recording {
  recordedAt: string;
  model: string;
  steps: { lineId: string; speaker: Speaker; text: string; msgs: StreamMsg[] }[];
  post: StreamMsg[];
  brief: StreamMsg[];
}
