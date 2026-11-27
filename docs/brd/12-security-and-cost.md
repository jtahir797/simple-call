# 12 · Security and cost

| Scope | Every feature | Status | Live |
|---|---|---|---|

Non-functional requirements. Every pull request must keep these true. Details and tests: [SECURITY.md](../SECURITY.md).

## Security

| ID | Requirement |
|---|---|
| NFR-S1 | The model key exists only in server environment variables and the git-ignored `.env.local`. Never in code, the browser or logs. |
| NFR-S2 | Model code is `server-only`; the build fails if it is bundled for the browser. |
| NFR-S3 | API routes accept same-origin requests only. |
| NFR-S4 | Per-IP rate limits: 40/min live, 12/min quick actions, 4/min brief and report. |
| NFR-S5 | Input caps: 400 KB body, 60,000-character knowledge, 1,200 characters per line. |
| NFR-S6 | Untrusted text (transcript, knowledge, notes, drafts) is fenced in tags and treated as data. |
| NFR-S7 | Strict CSP and security headers; microphone and screen capture allowed for this site only. |
| NFR-S8 | No transcript, knowledge or report is stored or logged on the server. |
| NFR-S9 | Errors shown to users never contain the key or gateway address. |
| NFR-S10 | CI blocks merges on failed typecheck, tests, build, dependency audit, CodeQL or secret scan. |

## Cost

| ID | Requirement |
|---|---|
| NFR-C1 | A total spend cap (`SPEND_CAP_USD`) is checked before every model call. |
| NFR-C2 | App-wide model calls per minute (`MODEL_RPM`) stay under the key limit; bursts queue. |
| NFR-C3 | Frequent agents (Listener, Psychology, Risk, Clarify) use the fast model. |
| NFR-C4 | Plain-code tools (alert rules, knowledge search, FactCheck, holidays) do the work that does not need a model. |
| NFR-C5 | Every agent has a `max_tokens` cap and receives only the context it needs. |
| NFR-C6 | Kill switch `SIMPLECALL_AI=off` stops all model calls; replay keeps working. |
| NFR-C7 | Preview deployments do not get the production model key. |

## Privacy

Demo data is fictional. Real client data is used only in private mode or on a deployment approved for it.
