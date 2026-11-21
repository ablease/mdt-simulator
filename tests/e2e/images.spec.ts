import { expect, test, type Page } from "@playwright/test";
import { costLine, download, fillKeys, go, runAndWait, setSeatModel, watchErrors, watchRequests } from "../support/app";
import { dicomBytes, gifBytes, heicBytes, jpegSize, makeImage, PLANTED, withJpegMetadata, withPngText } from "../support/images";
import { mockProviders } from "../support/mockProviders";

const FILENAMES = ["SMITH_JOHN_1234567.jpg", "Jones-Mary-DOB-1950.png"];

// A large JPEG with EXIF and a comment, and a small PNG with a text chunk, all naming a patient.
async function attachTwoImages(page: Page) {
  await go(page, "images");
  const jpeg = withJpegMetadata(await makeImage(page, { width: 3000, height: 2000, type: "image/jpeg", text: "SMITH JOHN 1234567" }),
    { artist: "SMITH JOHN", comment: "Patient SMITH JOHN NHS 943 476 5919" });
  const png = withPngText(await makeImage(page, { width: 800, height: 600, type: "image/png" }), "Comment", "JONES MARY NHS 943 476 5919");
  await page.setInputFiles("#imageInput", [
    { name: FILENAMES[0], mimeType: "image/jpeg", buffer: jpeg },
    { name: FILENAMES[1], mimeType: "image/png", buffer: png },
  ]);
  await expect(page.locator(".img-item")).toHaveCount(2);
}

async function tickAll(page: Page) {
  for (const box of await page.locator(".img-item input[type=checkbox]").all()) await box.check();
}

// Samples a pixel of an attached image's stored version (the same data that is sent to the provider).
const pixel = (page: Page, index: number, x: number, y: number) => page.locator(".img-item img").nth(index).evaluate((img: HTMLImageElement, [px, py]) => {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(px, py, 1, 1).data;
  return (d[0] + d[1] + d[2]) / 3;
}, [x, y]);

test("cleans attached images and runs the imaging review first", async ({ page }) => {
  const hosts = watchRequests(page);
  const errors = watchErrors(page);
  const mock = await mockProviders(page);
  await page.goto("/");
  await fillKeys(page, { openai: "sk-test", anthropic: "sk-ant-test" });
  await setSeatModel(page, "rad", "anthropic|claude-sonnet-5-5");
  await page.uncheck("#role-rad");
  await attachTwoImages(page);

  // The radiologist is brought back and locked on, and nothing runs until both images are ticked.
  await go(page, "panel");
  await expect(page.locator("#role-rad")).toBeChecked();
  await expect(page.locator("#role-rad")).toBeDisabled();
  await expect(await costLine(page)).toHaveText("Tick the box under each image to confirm you've checked it for identifiers.");
  await expect(page.locator("#runBtn")).toBeDisabled();
  await page.getByRole("link", { name: "Go to the images" }).click();
  await page.locator(".img-item").first().getByLabel("Image 1 caption").fill("AP pelvis, 3 months ago");
  await tickAll(page);
  await expect(await costLine(page)).toHaveText("Imaging review + 4 consultants × 2 rounds + chair = 10 AI calls on OpenAI and Anthropic");

  await runAndWait(page);
  await expect(page.locator(".round-head h3")).toHaveText(["Imaging review", "First opinions", "Discussion 1", "Chair's decision"]);
  await expect(page.locator(".card .tag")).toHaveText(Array(10).fill("done"));
  const imagingCard = page.locator(".round").first().locator(".card");
  await expect(imagingCard.locator(".ai-label")).toHaveText("AI image interpretation. Unvalidated, for research only.");
  await expect(imagingCard.locator(".thumbs figure")).toHaveCount(2);

  // The imaging call: labels then images ahead of the prompt, in Anthropic's base64 format.
  const imaging = mock.calls.find((c) => c.round === "imaging")!;
  expect(imaging.provider).toBe("anthropic");
  const parts = imaging.content as { type: string; text?: string; source?: { media_type: string } }[];
  expect(parts.map((p) => p.type)).toEqual(["text", "image", "text", "image", "text"]);
  expect(parts[0].text).toBe("Image 1: AP pelvis, 3 months ago");
  expect(parts[2].text).toBe("Image 2 (no caption)");
  expect(parts[1].source!.media_type).toBe("image/jpeg");
  expect(imaging.prompt).toContain("The anonymised images above are labelled Image 1 to Image 2");

  // Re-encoded to JPEG, downscaled without enlarging, and nothing identifying left in the file.
  const sent = imaging.images.map((b) => Buffer.from(b, "base64"));
  expect(sent.map((b) => b.subarray(0, 2).toString("hex"))).toEqual(["ffd8", "ffd8"]);
  expect(jpegSize(sent[0])).toEqual({ width: 1568, height: 1045 });
  expect(jpegSize(sent[1])).toEqual({ width: 800, height: 600 });
  for (const b of sent) {
    const raw = b.toString("latin1");
    for (const s of [...PLANTED, "Exif", "tEXt"]) expect(raw).not.toContain(s);
    expect(b.includes(Buffer.from([0xff, 0xe1]))).toBe(false);
  }

  // Everyone else reads the report as part of the case, without the images.
  const others = mock.calls.filter((c) => c.round !== "imaging");
  expect(others.every((c) => c.images.length === 0 && typeof c.content === "string")).toBe(true);
  for (const c of others) expect(c.prompt).toContain("IMAGING REPORT (written by the radiologist from 2 attached anonymised images before the meeting):\n## Images reviewed");
  expect(mock.calls.find((c) => c.role === "chair")!.prompt).not.toContain("=== Imaging review ===");

  // File names never leave the upload step.
  const json = await download(page, "jsonBtn");
  const everything = [json.data.toString(), await page.content(), ...mock.calls.map((c) => c.rawBody)].join("\n");
  for (const name of FILENAMES) expect(everything).not.toContain(name.replace(/\.\w+$/, ""));

  const rec = JSON.parse(json.data.toString());
  expect(rec.images.map((i: { label: string; caption: string; width: number }) => [i.label, i.caption, i.width])).toEqual([["Image 1", "AP pelvis, 3 months ago", 1568], ["Image 2", "", 800]]);
  expect(rec.images[0].data).toBe(imaging.images[0]);
  expect(rec.imagesSeenByAll).toBe(false);
  expect(rec.rounds[0].name).toBe("Imaging review");
  expect(rec.rounds[0].entries[0].images).toEqual(["Image 1: AP pelvis, 3 months ago", "Image 2 (no caption)"]);

  const pdf = await download(page, "pdfBtn");
  expect(pdf.data.subarray(0, 5).toString()).toBe("%PDF-");
  await expect(page.locator("#saveNote")).toHaveText("PDF downloaded.");
  expect([...hosts].sort()).toEqual(["api.anthropic.com", "api.openai.com", "localhost:4173"]);
  expect(errors).toEqual([]);
});

