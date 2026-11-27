/**
 * Regenerates the README screenshots and the PDF of the in-app presentation from the recorded demo run.
 *
 *   npx playwright install chromium     (once)
 *   npm run dev                          (terminal 1, with public/demo-recording.json present: see npm run record)
 *   npm run capture                      (terminal 2)  ->  public/screenshots/*.png and docs/Simple-Call-Presentation.pdf
 */
import { chromium, type Page } from "playwright";

const BASE = process.env.SIMPLECALL_URL || "http://localhost:3000";
const OUT = "public/screenshots";

async function shot(p: Page, name: string, full = false) {
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("saved", `${OUT}/${name}.png`);
}

async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await p.goto(BASE);
  await p.waitForSelector("text=Knowledge score");
  await shot(p, "knowledge");

  await p.click("nav >> text=Live call");
  await p.click("text=Prepare me for this call");
  await p.waitForSelector("text=Likely hard questions", { timeout: 90_000 });
  await shot(p, "pre-call-brief");

  await p.setViewportSize({ width: 1440, height: 1320 });
  await p.click("text=▶ Start");
  if (!(await p.isVisible("text=Instant replay"))) throw new Error("No recorded run found. Run npm run record first.");
  await p.click("text=Instant replay");
  await p.waitForSelector("text=commit on the call", { timeout: 180_000 });
  await p.waitForTimeout(1200);
  await shot(p, "live-call");
  await p.locator("[data-shot=answer]").screenshot({ path: `${OUT}/live-answer.png` });
  console.log("saved", `${OUT}/live-answer.png`);
  await p.click("[data-shot=steps] >> button:has-text('Verifier')");
  await p.waitForTimeout(400);
  await p.locator("[data-shot=steps]").screenshot({ path: `${OUT}/agent-xray.png` });
  console.log("saved", `${OUT}/agent-xray.png`);
  await p.click("text=close");
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.keyboard.press("v");
  await shot(p, "beside-the-call");
  await p.keyboard.press("v");
  await p.waitForFunction(() => !document.body.innerText.includes("Recorded run playing"), null, { timeout: 240_000 });
  await p.click("text=End call → report");
  await p.waitForSelector("text=Questions you were asked", { timeout: 60_000 }).catch(async (e) => { await p.screenshot({ path: "/tmp/capfail.png" }); throw e; });
  await p.waitForSelector("button:has-text('Approve & publish'):not([disabled])", { timeout: 120_000 });
  await p.waitForTimeout(800);
  await shot(p, "report");

  const d = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await d.goto(`${BASE}/present`);
  await d.waitForTimeout(1500);
  await d.emulateMedia({ media: "print" });
  await d.pdf({ path: "docs/Simple-Call-Presentation.pdf", width: "1280px", height: "720px", printBackground: true });
  console.log("saved docs/Simple-Call-Presentation.pdf");
  await b.close();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
