import { budgetStatus } from "@/lib/budget";
import { isConfigured, isPrivateModel, modelFor } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public status: no secrets, no gateway address. */
export async function GET() {
  const b = await budgetStatus();
  const on = isConfigured() && process.env.SIMPLECALL_AI !== "off";
  return Response.json(
    {
      configured: on,
      model: on ? modelFor("main") : null,
      fastModel: on ? modelFor("fast") : null,
      accessCode: Boolean(process.env.ACCESS_CODE),
      privateModel: on && isPrivateModel(),
      budget: { usedPct: b.usedPct, exhausted: b.exhausted, source: b.source },
      store: b.backend,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
