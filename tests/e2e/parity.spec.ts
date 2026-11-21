// Runs the same meetings through the original single-file app (legacy/index.html) and the new
// build, with identical mocked providers and a frozen clock, and checks the results match.
// Delete this file and legacy/ once the new version is live and agreed.
import { expect, test, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { download, fillKeys, setSeatModel } from "../support/app";
import { mockProviders, type MockOptions } from "../support/mockProviders";

const LEGACY_HTML = fs.readFileSync("legacy/index.html", "utf8");
const FIXED = new Date("2026-11-21T10:15:00Z");
const SHOTS = path.join("test-results", "parity");

interface Scenario {
  name: string;
  reply?: MockOptions["reply"];
  setup: (page: Page) => Promise<void>;
  during?: (page: Page) => Promise<void>;
}

// Records the document definition handed to pdfmake, with functions (layouts, header, footer)
// replaced by what they return for a fixed set of inputs, so two definitions can be compared.
function capturePdfDefinition() {
  const samples: unknown[][] = [[0, 1], [1, 3], [2, 3], [{ headlineLevel: 1 }, [1, 2]], [{ headlineLevel: 1 }, [1, 2, 3, 4, 5, 6, 7]]];
  const norm = (v: any): any => {
    if (typeof v === "function") return { fn: samples.map((args) => { try { return norm(v(...args)); } catch { return "throws"; } }) };
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm(v[k])]));
    return v;
  };
  const w = window as any;
  let real: any;
  Object.defineProperty(w, "pdfMake", {
    configurable: true,
    get: () => real,
    set(v) {
      real = v;
      if (v && v.createPdf && !v.__captured) {
        const orig = v.createPdf;
        v.createPdf = function (def: unknown, ...rest: unknown[]) { w.__pdfDef = norm(def); return orig.call(this, def, ...rest); };
        v.__captured = true;
      }
    },
  });
}

async function run(browser: Browser, app: "legacy" | "new", s: Scenario) {
  // The policy is tested elsewhere; here it would block the capture script's access to pdfMake.
  const context = await browser.newContext({ baseURL: "http://localhost:4173", bypassCSP: true, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED);
  await page.addInitScript(capturePdfDefinition);
  const mock = await mockProviders(page, { reply: s.reply });
  if (app === "legacy") {
    await page.route("http://legacy.test/", (r) => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: LEGACY_HTML }));
    // The same pdfmake 0.2.7 files the original fetched from cdnjs.
    await page.route("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/*", (r) =>
      r.fulfill({ path: path.join("node_modules/pdfmake/build", path.basename(new URL(r.request().url()).pathname)) }));
  }
  await page.goto(app === "legacy" ? "http://legacy.test/" : "/");
  await s.setup(page);
  const cost = await page.locator("#cost").innerText();
  await page.click("#runBtn");
  if (s.during) await s.during(page);
  await expect(page.locator("#savers")).toBeVisible({ timeout: 30_000 });

  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${s.name}-${app}.png`), fullPage: true });
  // Not the whole column: the original sets `hidden` on the "meeting hasn't started" box, but its
  // CSS display rule overrides that, so the box stays visible under the transcript. The new app hides it.
  const meetingText = await page.locator("#roundsOut").innerText();
  const steps = await page.locator("#steps .step").evaluateAll((els) => els.map((e) => e.className + ": " + e.textContent));

  const json = await download(page, "jsonBtn");
  const pdf = await download(page, "pdfBtn");
  await expect(page.locator("#saveNote")).toHaveText("PDF downloaded.");
  const pdfDef = await page.evaluate(() => (window as any).__pdfDef);
  const bodies = mock.calls.map((c) => `${c.provider} ${c.rawBody}`).sort();
  mock.release();
  await context.close();
  return {
    cost, meetingText, steps, bodies, pdfDef,
    json: json.data.toString(), jsonName: json.download.suggestedFilename(),
    pdf: pdf.data, pdfName: pdf.download.suggestedFilename(),
  };
}

const scenarios: Scenario[] = [
  {
    name: "full-meeting",
    setup: async (page) => {
      await fillKeys(page, { openai: "sk-test", anthropic: "sk-ant-test" });
      await page.check("#role-sceptic");
      await page.selectOption("#rounds", "2");
      await setSeatModel(page, "micro", "anthropic|claude-sonnet-5-5");
      await setSeatModel(page, "sceptic", "openai|gpt-5");
      await setSeatModel(page, "chair", "anthropic|claude-haiku-5-5");
    },
  },
  {
    name: "own-case-with-a-failed-seat",
    reply: (c) => c.role === "rad" && c.round === "first" ? { kind: "error", status: 400, message: "Invalid prompt", type: "invalid_request_error" } : undefined,
    setup: async (page) => {
      await page.selectOption("#caseSel", "blank");
      await page.fill("#caseText", "ANONYMISED CASE\n\nAge / sex: 70 F\nQuestion for MDT: revise or not?");
      await fillKeys(page, { openai: "sk-test" });
      await page.uncheck("#role-anaes");
    },
  },
  {
    name: "stopped-in-discussion",
    reply: (c) => c.round === "discussion 1" ? { kind: "hold" } : undefined,
    setup: async (page) => { await fillKeys(page, { openai: "sk-test" }); },
    during: async (page) => {
      await expect(page.locator(".round").nth(1).locator(".tag")).toHaveText(Array(4).fill("thinking"));
      await page.click("#stopBtn");
    },
  },
];

for (const s of scenarios) {
  test(`matches the original app: ${s.name}`, async ({ browser }) => {
    const legacy = await run(browser, "legacy", s);
    const next = await run(browser, "new", s);

    expect(next.cost).toBe(legacy.cost);
    expect(next.bodies).toEqual(legacy.bodies);
    expect(next.meetingText).toBe(legacy.meetingText);
    expect(next.steps).toEqual(legacy.steps);
    expect(next.jsonName).toBe(legacy.jsonName);
    expect(next.json).toBe(legacy.json);
    expect(legacy.pdfDef).toBeTruthy();
    expect(next.pdfDef).toEqual(legacy.pdfDef);
    expect(next.pdfName).toBe(legacy.pdfName);
    expect(next.pdf.equals(legacy.pdf), "PDF files are byte-identical").toBe(true);
  });
}
