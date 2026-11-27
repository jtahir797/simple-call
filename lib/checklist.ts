// Knowledge checklist: what Simple Call needs to answer well, with the questions to answer and a sample.
// Used for the coverage meter, the copy-paste prompt for Claude / ChatGPT, and the Knowledge Builder agent.
import type { Workspace } from "./types";

export interface ChecklistItem {
  id: string;
  title: string;
  field: "profile" | "guardrails" | "knowledge";
  heading?: string; // the ## heading used in the knowledge base
  essential: boolean;
  match?: RegExp; // how a knowledge heading is recognised
  questions: string[];
  sample: string;
}

export const CHECKLIST: ChecklistItem[] = [
  {
    id: "me",
    title: "About you and your authority",
    field: "profile",
    essential: true,
    questions: [
      "Your name and role on this project?",
      "What can you confirm on a call (dates in the plan, status, sending documents)?",
      "What can you NOT commit to (prices, change requests, contract terms, certifications)?",
      "Who do you escalate commercial, schedule or legal questions to?",
    ],
    sample:
      "Name: Sara Khan. Role: Project Manager. Can confirm dates already in the approved plan and send documents within 24 hours. Cannot quote prices, approve change requests or confirm certifications. Escalation: Account Manager Usman Tariq (commercials), Delivery Head Faisal Mir (schedule changes over 1 week).",
  },
  {
    id: "guardrails",
    title: "What you must never say or promise",
    field: "guardrails",
    essential: false,
    questions: ["Which topics must always be deferred on a call (pricing, discounts, certifications, legal, new dates)?", "What may only be shared in a limited way (e.g. budget as a percentage)?"],
    sample: "- Never quote prices or discounts; the Account Manager sends estimates within 3 business days.\n- Do not commit to dates not in the plan; confirm in writing within 24 hours.\n- Budget burn only as a percentage.",
  },
  {
    id: "people",
    title: "People on the call",
    field: "knowledge",
    heading: "People on this call",
    essential: false,
    match: /people|team|contact|stakeholder|attendee/i,
    questions: ["Who joins from the client side (name, role)?", "What does each person care about, and what do they usually ask?", "Who joins from our side?"],
    sample: "Megan Carter, VP Operations (sponsor): cares about dates and telling her leadership. Jason Lee, IT Director: security reviews and AWS.",
  },
  {
    id: "scope",
    title: "Project overview and scope",
    field: "knowledge",
    heading: "Project overview and scope",
    essential: false,
    match: /overview|scope|about the project|project in brief/i,
    questions: ["What is the product or project in one or two lines?", "Engagement model and team size?", "What is in scope, and what is explicitly out of scope?"],
    sample: "Rebuild of the driver and dispatch platform. Time and materials, team of 9. In scope: driver app, dispatcher portal, Samsara integration. Out of scope: offline mode (CR-03), SAP integration.",
  },
  {
    id: "milestones",
    title: "Milestones and key dates",
    field: "knowledge",
    heading: "Milestones",
    essential: true,
    match: /milestone|timeline|schedule|roadmap|key dates/i,
    questions: ["Each milestone with its date and status (done, on track, moved)?", "Go-live or delivery date, and how much buffer is left?"],
    sample: "M3 dispatcher portal: demo moved from 20 Nov to 4 Dec 2026. UAT 5 to 23 Jan 2027. Go-live 15 Feb 2027 (buffer down from 3 weeks to 1).",
  },
  {
    id: "status",
    title: "Current status",
    field: "knowledge",
    heading: "Current status",
    essential: true,
    match: /status|progress|update|current/i,
    questions: ["Progress this sprint or month (percent, done, in progress)?", "Any slip, its real cause, and the recovery plan?", "Budget burn as a percentage?"],
    sample: "Sprint 6 about 70% complete. Slip cause: sandbox credentials arrived 9 days late. 58% of approved hours used at 55% completion.",
  },
  {
    id: "issues",
    title: "Known issues and bugs",
    field: "knowledge",
    heading: "Known issues",
    essential: false,
    match: /bug|issue|defect|incident|problem/i,
    questions: ["Top open issues the client may raise?", "Impact, planned fix and target date for each?"],
    sample: "BUG-211: map freezes over 500 vehicles. Fix: clustering, ready 18 Dec 2026, load test with 1,000 vehicles.",
  },
  {
    id: "weak",
    title: "Weak spots and honest answers",
    field: "knowledge",
    heading: "Known weak spots (and my honest answer)",
    essential: false,
    match: /weak|risk|concern|honest/i,
    questions: ["What is the client most likely to be unhappy about?", "What is your honest, short answer for each?"],
    sample: "Reduced buffer: \"Buffer is down to one week, so I will flag any risk to 15 February the same day I see it.\"",
  },
  {
    id: "cr",
    title: "Change requests and commercial process",
    field: "knowledge",
    heading: "Change requests",
    essential: false,
    match: /change request|\bcr\b|commercial|pricing|estimate/i,
    questions: ["How is new scope handled, who prices it and how fast?", "Open change requests and their sizing (no prices)?"],
    sample: "Client emails the request; impact analysis via the Account Manager within 3 business days; approved through a signed CR. CR-03 offline mode: 6 to 8 weeks for 2 developers.",
  },
  {
    id: "security",
    title: "Security and compliance answers",
    field: "knowledge",
    heading: "Security and compliance",
    essential: false,
    match: /security|compliance|privacy|soc|iso|gdpr|hipaa/i,
    questions: ["Where is data hosted, and how is access controlled?", "Who answers certification or legal questions, and how fast?"],
    sample: "Data in the client's AWS (us-east-1), SSO with MFA, NDA signed. Pen test 15 Dec 2026. Certification questions go to the Account Manager, documents within 3 business days.",
  },
  {
    id: "faq",
    title: "Questions this client often asks",
    field: "knowledge",
    heading: "FAQs",
    essential: false,
    match: /faq|frequently|questions/i,
    questions: ["What does this client ask on most calls?", "Your best short answer for each?"],
    sample: "Q: Can more developers speed it up? A: Two more need about 2 weeks of onboarding, so the realistic gain is about 1 week; needs a CR.",
  },
];

