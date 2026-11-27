# Simple Call at the SSI Agent-A-Thon 2026

Submission material, kept apart from the product docs.

- **Slides:** in the app at `/present`, or [Simple-Call-Presentation.pdf](Simple-Call-Presentation.pdf)
- **Submission summary, demo script and Q&A:** [PITCH.md](PITCH.md)

## Try it in 90 seconds

1. Open the live app. A complete fictional project is already loaded.
2. Press **▶ Try the demo call**. A frustrated US client asks about a slipped demo, the go-live date, a price and SOC 2.
3. While it plays, click **Verifier** on the *Agent steps* line: the first draft quoted a price, so it was sent back and rewritten as a deferral.
4. Press **End call → report**: four agents write the minutes, client psychology, RAID and the recap email.

## Rules compliance

| Check | How Simple Call meets it |
|---|---|
| Own individual work | One person, own repo, own Vercel account. AI-assisted with Claude (allowed tooling) |
| No client or internal data | All demo data is fictional. No real names, gateway addresses or internal documents in the repo |
| No API key in the code | Key only in Vercel environment variables and a git-ignored `.env.local`. CI and GitHub push protection block committed keys |
| Live on Vercel | Next.js app deployed on Vercel from this repo |
| Safe AI-agent settings | Claude Code in Accept Edits mode. `.claude/settings.json` blocks reading `.env` files and force pushes. Agents at runtime only call the model and plain-code tools |
| Agentic, not a single prompt | 12 agents that plan, use tools, hand off and check each other |
| Works end to end | Knowledge → brief → live answers → report → publish → history |
| App stays up | Spend cap, calls-per-minute limit, circuit breaker, automatic replay fallback |
| Public repo matches the app | Vercel deploys every merge to `master` |
