import { strict as assert } from "node:assert";
import { test } from "node:test";
import { assertBudget, budgetStatus, costUsd, isFatalGatewayError, pauseAi, recordSpend, takeModelSlot } from "../lib/budget";
import { HttpError } from "../lib/guard";

const env = process.env as Record<string, string | undefined>;
delete env.LITELLM_BASE_URL; // no gateway: spend comes from the local estimate

test("cost estimate uses per-tier prices", () => {
  assert.equal(costUsd("main", 1_000_000, 0), 3);
  assert.equal(costUsd("fast", 0, 1_000_000), 5);
});

test("budget and key errors are recognised as fatal", () => {
  const http = (status: number, msg: string) => Object.assign(new Error(msg), { status });
  assert.equal(isFatalGatewayError(http(400, "Budget has been exceeded! Current cost: 25.1")), "budget reached");
  assert.equal(isFatalGatewayError(http(429, "ExceededBudget: key over max_budget")), "budget reached");
  assert.equal(isFatalGatewayError(http(401, "bad key")), "key rejected");
  assert.equal(isFatalGatewayError(http(403, "forbidden")), "key rejected");
  assert.equal(isFatalGatewayError(new Error("timeout")), null);
});

test("local errors that merely mention budget are never fatal", () => {
  // A parse error carrying report text such as "budget" must not trigger the budget circuit breaker.
  const parse = new Error('parse failed: Expected \',\' | raw="the budget has been exceeded on scope, budget exceeded risk"');
  assert.equal(isFatalGatewayError(parse), null);
  // A non-budget HTTP error mentioning budget in passing, or a budget message with the wrong status, is not fatal either.
  assert.equal(isFatalGatewayError(Object.assign(new Error("Budget has been exceeded"), { status: 500 })), null);
  assert.equal(isFatalGatewayError(Object.assign(new Error("server error"), { status: 500 })), null);
  assert.equal(isFatalGatewayError("budget"), null);
});

test("spend cap stops live AI before the key's $25 runs out", async () => {
  env.SPEND_CAP_USD = "1";
  await assertBudget();
  await recordSpend(1.2);
  await assert.rejects(assertBudget(), (e: unknown) => e instanceof HttpError && e.code === "budget");
  assert.equal((await budgetStatus()).exhausted, true);
  env.SPEND_CAP_USD = "1000";
  await assertBudget();
});

test("circuit breaker pauses live AI after a gateway budget error", async () => {
  await pauseAi("budget reached", 1);
  await assert.rejects(assertBudget(), (e: unknown) => e instanceof HttpError && /paused/.test(e.message));
});

test("app-wide model calls stay under the per-minute limit", async () => {
  env.MODEL_RPM = "2";
  env.MODEL_SLOT_WAIT_MS = "0";
  await takeModelSlot();
  await takeModelSlot();
  await assert.rejects(takeModelSlot(), (e: unknown) => e instanceof HttpError && e.code === "busy");
  delete env.MODEL_RPM;
  delete env.MODEL_SLOT_WAIT_MS;
});
