# 10 · Instant replay and resilience

| Feature | Demo, replay and fallbacks | Status | Live |
|---|---|---|---|

## Purpose

A user, a reviewer or a stakeholder must always see the product work, even when the AI budget is spent, the gateway is down or the rate limit is hit.

## Functional requirements

| ID | Requirement |
|---|---|
| FR-10.1 | *Play demo US client call*: a scripted 90-second call through the live agents. |
| FR-10.2 | *Instant replay*: plays a recorded real run (`public/demo-recording.json`) with every agent step, at zero model cost. |
| FR-10.3 | If live AI fails (budget, rate limit, key or gateway), the app switches to the recording automatically and says so. |
| FR-10.4 | Responses are cached for 7 days, so repeat demo runs cost nothing. |
| FR-10.5 | When a model reply is cut off, the agent retries once with a larger token limit. |
| FR-10.6 | `npm run record` refreshes the recording; `npm run capture` refreshes screenshots and the product tour PDF. |

## Business rules

- BR-10.1 Replays are labelled *Recorded run playing* and show 0 tokens.
- BR-10.2 A circuit breaker pauses live AI for 15 minutes after a budget or key error.

## Acceptance criteria

- **AC-10.1** Given live AI is not configured, when the user opens Live call, then *Start → Instant replay* is available and runs end to end.
- **AC-10.2** Given the gateway returns "budget exceeded", then the next request does not call the model and the UI offers replay.
