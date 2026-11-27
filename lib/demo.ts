import type { Speaker, Workspace } from "./types";

// Everything here is FICTIONAL demo data (hackathon rule: public or made-up data only).

export const DEMO_WORKSPACE: Workspace = {
  projectName: "FleetTrack 2.0",
  clientName: "Megan Carter, VP Operations",
  clientCompany: "Harborline Logistics (fictional)",
  clientLocation: "Austin, Texas, US Central Time",
  mode: "client",
  myName: "Sara|Sarah|Zara",
  topics: "Samsara, UAT, offline mode, go-live, CR-03, dispatcher portal",
  profile: `Name: Sara Khan (fictional)
Role: Project Manager for FleetTrack 2.0, based in Lahore, joins client calls at 8-10 AM US Central.
Authority: can confirm dates already in the approved plan, explain status, risks and process. Can commit to sending documents within 24 hours.
Cannot: quote prices or rates, approve change requests, change contract terms, confirm certifications or legal positions.
Escalation: Account Manager Usman Tariq (commercials, CRs, certifications); Delivery Head Faisal Mir (schedule changes over 1 week).
Style: calm, direct, owns problems, prefers giving dates with a confidence level.`,
  guardrails: `- Never quote prices, rates, discounts or budget figures in dollars on a call. Say the Account Manager will send an estimate within 3 business days.
- Do not commit to any new date that is not in the knowledge base. Offer to confirm in writing within 24 hours.
- Do not confirm or deny certifications (SOC 2, ISO, HIPAA) or legal/contract terms on a call. Route to the Account Manager.
- Never blame the client. Describe dependencies factually with dates.
- Budget burn may only be shared as a percentage.`,
  knowledge: `# FleetTrack 2.0 knowledge base

## Project overview
FleetTrack 2.0 is a rebuild of Harborline Logistics' driver and dispatch platform. Engagement model: time and materials with an approved plan. Start date 3 August 2026. Target go-live 15 February 2027. Team of 9 from our side.

## Scope - in scope
Driver mobile app (React Native, iOS and Android). Dispatcher web portal (Next.js). Node.js backend on AWS. Integration with the Samsara telematics API for vehicle location and driver hours-of-service (HOS) events. Proof-of-delivery photo capture. Route suggestions using Google Routes API.

## Scope - out of scope
Offline mode for the driver app (logged as change request CR-03, Phase 2 candidate). SAP integration (owned by Harborline IT). Payroll export.

## Team and contacts
Our side: Sara Khan (PM), Bilal Ahmed (Tech Lead), 3 mobile developers, 2 backend developers, 1 QA engineer, 1 UI/UX designer. Account Manager: Usman Tariq. Delivery Head: Faisal Mir.
Client side: Megan Carter (VP Operations, project sponsor), Jason Lee (IT Director, owns AWS account, SAP and security reviews).

## Milestones
- M1 Discovery and design: completed 4 September 2026.
- M2 Driver app MVP (Sprints 1-4): completed 30 October 2026.
- M3 Dispatcher portal + Samsara integration (Sprints 5-6): Sprint 6 demo was planned for 20 November 2026 and has moved to 4 December 2026.
- M4 UAT: 5 January to 23 January 2027. Pilot with 25 drivers at the Dallas depot starts 12 January 2027.
- M5 Go-live: 15 February 2027.

## Current status (as of 25 November 2026)
Sprint 6 is about 70% complete. Samsara vehicle-location integration is done; driver HOS events integration is in progress, due 1 December.
Reason for the Sprint 6 slip: Samsara sandbox API credentials were requested on 28 October and received on 6 November (9 days later than planned), which delayed integration testing.
Go-live on 15 February 2027 is still achievable. The schedule buffer before go-live has reduced from 3 weeks to 1 week.
Budget: 58% of approved hours consumed at 55% completion (on track within tolerance).
Open bugs: 14 total, 2 high priority.

## Known high-priority bugs
- BUG-211: Dispatcher map freezes when more than 500 vehicles are loaded. Fix in progress using map clustering and viewport-based loading. Target fix: Sprint 7, ready by 18 December 2026, well before UAT. Load test planned with 1,000 simulated vehicles.
- BUG-198: Proof-of-delivery photo upload fails on Android 12 for images over 8 MB. Fix: client-side compression. Target: 4 December 2026 with the Sprint 6 demo.

## Quality metrics
Beta crash-free sessions: 99.1% (target 99.5% by UAT). API p95 response time: 310 ms (target under 400 ms).

## Change requests
CR-03 Offline mode for the driver app: initial sizing 6 to 8 weeks for 2 developers. Not in current scope. Adding it into the current phase would put the 15 February go-live at risk; recommended as Phase 2 starting after go-live, or as a separate parallel stream if approved.
Process: client sends request by email, we provide impact analysis (schedule + estimate) within 3 business days via the Account Manager, change is approved through a signed CR.

## Staffing FAQ
Adding developers: 2 extra developers would need about 2 weeks of onboarding, so they would only add capacity from mid-January. Realistic gain is about 1 week of buffer. Requires a CR for the additional hours.

## Security and compliance
All client data is hosted in Harborline's own AWS account (us-east-1). Access through SSO with MFA. Team members have signed Harborline's NDA. An independent penetration test is scheduled for 15 December 2026, before UAT. Questions about certifications (e.g. SOC 2) or contract/legal terms are handled by the Account Manager, who can share documentation within 3 business days.

## Training and rollout
Two remote training sessions for dispatchers in the UAT window. Short video guides for drivers. Hypercare support for 4 weeks after go-live.

## Known weak spots (and my honest answer)
- Sprint 6 slip: "The demo moved to 4 December because sandbox credentials arrived 9 days late. We have kept go-live and I now flag dependencies a week earlier."
- Crash-free rate below target (99.1% vs 99.5%): "We are fixing the top 3 crash causes in Sprint 7 and will report the rate weekly until UAT."
- Reduced buffer: "Buffer is down to one week, so I will flag any risk to 15 February the same day I see it."

## Meeting cadence
Weekly status call Tuesdays 9:00 AM Central. Written status report every Friday.
`,
};

