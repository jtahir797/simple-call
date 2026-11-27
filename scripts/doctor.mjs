// Diagnose LiteLLM gateway problems. Reads .env.local itself and never prints the key
// (or the gateway address). Run: node scripts/doctor.mjs
import { readFileSync } from "node:fs";

function loadEnv(path) {
  const env = {};
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    console.log("Cannot read .env.local (does it exist in this folder?)");
    process.exit(1);
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

const env = loadEnv(".env.local");
const baseRaw = env.LITELLM_BASE_URL || "";
const key = env.LITELLM_API_KEY || "";
const model = env.LITELLM_MODEL || "";
const fast = env.LITELLM_FAST_MODEL || "";

// Redact the key, and the gateway address too, from anything we print.
const secrets = [key, baseRaw, baseRaw.replace(/\/+$/, "")].filter((s) => s && s.length > 3);
const mask = (s) => {
  let out = String(s);
  for (const sec of secrets) out = out.split(sec).join("***");
  return out;
};
const say = (...a) => console.log(mask(a.join(" ")));

const base = baseRaw.replace(/\/+$/, "");
const root = base.replace(/\/v1$/, "");

say("== Config shape (no values shown) ==");
say("LITELLM_BASE_URL set:", !!baseRaw, "| starts with https://:", /^https:\/\//.test(baseRaw), "| ends with /v1:", /\/v1\/?$/.test(baseRaw), "| trailing slash:", /\/$/.test(baseRaw));
say("LITELLM_API_KEY set:", !!key, "| length:", key.length, "| starts with sk-:", key.startsWith("sk-"), "| has spaces/quotes:", /[\s"']/.test(key));
say("LITELLM_MODEL:", model || "(empty)", "| LITELLM_FAST_MODEL:", fast || "(empty)");
if (!base || !key) {
  say("Base URL or key is missing, stopping.");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function call(label, url, init) {
  try {
    const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {}
    return { res, json, text };
  } catch (e) {
    say(`${label}: network error:`, e?.cause?.code || e?.code || e?.name || "unknown", "-", e?.message || "");
    return null;
  }
}

const errMsg = (r) => r.json?.error?.message || r.json?.detail?.error || r.json?.detail || r.text.slice(0, 300);

// a. models
say("\n== a. GET /models ==");
const a = await call("models", `${base}/models`, { method: "GET" });
if (a) {
  say("HTTP", a.res.status);
  if (a.res.ok) {
    const ids = (a.json?.data || []).map((m) => m.id);
    say("models:", ids.join(", ") || "(none)");
    if (model) say(`LITELLM_MODEL "${model}" in list:`, ids.includes(model));
    if (fast) say(`LITELLM_FAST_MODEL "${fast}" in list:`, ids.includes(fast));
  } else say("error:", errMsg(a));
}

// b. key info
say("\n== b. GET /key/info ==");
const b = await call("key/info", `${root}/key/info`, { method: "GET" });
if (b) {
  say("HTTP", b.res.status);
  if (b.res.ok) {
    const info = b.json?.info || {};
    say("spend:", info.spend, "| max_budget:", info.max_budget);
    say("models:", Array.isArray(info.models) ? (info.models.join(", ") || "(all)") : String(info.models));
  } else say("error:", errMsg(b));
}

// c. chat completions
for (const [label, m] of [["main", model], ["fast", fast]]) {
  say(`\n== c. POST /chat/completions (${label}: ${m || "(empty)"}) ==`);
  if (!m) {
    say("skipped, model name is empty");
    continue;
  }
  const c = await call("chat", `${base}/chat/completions`, {
    method: "POST",
    body: JSON.stringify({ model: m, max_tokens: 5, messages: [{ role: "user", content: "Say OK" }] }),
  });
  if (c) {
    say("HTTP", c.res.status);
    if (c.res.ok) say("reply:", c.json?.choices?.[0]?.message?.content ?? "(empty)");
    else say("error:", errMsg(c));
  }
}