test("can let every consultant see the images with their first opinion", async ({ page }) => {
  const mock = await mockProviders(page);
  await page.goto("/");
  await fillKeys(page, { openai: "sk-test" });
  await attachTwoImages(page);
  await tickAll(page);
  await page.check("#seeImages");
  await runAndWait(page);

  const first = mock.calls.filter((c) => c.round === "first");
  expect(first).toHaveLength(4);
  for (const c of first) {
    expect(c.images).toHaveLength(2);
    expect(c.prompt).toContain("The same images are attached above, labelled Image 1 to Image 2. You may look at them yourself, but describe only what you can see.\n\nGive your first opinion independently.");
  }
  // OpenAI's format: data URLs at high detail.
  const part = (first[0].content as { type: string; image_url?: { url: string; detail: string } }[]).find((p) => p.type === "image_url")!;
  expect(part.image_url!.url).toMatch(/^data:image\/jpeg;base64,\/9j\//);
  expect(part.image_url!.detail).toBe("high");
  expect(mock.calls.filter((c) => c.round.startsWith("discussion") || c.round === "chair").every((c) => c.images.length === 0)).toBe(true);
  await expect(page.locator(".round").nth(1).locator(".sent-with").first()).toHaveText(/^Sent with 2 images before the text: Image 1 \(no caption\); Image 2 \(no caption\)$/, { useInnerText: false });

  const rec = JSON.parse((await download(page, "jsonBtn")).data.toString());
  expect(rec.imagesSeenByAll).toBe(true);
});

test("carries on without a report when the radiologist's model can't read images", async ({ page }) => {
  const mock = await mockProviders(page, {
    reply: (c) => c.images.length ? { kind: "error", status: 400, message: "Invalid content type. image_url is only supported by certain models.", type: "invalid_request_error" } : undefined,
  });
  await page.goto("/");
  await fillKeys(page, { openai: "sk-test" });
  await setSeatModel(page, "rad", "openai|gpt-4.1-mini");
  await attachTwoImages(page);
  await tickAll(page);
  await runAndWait(page);

  const imagingCard = page.locator(".round").first().locator(".card");
  await expect(imagingCard.locator(".tag")).toHaveText("failed");
  await expect(imagingCard.locator(".err")).toHaveText(
    "OpenAI couldn't read the images with gpt-4.1-mini. It said: \"Invalid content type. image_url is only supported by certain models\". Choose a model that can read images for this seat, such as gpt-5, and run the meeting again. The meeting will carry on without an imaging report.");
  await expect(page.locator(".card.chair .tag")).toHaveText("done");
  expect(mock.calls.filter((c) => c.round !== "imaging").every((c) => !c.prompt.includes("IMAGING REPORT"))).toBe(true);
  const rec = JSON.parse((await download(page, "jsonBtn")).data.toString());
  expect(rec.rounds[0].entries[0].error).toBe("400: Invalid content type. image_url is only supported by certain models.");
  expect(rec.stoppedEarly).toBe(false);
});

test("black-out boxes are burned into the image", async ({ page }) => {
  await page.goto("/#/new/images");
  await page.setInputFiles("#imageInput", { name: "white.png", mimeType: "image/png", buffer: await makeImage(page, { width: 1000, height: 500, type: "image/png", fill: "#fff" }) });
  const item = page.locator(".img-item");
  await item.locator("input[type=checkbox]").check();
  expect(await pixel(page, 0, 250, 125)).toBeGreaterThan(240);

  // Cancel throws boxes away.
  await item.getByRole("button", { name: "Black out areas" }).click();
  const dialog = page.getByRole("dialog", { name: "Black out areas on Image 1" });
  await expect(dialog).toBeVisible();
  const canvas = dialog.locator("canvas");
  const drag = async (x0: number, y0: number, x1: number, y1: number) => {
    const b = (await canvas.boundingBox())!;
    await page.mouse.move(b.x + b.width * x0, b.y + b.height * y0);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * x1, b.y + b.height * y1, { steps: 5 });
    await page.mouse.up();
  };
  await drag(0.1, 0.1, 0.4, 0.4);
  await expect(dialog.getByRole("status")).toHaveText("1 box");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(item.locator("input[type=checkbox]")).toBeChecked();
  expect(await pixel(page, 0, 250, 125)).toBeGreaterThan(240);

  // A dragged box covers 100–400 × 50–200 px; saving burns it in and clears the checklist tick.
  await item.getByRole("button", { name: "Black out areas" }).click();
  await drag(0.1, 0.1, 0.4, 0.4);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(item.locator("input[type=checkbox]")).not.toBeChecked();
  await expect.poll(() => pixel(page, 0, 250, 125)).toBeLessThan(25);
  expect(await pixel(page, 0, 600, 400)).toBeGreaterThan(240);

  // Keyboard: "Add box" puts a 250 × 50 box at x 375, then five Left presses move it 50 px.
  await item.getByRole("button", { name: "Black out areas" }).click();
  await dialog.getByRole("button", { name: "Add box" }).click();
  await expect(canvas).toBeFocused();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => pixel(page, 0, 335, 250)).toBeLessThan(25);
  expect(await pixel(page, 0, 600, 250)).toBeGreaterThan(240);
});

