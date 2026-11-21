// Accessibility: automated checks (axe, WCAG 2.2 A and AA) on every page and state in both themes,
// then keyboard use: every control reached by Tab shows where focus is, and a whole meeting can be
// run, retried and tidied up without a mouse.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { fillKeys, go, startMeeting } from "../support/app";
import { makeImage } from "../support/images";
import { mockProviders } from "../support/mockProviders";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function audit(page: Page, where: string): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return violations.map((v) => `${where}: ${v.id} (${v.impact}) ${v.help} at ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`every page passes automated accessibility checks in the ${colorScheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    let microFailed = false;
    const mock = await mockProviders(page, {
      reply: (c) => {
        if (c.round === "first" && c.role === "micro" && !microFailed) { microFailed = true; return { kind: "error", status: 400, message: "Unsupported parameter" }; }
        if (c.round === "discussion 1" && c.role === "rad") return { kind: "hold", answer: true };
      },
    });
    await page.goto("/");
    const found: string[] = [];
    found.push(...await audit(page, "case step"));
    await fillKeys(page, { openai: "sk-test" });
    found.push(...await audit(page, "settings"));

    await go(page, "images");
    await page.setInputFiles("#imageInput", [{ name: "x.png", mimeType: "image/png", buffer: await makeImage(page, { width: 400, height: 300, type: "image/png" }) }]);
    await expect(page.locator(".img-item")).toHaveCount(1);
    found.push(...await audit(page, "images step"));
    await page.getByRole("button", { name: /Black out/ }).click();
    await expect(page.locator("dialog.redact")).toBeVisible();
    found.push(...await audit(page, "black-out editor"));
    await page.keyboard.press("Escape");
    await page.locator(".img-item input[type=checkbox]").check();
    await go(page, "panel");
    found.push(...await audit(page, "panel step"));
    await go(page, "review");
    found.push(...await audit(page, "review step"));

    await startMeeting(page);
    await expect(page.locator("#pausePanel")).toBeVisible();
    found.push(...await audit(page, "meeting waiting for a decision"));
    await page.getByRole("button", { name: "Try again" }).first().click();
    await expect(page.locator(".round")).toHaveCount(3);
    found.push(...await audit(page, "meeting in progress"));
    mock.release();
    await expect(page.locator("#savers")).toBeVisible();
    await expect(page).toHaveURL(/#\/meeting\/[\w-]+$/);
    found.push(...await audit(page, "saved meeting"));
    await page.locator("#foldBtn").click();
    await page.locator("#deleteBtn").click();
    found.push(...await audit(page, "saved meeting, every round open, delete asked"));
    await page.getByRole("button", { name: "Cancel" }).click();

    await go(page, "history");
    await page.locator("table.history tbody input[type=checkbox]").first().check();
    found.push(...await audit(page, "history"));
    expect(found).toEqual([]);
  });
}

// Presses Tab until the locator has focus, failing if it isn't reached within the given number of presses.
async function tabTo(page: Page, target: Locator, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Couldn't reach ${target} with the Tab key`);
}

// Tabs through the whole page from the top and lists anything that takes focus without a visible outline.
async function focusWithoutOutline(page: Page, where: string): Promise<string[]> {
  // Let a page change finish moving focus to its heading first, then start from the top.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo(0, 0); });
  const missing: string[] = [];
  let count = 0;
  for (let i = 0; i < 150; i++) {
    await page.keyboard.press("Tab");
    const el = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      // Headings and the like that only take focus from the page itself (tabindex -1) aren't Tab stops.
      if (!a || a === document.body || a.tabIndex < 0) return null;
      // Back to an element already visited: the whole page has been covered.
      if (a.dataset.tabbed) return { again: true, name: "", visible: true };
      a.dataset.tabbed = "1";
      const st = getComputedStyle(a);
      const name = a.tagName.toLowerCase() + (a.id ? "#" + a.id : "") + " " + (a.getAttribute("aria-label") || a.textContent || (a as HTMLInputElement).name || "").trim().slice(0, 40);
      return { again: false, name, visible: st.outlineStyle !== "none" && parseFloat(st.outlineWidth) > 0 };
    });
    if (!el) continue;
    if (el.again) break;
    count++;
    if (!el.visible) missing.push(`${where}: ${el.name}`);
  }
  await page.evaluate(() => document.querySelectorAll<HTMLElement>("[data-tabbed]").forEach((e) => delete e.dataset.tabbed));
  expect(count, where).toBeGreaterThan(3);
  return missing;
}

