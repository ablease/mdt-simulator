// Drives the meeting screen. The element ids match the original single-file app, so the parity
// tests can run the same steps against both versions.
import { expect, type Download, type Page } from "@playwright/test";
import fs from "node:fs/promises";

export async function fillKeys(page: Page, keys: { openai?: string; anthropic?: string }) {
  if (keys.openai) await page.fill("#key-openai", keys.openai);
  if (keys.anthropic) await page.fill("#key-anthropic", keys.anthropic);
}

export async function setSeatModel(page: Page, roleId: string, value: string) {
  await page.selectOption("#model-" + roleId, value);
}

export const cardTags = (page: Page) => page.locator(".card .tag");

export async function runAndWait(page: Page) {
  await page.click("#runBtn");
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
