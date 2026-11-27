import { strict as assert } from "node:assert";
import { test } from "node:test";
import { assertAccess, assertSameOrigin, cleanLines, cleanWorkspace, HttpError, publicError, rateLimit } from "../lib/guard";

const req = (headers: Record<string, string>) => new Request("https://app.example/api/orchestrate", { method: "POST", headers });
const env = process.env as Record<string, string | undefined>;

test("oversized knowledge is rejected", () => {
  assert.throws(() => cleanWorkspace({ knowledge: "x".repeat(60_001) }), (e: unknown) => e instanceof HttpError && e.status === 413);
});

test("empty knowledge is rejected, fields are truncated", () => {
  assert.throws(() => cleanWorkspace({ knowledge: "  " }), HttpError);
  const ws = cleanWorkspace({ knowledge: "## A\nb", projectName: "p".repeat(500) });
  assert.equal(ws.projectName.length, 200);
});

test("transcript lines are capped and sanitised", () => {
  const lines = cleanLines(Array.from({ length: 100 }, (_, i) => ({ id: String(i), speaker: "hacker", text: "y".repeat(5000) })), 40);
  assert.equal(lines.length, 40);
  assert.equal(lines[0].speaker, "client");
  assert.equal(lines[0].text.length, 1200);
});

test("cross-site calls are refused in production", () => {
  const prev = env.NODE_ENV;
  env.NODE_ENV = "production";
  try {
    assert.throws(() => assertSameOrigin(req({ origin: "https://evil.example", host: "app.example" })), HttpError);
    assert.throws(() => assertSameOrigin(req({ host: "app.example" })), HttpError);
    assert.doesNotThrow(() => assertSameOrigin(req({ origin: "https://app.example", host: "app.example" })));
  } finally {
    env.NODE_ENV = prev;
  }
});

test("access code is enforced only when configured", () => {
  delete env.ACCESS_CODE;
  assert.doesNotThrow(() => assertAccess(req({})));
  env.ACCESS_CODE = "s3cret";
  assert.throws(() => assertAccess(req({ "x-access-code": "wrong!" })), HttpError);
  assert.doesNotThrow(() => assertAccess(req({ "x-access-code": "s3cret" })));
  delete env.ACCESS_CODE;
});

test("rate limiter blocks after the limit", async () => {
  const r = req({ "x-real-ip": "203.0.113.9" });
  for (let i = 0; i < 3; i++) await rateLimit(r, "t", 3, 60);
  await assert.rejects(rateLimit(r, "t", 3, 60), (e: unknown) => e instanceof HttpError && e.status === 429);
});

test("gateway errors never leak details", () => {
  assert.equal(publicError({ status: 401, message: "Invalid key sk-abc at https://gw.internal" }), "Model gateway rejected the key");
  assert.equal(publicError(new Error("connect ECONNREFUSED 10.0.0.5")), "Agent failed");
});