test("every control reached with the Tab key shows where the focus is", async ({ page }) => {
  let microFailed = false;
  await mockProviders(page, { reply: (c) => {
    if (c.round === "first" && c.role === "micro" && !microFailed) { microFailed = true; return { kind: "error", status: 400, message: "Unsupported parameter" }; }
  } });
  await page.goto("/");
  await fillKeys(page, { openai: "sk-test" });
  const missing: string[] = [];
  missing.push(...await focusWithoutOutline(page, "settings"));
  await go(page, "images");
  await page.setInputFiles("#imageInput", [{ name: "x.png", mimeType: "image/png", buffer: await makeImage(page, { width: 400, height: 300, type: "image/png" }) }]);
  for (const place of ["case", "images", "panel", "review"] as const) {
    await go(page, place);
    missing.push(...await focusWithoutOutline(page, place));
  }
  // The meeting itself runs without the image.
  await go(page, "images");
  await page.getByRole("button", { name: "Remove" }).click();
  await startMeeting(page);
  await expect(page.locator("#pausePanel")).toBeVisible();
  missing.push(...await focusWithoutOutline(page, "meeting waiting"));
  await page.click("#carryOnBtn");
  await expect(page).toHaveURL(/#\/meeting\/[\w-]+$/);
  await page.locator("#foldBtn").click();
  missing.push(...await focusWithoutOutline(page, "saved meeting"));
  await go(page, "history");
  missing.push(...await focusWithoutOutline(page, "history"));
  expect(missing).toEqual([]);
});

test("a meeting can be run, retried and tidied up with only the keyboard", async ({ page }) => {
  let microFailed = false;
  await mockProviders(page, { reply: (c) => {
    if (c.round === "first" && c.role === "micro" && !microFailed) { microFailed = true; return { kind: "error", status: 400, message: "Unsupported parameter" }; }
  } });
  await page.goto("/");
  await fillKeys(page, { openai: "sk-test" });

  // The black-out editor opens and closes from the keyboard, and focus goes back where it was.
  await go(page, "images");
  await page.setInputFiles("#imageInput", [{ name: "x.png", mimeType: "image/png", buffer: await makeImage(page, { width: 400, height: 300, type: "image/png" }) }]);
  const blackOut = page.getByRole("button", { name: "Black out areas" });
  await tabTo(page, blackOut);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(blackOut).toBeFocused();
  await page.getByRole("button", { name: "Remove" }).press("Enter");
  await expect(page.locator(".img-item")).toHaveCount(0);

  await go(page, "review");
  await tabTo(page, page.locator("#runBtn"));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.locator("#pausePanel")).toBeVisible();
  await tabTo(page, page.locator("#retryAllBtn"));
  await page.keyboard.press("Enter");
  await expect(page.locator("#progressText")).toBeFocused();
  await expect(page.locator("#savers")).toBeVisible();
  await expect(page.locator(".card .tag")).toHaveText(Array(9).fill("done"));

  // Open an earlier round, then a card's prompt, from the keyboard.
  await tabTo(page, page.getByRole("button", { name: "First opinions" }));
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "First opinions" })).toHaveAttribute("aria-expanded", "true");
  await tabTo(page, page.locator(".round").first().locator("summary").first());
  await page.keyboard.press("Enter");
  await expect(page.locator(".round").first().locator("details.prompt").first()).toHaveAttribute("open", "");

  // Asking to delete puts focus on Cancel; Escape cancels and goes back to the button.
  await page.locator("#deleteBtn").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#deleteBtn")).toBeFocused();
  await expect(page.getByRole("group", { name: "Delete this meeting" })).toHaveCount(0);
});

test("nothing moves for people who ask for reduced motion", async ({ page }) => {
  await mockProviders(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await fillKeys(page, { openai: "sk-test" });
  await startMeeting(page);
  await expect(page.locator("#savers")).toBeVisible();
  const moving = () => page.evaluate(() => [...document.querySelectorAll("*")].flatMap((el) => {
    const st = getComputedStyle(el);
    const before = getComputedStyle(el, "::before");
    return [st, before].some((x) => x.animationName !== "none" || parseFloat(x.transitionDuration) > 0) ? [el.className || el.tagName] : [];
  }));
  expect(await moving()).toEqual([]);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await moving()).not.toEqual([]);
});