export interface Coverage {
  done: Set<string>;
  essentialsDone: boolean;
  score: number;
  total: number;
}

/** Which checklist items the current workspace already covers (cheap, no model call). */
export function coverage(ws: Workspace): Coverage {
  const headings = Array.from(ws.knowledge.matchAll(/^#{1,4}\s+(.+)$/gm)).map((m) => m[1]);
  const done = new Set<string>();
  for (const c of CHECKLIST) {
    if (c.field === "profile" && ws.profile.trim().length > 20) done.add(c.id);
    else if (c.field === "guardrails" && ws.guardrails.trim().length > 20) done.add(c.id);
    else if (c.match && headings.some((h) => c.match!.test(h))) done.add(c.id);
  }
  const essentialsDone = CHECKLIST.filter((c) => c.essential).every((c) => done.has(c.id));
  return { done, essentialsDone, score: done.size, total: CHECKLIST.length };
}

// ---------------- copy-paste prompt for Claude / ChatGPT ----------------

export function buildPrompt(): string {
  const qs = CHECKLIST.map(
    (c, i) => `${i + 1}. ${c.title}${c.essential ? " (essential)" : ""}\n${c.questions.map((q) => `   - ${q}`).join("\n")}\n   Example: ${c.sample.replace(/\n/g, " ")}`
  ).join("\n\n");
  const headings = CHECKLIST.filter((c) => c.field === "knowledge").map((c) => `## ${c.heading}`).join("\n...\n\n");
  return `You are helping me prepare the knowledge base for Simple Call, an AI copilot that suggests answers during my client calls.

I will attach or paste my project material (status report, SOW, plan, recent emails, meeting notes).
1. Read it and answer the checklist below using ONLY facts from my material.
2. For anything my material does not cover, ask me the missing questions in ONE short message (essential items first), then wait for my reply.
3. Then produce the final output exactly in the format at the end. Keep numbers and dates exact. Never invent facts; write "TODO: ask <person>" if still unknown. No prices unless I say they may be shared on calls.

CHECKLIST
${qs}

OUTPUT FORMAT (copy exactly, fill the values, keep the markers)
=== SIMPLE CALL ===
PROJECT: <project name>
CLIENT CONTACT: <main client person, title>
CLIENT COMPANY: <client company>
CLIENT LOCATION: <city, time zone>
MY NAME: <my first name and how captions might mishear it, separated by |>
TOPICS: <4 to 8 comma separated project words the client often says>
--- PROFILE ---
<item 1 as short lines>
--- GUARDRAILS ---
<item 2 as "- " bullet lines>
--- KNOWLEDGE ---
${headings}
...
=== END ===`;
}

/** Parse the AI's answer (the format above) back into workspace fields. Unknown text goes to knowledge. */
export function parseFilled(text: string, ws: Workspace): Workspace {
  const t = text.replace(/\r/g, "");
  const get = (label: string) => t.match(new RegExp(`^\\s*${label}:\\s*(.+)$`, "mi"))?.[1]?.trim();
  const block = (name: string) => t.match(new RegExp(`---\\s*${name}\\s*---\\s*\\n([\\s\\S]*?)(?=\\n---\\s*[A-Z ]+---|\\n===|$)`, "i"))?.[1]?.trim();
  const knowledge = block("KNOWLEDGE");
  if (!knowledge && !block("PROFILE")) {
    return { ...ws, knowledge: t.trim() };
  }
  return {
    ...ws,
    projectName: get("PROJECT") ?? ws.projectName,
    clientName: get("CLIENT CONTACT") ?? ws.clientName,
    clientCompany: get("CLIENT COMPANY") ?? ws.clientCompany,
    clientLocation: get("CLIENT LOCATION") ?? ws.clientLocation,
    myName: get("MY NAME") ?? ws.myName,
    topics: get("TOPICS") ?? "",
    profile: block("PROFILE") ?? ws.profile,
    guardrails: block("GUARDRAILS") ?? ws.guardrails,
    knowledge: knowledge ?? ws.knowledge,
  };
}
