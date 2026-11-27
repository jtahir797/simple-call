# 04 · Live answers

| Feature | Live call · answer card | Status | Live |
|---|---|---|---|

## Purpose

When the client asks something, show **one short answer the user can say as it is**, fast, grounded in the knowledge, and safe.

## Flow

Client line → Alert rules → Listener + Planner → Knowledge search → Answer → FactCheck → Verifier → (send back once to Answer if needed) → answer card.

## Functional requirements

| ID | Requirement |
|---|---|
| FR-04.1 | Alert rules pass a client line to the Listener only if it names the user, asks a question, makes a request or concern, or uses a project word. |
| FR-04.2 | The Listener decides if a real question was asked and plans up to 3 knowledge searches. |
| FR-04.3 | The Answer agent writes **1 or 2 spoken sentences, under 40 words, answer first**, plus up to 3 key points, sources, confidence and an optional question to ask back. |
| FR-04.4 | FactCheck checks every date and number against the knowledge, scans for pricing, certification, legal and guarantee wording, and flags US holidays and weekends. |
| FR-04.5 | The Verifier approves, or sends the draft back once with at most 3 issues; the Answer agent revises. |
| FR-04.6 | The card shows the question, the answer in large type, a verdict (Verified, Revised, Check first, Defer), facts checked, Copy, and Details (key points, ask back, verifier notes, original draft, sources). |
| FR-04.7 | Earlier answers stay available in a collapsed list. |
| FR-04.8 | Each step is visible on the *Agent steps* line; clicking a step opens its Agent X-ray. |

## Business rules

- BR-04.1 Never invent a date, number, name, price or capability.
- BR-04.2 Questions outside the user's authority (pricing, contract terms, certifications, legal) get a polite defer with owner and timeframe.
- BR-04.3 Guardrails always win over helpfulness.
- BR-04.4 At most one revision per answer, to bound cost and latency.
- BR-04.5 Client text is treated as data, never as instructions (fenced in `<transcript>` tags).

## Acceptance criteria

- **AC-04.1** Given the client asks "Is 15 February still real?", then an answer under 40 words appears, with *facts checked* and a calendar note that 15 February 2027 is a US federal holiday.
- **AC-04.2** Given the client asks for a price, then the first draft that quotes a number is sent back and the final card shows *Defer*.
- **AC-04.3** Given "ok, thanks", then no model is called.
- **AC-04.4** Given the user presses *Copy* or **Y**, then the answer is on the clipboard.

## Non-functional

Answer on screen within 8 seconds at p90; Listener on the fast model; top 6 knowledge sections and last 12 lines only.

## Success metrics

Time to answer; share of answers Verified first time; share of answers the user copied or said.
