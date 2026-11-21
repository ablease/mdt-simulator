// Drives the app the way a person would: through the sidebar, the set-up steps and the buttons.
import { expect, type Download, type Page } from "@playwright/test";
import fs from "node:fs/promises";

export type Place = "case" | "images" | "panel" | "review" | "settings" | "history" | "meeting";

const hashFor = (place: Place) => ["case", "images", "panel", "review"].includes(place) ? "#/new/" + place : "#/" + place;

// Moves to a page or step by clicking links in the sidebar and the step list. "meeting" opens the
// newest meeting in the sidebar: the one running, or the latest saved.
export async function go(page: Page, place: Place) {
  if (place === "meeting") {
    if (/#\/meeting/.test(page.url())) return;
    await page.locator(".session-item").first().click();
    await expect(page.locator(".session-item[aria-current]")).toBeVisible();
    return;
  }
  const hash = hashFor(place);
  const now = new URL(page.url()).hash;
  if (now === hash) return;
  const onNewMeeting = now === "" || now.startsWith("#/new/");
  if (hash.startsWith("#/new/") && !onNewMeeting) await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "New meeting" }).click();
  if (hash !== "#/new/case" || onNewMeeting) await page.locator(`a[href="${hash}"]`).first().click();
  // The page has been drawn once its link is marked as the current one.
  await expect(page.locator(`a[href="${hash}"][aria-current]`).first()).toBeVisible();
}

export async function fillKeys(page: Page, keys: { openai?: string; anthropic?: string }) {
  await go(page, "settings");
  if (keys.openai) await page.fill("#key-openai", keys.openai);
  if (keys.anthropic) await page.fill("#key-anthropic", keys.anthropic);
}

export async function setSeatModel(page: Page, roleId: string, value: string) {
  await go(page, "panel");
  await page.selectOption("#model-" + roleId, value);
}

// The call count and providers, or what's stopping the meeting, as shown before it runs.
export async function costLine(page: Page) {
  await go(page, "review");
  return page.locator("#cost");
}

export const cardTags = (page: Page) => page.locator(".card .tag");

export async function startMeeting(page: Page) {
  await go(page, "review");
  await page.click("#runBtn");
}

export async function runAndWait(page: Page) {
  await startMeeting(page);
  await expect(page.locator("#savers")).toBeVisible({ timeout: 30_000 });
}

export async function download(page: Page, buttonId: string): Promise<{ download: Download; data: Buffer }> {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#" + buttonId)]);
  const path = await dl.path();
  return { download: dl, data: await fs.readFile(path!) };
}

// Hosts the app is allowed to contact. Everything else is a third-party request.
export function watchRequests(page: Page) {
  const hosts = new Set<string>();
  page.on("request", (r) => { hosts.add(new URL(r.url()).host); });
  return hosts;
}

// Collects console errors and uncaught exceptions, including Content Security Policy violations.
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}
