import { strict as assert } from "node:assert";
import { test } from "node:test";
import { extractDates, extractNumbers, factCheck, isSmallTalk, policyScan, usCalendar } from "../lib/tools";

const KB = "Go-live 15 February 2027. Buffer reduced from 3 weeks to 1 week. Sprint 6 demo moved to 4 December 2026. UAT 5 January to 23 January 2027. 58% of hours consumed.";

test("extracts dates in several formats", () => {
  const d = extractDates("Feb 15, December 4th, 23 January 2027 and 2027-01-12");
  assert.deepEqual(d.map((x) => `${x.month}-${x.day}`), ["2-15", "12-4", "1-23", "1-12"]);
});

test("number words are normalised", () => {
  assert.ok(extractNumbers("buffer went from three weeks to one").includes("3"));
});

test("grounded answer passes the fact check", () => {
  const r = factCheck("February 15th is still the plan; buffer is down from three weeks to one. Demo on December 4th.", KB);
  assert.equal(r.grounded, r.total);
  assert.ok(r.total >= 3);
});

test("invented date and number are caught", () => {
  const r = factCheck("We will finish by March 3rd with 12 developers.", KB);
  assert.equal(r.grounded, 0);
  assert.equal(r.total, 2);
});

test("policy scan flags pricing and certifications", () => {
  assert.deepEqual(policyScan("Offline mode would cost about $40,000"), ["pricing"]);
  assert.ok(policyScan("Yes, we are SOC 2 certified").includes("certification"));
  assert.deepEqual(policyScan("Usman will send the estimate within three business days."), []);
});

test("US calendar flags Presidents' Day go-live and weekend dates", () => {
  const flags = usCalendar("Go-live is Feb 15 and UAT ends January 23", KB, new Date("2026-11-26T00:00:00Z"));
  assert.equal(flags.length, 2);
  assert.match(flags[0].issue, /Presidents/);
  assert.equal(flags[0].iso, "2027-02-15");
  assert.match(flags[1].issue, /Saturday/);
});

test("observed US holidays never fall on a weekend", () => {
  for (const iso of ["2026-07-03", "2027-06-18", "2027-07-05", "2027-12-24", "2026-11-26", "2027-02-15"]) {
    const dow = new Date(iso + "T00:00:00Z").getUTCDay();
    assert.ok(dow > 0 && dow < 6, iso);
    const [y, m, d] = iso.split("-").map(Number);
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    assert.equal(usCalendar(`${months[m - 1]} ${d}, ${y}`).length, 1, iso);
  }
});

test("small talk skips the model, questions never do", () => {
  assert.ok(isSmallTalk("Sounds good. Thanks, Sara."));
  assert.ok(!isSmallTalk("Okay, so is February 15th still real?"));
  assert.ok(!isSmallTalk("Could we add a couple more developers to get some of that buffer back?"));
});

test("day numbers inside dates are not double counted as facts", () => {
  const r = factCheck("Go-live 15 Feb 2027, same as February 15th. Demo 4 Dec.", KB);
  // two distinct dates, no stray numbers
  assert.equal(r.total, 2);
  assert.equal(r.grounded, 2);
});

import { alertRule } from "../lib/tools";

test("alert rules: name, question, request, topic, or skip", () => {
  assert.equal(alertRule("Sarah, quick one for you", "Sara|Sarah"), "your name");
  assert.equal(alertRule("Is the date real?"), "question");
  assert.equal(alertRule("My leadership is asking me why it slipped."), "request or concern");
  assert.equal(alertRule("Let's get the revised plan by Friday."), "request or concern");
  assert.equal(alertRule("The UAT window looks tight to me.", "", "UAT, go-live"), "project topic");
  assert.equal(alertRule("We had a long week here in Austin."), null);
  assert.equal(alertRule("Samsara integration went fine for us.", "Sara"), null); // whole words only
});
