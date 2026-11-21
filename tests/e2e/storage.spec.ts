import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { costLine, download, fillKeys, go, runAndWait, setSeatModel, startMeeting } from "../support/app";
import { makeImage, withJpegMetadata } from "../support/images";
import { defaultText, mockProviders, type MockOptions } from "../support/mockProviders";

const SAVED = /#\/meeting\/[\w-]+$/;

// Runs a meeting on the given case and waits until it has been saved.
async function runAndSave(page: Page, opts: { caseId?: string; tag?: string } = {}) {
  await go(page, "case");
  if (opts.caseId) await page.selectOption("#caseSel", opts.caseId);
  await page.fill("#caseTag", opts.tag ?? "");
  await runAndWait(page);
  await expect(page).toHaveURL(SAVED);
}

async function setUp(page: Page, opts: MockOptions = {}) {
  const mock = await mockProviders(page, opts);
  await page.goto("/");
  await fillKeys(page, { openai: "sk-test", anthropic: "sk-ant-test" });
  return mock;
}

const historyRows = (page: Page) => page.locator("table.history tbody tr");

test("each meeting is saved when it finishes and is still there after a reload", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { persistCalls: number };
    w.persistCalls = 0;
    navigator.storage.persisted = async () => false;
    navigator.storage.persist = async () => { w.persistCalls++; return true; };
  });
  await setUp(page);
  await runAndSave(page, { tag: "PJI-01" });

  // The saved copy takes over without losing the meeting on screen.
  await expect(page.locator(".card .tag")).toHaveText(Array(9).fill("done"));
  await expect(page.locator(".meta")).toContainText("PJI-01");
  await expect(page.getByRole("heading", { name: "Research notes" })).toBeVisible();
  // The browser is asked once to keep saved meetings even when space runs low.
  expect(await page.evaluate(() => (window as unknown as { persistCalls: number }).persistCalls)).toBe(1);

  await page.reload();
  await expect(page.locator(".card .tag")).toHaveText(Array(9).fill("done"));
  await expect(page.locator(".session-item").first()).toContainText("PJI-01 · Painful hip, possible infection");
  await go(page, "history");
  await expect(historyRows(page)).toHaveCount(1);
  await expect(historyRows(page).locator("td")).toHaveText([
    "", /^\d{1,2} \w{3} \d{4}, \d{2}:\d{2}$/, "PJI-01Painful hip, possible infection", "OpenAI gpt-5-mini ×5",
    "Two-stage revision of the acetabular component (chair on openai (gpt-5-mini)).", "Majority", "Not rated",
  ]);
});

