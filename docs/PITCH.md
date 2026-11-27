# Simple Call: submission summary and demo script

## Submit-page summary (paste as is)

Simple Call is a multi-agent copilot for client calls. The employee loads the project once (status, scope, milestones, known issues, guardrails, their own authority limits). Before the call, a Strategist agent predicts the hardest questions. During a Teams, Meet or Zoom call, a Conductor routes every line through a Listener/Planner, a knowledge search tool, an Answer agent, a deterministic FactCheck tool (dates, numbers, pricing and certification language, US holidays) and a Verifier that sends weak drafts back for revision, while Psychology and Risk agents read the client's mood and log risks and commitments live. After the call, Scribe, Psychologist, Risk Officer and Follow-up agents write the minutes, sentiment read, RAID with RAG status and recap email for the employee to edit and publish. Six call modes (client, presales, commercial, steering, standup, client interview), quick actions (Answer, Clarify, Recap, Follow-up) and a beside-the-call view. Secured (key server-side, same-origin, rate limits, strict CSP) and built to survive judging on a $25 key (spend cap read from the gateway, 55 calls/minute limit, response cache, Haiku for frequent steps, automatic zero-cost replay of a recorded real run). Next.js on Vercel with the SSI LiteLLM gateway; fictional data only.

## The problem (30 seconds)

- Our delivery teams in Lahore run calls with US clients, often early morning US time and late in our day.
- Clients ask pointed questions: "Is the date still real?", "What will it cost?", "Are you SOC 2?". The answer sits in a status report or with someone else.
- Three things go wrong: slow or vague answers, promises the PM is not authorised to make, and client frustration that nobody records until it is an escalation.

## Demo script (2 minutes)

0. **Knowledge** (optional, 15s): Knowledge score 11/11 on the example; show *Fill it with Claude or ChatGPT* and *Paste documents here*: "setup takes five minutes, nobody writes a knowledge base by hand."
1. **Pre-call brief** (15s): *Prepare me for this call*. "Before I dial in, the Strategist tells me the five hardest questions and what not to say."
2. **Live call** (60s): *Watch the 90-second demo* (or *Play demo US client call* on the Live call tab).
   - Psychology: *frustrated, trust low*, tip "acknowledge first, then the date".
   - "Is February 15th still real?" → grounded answer, *facts grounded* badge, and the **US calendar tool** flags that 15 Feb 2027 is Presidents' Day in the US.
   - "What would offline mode cost?" → open the **Verifier X-ray**: draft sent back, Answer revised into a proper deferral (no price on the call, Account Manager within 3 business days).
   - "Are you SOC 2?" → deferred again.
   - Press `R` for a 5-minute recap and `V` for the beside-the-call view; switch the mode to *Commercial / change request* to show the coaching style change.
   - Point at the token meter and "served from cache".
3. **Report** (30s): four agents in parallel; RAG status; edit one line; *Approve & publish*; *Open email draft*.
4. **Close** (15s): "Every answer is fact-checked before I say it, every risk is captured, the paperwork is done when the call ends, and it cannot run up a bill."

## Criteria mapping

| Criterion | Evidence in the product |
|---|---|
| Completeness (incl. orchestration) | Pre-call → live → post-call → publish → history. 12 AI agents + 4 tools, parallel and sequential chains, loop-back revision, Agent X-ray on every step |
| Creativity | Live client psychology with "how to respond now"; US holiday check on promised dates; pre-call Strategist |
| Technical execution | Key never in code or browser, 37 unit tests, CI with audit and secret scan, input validation, streaming, cache, budget |
| Presentation | One-click demo, preloaded project, Instant replay fallback, SSI branding |
| Business value | Faster accurate answers to US clients, no unauthorised commitments, early warning on unhappy clients, minutes and RAID on time, feeds PMO governance |

## Local-first (the "can we use this with real clients?" answer)

- Audio is transcribed on the laptop (on-device speech); no bot joins the call.
- Both sides of the call are captioned and labelled automatically from the shared call audio and the mic.
- Knowledge and transcripts stay in the browser. Private mode runs the same agents on a local model with Ollama, so a real client call never leaves the machine. The public URL uses fictional data, as the rules require.

## Likely judge questions

- **Does it join Teams?** No bot joins: it captions the call locally from the shared Teams or Meet tab audio and your mic, so there is nothing for the client's IT to approve.
- **Hallucination?** The Answer agent only sees retrieved knowledge; FactCheck verifies every date and number in code; the Verifier rejects and the Answer agent revises.
- **Security?** See docs/SECURITY.md: threat model with controls and tests, plus the honest known-limits list.
- **Cost?** Cache makes repeat demos free, small talk never reaches a model, cheap model tier for the high-frequency agents, hard spend cap under the $25 key budget, zero-cost replay.
