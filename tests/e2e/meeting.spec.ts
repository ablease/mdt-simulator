import { expect, test } from "@playwright/test";
import { cardTags, download, fillKeys, runAndWait, setSeatModel, watchErrors, watchRequests } from "../support/app";
import { mockProviders } from "../support/mockProviders";

test("runs a full meeting with consultants on both providers", async ({ page }) => {
  const hosts = watchRequests(page);
  const errors = watchErrors(page);
  const mock = await mockProviders(page);
  await page.goto("/");
  await fillKeys(page, { openai: "sk-test-openai", anthropic: "sk-ant-test" });
  await setSeatModel(page, "micro", "anthropic|claude-sonnet-5-5");
  await setSeatModel(page, "chair", "anthropic|claude-haiku-5-5");
  await expect(page.locator("#cost")).toHaveText("4 consultants × 2 rounds + chair = 9 AI calls on OpenAI and Anthropic");

  await runAndWait(page);

  await expect(cardTags(page)).toHaveCount(9);
  await expect(cardTags(page)).toHaveText(Array(9).fill("done"));
  await expect(page.locator(".round-head h3")).toHaveText(["First opinions", "Discussion 1", "Chair's decision"]);
  await expect(page.locator("#steps .step.done")).toHaveCount(3);
  await expect(page.locator("#runBtn")).toHaveText("Hold the meeting again");

  // Who was asked what, on which provider.
  const byProvider = (p: string) => mock.calls.filter((c) => c.provider === p).map((c) => `${c.round}:${c.role}`).sort();
  expect(byProvider("openai")).toEqual(["discussion 1:anaes", "discussion 1:rad", "discussion 1:surg", "first:anaes", "first:rad", "first:surg"]);
  expect(byProvider("anthropic")).toEqual(["chair:chair", "discussion 1:micro", "first:micro"]);

  const anth = mock.calls.find((c) => c.provider === "anthropic")!;
  expect(anth.headers["x-api-key"]).toBe("sk-ant-test");
  expect(anth.headers["anthropic-version"]).toBe("2023-06-01");
  expect(anth.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  expect(anth.body).toMatchObject({ model: "claude-sonnet-5-5", max_tokens: 2000, stream: true });
  const oai = mock.calls.find((c) => c.provider === "openai")!;
  expect(oai.headers["authorization"]).toBe("Bearer sk-test-openai");
  expect(oai.body).toMatchObject({ model: "gpt-5-mini", stream: true });

  // Each discussion prompt carries the other seats' first opinions but not the seat's own.
  const surgDiscussion = mock.calls.find((c) => c.round === "discussion 1" && c.role === "surg")!.prompt;
  expect(surgDiscussion).toContain("### Consultant microbiologist\n## Key concerns");
  expect(surgDiscussion).not.toContain("### Revision arthroplasty surgeon");
  const chairPrompt = mock.calls.find((c) => c.role === "chair")!.prompt;
  expect(chairPrompt).toContain("=== First opinions ===");
  expect(chairPrompt).toContain("=== Discussion 1 ===");

  // The markdown-lite renderer turns headings and bold into elements, not raw text.
  const chair = page.locator(".card.chair");
  await expect(chair.locator("h4").first()).toHaveText("MDT decision");
  await expect(chair.locator("strong").first()).toHaveText("Two-stage revision");

  // Privacy: nothing but this site and the two providers was contacted, and the security policy wasn't tripped.
  expect([...hosts].sort()).toEqual(["api.anthropic.com", "api.openai.com", "localhost:4173"]);
  expect(errors).toEqual([]);
});

test("stops a meeting midway", async ({ page }) => {
  const mock = await mockProviders(page, { reply: (c) => c.round === "discussion 1" ? { kind: "hold" } : undefined });
  await page.goto("/");
  await fillKeys(page, { openai: "sk-test" });
  await page.click("#runBtn");
  await expect(page.locator(".round-head h3")).toHaveText(["First opinions", "Discussion 1"]);
  await expect(page.locator(".round").nth(1).locator(".tag")).toHaveText(Array(4).fill("thinking"));

  await page.click("#stopBtn");

  await expect(page.locator("#savers")).toBeVisible();
  await expect(page.locator(".round").nth(1).locator(".tag")).toHaveText(Array(4).fill("stopped"));
  await expect(page.locator(".round").nth(1).locator(".err").first()).toHaveText("Stopped.");
  await expect(page.locator(".round-head h3")).toHaveText(["First opinions", "Discussion 1"]);
  await expect(page.locator("#steps .step.done, #steps .step.on")).toHaveCount(0);
  await expect(page.locator("#stopBtn")).toHaveCount(0);
  expect(mock.calls.some((c) => c.role === "chair")).toBe(false);

  const { data } = await download(page, "jsonBtn");
  const rec = JSON.parse(data.toString());
  expect(rec.stoppedEarly).toBe(true);
  expect(rec.rounds.map((r: { name: string }) => r.name)).toEqual(["First opinions", "Discussion 1"]);
  expect(rec.rounds[1].entries.map((e: { error: string }) => e.error)).toEqual(Array(4).fill("stopped"));
  mock.release();
});

test("a rejected key stops the meeting with a plain-English message", async ({ page }) => {
  await mockProviders(page, { reply: () => ({ kind: "error", status: 401, message: "Incorrect API key provided", type: "invalid_request_error" }) });
  await page.goto("/");
  await fillKeys(page, { openai: "sk-wrong" });
  await runAndWait(page);

  await expect(page.locator(".round-head h3")).toHaveText(["First opinions"]);
  // The first 401 cancels calls still in flight, so the other cards end "failed" or "stopped" depending on timing.
  await expect(cardTags(page)).toHaveText(Array(4).fill(/^(failed|stopped)$/));
  await expect(page.locator(".card .err", { hasText: "OpenAI rejected the API key. Check you pasted the whole key into the right box." }).first()).toBeVisible();
  const { data } = await download(page, "jsonBtn");
  const rec = JSON.parse(data.toString());
  expect(rec.stoppedEarly).toBe(true);
  expect(rec.rounds[0].entries.map((e: { error: string }) => e.error)).toContain("401: Incorrect API key provided");
});

test("retries after a rate limit and carries on", async ({ page }) => {
  await page.clock.install();
  let limited = false;
  const mock = await mockProviders(page, {
    reply: (c) => {
      if (c.role === "surg" && c.round === "first" && !limited) {
        limited = true;
        return { kind: "error", status: 429, message: "Rate limit reached", type: "rate_limit_error" };
      }
    },
  });
  await page.goto("/");
  await fillKeys(page, { openai: "sk-test" });
  await page.click("#runBtn");

  const surgeon = page.locator(".round").first().locator(".card").first();
  await expect(surgeon.locator(".tag")).toHaveText("retrying");
  await expect(surgeon.locator(".body")).toHaveText("OpenAI is busy, retrying…");
  await page.clock.fastForward(4000);

  await expect(page.locator("#savers")).toBeVisible();
  await expect(cardTags(page)).toHaveText(Array(9).fill("done"));
  expect(mock.calls.filter((c) => c.role === "surg" && c.round === "first")).toHaveLength(2);
});

test("downloads the meeting as JSON and as a PDF", async ({ page }) => {
  const errors = watchErrors(page);
  await mockProviders(page);
  await page.goto("/");
  await fillKeys(page, { openai: "sk-test" });
  await runAndWait(page);

  const json = await download(page, "jsonBtn");
  expect(json.download.suggestedFilename()).toMatch(/^mdt-pji-hip-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/);
  const rec = JSON.parse(json.data.toString());
  expect(rec).toMatchObject({ tool: "Revision MDT Simulator (prototype)", note: "Not clinical advice.", caseId: "pji-hip", caseTitle: "Painful hip, possible infection", discussionRounds: 1, stoppedEarly: false });
  expect(rec.seats.map((s: { roleId: string }) => s.roleId)).toEqual(["surg", "micro", "rad", "anaes", "chair"]);
  expect(rec.rounds.map((r: { name: string }) => r.name)).toEqual(["First opinions", "Discussion 1", "Chair's decision"]);
  for (const r of rec.rounds) for (const e of r.entries) {
    expect(e.response).toBeTruthy();
    expect(e.prompt).toContain("FICTIONAL TEST CASE 1");
  }

  const pdf = await download(page, "pdfBtn");
  expect(pdf.download.suggestedFilename()).toMatch(/^mdt-pji-hip-.*\.pdf$/);
  expect(pdf.data.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.data.length).toBeGreaterThan(20_000);
  await expect(page.locator("#saveNote")).toHaveText("PDF downloaded.");
  expect(errors).toEqual([]);
});

test("the Check button lists the models a key can use", async ({ page }) => {
  await mockProviders(page);
  await page.goto("/");
  await fillKeys(page, { openai: "sk-test" });
  await page.locator(".keyblock").first().getByRole("button", { name: "Check" }).click();
  await expect(page.locator(".keyblock").first().locator(".connstate")).toHaveText("Key works. 3 OpenAI models available to you, now in the model menus.");
  // Speech and embedding models are filtered out.
  await expect(page.locator("#defaultModel optgroup[label='OpenAI'] option")).toHaveText(["gpt-4.1", "gpt-5", "gpt-5-mini"]);
});
