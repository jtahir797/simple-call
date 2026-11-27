# 00 · Product overview

| Product | Simple Call | Version | 1.1 |
|---|---|---|---|
| Owner | Junaid Tahir | Status | Live |

## Problem

Delivery teams take client calls with US and European clients every week, often late in their own day. Three things go wrong:

1. **Slow or vague answers.** The fact the client wants ("Is 15 February still real?") sits in a status report or with someone else.
2. **Promises nobody approved.** A confident answer about price, dates or certifications becomes a commercial or legal problem.
3. **Signals lost.** Client frustration, new risks and commitments are noticed late, and minutes, RAID and the recap email are written hours after the call, if at all.

## Solution

A browser app that sits beside Teams, Meet or Zoom. No bot joins the call.

- **Before:** predicts the hardest questions and how to answer them.
- **During:** shows one short, fact-checked answer to say, the client's mood, and the risks raised.
- **After:** writes minutes, client psychology, RAID with RAG status and the recap email for the user to edit and publish.

## Users

| Persona | Typical call | Main need |
|---|---|---|
| Project manager | Weekly client status call | Accurate dates and status, no over-promising |
| Delivery or engineering lead | Steering, standup, technical deep dive | Quick facts, clean action list |
| Presales or account manager | Discovery, demo, commercial | Stay inside pricing and contract rules |
| Engineer | Client interview or client standup | Confident, honest answers about their own work |

## Goals and measures

| Goal | Measure | Target |
|---|---|---|
| Faster answers | Time from client question to answer on screen | Under 8 seconds |
| Safe answers | Answers with an ungrounded date or number shown as Verified | 0 |
| Less admin | Time from call end to a publishable report | Under 2 minutes |
| Low cost | Model spend per 30-minute call | Under USD 0.50 |

## Out of scope (v1)

Joining the call as a bot, recording audio, storing transcripts on a server, CRM or Jira write-back, languages other than English.

## Glossary

| Term | Meaning |
|---|---|
| Knowledge | The project facts the user loads: status, scope, milestones, known issues, guardrails, their authority |
| Guardrails | Things the user must never say or promise |
| Defer | A polite answer that passes the question to the right owner with a timeframe |
| FactCheck | Plain-code tool that checks every date and number in an answer against the knowledge |
| RAID | Risks, Assumptions or Actions, Issues, Dependencies |
| RAG | Red, Amber, Green status |
| Agent X-ray | The view that shows what each agent decided, how long it took and its token cost |
