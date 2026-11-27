import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DEMO_WORKSPACE } from "../lib/demo";
import { chunkKnowledge, retrieve, retrieveMulti } from "../lib/retrieve";

test("knowledge is split by headings", () => {
  const c = chunkKnowledge(DEMO_WORKSPACE.knowledge);
  assert.ok(c.length >= 10);
  assert.ok(c.some((x) => x.title.startsWith("Change requests")));
});

test("offline mode question finds the change request section", () => {
  const top = retrieve(DEMO_WORKSPACE.knowledge, "Can you add offline mode into this phase and what would it cost", 3);
  assert.ok(top.some((c) => c.title.startsWith("Change requests")));
});

test("planner queries widen recall", () => {
  const r = retrieveMulti(DEMO_WORKSPACE.knowledge, ["map freezes 600 trucks", "UAT dates"], 6);
  const titles = r.map((c) => c.title).join(" | ");
  assert.match(titles, /Known high-priority bugs/);
  assert.match(titles, /Milestones/);
});
