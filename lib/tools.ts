// Deterministic tools the agents call. No model cost, fully testable.
//  - factCheck: are the numbers and dates in a drafted answer actually in the project knowledge?
//  - policyScan: does the answer touch pricing, certifications, legal or guarantees?
//  - usCalendar: does a promised date fall on a weekend or a US federal holiday?

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MON_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const WORDS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", fifteen: "15", twenty: "20", thirty: "30", hundred: "100", thousand: "1000",
};

export interface DateRef {
  text: string;
  month: number; // 1-12
  day: number;
  year?: number;
}

function monthIndex(m: string) {
  return MONTHS.findIndex((x) => x.startsWith(m.toLowerCase().slice(0, 3))) + 1;
}

/** Find explicit calendar dates like "Feb 15", "15 February 2027", "December 4th", "2027-01-12". */
export function extractDates(text: string, dedupe = true): DateRef[] {
  const out: DateRef[] = [];
  const a = new RegExp(`\\b${MON_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`, "gi");
  const b = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON_RE}\\.?(?:,?\\s+(20\\d{2}))?\\b`, "gi");
  const c = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = a.exec(text))) out.push({ text: m[0], month: monthIndex(m[1]), day: +m[2], year: m[3] ? +m[3] : undefined });
  while ((m = b.exec(text))) out.push({ text: m[0], month: monthIndex(m[2]), day: +m[1], year: m[3] ? +m[3] : undefined });
  while ((m = c.exec(text))) out.push({ text: m[0], month: +m[2], day: +m[3], year: +m[1] });
  if (!dedupe) return out;
  const seen = new Set<string>();
  return out.filter((d) => d.month >= 1 && d.day >= 1 && d.day <= 31 && !seen.has(`${d.month}-${d.day}`) && seen.add(`${d.month}-${d.day}`));
}

/** Numbers that carry meaning: percentages, money, counts with units. Ignores dates. */
export function extractNumbers(text: string): string[] {
  const noDates = extractDates(text, false).reduce((t, d) => t.split(d.text).join(" "), text);
  const norm = noDates.toLowerCase().replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|hundred|thousand)\b/g, (w) => WORDS[w]);
  const nums = norm.match(/\$?\d[\d,]*(?:\.\d+)?%?/g) ?? [];
  return Array.from(new Set(nums.map((n) => n.replace(/,/g, "")).filter((n) => !/^(19|20)\d{2}$/.test(n) && n !== "1")));
}

export interface FactCheck {
  facts: { fact: string; kind: "date" | "number"; grounded: boolean }[];
  grounded: number;
  total: number;
}

/** Check that every date and number in the answer appears in the knowledge the agent was given. */
export function factCheck(answer: string, sourceText: string): FactCheck {
  const srcDates = extractDates(sourceText).map((d) => `${d.month}-${d.day}`);
  const srcNorm = " " + sourceText.toLowerCase().replace(/,/g, "").replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|hundred|thousand)\b/g, (w) => WORDS[w]) + " ";
  const facts: FactCheck["facts"] = [];
  for (const d of extractDates(answer)) facts.push({ fact: d.text, kind: "date", grounded: srcDates.includes(`${d.month}-${d.day}`) });
  for (const n of extractNumbers(answer)) {
    const bare = n.replace(/[$%]/g, "");
    const re = new RegExp(`(^|[^\\d.])${bare.replace(".", "\\.")}([^\\d]|$)`);
    facts.push({ fact: n, kind: "number", grounded: re.test(srcNorm) });
  }
  return { facts, grounded: facts.filter((f) => f.grounded).length, total: facts.length };
}

const POLICY: [string, RegExp][] = [
  ["pricing", /\$\s?\d|\b(usd|price|pricing|cost (?:you|us)|rate card|hourly rate|discount|invoice|quote you|it will cost|costs? about|fee)\b/i],
  ["certification", /\b(soc\s?2|iso\s?27001|hipaa|gdpr compliant|pci|certified|certification)\b/i],
  ["legal", /\b(contract(?:ually)?|liabilit|indemn|penalt|sla credit|legal(?:ly)?)\b/i],
  ["guarantee", /\b(guarantee|we promise|100% sure|definitely will|no risk)\b/i],
];

/** Topics the employee may not be authorised to speak to on a call. */
export function policyScan(text: string): string[] {
  return POLICY.filter(([, re]) => re.test(text)).map(([k]) => k);
}

// US federal holidays (observed dates) from the US Office of Personnel Management schedule.
const US_HOLIDAYS: Record<string, string> = {
  "2026-01-01": "New Year's Day", "2026-01-19": "Martin Luther King Jr. Day", "2026-02-16": "Presidents' Day",
  "2026-05-25": "Memorial Day", "2026-06-19": "Juneteenth", "2026-07-03": "Independence Day (observed)",
  "2026-09-07": "Labor Day", "2026-10-12": "Columbus Day", "2026-11-11": "Veterans Day",
  "2026-11-26": "Thanksgiving Day", "2026-12-25": "Christmas Day",
  "2027-01-01": "New Year's Day", "2027-01-18": "Martin Luther King Jr. Day", "2027-02-15": "Presidents' Day",
  "2027-05-31": "Memorial Day", "2027-06-18": "Juneteenth (observed)", "2027-07-05": "Independence Day (observed)",
  "2027-09-06": "Labor Day", "2027-10-11": "Columbus Day", "2027-11-11": "Veterans Day",
  "2027-11-25": "Thanksgiving Day", "2027-12-24": "Christmas Day (observed)",
};

export interface CalendarFlag {
  date: string;
  iso: string;
  issue: string;
}

/** Flag promised dates that land on a US weekend or federal holiday (client is US-based). */
export function usCalendar(text: string, contextText = "", today = new Date()): CalendarFlag[] {
  const flags: CalendarFlag[] = [];
  const ctxYears = new Map(extractDates(contextText).filter((d) => d.year).map((d) => [`${d.month}-${d.day}`, d.year!]));
  for (const d of extractDates(text)) {
    let year = d.year ?? ctxYears.get(`${d.month}-${d.day}`);
    if (!year) {
      year = today.getUTCFullYear();
      const candidate = Date.UTC(year, d.month - 1, d.day);
      if (candidate < today.getTime() - 30 * 86400_000) year += 1;
    }
    const dt = new Date(Date.UTC(year, d.month - 1, d.day));
    if (dt.getUTCMonth() !== d.month - 1) continue;
    const iso = dt.toISOString().slice(0, 10);
    const dow = dt.getUTCDay();
    if (US_HOLIDAYS[iso]) flags.push({ date: d.text, iso, issue: `US federal holiday (${US_HOLIDAYS[iso]})` });
    else if (dow === 0 || dow === 6) flags.push({ date: d.text, iso, issue: dow === 0 ? "a Sunday" : "a Saturday" });
  }
  return flags;
}

const SMALL_TALK = /^(ok(ay)?|sure|great|good|thanks?( you)?|thank you|sounds good|perfect|right|alright|got it|yes|yeah|yep|no|nope|cool|fine|bye|see you|hello|hi|hey|morning|good morning)[\s,.!a-z]*$/i;

/** Cheap pre-filter so short acknowledgements never reach a model. */
export function isSmallTalk(text: string): boolean {
  const t = text.trim();
  if (t.includes("?")) return false;
  const words = t.split(/\s+/).length;
  return words <= 6 && SMALL_TALK.test(t);
}

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const REQUEST =
  /\b(can|could|would|will) (you|we|your team)\b|\b(i|we) (need|want|expect|require)\b|\blet'?s (get|have|do|make|see)\b|\bplease\b|\b(asking|wondering|concerned|worried|frustrated|disappointed|confused)\b|^(what|when|why|how|where|who|which|is|are|do|does|did|should|shall|may)\b/i;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Deterministic alert rules: only lines that look addressed to you reach the
 * Listener model. Returns the rule that fired, or null to skip the model call entirely.
 */
export function alertRule(text: string, myName = "", topics = ""): string | null {
  const t = text.trim();
  const names = myName.split(/[|,]/).map((n) => n.trim()).filter((n) => n.length > 1);
  if (names.some((n) => new RegExp(`\\b${escapeRe(n)}\\b`, "i").test(t))) return "your name";
  if (t.includes("?")) return "question";
  if (REQUEST.test(t)) return "request or concern";
  const words = topics.split(",").map((w) => w.trim()).filter((w) => w.length > 1);
  if (words.some((w) => new RegExp(`\\b${escapeRe(w)}\\b`, "i").test(t))) return "project topic";
  return null;
}
