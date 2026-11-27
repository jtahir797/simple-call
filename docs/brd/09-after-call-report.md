# 09 · After-call report and history

| Feature | Report and History tabs | Status | Live |
|---|---|---|---|

## Purpose

Turn the call into the documents the PMO expects, in under 2 minutes, with the user in control of what is published.

## Functional requirements

| ID | Requirement |
|---|---|
| FR-09.1 | *End call → report* runs 4 agents in parallel: Scribe (minutes, decisions, actions), Psychologist (emotional arc, drivers, next-call plan), Risk Officer (RAID with RAG status and escalations), Follow-up (recap email). |
| FR-09.2 | Minutes include the questions the client asked and the answers given. |
| FR-09.3 | Every section is editable in place. |
| FR-09.4 | Header shows duration, answers, share verified, sentiment start to end, items logged, and agent status. |
| FR-09.5 | Actions: Copy all, Email draft (opens the mail app), Download .md, Print or save PDF, Regenerate, Approve & publish. |
| FR-09.6 | Published reports are saved to History (last 25) in the browser; they can be reopened or deleted. |

## Business rules

- BR-09.1 Nothing is published without the user pressing *Approve & publish*.
- BR-09.2 The report uses only what was said on the call and the knowledge. No new facts.
- BR-09.3 RAG status follows the worst of scope, schedule, budget and risk.

## Acceptance criteria

- **AC-09.1** Given a finished call, when the report is generated, then all 4 sections appear within 30 seconds.
- **AC-09.2** Given an edited section, when the user publishes, then History stores the edited text.
- **AC-09.3** Given *Email draft*, then the mail app opens with subject and body filled.

## Open items

Publish to SharePoint, Teams or the PMO Portfolio Console; push actions to Jira or Azure DevOps.
