# 11 · Private mode

| Feature | Local model | Status | Live |
|---|---|---|---|

## Purpose

Real client calls carry confidential data. Private mode runs the same product with nothing leaving the laptop.

## Functional requirements

| ID | Requirement |
|---|---|
| FR-11.1 | `npm run private` builds and serves the app on 127.0.0.1 only. |
| FR-11.2 | The agents call a local OpenAI-compatible model (Ollama) set in `.env.local` from `.env.private.example`. |
| FR-11.3 | `LLM_JSON_MODE=1` forces JSON output for local models. |
| FR-11.4 | The header shows *Private mode*; the Knowledge tab says nothing leaves the laptop. |

## Business rules

- BR-11.1 Private mode must not depend on any cloud service at runtime.
- BR-11.2 On-device speech is recommended with private mode.

## Acceptance criteria

- **AC-11.1** Given Ollama with `qwen2.5:7b` and `llama3.2:3b`, when the user runs `npm run private` and opens 127.0.0.1:3000, then a live call works with the network cable unplugged (after the speech pack is installed).

## Open items

A packaged desktop installer so non-technical users do not need Node.js.
