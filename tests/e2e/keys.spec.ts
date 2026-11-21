import { expect, test, type Page } from "@playwright/test";

const PASS = "correct horse battery staple";
const storage = (page: Page) => page.evaluate(() => ({ ...localStorage }));

async function saveWithPassphrase(page: Page, first: string, second = first) {
  await page.fill("#newPass", first);
  await page.fill("#newPass2", second);
  await page.getByRole("button", { name: "Save my keys" }).click();
}

test("keys are only remembered locked with a passphrase", async ({ page }) => {
  await page.goto("/");
  await page.fill("#key-openai", "sk-secret-openai-123");
  await page.fill("#key-anthropic", "sk-ant-secret-456");
  expect(await storage(page)).toEqual({});

  await page.check("#remember");
  await saveWithPassphrase(page, "short");
  await expect(page.locator("#keyMessage")).toHaveText("Use at least 12 characters. Three or four unrelated words work well.");
  await saveWithPassphrase(page, PASS, PASS + "!");
  await expect(page.locator("#keyMessage")).toHaveText("The two passphrases don't match. Type the same passphrase in both boxes.");
  await saveWithPassphrase(page, PASS);
  await expect(page.locator("#keyMessage")).toHaveText(/^Your keys are saved on this computer, locked with your passphrase\./);

  // Only an encrypted copy is stored: neither key nor the passphrase appears anywhere in storage.
  const saved = await storage(page);
  expect(Object.keys(saved)).toEqual(["mdt.vault"]);
  expect(JSON.parse(saved["mdt.vault"])).toMatchObject({ v: 1, kdf: "PBKDF2-SHA256", iter: 600000 });
  const all = JSON.stringify(saved);
  for (const secret of ["sk-secret-openai-123", "sk-ant-secret-456", PASS]) expect(all).not.toContain(secret);

  // Changing a key while unlocked re-saves it without asking for the passphrase again.
  await page.fill("#key-openai", "sk-secret-openai-789");
  await expect.poll(async () => (await storage(page))["mdt.vault"]).not.toBe(saved["mdt.vault"]);

  await page.reload();
  await expect(page.locator("#key-openai")).toHaveCount(0);
  await expect(page.locator("#cost")).toHaveText("Unlock your saved keys above, or press \"Forget keys\" and paste them in again.");
  await expect(page.locator("#runBtn")).toBeDisabled();
  await page.fill("#unlockPass", "wrong passphrase here");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.locator("#keyMessage")).toHaveText(/^That passphrase didn't unlock your keys\./);
  await page.fill("#unlockPass", PASS);
  await page.keyboard.press("Enter");
  await expect(page.locator("#key-openai")).toHaveValue("sk-secret-openai-789");
  await expect(page.locator("#key-anthropic")).toHaveValue("sk-ant-secret-456");
  await expect(page.locator("#remember")).toBeChecked();
  await expect(page.locator("#runBtn")).toBeEnabled();
});

test("unticking Remember deletes the saved copy but keeps keys for this tab", async ({ page }) => {
  await page.goto("/");
  await page.fill("#key-openai", "sk-secret");
  await page.check("#remember");
  await saveWithPassphrase(page, PASS);
  await expect(page.locator("#keyMessage")).toHaveText(/locked with your passphrase/);
  await page.uncheck("#remember");
  await expect(page.locator("#keyMessage")).toHaveText(/^Your saved keys have been removed from this computer\./);
  expect(await storage(page)).toEqual({});
  await expect(page.locator("#key-openai")).toHaveValue("sk-secret");
});

test("Forget keys clears the boxes and the saved copy", async ({ page }) => {
  await page.goto("/");
  await page.fill("#key-openai", "sk-secret");
  await page.check("#remember");
  await saveWithPassphrase(page, PASS);
  await expect(page.locator("#keyMessage")).toHaveText(/locked with your passphrase/);
  await page.click("#forgetBtn");
  await expect(page.locator("#key-openai")).toHaveValue("");
  await expect(page.locator("#remember")).not.toBeChecked();
  await expect(page.locator("#cost")).toHaveText("Keys cleared from this browser.");
  expect(await storage(page)).toEqual({});

  // Forget also works from the locked screen, for a forgotten passphrase.
  await page.fill("#key-openai", "sk-secret-2");
  await page.check("#remember");
  await saveWithPassphrase(page, PASS);
  await expect(page.locator("#keyMessage")).toHaveText(/locked with your passphrase/);
  await page.reload();
  await page.click("#forgetBtn");
  await expect(page.locator("#key-openai")).toHaveValue("");
  expect(await storage(page)).toEqual({});
});

test("plain-text keys from an earlier version are moved out of storage", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("mdt.key.openai", "sk-old-plain");
    localStorage.setItem("mdt.remember", "1");
  });
  await page.reload();
  await expect(page.locator("#key-openai")).toHaveValue("sk-old-plain");
  await expect(page.locator("#keyMessage")).toHaveText(/^Your keys were saved on this computer without a passphrase\./);
  await expect(page.locator("#remember")).not.toBeChecked();
  expect(await storage(page)).toEqual({});
});

test("saved model choices from earlier versions still apply", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("mdt.default", "anthropic|claude-opus-5-5");
    localStorage.setItem("mdt.seats", JSON.stringify({ rad: "openai|gpt-4.1", sceptic: "openai|my-own-model" }));
    localStorage.setItem("mdt.custom.openai", JSON.stringify(["my-own-model"]));
  });
  await page.reload();
  await expect(page.locator("#defaultModel")).toHaveValue("anthropic|claude-opus-5-5");
  await expect(page.locator("#model-rad")).toHaveValue("openai|gpt-4.1");
  await expect(page.locator("#model-sceptic")).toHaveValue("openai|my-own-model");
  await expect(page.locator("#model-surg option").first()).toHaveText("Default model (Anthropic · claude-opus-5-5)");
});

test("the setting from the single-provider version is migrated", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("mdt.provider", "anthropic");
    localStorage.setItem("mdt.model.anthropic", "claude-older-model");
  });
  await page.reload();
  await expect(page.locator("#defaultModel")).toHaveValue("anthropic|claude-older-model");
});
