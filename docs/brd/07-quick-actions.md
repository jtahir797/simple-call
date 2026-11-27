# 07 · Quick actions

| Feature | Live call · action row | Status | Live |
|---|---|---|---|

## Purpose

Give the user help on demand, with one key, when the automatic flow is not enough.

## Functional requirements

| ID | Key | Action | Output |
|---|---|---|---|
| FR-07.1 | A | Answer now | Runs the full answer chain on the last client line |
| FR-07.2 | K | Clarify | One line: "They're asking..." |
| FR-07.3 | R | Recap | 3 or 4 bullets of the last few minutes |
| FR-07.4 | F | Questions to ask | 2 or 3 questions to ask the client now |
| FR-07.5 | Y | Copy | Copies the latest answer |
| FR-07.6 | V | Beside the call | Narrow view: answer and mood only |
| FR-07.7 | S | Sound | Beep on each new answer |

Also: desktop notification when the tab is hidden (opt-in).

## Business rules

- BR-07.1 Assist replies are under 45 words, each bullet under 12 words.
- BR-07.2 Shortcuts are ignored while typing in a field.
- BR-07.3 Quick actions are disabled during a recorded replay.

## Acceptance criteria

- **AC-07.1** Given a call with lines, when the user presses **R**, then a recap card appears within 6 seconds.
- **AC-07.2** Given the cursor is in the transcript input, when the user types "a", then no action runs.
