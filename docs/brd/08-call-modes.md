# 08 · Call modes

| Feature | Call mode setting | Status | Live |
|---|---|---|---|

## Purpose

A steering committee and a standup need different answers. The mode tunes what the agents listen for and how they answer.

## Modes

| Mode | Focus |
|---|---|
| Client status call | Status, deliverables, scope questions and concerns |
| Presales / discovery | Understand the buyer, answer capability questions, handle objections honestly |
| Commercial / change request | Coaching on the next move, using only the user's own anchor, target and walk-away |
| Steering / leadership review | RAG status and reason first, then decisions needed, risks with owners |
| Standup / daily sync | One or two sentences: done, next, blocked |
| Client interview (staff augmentation) | The user's real experience only; STAR outline for behavioural questions |

## Functional requirements

| ID | Requirement |
|---|---|
| FR-08.1 | Mode is set on the Knowledge tab or in the call settings and saved with the workspace. |
| FR-08.2 | Each mode adds its purpose, answer style and "never" rules to every agent's context. |

## Acceptance criteria

- **AC-08.1** Given Commercial mode and no walk-away point in the profile, when the client pushes on rate, then the answer does not invent a figure.
- **AC-08.2** Given Steering mode, when asked for status, then the answer leads with the RAG colour and one-line reason.
- **AC-08.3** Given Standup mode, then answers are at most two sentences.

## Dependencies

`lib/modes.ts`.
