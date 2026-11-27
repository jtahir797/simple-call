# 06 · Live risk log

| Feature | Live call · Logged | Status | Live |
|---|---|---|---|

## Purpose

Risks, issues, actions and commitments are said once and lost. Capture them as they happen so the RAID log writes itself.

## Functional requirements

| ID | Requirement |
|---|---|
| FR-06.1 | The Risk agent reads client lines of 6 words or more and returns up to 3 new items: type (risk, issue, action, commitment), title (under 10 words), detail, severity, owner. |
| FR-06.2 | The *Logged* card shows counts per type and expands to the full list. |
| FR-06.3 | Duplicates of existing items are not added. |
| FR-06.4 | The list feeds the Risk Officer agent after the call. |

## Business rules

- BR-06.1 A commitment is logged only if someone on the call actually made it.
- BR-06.2 Owners are SSI, Client, a named person, or empty. Never guessed.

## Acceptance criteria

- **AC-06.1** Given "Our IT team needs your SOC 2 report before UAT", then an *issue* or *dependency* item appears with owner Client or SSI.
- **AC-06.2** Given the user says "I'll send the plan within 24 hours", then a *commitment* is logged.
