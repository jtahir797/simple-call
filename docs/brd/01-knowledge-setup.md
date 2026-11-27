# 01 · Knowledge setup

| Feature | Knowledge tab | Status | Live |
|---|---|---|---|

## Purpose

Answers can only be as good as the facts behind them. Users will not write a knowledge base by hand, so setup must take about 5 minutes from documents they already have.

## Users

Anyone preparing for a client call. No technical skills assumed.

## Scope

- **In:** paste documents, file upload (.md, .txt, .csv, .json), Claude or ChatGPT prompt, guided 11-topic checklist, call context fields, guardrails, the user's authority, example project, blank start, delete all data.
- **Out:** syncing from SharePoint, Jira, Azure DevOps or GitHub (see Open items).

## Functional requirements

| ID | Requirement |
|---|---|
| FR-01.1 | Load a complete fictional example project on first visit so the user sees what good looks like. |
| FR-01.2 | **Paste documents:** the Knowledge Builder agent turns pasted status reports, SOWs or emails into structured knowledge and lists up to 6 gaps as questions. |
| FR-01.3 | **Fill with Claude or ChatGPT:** copy a ready prompt; paste the reply back; the app parses the `=== SIMPLE CALL ===` format into the right fields. |
| FR-01.4 | **Checklist:** 11 topics, each with its questions and an example answer. |
| FR-01.5 | Show a Knowledge score (covered topics out of 11) and mark 3 essentials: about you and your authority, milestones, current status. |
| FR-01.6 | Offer **Undo** after any import. |
| FR-01.7 | Index knowledge by `## Heading` sections so answers can cite them. |
| FR-01.8 | Capture call context: project, client contact, company, location and time zone, call mode, the user's name and how captions mishear it, project words that always count as a question. |

## Business rules

- BR-01.1 Knowledge is capped at 60,000 characters; files over 1.5 MB are skipped.
- BR-01.2 Knowledge, transcripts and reports are stored only in the user's browser.
- BR-01.3 On the public demo, the UI tells users to paste fictional or public material only.

## Acceptance criteria

- **AC-01.1** Given a new browser, when the app opens, then the example project is loaded and the score shows 11/11.
- **AC-01.2** Given a pasted status report, when the user presses *Build my knowledge*, then the fields fill, gaps are listed, and *Undo* restores the previous state.
- **AC-01.3** Given a reply in the Simple Call format, when the user presses *Apply*, then every section lands in the matching field.
- **AC-01.4** Given the user presses *Delete all my data*, then browser storage is cleared and the example project is reloaded.

## Dependencies

Knowledge Builder agent (`/api/knowledge`), `lib/checklist.ts`, `lib/retrieve.ts`.

## Open items

- Import directly from SharePoint or a repository README.
- Share one project knowledge pack across a team.