export interface ScriptLine {
  speaker: Speaker;
  text: string;
}

export const DEMO_SCRIPT: ScriptLine[] = [
  { speaker: "me", text: "Hi Megan, thanks for making time. I'd like to walk you through where Sprint 6 stands and what's next." },
  { speaker: "client", text: "Sure. I'll be honest, I was expecting the dispatcher demo last week and then I got an email saying it slipped. My leadership is asking me why. What happened?" },
  { speaker: "me", text: "That's fair, and I'm sorry it came as a surprise. The Samsara sandbox credentials arrived on November 6th instead of late October, so integration testing started late. The demo is now December 4th." },
  { speaker: "client", text: "Okay. So is February 15th still real, or do I need to start preparing my CEO for a delay?" },
  { speaker: "me", text: "February 15th is still our plan. Our buffer has gone from three weeks down to one, so I'll be watching it closely and flag anything early." },
  { speaker: "client", text: "Alright. The other thing, my dispatchers keep telling me the map freezes when they load the whole fleet. We have about 600 trucks. Is that going to be fixed before UAT?" },
  { speaker: "me", text: "Yes, that's a known issue. We're adding clustering so it only loads what's on screen, and we'll load test it with a thousand vehicles. Target is December 18th." },
  { speaker: "client", text: "Good. Now, our drivers in West Texas lose signal all the time. I really need offline mode. Can you just add it into this phase? And what would that cost us?" },
  { speaker: "me", text: "I hear you, offline mode matters a lot for those routes. It isn't in the current scope, so let me get you a proper impact analysis." },
  { speaker: "client", text: "Hmm. I'm not thrilled about another process step, but fine. Also, Jason from IT is asking whether you guys are SOC 2 compliant. Our security team needs that before UAT." },
  { speaker: "me", text: "Understood. I'll make sure Usman gets Jason what the security team needs." },
  { speaker: "client", text: "Could we add a couple more developers to get some of that buffer back?" },
  { speaker: "me", text: "We could, but there's an onboarding cost. Realistically it buys about a week. I'll include that option in the plan." },
  { speaker: "client", text: "Okay, that's helpful. I appreciate you being straight with me. Let's get the revised plan and the offline mode estimate in writing by Friday and I'll take it to my leadership." },
  { speaker: "me", text: "Will do. I'll send the revised plan by Friday, and Usman will send the offline mode estimate within three business days." },
  { speaker: "client", text: "Sounds good. Thanks, Sara." },
];

export const EMPTY_WORKSPACE: Workspace = {
  mode: "client",
  myName: "",
  topics: "",
  projectName: "",
  clientName: "",
  clientCompany: "",
  clientLocation: "",
  profile: "",
  knowledge: "",
  guardrails: "",
};

// Starter structure for your own knowledge base (headings help the Knowledge tool cite sections).
export const KNOWLEDGE_TEMPLATE = `## About me
- Name, role, what I own on this project, what I can and cannot commit to.

## People on this call
- Name: role, what they care about, questions they usually ask.

## Project in brief
- What it is, engagement model, team, current phase.

## Milestones
- Milestone: date, status.

## Current status
- Progress, blockers, budget burn as a percentage.

## Key numbers I can say out loud
- Only figures you are happy to share with this client.

## Known weak spots (and my honest answer)
- Weak spot: the short, honest answer.

## Change requests
- How new scope is handled, who prices it, how fast.

## FAQs
- Q: ... A: ...
`;
