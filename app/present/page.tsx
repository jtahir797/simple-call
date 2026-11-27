"use client";

import { useCallback, useEffect, useState } from "react";

// The pitch deck lives inside the app (open /present) and is exported to docs/Simple-Call-Presentation.pdf.
// Arrow keys or click to move. Print or "Save as PDF" gives one slide per page.

const RED = "#b91f2a";

function Title({ kicker, children }: { kicker?: string; children: React.ReactNode }) {
  return (
    <div>
      {kicker && <div className="text-[15px] font-bold uppercase tracking-[0.2em]" style={{ color: RED }}>{kicker}</div>}
      <h2 className="mt-2 text-[44px] font-black leading-[1.1] text-ink">{children}</h2>
    </div>
  );
}

function Box({ title, children, dark }: { title: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={`border-l-4 px-5 py-4 ${dark ? "bg-ink text-white" : "bg-slate-50"}`} style={{ borderColor: RED }}>
      <div className={`text-[22px] font-bold ${dark ? "text-white" : "text-ink"}`}>{title}</div>
      <div className={`mt-2 text-[18px] leading-snug ${dark ? "text-neutral-300" : "text-slate-600"}`}>{children}</div>
    </div>
  );
}

function Shot({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="max-h-[610px] w-full self-center rounded-lg border border-slate-200 object-contain shadow-lg" />;
}

const Node = ({ t, s, tool }: { t: string; s: string; tool?: boolean }) => (
  <div className={`flex flex-col justify-center rounded-lg border-2 px-3 py-2 text-center ${tool ? "border-sky-300 bg-sky-50" : "border-[#b91f2a] bg-white"}`}>
    <div className="text-[15px] font-bold text-ink">{t}</div>
    <div className="text-[11.5px] leading-tight text-slate-500">{s}</div>
  </div>
);
const Arrow = () => <div className="self-center text-[22px] font-bold text-slate-300">→</div>;

const SLIDES: { dark?: boolean; body: React.ReactNode }[] = [
  {
    dark: true,
    body: (
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center text-[16px] font-black text-white" style={{ background: RED }}>SC</div>
          <div className="text-[18px] font-bold tracking-wide text-neutral-300">SSI AGENT-A-THON 2026</div>
        </div>
        <div>
          <div className="text-[96px] font-black leading-none text-white">Simple Call</div>
          <div className="mt-4 max-w-[900px] text-[34px] leading-tight text-neutral-200">
            A team of AI agents on every client call: fact-checked answers in seconds, the client&apos;s mood read live, and the paperwork done when the call ends.
          </div>
        </div>
        <div className="flex items-end justify-between text-[18px] text-neutral-400">
          <span>12 AI agents · 4 tools · live on Vercel · local-first</span>
          <span>Built by Junaid Tahir, PMO</span>
        </div>
      </div>
    ),
  },
  {
    body: (
      <div className="flex h-full flex-col gap-8">
        <Title kicker="The problem">Every week our teams take calls with US clients. The hardest moment is a question you cannot answer on the spot.</Title>
        <div className="grid grid-cols-3 gap-5">
          <Box title="Slow or vague answers">&quot;Is the date still real?&quot; The facts sit in a status report, a ticket or someone else&apos;s head.</Box>
          <Box title="Promises nobody may make">&quot;What will it cost?&quot; &quot;Are you SOC 2?&quot; One confident answer becomes a commercial or legal problem.</Box>
          <Box title="Signals lost">A frustrated client and a new risk are noticed late, and minutes, RAID and the recap email are written hours later, if at all.</Box>
        </div>
      </div>
    ),
  },
  {
    body: (
      <div className="flex h-full flex-col gap-8">
        <Title kicker="The solution">Feed it the project once. Simple Call works before, during and after the call.</Title>
        <div className="grid grid-cols-3 gap-5">
          <Box title="Before">The <b>Strategist</b> predicts the five hardest questions, with grounded answers, landmines and an opening line.</Box>
          <Box title="During" dark>Each client question gets a <b>fact-checked answer to say</b>, a <b>mood read</b> with how to respond now, and a <b>live risk log</b>. No bot joins the call.</Box>
          <Box title="After">Four agents write <b>minutes, client psychology, RAID with RAG, and the recap email</b>. You edit, approve and publish.</Box>
        </div>
        <div className="text-[18px] text-slate-500">Six call modes: client status · presales · commercial / change request · steering · standup · client interview of our engineers.</div>
      </div>
    ),
  },
  {
    body: (
      <div className="grid h-full grid-cols-[1fr_2.1fr] gap-8">
        <div className="flex flex-col gap-5">
          <Title kicker="See it live">One screen beside the call</Title>
          <ul className="space-y-3 text-[18px] leading-snug text-slate-700">
            <li><b>Say this</b>: 1 or 2 spoken sentences, answer first, with sources and a facts-checked badge.</li>
            <li><b>Verified, revised or defer</b>: you know at a glance if it is safe to say.</li>
            <li><b>Psychology</b>: emotion, trust, what they need, how to respond.</li>
            <li><b>Agent X-ray</b>: click any step to see what each agent decided.</li>
          </ul>
        </div>
        <Shot src="/screenshots/live-answer.png" alt="Live call: transcript, suggested answer and client psychology" />
      </div>
    ),
  },
  {
    body: (
      <div className="flex h-full flex-col gap-6">
        <Title kicker="How the agents work together">A Conductor hands every client line through a team that plans, uses tools and checks each other</Title>
        <div className="grid grid-cols-[repeat(13,auto)] items-stretch gap-2">
          <Node t="Conductor" s="routes each line" />
          <Arrow />
          <Node t="Alert rules" s="is it for you?" tool />
          <Arrow />
          <Node t="Listener + Planner" s="question, intent, searches" />
          <Arrow />
          <Node t="Knowledge" s="search tool" tool />
          <Arrow />
          <Node t="Answer" s="drafts what to say" />
          <Arrow />
          <Node t="FactCheck" s="dates, numbers, policy, US holidays" tool />
          <Arrow />
          <Node t="Verifier" s="approve or send back" />
        </div>
        <div className="grid grid-cols-3 gap-5">
          <Box title="Loop-back">If the Verifier rejects a draft, the Answer agent rewrites it with the issues and FactCheck runs again.</Box>
          <Box title="In parallel">Psychology reads the client&apos;s mood; Risk logs risks, issues, actions and commitments.</Box>
          <Box title="Around the call">Knowledge Builder (setup), Strategist (before), Assist quick actions (during), Scribe, Psychologist, Risk Officer, Follow-up (after).</Box>
        </div>
        <div className="text-[16px] text-slate-500"><b className="text-ink">12 AI agents</b> on claude-sonnet-5-5 and claude-haiku through the SSI LiteLLM gateway · <b className="text-ink">4 deterministic tools</b> at zero token cost.</div>
      </div>
    ),
  },
  {
    body: (
      <div className="flex h-full flex-col gap-6">
        <Title kicker="Agents that check each other">The client asks for a price. Simple Call will not let you guess one.</Title>
        <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-5">
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-5">
            <div className="text-[14px] font-bold uppercase tracking-wider text-amber-800">Answer agent, first draft</div>
            <p className="mt-2 text-[20px] text-slate-800 line-through decoration-amber-500">&quot;Offline mode would be roughly $40,000 and 6 to 8 weeks, so we could fit it into this phase.&quot;</p>
            <div className="mt-3 text-[15px] text-amber-900"><b>FactCheck:</b> $40,000 not in knowledge · policy: pricing<br /><b>Verifier:</b> send back, quotes a price, commits scope</div>
          </div>
          <div className="text-[40px] font-black" style={{ color: RED }}>↺</div>
          <div className="rounded-lg border-2 border-rose-300 bg-white p-5">
            <div className="text-[14px] font-bold uppercase tracking-wider" style={{ color: RED }}>Revised, marked Defer</div>
            <p className="mt-2 text-[20px] text-slate-800">&quot;I don&apos;t want to guess at a number on the call. Usman, our Account Manager, will send a proper estimate within 3 business days; sizing is 6 to 8 weeks.&quot;</p>
          </div>
        </div>
        <Box title="And it catches what people miss">The promised go-live, 15 February 2027, is Presidents&apos; Day in the US. The US calendar tool flags it before the client does.</Box>
      </div>
    ),
  },
  {
    body: (
      <div className="grid h-full grid-cols-[1fr_1.5fr] gap-8">
        <div className="flex flex-col gap-5">
          <Title kicker="After the call">Minutes, client psychology, RAID and the recap email, in parallel</Title>
          <ul className="space-y-3 text-[18px] leading-snug text-slate-700">
            <li><b>Scribe</b>: summary, decisions, action items with owners.</li>
            <li><b>Psychologist</b>: how the client&apos;s mood moved and why, what landed, plan for the next call.</li>
            <li><b>Risk Officer</b>: RAID with RAG status (worst-of rule), mitigations, escalations.</li>
            <li><b>Follow-up</b>: the recap email, one click to open in Outlook.</li>
            <li>Plus every question the client asked and the answer suggested, at zero cost.</li>
          </ul>
        </div>
        <Shot src="/screenshots/report.png" alt="After-call report" />
      </div>
    ),
  },
  {
    body: (
      <div className="flex h-full flex-col gap-8">
        <Title kicker="Local-first">Built to be used with real clients</Title>
        <div className="grid grid-cols-2 gap-5">
          <Box title="Audio stays on the laptop">On-device speech in Chrome and Edge. No meeting bot joins, nothing for the client&apos;s IT to approve.</Box>
          <Box title="Both sides of the call">Shared Teams or Meet audio is captioned as the client, your mic as you, labelled automatically.</Box>
          <Box title="Data stays in the browser">Knowledge, transcripts and reports are never stored or logged on the server. Delete all with one click.</Box>
          <Box title="Private mode" dark>The same agents on a local model (Ollama) at 127.0.0.1: a real client call never leaves the machine. The public demo uses fictional data only.</Box>
        </div>
      </div>
    ),
  },
  {
    body: (
      <div className="flex h-full flex-col gap-7">
        <Title kicker="Safe and cost-efficient">Secured like a product, budgeted to survive judging</Title>
        <div className="grid grid-cols-2 gap-5">
          <Box title="Security">Key only in server environment variables · same-origin check · per-IP rate limits · input caps · prompt-injection fencing · strict CSP · secret scan in CI · 39 unit tests.</Box>
          <Box title="Cost">Alert rules and small-talk filter skip the model · cache makes repeat demos free · Haiku for frequent steps · tools in plain code · capped context and replies.</Box>
          <Box title="$25 key budget, protected">Spend cap read from the gateway itself, app-wide limit under 60 calls a minute (bursts queue, never fail), circuit breaker on budget errors.</Box>
          <Box title="Never a broken demo" dark>If live AI is unavailable, the app switches to a recorded real run automatically: zero tokens, same experience.</Box>
        </div>
      </div>
    ),
  },
  {
    body: (
      <div className="flex h-full flex-col gap-8">
        <Title kicker="Business value">Who uses it at SSI, and what changes</Title>
        <div className="grid grid-cols-2 gap-5">
          <Box title="Project managers and delivery leads">Confident, accurate answers to US clients; no unauthorised commitments; minutes and RAID done when the call ends.</Box>
          <Box title="Presales and account managers">Discovery and objection handling grounded in real capability; pricing always routed to the right owner.</Box>
          <Box title="Engineers in client interviews">STAR-style prompts from their own experience when a client interviews them for staff augmentation.</Box>
          <Box title="PMO and leadership" dark>Every call produces the same minutes, RAID, RAG and client-sentiment format: early warning on unhappy accounts.</Box>
        </div>
      </div>
    ),
  },
  {
    dark: true,
    body: (
      <div className="flex h-full flex-col justify-between">
        <div className="text-[18px] font-bold uppercase tracking-[0.2em]" style={{ color: "#ee969d" }}>Try it in 90 seconds</div>
        <ol className="space-y-5 text-[30px] leading-snug text-white">
          <li><b style={{ color: "#ee969d" }}>1.</b> Open the live app: the example project is already loaded.</li>
          <li><b style={{ color: "#ee969d" }}>2.</b> Click <b>Try the demo call</b>: a frustrated US client, live.</li>
          <li><b style={{ color: "#ee969d" }}>3.</b> Click <b>Verifier</b> on the Agent steps line to see a draft sent back.</li>
          <li><b style={{ color: "#ee969d" }}>4.</b> <b>End call → report</b>: four agents write the minutes, RAID and email.</li>
        </ol>
        <div className="flex items-end justify-between text-[18px] text-neutral-400">
          <span>Architecture, user guide and security notes: in the GitHub repo, docs/</span>
          <span className="text-[28px] font-black text-white">Thank you</span>
        </div>
      </div>
    ),
  },
];

export default function Present() {
  const [i, setI] = useState(0);
  const [scale, setScale] = useState(1);
  const go = useCallback((d: number) => setI((x) => Math.min(SLIDES.length - 1, Math.max(0, x + d))), []);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1280, window.innerHeight / 760));
    fit();
    window.addEventListener("resize", fit);
    const key = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) go(1);
      if (["ArrowLeft", "PageUp"].includes(e.key)) go(-1);
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", key);
    };
  }, [go]);

  const slide = (s: (typeof SLIDES)[number], n: number) => (
    <section key={n} className={`slide relative h-[720px] w-[1280px] overflow-hidden px-16 py-14 ${s.dark ? "bg-ink" : "bg-white"}`}>
      {!s.dark && <div className="absolute left-0 top-0 h-2 w-full" style={{ background: RED }} />}
      {s.body}
      <div className={`absolute bottom-5 right-8 text-[13px] ${s.dark ? "text-neutral-500" : "text-slate-400"}`}>Simple Call · {n + 1} / {SLIDES.length}</div>
    </section>
  );

  return (
    <>
      <style>{`
        @page { size: 1280px 720px; margin: 0; }
        @media print {
          body { background: white !important; }
          .screen { display: none !important; }
          .print { display: block !important; }
          .slide { break-after: page; }
        }
        .print { display: none; }
        .slide:last-child { break-after: auto; }
      `}</style>
      <div className="screen flex h-screen w-screen select-none items-center justify-center bg-neutral-900" onClick={() => go(1)}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "center" }} className="shadow-2xl">{slide(SLIDES[i], i)}</div>
        <div className="fixed bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-3 text-xs text-neutral-400" onClick={(e) => e.stopPropagation()}>
          <button className="rounded border border-neutral-700 px-2 py-1 hover:text-white" onClick={() => go(-1)}>←</button>
          <span>{i + 1} / {SLIDES.length} · arrow keys or click</span>
          <button className="rounded border border-neutral-700 px-2 py-1 hover:text-white" onClick={() => go(1)}>→</button>
          <a className="rounded border border-neutral-700 px-2 py-1 hover:text-white" href="/">Open the app</a>
        </div>
      </div>
      <div className="print">{SLIDES.map((s, n) => slide(s, n))}</div>
    </>
  );
}
