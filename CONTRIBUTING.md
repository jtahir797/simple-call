# Developing Simple Call

How to change Simple Call safely: branch, pull request, automatic checks, review, merge, deploy.

## The flow

```
feature branch ──► pull request ──► checks + review ──► merge to master ──► Vercel deploys production
                        │
                        └──► Vercel preview link (no AI key, uses Instant replay)
```

1. **Branch** from `master`: `feature/<short-name>`, `fix/<short-name>` or `docs/<short-name>`.
2. **Build and check locally**: `npm run dev`, then `npm run check` before every push.
3. **Push and open a pull request** into `master`. The template asks what changed, how you tested it and which BRD requirement it touches.
4. **Checks run automatically** (all must pass before merge):

   | Check | What it catches |
   |---|---|
   | Typecheck, test, audit, build | Type errors, broken logic (39 unit tests), vulnerable runtime packages, build failures, committed keys or `.env` files |
   | CodeQL security scan | Injection, XSS and other code-level security issues |
   | Dependency review | New dependencies with known high-severity vulnerabilities |

5. **Review**: read the diff and the Vercel preview. Optional AI review: in VS Code ask Claude Code *"Review pull request #N for bugs, security and the rules in CONTRIBUTING.md"*.
6. **Merge** with *Squash and merge*. Vercel deploys `master` to production in about a minute.

## Rules for every change

- No keys, gateway addresses, client names or internal company data in the repo. Demo data stays fictional.
- Keep untrusted text fenced in prompts and every agent's `max_tokens` capped (see [BRD 12](docs/brd/12-security-and-cost.md)).
- If behaviour changes, update the matching file in [`docs/brd/`](docs/brd/) in the same pull request.
- UI changes: run `npm run capture` so the screenshots in the README stay true. Agent prompt changes: run `npm run record` first so Instant replay matches.
- Plain, short wording in the UI and docs. No em-dashes.
- AI coding agents run in **Accept Edits** mode only. `.claude/settings.json` blocks reading `.env` files and force pushes.

## One-time GitHub setup (repository owner)

**Settings → Branches → Add branch ruleset** (or classic branch protection) for `master`:

- Require a pull request before merging (required approvals: 0 while you are the only developer, since GitHub does not let authors approve their own PRs; raise to 1 when a second developer joins).
- Require status checks to pass: `Typecheck, test, audit, build`, `CodeQL security scan`, `Dependency review`.
- Require conversation resolution before merging.
- Block force pushes and deletions.

**Settings → Code security**:

- Secret Protection and **Push protection**: ON (blocks a push that contains a key).
- Dependabot alerts and Dependabot security updates: ON. Version updates come from `.github/dependabot.yml`.
- Code scanning: leave the default setup OFF. The `codeql.yml` workflow already runs it, and the two conflict.

**Settings → General → Pull Requests**: allow squash merging only, and tick *Automatically delete head branches*.

## Vercel (deployment pipeline)

- **Production** = `master`. **Preview** = every pull request, with its own link posted on the PR.
- Add the AI environment variables to **Production only** (`LITELLM_BASE_URL`, `LITELLM_API_KEY`, `LITELLM_MODEL`, `LITELLM_FAST_MODEL`, `SPEND_CAP_USD`, `MODEL_RPM`). Previews then run without a key and use Instant replay, so testing a PR never spends the AI budget.
- To test live AI on a branch, run it locally with your own `.env.local`.
- Emergency stop: set `SIMPLECALL_AI=off` in Vercel and redeploy. Replay keeps working.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Local app at http://localhost:3000 |
| `npm run check` | Typecheck, unit tests, dependency audit |
| `node scripts/doctor.mjs` | Checks the AI key and models without printing secrets |
| `npm run record` | Records a real demo run for Instant replay (costs about USD 0.30) |
| `npm run capture` | Refreshes README screenshots and the product tour PDF |
| `npm run private` | Private mode on a local model |
