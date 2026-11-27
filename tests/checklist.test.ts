import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildPrompt, CHECKLIST, coverage, parseFilled } from "../lib/checklist";
import { DEMO_WORKSPACE, EMPTY_WORKSPACE } from "../lib/demo";

test("the example project covers the whole checklist", () => {
  const c = coverage(DEMO_WORKSPACE);
  assert.equal(c.score, CHECKLIST.length);
  assert.ok(c.essentialsDone);
});

test("an empty workspace is not ready", () => {
  const c = coverage(EMPTY_WORKSPACE);
  assert.equal(c.score, 0);
  assert.ok(!c.essentialsDone);
});

test("the prompt lists every topic and the exact output markers", () => {
  const p = buildPrompt();
  CHECKLIST.forEach((c) => assert.ok(p.includes(c.title), c.title));
  ["=== SIMPLE CALL ===", "--- PROFILE ---", "--- GUARDRAILS ---", "--- KNOWLEDGE ---", "=== END ==="].forEach((m) => assert.ok(p.includes(m)));
});

test("an AI's filled answer is parsed back into the right fields", () => {
  const filled = `Sure, here it is:
=== SIMPLE CALL ===
PROJECT: Atlas CRM
CLIENT CONTACT: Dana Fox, CTO
CLIENT COMPANY: Northpeak (fictional)
CLIENT LOCATION: Denver, Mountain Time
MY NAME: Ali|Ollie
--- PROFILE ---
Name: Ali. PM. Cannot quote prices.
--- GUARDRAILS ---
- Never quote prices.
--- KNOWLEDGE ---
## Milestones
- Beta 10 March 2027

## Current status
- 40% complete
=== END ===`;
  const ws = parseFilled(filled, EMPTY_WORKSPACE);
  assert.equal(ws.projectName, "Atlas CRM");
  assert.equal(ws.clientCompany, "Northpeak (fictional)");
  assert.equal(ws.myName, "Ali|Ollie");
  assert.match(ws.profile, /Cannot quote prices/);
  assert.equal(ws.guardrails, "- Never quote prices.");
  assert.match(ws.knowledge, /^## Milestones/);
  assert.ok(!ws.knowledge.includes("=== END"));
  assert.ok(coverage(ws).essentialsDone);
});

test("free text without markers goes into knowledge", () => {
  const ws = parseFilled("## Current status\n- fine", EMPTY_WORKSPACE);
  assert.equal(ws.knowledge, "## Current status\n- fine");
});
