# 05 · Client psychology

| Feature | Live call · mood card | Status | Live |
|---|---|---|---|

## Purpose

Users on a long call miss emotional signals. A short read of the client's mood, with one instruction on how to respond, prevents escalations.

## Functional requirements

| ID | Requirement |
|---|---|
| FR-05.1 | After each meaningful client line, the Psychology agent returns: score (-1 to 1), emotion, intensity, trust (low, medium, high), up to 3 exact cues, the underlying need (under 8 words) and a tip (under 15 words). |
| FR-05.2 | The mood card shows the emotion, trust and a sparkline of the score over the call, plus the tip. |
| FR-05.3 | The current mood is passed to the Answer agent so tone adapts (acknowledge frustration before facts). |
| FR-05.4 | The after-call Psychologist agent turns the mood history into an emotional arc, drivers and a next-call plan. |

## Business rules

- BR-05.1 The read describes the client's communication on this call only. No personality profiling, no health or personal inferences.
- BR-05.2 Cues must be exact quotes from the transcript.

## Acceptance criteria

- **AC-05.1** Given "My leadership is asking me why", then the card shows a negative emotion with a tip to acknowledge first.
- **AC-05.2** Given the mood improves over the call, then the sparkline rises and the report shows the start and end score.

## Success metric

Calls where the ending score is higher than the starting score.
