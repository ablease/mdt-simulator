import { expect, test } from "@playwright/test";
import { costLine, fillKeys, go, runAndWait, startMeeting } from "../support/app";
import { mockProviders } from "../support/mockProviders";

const BAR = "Research tool. Simulated, AI-generated output. Not clinical advice. Fictional or fully anonymised cases only.";

test("every page carries the research-only notice", async ({ page }) => {
  await mockProviders(page);
  await page.goto("/");
  await fillKeys(page, { openai: "sk-test" });
  for (const place of ["case", "images", "panel", "review", "history", "settings"] as const) {
    await go(page, place);
    await expect(page.getByRole("note")).toHaveText(BAR);
  }
  await runAndWait(page);
  await expect(page.getByRole("note")).toHaveText(BAR);
  await expect(page.locator(".page-head .lede")).toHaveText("A simulated MDT meeting. Everything below is AI-generated and is not clinical advice.");
});

test("the new meeting steps work from the keyboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "1 Case" })).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("link", { name: "New meeting" })).toHaveAttribute("aria-current", "page");

  // Each Next link moves on a step and puts focus back at the top of the page.
  for (const [next, step] of [["Next: Images", "2 Images optional"], ["Next: Panel and models", "3 Panel and models"], ["Next: Review and run", "4 Review and run"]]) {
    await page.getByRole("link", { name: next }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: step })).toHaveAttribute("aria-current", "step");
    await expect(page.getByRole("heading", { level: 1, name: "New meeting" })).toBeFocused();
  }
  await expect(page.getByRole("link", { name: /^Next/ })).toHaveCount(0);
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(/#\/new\/panel$/);

  // The browser's Back button goes back a step, and nothing typed is lost on the way.
  await go(page, "case");
  await page.fill("#caseText", "ANONYMISED TEST CASE");
  await go(page, "settings");
  await page.goBack();
  await expect(page.locator("#caseText")).toHaveValue("ANONYMISED TEST CASE");

  // An address the app doesn't know opens the first step.
  await page.goto("/#/nowhere");
  await expect(page.getByRole("link", { name: "1 Case" })).toHaveAttribute("aria-current", "step");
});

test("the skip link jumps past the navigation", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await expect(page).toHaveURL(/\/$/);
});

test("the review step says what's missing and links to where to fix it", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".note")).toHaveText("Before your first meeting, add an API key in Settings.");
  await expect(await costLine(page)).toHaveText("Add your OpenAI API key, or switch those seats to a provider you have a key for.");
  await expect(page.locator("#runBtn")).toBeDisabled();
  await page.getByRole("link", { name: "Add a key in Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeFocused();
  await page.fill("#key-openai", "sk-test");

  await go(page, "panel");
  for (const id of ["surg", "micro", "rad"]) await page.uncheck("#role-" + id);
  await expect(await costLine(page)).toHaveText("Choose at least two consultants.");
  await page.getByRole("link", { name: "Choose consultants" }).click();
  await page.check("#role-surg");

  await go(page, "case");
  await page.fill("#caseText", "  ");
  await expect(await costLine(page)).toHaveText("The case is empty. Choose a test case, or write your own.");
  await page.getByRole("link", { name: "Go to the case" }).click();
  await page.selectOption("#caseSel", "dislocate");

  await expect(await costLine(page)).toHaveText("2 consultants × 2 rounds + chair = 5 AI calls on OpenAI");
  const rows = page.locator(".seat-table tbody tr");
  await expect(rows.locator("th")).toHaveText(["Revision arthroplasty surgeon", "Peri-operative physician / anaesthetist", "MDT chair"]);
  await expect(rows.locator("td")).toHaveText(Array(3).fill("OpenAI · gpt-5-mini"));
  await expect(page.locator(".summary dd").first()).toHaveText("Repeated hip dislocations Change");
  await expect(page.locator("#runBtn")).toBeEnabled();
});

test("the meeting carries on in the background and keeps its own copy of the case", async ({ page }) => {
  const mock = await mockProviders(page, { reply: (c) => c.round === "discussion 1" ? { kind: "hold" } : undefined });
  await page.goto("/");
  await fillKeys(page, { openai: "sk-test" });
  await startMeeting(page);
  await expect(page).toHaveURL(/#\/meeting$/);
  await expect(page.getByRole("heading", { level: 1, name: "Painful hip, possible infection" })).toBeFocused();
  const session = page.locator(".session-item");
  await expect(session).toContainText("In progress");

  // Starting to set up the next meeting doesn't disturb this one or its record of the case.
  await go(page, "case");
  await page.selectOption("#caseSel", "stiff-tkr");
  await go(page, "review");
  await expect(page.locator("#runBtn")).toHaveText("Meeting in progress…");
  await expect(page.locator("#runBtn")).toBeDisabled();
  await page.getByRole("link", { name: "Go to the meeting in progress" }).click();
  const details = page.getByRole("complementary", { name: "Case and panel" });
  await expect(details.locator(".case-copy")).toContainText("FICTIONAL TEST CASE 1");
  await expect(details.locator(".seat-list b")).toHaveText(["Revision arthroplasty surgeon", "Consultant microbiologist", "Musculoskeletal radiologist", "Peri-operative physician / anaesthetist", "MDT chair"]);

  await page.click("#stopBtn");
  await expect(page.locator("#savers")).toBeVisible();
  mock.release();
  // Some seats had answered, so it's saved, and the page becomes the saved copy.
  await expect(page).toHaveURL(/#\/meeting\/[\w-]+$/);
  await expect(session).toHaveCount(1);
  await expect(session).not.toContainText("In progress");
  await expect(details.locator(".case-copy")).toContainText("FICTIONAL TEST CASE 1");

  // The case and panel can be hidden, and the choice is remembered.
  const toggle = page.getByRole("button", { name: "Hide case and panel" });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(details).toBeHidden();
  await expect(page.getByRole("button", { name: "Show case and panel" })).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => localStorage.getItem("mdt.ui.details"))).toBe("closed");
});

test("nothing spills sideways on a tablet or phone", async ({ page }) => {
  await mockProviders(page);
  await page.goto("/");
  await fillKeys(page, { openai: "sk-test" });
  await runAndWait(page);
  for (const width of [1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const place of ["meeting", "case", "panel", "review", "settings"] as const) {
      await go(page, place);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${place} at ${width}px`).toBeLessThanOrEqual(width);
    }
  }
});
