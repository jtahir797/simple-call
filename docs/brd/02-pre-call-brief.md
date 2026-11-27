# 02 · Pre-call brief

| Feature | Before the call | Status | Live |
|---|---|---|---|

## Purpose

Most hard questions are predictable. One minute of preparation removes most on-call surprises.

## Scope

- **In:** optional agenda and attendees, 5 likely hard questions with answers, defer flags, mood forecast, opening line, things to avoid, questions to ask the client.
- **Out:** calendar integration, attendee research from the web.

## Functional requirements

| ID | Requirement |
|---|---|
| FR-02.1 | *Prepare me for this call* runs the Strategist agent on the knowledge, the call mode, the optional agenda and the last published call's psychology and RAID notes. |
| FR-02.2 | Return exactly 5 likely questions, each with a spoken answer of under 25 words and a `defer` flag when outside the user's authority. |
| FR-02.3 | Return an opening line, a mood forecast, up to 4 things to avoid and 2 to 4 questions to ask. |
| FR-02.4 | Hide the brief once the call starts so the screen stays focused on live answers. |

## Business rules

- BR-02.1 The brief uses only facts in the knowledge; anything else is marked as a defer.
- BR-02.2 Pricing, contract and certification questions are always marked defer unless the knowledge gives the user that authority.

## Acceptance criteria

- **AC-02.1** Given complete knowledge, when the user presses *Prepare me for this call*, then 5 questions with answers appear within 20 seconds.
- **AC-02.2** Given a pricing question is predicted, then it shows a *defer* tag.
- **AC-02.3** Given live AI is off and a recorded run exists, then the recorded brief is shown at no cost.

## Success metric

Share of client questions on the call that were already in the brief (target: 3 of 5).
