# Simple Call user guide

For project managers, delivery leads, presales and engineers. No technical knowledge needed.

## What it does

Simple Call sits next to your Teams, Meet or Zoom call. When the client asks something, it shows you a short, fact-checked answer to say. It tells you how the client feels and how to respond, keeps a list of risks and promises, and writes the minutes and recap email when the call ends.

Use **Google Chrome** or **Microsoft Edge**.

## Step 1. Give it your project (once, about 5 minutes)

Open the **Knowledge** tab. An example project is already loaded so you can see what good looks like. Replace it with your own in one of three ways:

1. **Paste documents here** (easiest): paste your latest status report, SOW or client emails and press **Build my knowledge**. Simple Call organises it and lists the few questions still missing.
2. **Fill it with Claude or ChatGPT**: press **Copy prompt**, paste it into Claude or ChatGPT with your status report attached, answer its questions, then paste its answer back and press **Apply**.
3. **Answer the checklist yourself**: click any topic to see its questions and an example answer.

The **Knowledge score** shows what is covered. Three topics are essential: about you and your authority, milestones, and current status.

Also set:
- **Call mode**: client status call, presales, commercial / change request, steering, standup, or client interview.
- **Your name** (and how captions might mishear it), so questions addressed to you are never missed.

> On the public demo link, use made-up information only. For real clients, use private mode (see the end of this guide).

## Step 2. Before the call (1 minute)

On **Live call**, type the agenda and who is joining, then press **Prepare me for this call**. You get the five questions the client is most likely to ask, with answers, things to avoid, and a strong opening line.

## Step 3. During the call

1. Tell the client an AI note-taker is in use.
2. Open **⚙** (call settings) once and choose the captions source:
   - **Headphones**: *call audio = client, mic = me*.
   - **Speakers**: *call audio only*.
3. Press **▶ Start → Live captions** and share your Teams or Meet tab with **Share tab audio** ticked. (Teams desktop app on Windows: share the entire screen with system audio.)
4. Press **V** for the *beside the call* view and place it next to your call.

What to look at:

| On screen | Meaning |
|---|---|
| **The big answer** | Say it as it is: 1 or 2 sentences, answer first. *Details* shows key points and sources |
| Green **Verified** | Safe to say |
| Blue **Revised** | The checker corrected the first draft; say the new version |
| Red **Defer** | Do not commit; it gives you a polite way to pass it to the right person |
| Amber **Check first** | Some facts could not be confirmed; check before you say it |
| **US calendar** note | A date you are about to promise is a US holiday or weekend |
| **Mood** | How they feel, their trust level, and how to respond right now |
| **Logged** | Risks, issues, actions and commitments, captured as the call goes. Click to see the list |
| **Agent steps** | What each agent did for the latest answer. Click a step for details |

Keyboard shortcuts: **A** answer the last question · **K** clarify what they asked · **R** recap the last 5 minutes · **F** questions to ask them · **Y** copy the answer · **S** sound cue · **V** beside the call.

If captions miss something, open **Transcript** and type the line. **Ask** sends it straight to the answer agents.

## Step 4. After the call (2 minutes)

1. Press **Stop captions**, then **End call → report**.
2. Four agents write the minutes, the client sentiment read, the risk log (with RAG status) and the recap email.
3. Click **Edit** on any section to change it, then **Approve & publish**.
4. **Email draft** opens the recap in your mail app. **⋯** has *Download .md*, *Print or save PDF* and *Regenerate*.

Published reports are kept under **History** in your browser.

## Private mode (for real client calls)

Everything stays on your laptop: speech, knowledge and the AI model. Ask your IT or PMO contact to do this once:

1. Install Node.js (nodejs.org) and Ollama (ollama.com), then download the models: `ollama pull qwen2.5:7b` and `ollama pull llama3.2:3b`.
2. In the Simple Call folder: copy `.env.private.example` to `.env.local`, run `npm install`, then `npm run private`.
3. Open **http://127.0.0.1:3000** in Chrome or Edge. The header shows **Private mode**.

## Questions

- **No captions?** Use Chrome or Edge, allow the microphone, and press *Download speech pack* if asked.
- **The client's voice is missing?** Share the call tab again and tick *Share tab audio*.
- **"Live AI is paused"?** The demo's AI budget is protected; use **▶ Start → Instant replay** to see a recorded run.
- **Where is my data?** Only in this browser. *Delete all my data* on the Knowledge tab removes it.
