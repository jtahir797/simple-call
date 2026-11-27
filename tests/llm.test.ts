import { strict as assert } from "node:assert";
import { test } from "node:test";
import { completeJson, parseJson, retryMaxTokens, type Completion } from "../lib/llm";

const ok = (content: string, finish = "stop", outTok = 10): Completion => ({ content, finish, inTok: 100, outTok });
const cut = (content: string, outTok = 10): Completion => ok(content, "length", outTok);

test("retry max_tokens is x1.6, capped at 3500, and skipped when it cannot grow", () => {
  assert.equal(retryMaxTokens(1000), 1600);
  assert.equal(retryMaxTokens(2200), 3500);
  assert.equal(retryMaxTokens(3500), null);
});

test("a cut-off reply is retried once with a larger max_tokens and then succeeds", async () => {
  const seen: number[] = [];
  const usage: number[] = [];
  const replies = [cut('{"subject":"Recap","body":"Hi Megan,\\n\\nThank you for'), ok('{"subject":"Recap","body":"Hi Megan"}')];
  const r = await completeJson<{ subject: string }>(
    async (max) => {
      seen.push(max);
      return replies.shift()!;
    },
    800,
    (c) => void usage.push(c.outTok)
  );
  assert.deepEqual(seen, [800, 1280]);
  assert.equal(r.data.subject, "Recap");
  assert.equal(usage.length, 2, "spend is recorded for both attempts");
  assert.equal(r.tokens, 220, "tokens include both attempts");
});

test("throws only when the retry is also cut off, and never retries more than once", async () => {
  let calls = 0;
  await assert.rejects(
    completeJson(
      async () => {
        calls++;
        return cut('{"a":[1,2,');
      },
      800
    ),
    /did not return JSON/
  );
  assert.equal(calls, 2);
});

test("a complete reply is never retried, and a non-truncated parse error is not retried", async () => {
  let calls = 0;
  const good = await completeJson<{ a: number }>(async () => (calls++, ok('{"a":1}')), 800);
  assert.equal(good.data.a, 1);
  assert.equal(calls, 1);

  calls = 0;
  await assert.rejects(completeJson(async () => (calls++, ok("not json at all")), 800), /did not return JSON/);
  assert.equal(calls, 1);
});

test("a failed parse carries finishReason so it can be logged without the reply text", async () => {
  await assert.rejects(
    completeJson(async () => cut('{"a":[', 3500), 3500),
    (e: unknown) => (e as { finishReason?: string }).finishReason === "length"
  );
});

test("no retry when max_tokens is already at the cap", async () => {
  let calls = 0;
  await assert.rejects(completeJson(async () => (calls++, cut('{"a":[')), 3500), /did not return JSON/);
  assert.equal(calls, 1);
});

test("parseJson keeps the first complete object and ignores text or a repeat after it", () => {
  const one = '{"emotion": "frustrated", "cues": ["a {quoted} brace", "say \\"no\\""], "tip": "Acknowledge first"}';
  assert.deepEqual(parseJson(one), JSON.parse(one));
  assert.deepEqual(parseJson("Here is the read:\n" + one + "\n\nExplanation: the client {was} upset and"), JSON.parse(one));
  assert.deepEqual(parseJson(one + "\n" + one + "\n{\"emotion\": \"cut"), JSON.parse(one));
  assert.deepEqual(parseJson("```json\n" + one + "\n```\nmore"), JSON.parse(one));
  assert.throws(() => parseJson('{"emotion": "cut off'));
  assert.throws(() => parseJson("no json here"));
});

test("a complete object followed by rambling up to the limit is accepted without a retry", async () => {
  let calls = 0;
  const call = async (): Promise<Completion> => {
    calls++;
    return { content: '{"emotion":"calm"}\nThe client seems calm because ' + "and ".repeat(300), finish: "length", inTok: 10, outTok: 450 };
  };
  const r = await completeJson<{ emotion: string }>(call, 450);
  assert.equal(r.data.emotion, "calm");
  assert.equal(calls, 1);
});