test("refuses files that aren't PNG or JPEG, and more than ten images", async ({ page }) => {
  await page.goto("/#/new/images");
  await page.setInputFiles("#imageInput", [
    { name: "photo.heic", mimeType: "image/heic", buffer: heicBytes() },
    { name: "scan.gif", mimeType: "image/gif", buffer: gifBytes() },
    { name: "study.dcm", mimeType: "application/dicom", buffer: dicomBytes() },
  ]);
  const errs = page.locator(".img-errors li");
  await expect(errs).toHaveText([
    /^"photo\.heic" is an iPhone \(HEIC\) photo\./,
    /^"scan\.gif" isn't a PNG or JPEG image\./,
    /^"study\.dcm" is a DICOM file\. These can't be used yet, because they usually contain patient details\./,
  ]);
  await expect(page.locator(".img-item")).toHaveCount(0);

  const small = await makeImage(page, { width: 40, height: 30, type: "image/png" });
  await page.setInputFiles("#imageInput", Array.from({ length: 11 }, (_, i) => ({ name: `img${i}.png`, mimeType: "image/png", buffer: small })));
  await expect(page.locator(".img-item")).toHaveCount(10);
  await expect(errs).toHaveText(["You can attach up to 10 images. Only the first 10 were added."]);
  await expect(page.getByRole("button", { name: "Choose images" })).toBeDisabled();

  // Removing every image unlocks the radiologist again.
  await go(page, "panel");
  await expect(page.locator("#role-rad")).toBeDisabled();
  await go(page, "images");
  while (await page.locator(".img-item").count()) await page.locator(".img-item").first().getByRole("button", { name: "Remove" }).click();
  await expect(page.locator("#seeImages")).toHaveCount(0);
  await go(page, "panel");
  await expect(page.locator("#role-rad")).toBeEnabled();
});

test("keeps photos the right way up and accepts dropped files", async ({ page }) => {
  await page.goto("/#/new/images");
  // EXIF orientation 6 means "rotate 90° clockwise to display": a 300 × 200 file shows as 200 × 300.
  const rotated = withJpegMetadata(await makeImage(page, { width: 300, height: 200, type: "image/jpeg" }), { artist: "X", comment: "Y", orientation: 6 });
  const png = await makeImage(page, { width: 120, height: 80, type: "image/png" });
  await page.setInputFiles("#imageInput", { name: "rotated.jpg", mimeType: "image/jpeg", buffer: rotated });
  const dataTransfer = await page.evaluateHandle((b64) => {
    const dt = new DataTransfer();
    dt.items.add(new File([Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))], "dropped.png", { type: "image/png" }));
    return dt;
  }, png.toString("base64"));
  await page.dispatchEvent(".drop", "drop", { dataTransfer });
  await expect(page.locator(".img-item")).toHaveCount(2);
  const sizes = await page.locator(".img-item img").evaluateAll((imgs) => (imgs as HTMLImageElement[]).map((i) => [i.naturalWidth, i.naturalHeight]));
  expect(sizes).toEqual([[200, 300], [120, 80]]);
});
