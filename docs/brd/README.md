# Business requirements (BRDs)

One short BRD per feature. Each one states the business need, the rules the product must follow, and how we test that it works. They are the source of truth for new work: change the BRD in the same pull request as the code.

| # | Feature | What it gives the user |
|---|---|---|
| [00](00-overview.md) | Product overview | Problem, users, goals, glossary |
| [01](01-knowledge-setup.md) | Knowledge setup | Project facts loaded in about 5 minutes |
| [02](02-pre-call-brief.md) | Pre-call brief | The 5 hardest questions, answered, before the call |
| [03](03-live-captions.md) | Live captions | Both sides of the call as text, on-device where possible |
| [04](04-live-answers.md) | Live answers | A short, fact-checked answer to say |
| [05](05-client-psychology.md) | Client psychology | The client's mood and how to respond |
| [06](06-live-risk-log.md) | Live risk log | Risks, issues, actions and commitments as they are said |
| [07](07-quick-actions.md) | Quick actions | Answer, Clarify, Recap, Questions to ask, on one key |
| [08](08-call-modes.md) | Call modes | Behaviour tuned to the type of call |
| [09](09-after-call-report.md) | After-call report and history | Minutes, psychology, RAID and recap email to edit and publish |
| [10](10-replay-and-resilience.md) | Instant replay and resilience | The product keeps working when live AI is not available |
| [11](11-private-mode.md) | Private mode | Everything runs on the user's laptop |
| [12](12-security-and-cost.md) | Security and cost | Non-functional rules every feature must meet |

## How to read a BRD

- **FR**: functional requirement. Numbered so tests, issues and pull requests can point to it (for example `FR-04.3`).
- **BR**: business rule. Must always hold.
- **AC**: acceptance criteria in Given / When / Then form.
- **Status**: `Live` (shipped), `Planned` or `Idea`.