test("a meeting where nobody answered isn't saved", async ({ page }) => {
  await setUp(page, { reply: () => ({ kind: "error", status: 401, message: "Incorrect API key provided" }) });
  await startMeeting(page);
  await expect(page.locator("#pausePanel")).toBeVisible();
  await page.click("#stopBtn");
  await expect(page.locator(".note")).toHaveText("This meeting wasn't saved, because no consultant answered. Check the messages on the cards, then try again.");
  await expect(page).toHaveURL(/#\/meeting$/);
  await expect(page.locator(".session-item")).toContainText("Not saved");
  await go(page, "history");
  await expect(page.locator(".note")).toHaveText("No saved meetings yet. They'll appear here as soon as one finishes.");
});

test("research notes are saved and go into every export, but never to the AI", async ({ page }) => {
  const mock = await setUp(page);
  await runAndSave(page, { tag: "PJI-01" });
  const callsBefore = mock.calls.length;

  await page.getByRole("button", { name: "Go to research notes" }).click();
  await expect(page.getByRole("heading", { name: "Research notes" })).toBeFocused();
  await page.fill("#rActual", "Single-stage revision with extended antibiotics");
  await page.getByLabel("Partly agree").check();
  await page.fill("#rNotes", "Panel underplayed the frailty.");
  await expect(page.locator("#researchStatus")).toHaveText("Saved.");

  await page.reload();
  await expect(page.locator("#rActual")).toHaveValue("Single-stage revision with extended antibiotics");
  await expect(page.getByLabel("Partly agree")).toBeChecked();
  await expect(page.locator(".session-item").first()).toContainText("PJI-01");

  const json = await download(page, "jsonBtn");
  expect(json.download.suggestedFilename()).toMatch(/^mdt-PJI-01-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/);
  const rec = JSON.parse(json.data.toString());
  expect(Object.keys(rec).slice(0, 4)).toEqual(["tool", "note", "id", "caseId"]);
  expect(rec.research).toMatchObject({ caseTag: "PJI-01", actualDecision: "Single-stage revision with extended antibiotics", rating: "partly agree", notes: "Panel underplayed the frailty." });

  const pdf = await download(page, "pdfBtn");
  expect(pdf.data.subarray(0, 5).toString()).toBe("%PDF-");

  const word = await download(page, "wordBtn");
  expect(word.download.suggestedFilename()).toMatch(/^mdt-PJI-01-.*\.docx$/);
  const xml = strFromU8(unzipSync(new Uint8Array(word.data))["word/document.xml"]);
  for (const text of ["Simulated meeting. ", "Research notes", "Single-stage revision with extended antibiotics", "Partly agree", "Two-stage revision", "Appendix: instructions given to each seat"]) {
    expect(xml).toContain(text);
  }
  await expect(page.locator("#saveNote")).toHaveText("Word file downloaded.");

  expect(mock.calls.length).toBe(callsBefore);
  expect(mock.calls.some((c) => c.rawBody.includes("PJI-01") || c.rawBody.includes("underplayed"))).toBe(false);
});

test("Rerun this case loads the same case, images and panel, and asks for the images to be checked again", async ({ page }) => {
  const mock = await setUp(page);
  await go(page, "case");
  await page.selectOption("#caseSel", "stiff-tkr");
  await page.fill("#caseTag", "TKR-7");
  await go(page, "images");
  await page.setInputFiles("#imageInput", { name: "x.png", mimeType: "image/png", buffer: await makeImage(page, { width: 400, height: 300, type: "image/png" }) });
  await page.locator(".img-item").getByLabel("Image 1 caption").fill("Lateral knee");
  await page.locator(".img-item input[type=checkbox]").check();
  await go(page, "panel");
  await page.check("#role-sceptic");
  await page.selectOption("#rounds", "2");
  await setSeatModel(page, "micro", "anthropic|claude-sonnet-5-5");
  await runAndWait(page);
  await expect(page).toHaveURL(SAVED);

  // Change the set-up, then rerun the saved meeting.
  await go(page, "case");
  await page.selectOption("#caseSel", "pji-hip");
  await page.fill("#caseTag", "");
  await go(page, "panel");
  await page.uncheck("#role-sceptic");
  await go(page, "meeting");
  await page.getByRole("button", { name: "Rerun this case" }).click();

  await expect(page).toHaveURL(/#\/new\/review$/);
  await expect(page.locator(".summary dd").first()).toHaveText("Stiff, painful knee replacement Change");
  await expect(page.locator(".summary")).toContainText("TKR-7");
  await expect(page.locator("#cost")).toHaveText("Tick the box under each image to confirm you've checked it for identifiers.");
  await page.getByRole("link", { name: "Go to the images" }).click();
  await expect(page.locator(".img-item").getByLabel("Image 1 caption")).toHaveValue("Lateral knee");
  await page.locator(".img-item input[type=checkbox]").check();
  await expect(await costLine(page)).toHaveText("Imaging review + 5 consultants × 3 rounds + chair = 17 AI calls on OpenAI and Anthropic");
  await go(page, "panel");
  await expect(page.locator("#model-micro")).toHaveValue("anthropic|claude-sonnet-5-5");

  const before = mock.calls.length;
  await runAndWait(page);
  await expect(page).toHaveURL(SAVED);
  const second = mock.calls.slice(before);
  expect(second.find((c) => c.round === "imaging")!.images).toHaveLength(1);
  expect(second.find((c) => c.role === "surg")!.prompt).toContain("FICTIONAL TEST CASE 2");
  await go(page, "history");
  await expect(historyRows(page)).toHaveCount(2);
});

test("History searches, filters, compares and exports a spreadsheet", async ({ page }) => {
  // One chair answer starts with "=", which a spreadsheet would run as a formula.
  await setUp(page, {
    reply: (c) => c.role === "chair" && c.prompt.includes("FICTIONAL TEST CASE 4")
      ? { kind: "stream", text: '## MDT decision\n=HYPERLINK("http://example.com","Open")\n\n## Level of agreement (unanimous / majority / no consensus, and who differed)\nUnanimous.' }
      : undefined,
  });
  await runAndSave(page, { caseId: "pji-hip", tag: "PJI-01" });
  await runAndSave(page, { caseId: "pji-hip", tag: "PJI-01" });
  await setSeatModel(page, "chair", "anthropic|claude-haiku-5-5");
  await runAndSave(page, { caseId: "dislocate" });

  await go(page, "history");
  await expect(historyRows(page)).toHaveCount(3);
  await page.selectOption("#hCase", { label: "PJI-01: Painful hip, possible infection" });
  await expect(historyRows(page)).toHaveCount(2);
  await expect(page.locator("#shownCount")).toHaveText("Showing 2 of 3 meetings. Clear filters");
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await page.selectOption("#hProvider", "Anthropic");
  await expect(historyRows(page)).toHaveCount(1);
  await page.selectOption("#hProvider", "");
  await page.selectOption("#hModel", "Anthropic · claude-haiku-5-5");
  await expect(historyRows(page)).toContainText("Repeated hip dislocations");
  await page.selectOption("#hModel", "");
  await page.fill("#hSearch", "hyperlink");
  await expect(historyRows(page)).toHaveCount(1);
  await page.fill("#hSearch", "");
  await page.fill("#hTo", "2020-01-01");
  await expect(page.locator(".note")).toContainText("No meetings match.");
  await page.getByRole("button", { name: "Clear filters" }).last().click();
  await expect(historyRows(page)).toHaveCount(3);

  await page.getByLabel("Choose every meeting shown").check();
  await expect(page.locator(".selection > span")).toHaveText("3 chosen");
  const pdf = await download(page, "compareBtn");
  expect(pdf.download.suggestedFilename()).toMatch(/^mdt-comparison-\d{4}-\d{2}-\d{2}\.pdf$/);
  expect(pdf.data.subarray(0, 5).toString()).toBe("%PDF-");

  const csv = (await download(page, "csvBtn")).data.toString("utf8");
  expect(csv.startsWith("﻿")).toBe(true);
  const lines = csv.slice(1).trim().split("\r\n");
  expect(lines[0]).toBe('"Meeting ID","Date","Case ID","Case","Panel models","Providers","Discussion rounds","Images","Decision","Level of agreement","Actual MDT decision","Reviewer rating","Notes","Status"');
  expect(lines).toHaveLength(4);
  // Oldest first, and the formula-like decision is made safe.
  expect(lines[1]).toContain('"PJI-01","Painful hip, possible infection"');
  expect(lines[3]).toContain(`"'=HYPERLINK(""http://example.com"",""Open"")","Unanimous"`);
  expect(lines[3]).toContain('"OpenAI gpt-5-mini ×4 · Anthropic claude-haiku-5-5","OpenAI; Anthropic"');
});

test("deleting asks on the page first, never in a pop-up", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", (d) => { dialogs.push(d.type()); void d.dismiss(); });
  await setUp(page);
  await runAndSave(page, { tag: "A" });
  await runAndSave(page, { tag: "B" });
  await runAndSave(page, { tag: "C" });

  const trigger = page.getByRole("button", { name: "Delete this meeting" });
  await trigger.click();
  const confirm = page.getByRole("group", { name: "Delete this meeting" });
  await expect(confirm).toContainText("Delete this meeting? It will be removed from this computer and can't be brought back unless it's in a backup.");
  await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("button", { name: "Delete meeting" }).click();
  await expect(page).toHaveURL(/#\/history$/);
  await expect(historyRows(page)).toHaveCount(2);
  await expect(historyRows(page)).not.toContainText(["C"]);

  await historyRows(page).first().getByRole("checkbox").check();
  await page.getByRole("button", { name: "Delete these" }).click();
  await page.getByRole("button", { name: "Delete 1 meeting" }).click();
  await expect(historyRows(page)).toHaveCount(1);
  await expect(page.locator(".session-item")).toHaveCount(1);
  expect(dialogs).toEqual([]);
});

test("backs up every meeting and restores them, checking what comes in", async ({ page }) => {
  await setUp(page);
  await go(page, "images");
  await page.setInputFiles("#imageInput", { name: "x.png", mimeType: "image/png", buffer: await makeImage(page, { width: 300, height: 200, type: "image/png" }) });
  await page.locator(".img-item input[type=checkbox]").check();
  await runAndSave(page, { tag: "IMG-1" });
  await page.fill("#rNotes", "Keep this note.");
  await expect(page.locator("#researchStatus")).toHaveText("Saved.");
  await go(page, "images");
  await page.locator(".img-item").getByRole("button", { name: "Remove" }).click();
  await runAndSave(page, { caseId: "ppf-frail", tag: "PPF-2" });

  await go(page, "settings");
  await expect(page.locator("#storageSummary")).toContainText("2 meetings are saved in this browser on this computer");
  const backup = await download(page, "settingsBackupAll");
  expect(backup.download.suggestedFilename()).toMatch(/^mdt-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = JSON.parse(backup.data.toString());
  expect(file).toMatchObject({ format: "revision-mdt-simulator-backup", version: 1, count: 2 });
  expect(file.meetings.map((m: { research: { caseTag: string } }) => m.research.caseTag).sort()).toEqual(["IMG-1", "PPF-2"]);
  await expect(page.locator(".session .hint").last()).toContainText("Last backup");

  await page.getByRole("button", { name: "Delete all saved meetings" }).click();
  await page.getByRole("button", { name: "Delete all 2 meetings" }).click();
  await expect(page.locator("#storageSummary")).toContainText("No meetings are saved yet.");
  await expect(page.locator(".session-item")).toHaveCount(0);

  await page.setInputFiles("#settingsRestore", { name: "backup.json", mimeType: "application/json", buffer: backup.data });
  await expect(page.locator(".backup [role=status]")).toHaveText("Restored 2 meetings.");
  await page.setInputFiles("#settingsRestore", { name: "backup.json", mimeType: "application/json", buffer: backup.data });
  await expect(page.locator(".backup [role=status]")).toHaveText("No new meetings were added. 2 meetings were already here and up to date.");
  await page.locator(".session-item", { hasText: "IMG-1" }).click();
  await expect(page.locator("#rNotes")).toHaveValue("Keep this note.");
  await expect(page.locator(".round").first().locator(".thumbs img")).toHaveCount(1);

  // A meeting downloaded on its own, before saving existed, can be added too. One carrying an image with
  // hidden details has the image redrawn, and anything that isn't a meeting is refused with an explanation.
  const old = { ...file.meetings[0] };
  delete old.id;
  delete old.research;
  const planted = withJpegMetadata(await makeImage(page, { width: 300, height: 200, type: "image/jpeg" }), { artist: "SMITH JOHN", comment: "NHS 943 476 5919" });
  old.images = [{ ...old.images?.[0], label: "Image 1", caption: "", mediaType: "image/jpeg", width: 300, height: 200, data: planted.toString("base64") }];
  await go(page, "history");
  await page.setInputFiles("#historyRestore", { name: "old.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(old)) });
  await expect(page.locator(".backup [role=status]")).toHaveText("Restored 1 meeting.");
  await expect(historyRows(page)).toHaveCount(3);
  const stored = await page.evaluate(() => new Promise<string>((resolve) => {
    const open = indexedDB.open("mdt-simulator");
    open.onsuccess = () => {
      const req = open.result.transaction("records").objectStore("records").getAll();
      req.onsuccess = () => resolve(JSON.stringify(req.result.filter((r: { id: string }) => r.id.startsWith("imported-"))));
    };
  }));
  const data = JSON.parse(stored)[0].images[0].data as string;
  const bytes = Buffer.from(data, "base64");
  expect(bytes.includes("SMITH JOHN")).toBe(false);
  expect(bytes.includes("Exif")).toBe(false);

  await page.setInputFiles("#historyRestore", { name: "notes.json", mimeType: "application/json", buffer: Buffer.from('{"hello":"world"}') });
  await expect(page.locator(".backup [role=status]")).toHaveText("This file isn't a backup or a meeting from the Revision MDT Simulator. Choose a file that was downloaded from the simulator.");
});

test("another open tab sees new meetings straight away", async ({ page, context }) => {
  await setUp(page);
  const other = await context.newPage();
  await other.goto("/#/history");
  await expect(other.locator(".note")).toContainText("No saved meetings yet");
  await runAndSave(page, { tag: "TAB-1" });
  await expect(other.locator("table.history tbody tr")).toHaveCount(1);
  await expect(other.locator(".session-item")).toContainText("TAB-1");
});

test("defaultText still describes what the mock chair says", () => {
  // The history assertions above depend on this wording.
  expect(defaultText({ role: "chair", round: "chair", provider: "openai", body: { model: "gpt-5-mini", stream: true, messages: [] } }))
    .toContain("## MDT decision\n**Two-stage revision** of the acetabular component (chair on openai (gpt-5-mini)).");
});
