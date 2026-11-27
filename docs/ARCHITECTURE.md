# Simple Call architecture

Simple Call is a Next.js app. The browser handles the screen, on-device speech and storage. Server routes on Vercel run the agents and call Claude through the SSI LiteLLM gateway. The API key never leaves the server.

## 1. System overview

```mermaid
flowchart LR
  subgraph Laptop["User's laptop (browser)"]
    UI["Simple Call UI<br/>Knowledge · Live call · Report"]
    STT["On-device speech<br/>(Chrome / Edge)"]
    LS[("Browser storage<br/>knowledge, transcripts, reports")]
    CALL["Teams / Meet tab audio<br/>+ microphone"]
    CALL --> STT --> UI
    UI <--> LS
  end
  subgraph Vercel["Vercel (server routes)"]
    G["Gate: origin · rate limit · spend cap · input caps"]
    C{{"Conductor<br/>/api/orchestrate"}}
    P["/api/prep · /api/action<br/>/api/postcall · /api/knowledge"]
    T["Tools (plain code)<br/>alert rules · knowledge search<br/>FactCheck · US calendar"]
    B["Budget guard<br/>cache · 55 calls/min · circuit breaker"]
  end
  LLM["SSI LiteLLM gateway<br/>claude-sonnet-5-5 · claude-haiku"]
  UI -- "NDJSON stream" --> G --> C & P
  C --> T
  C & P --> B --> LLM
```

- Every agent step streams back to the screen as it finishes, so the user can watch the orchestration and open any step in the Agent X-ray.
- Nothing about the call is stored on the server. Each request carries only the recent transcript window and the project knowledge it needs.

## 2. One client question, step by step

```mermaid
sequenceDiagram
  participant U as Browser
  participant C as Conductor
  participant A as Alert rules (tool)
  participant L as Listener + Planner
  participant K as Knowledge search (tool)
  participant W as Answer
  participant F as FactCheck (tool)
  participant V as Verifier
  participant P as Psychology
  participant R as Risk
  U->>C: new client line
  C->>A: is it addressed to me?
  par mood and risks
    C->>P: read emotion, trust, need
    P-->>U: mood + how to respond
    C->>R: new risks, issues, actions, commitments
    R-->>U: live log items
  and answer chain
    C->>L: question? intent? which searches?
    L->>K: planned queries
    K-->>W: top 6 knowledge sections
    W-->>U: draft "Say this"
    W->>F: dates, numbers, pricing words, US holidays
    F->>V: tool results
    alt verified
      V-->>U: Verified
    else sent back
      V->>W: issues
      W->>F: revised draft re-checked
      F-->>U: Revised or Defer
    end
  end
```

## 3. Agents

| # | Agent | When | Model | Hands work to |
|---|---|---|---|---|
| 1 | Knowledge Builder | Setup | Sonnet | Turns pasted documents into the knowledge format and asks for gaps |
| 2 | Strategist | Before the call | Sonnet | Pre-call brief: likely hard questions, landmines, opening line |
| 3 | Listener + Planner | Each client line | Haiku | Decides if an answer is needed; plans searches for the Knowledge tool |
| 4 | Answer | Each question | Sonnet | Drafts what to say (1 or 2 sentences, under 40 words); revises when the Verifier sends it back |
| 5 | Verifier | Each question | Sonnet | Approves, sends back, or forces a deferral, using FactCheck results |
| 6 | Psychology | Each client line | Haiku | Emotion, trust, underlying need, how to respond; feeds the Answer agent's tone |
| 7 | Risk | Each client line | Haiku | Risks, issues, actions and commitments, de-duplicated |
| 8 | Assist | On demand | Haiku / Sonnet | Clarify, Recap, Follow-up questions |
| 9 | Scribe | After the call | Sonnet | Minutes, decisions, actions |
| 10 | Psychologist | After the call | Sonnet | Emotional arc, what landed, next-call plan |
| 11 | Risk Officer | After the call | Sonnet | RAID with RAG status (worst-of rule), escalations |
| 12 | Follow-up | After the call | Sonnet | Recap email |

The **Conductor** is plain code: it routes each line, runs chains in parallel or in sequence, and decides when to loop back.

## 4. Tools (no model cost)

| Tool | What it does |
|---|---|
| Alert rules | A client line reaches the Listener only if it names the user, asks a question, makes a request or concern, or mentions a project word |
| Knowledge search | BM25 ranking over the knowledge base, using the Listener's planned queries |
| FactCheck | Every date and number in a draft must exist in the knowledge; scans for pricing, certification, legal and guarantee wording |
| US calendar | Flags promised dates that fall on a US weekend or federal holiday |

## 5. Staying up when live AI is unavailable

```mermaid
flowchart LR
  Req["Request"] --> O{"Same origin?<br/>Rate limit OK?"}
  O -- no --> X["403 / 429"]
  O -- yes --> S{"Spend under cap?<br/>(LiteLLM /key/info)"}
  S -- no --> RP["UI switches to<br/>Instant replay (0 tokens)"]
  S -- yes --> CA{"Cached?"}
  CA -- yes --> OUT["Answer, 0 tokens"]
  CA -- no --> RPM{"Under 55 calls/min?"}
  RPM -- "no, wait for next minute" --> RPM
  RPM -- yes --> M["Claude via LiteLLM"]
  M -- "budget or key error" --> CB["Circuit breaker:<br/>pause live AI 15 min"] --> RP
  M --> OUT
```

## 6. Data and privacy

| Data | Where it lives |
|---|---|
| Audio | Never leaves the laptop with on-device speech |
| Knowledge, transcripts, reports | Browser storage only; deleted with one click |
| API key and gateway address | Vercel environment variables only |
| Model calls | SSI LiteLLM gateway (public demo, fictional data) or a local model in private mode |

## 7. Code map

```
app/
  page.tsx               the app: Knowledge, Live call, Report, History
  present/page.tsx       the presentation (also exported to docs/Simple-Call-Presentation.pdf)
  api/orchestrate        Conductor: live agent chain per transcript line
  api/prep               Strategist
  api/action             Assist quick actions
  api/postcall           Scribe, Psychologist, Risk Officer, Follow-up
  api/knowledge          Knowledge Builder
  api/health             public status (no secrets)
components/              UI: LiveCall, Report, Setup, KnowledgeCoach
hooks/useCopilot.ts      live call engine: captions, queue, replay, quick actions
lib/agents.ts            every agent's prompt and output schema
lib/tools.ts             alert rules, FactCheck, policy scan, US calendar
lib/retrieve.ts          knowledge search
lib/budget.ts            spend cap, calls per minute, circuit breaker
lib/guard.ts             origin check, rate limits, input validation
lib/modes.ts             six call modes
lib/checklist.ts         knowledge checklist and Claude / ChatGPT prompt
scripts/                 record the demo run, capture screenshots and the PDF, check the key
tests/                   39 unit tests
docs/brd/                one business requirements doc per feature
.github/                 CI, CodeQL, Dependabot, PR template, CODEOWNERS
```
