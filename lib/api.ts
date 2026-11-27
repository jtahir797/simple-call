import "server-only";
import { assertBudget } from "./budget";
import { assertAccess, assertSameOrigin, HttpError, rateLimit, readJson } from "./guard";
import { isConfigured } from "./llm";

/** Every AI route runs the same gate: origin, access code, rate limit, budget, config, body size. */
export async function gate(req: Request, route: string, perMinute: number): Promise<unknown> {
  assertSameOrigin(req);
  assertAccess(req);
  await rateLimit(req, route, perMinute, 60);
  if (process.env.SIMPLECALL_AI === "off") throw new HttpError(503, "ai_off", "Live AI is switched off. Use Instant replay.");
  if (!isConfigured()) throw new HttpError(503, "not_configured", "Model gateway not configured. Add LITELLM_* env vars.");
  await assertBudget();
  return readJson(req);
}
