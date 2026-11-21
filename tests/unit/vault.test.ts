import { describe, expect, it } from "vitest";
import { createSealer, openVault, seal } from "../../src/storage/vault";

const keys = { openai: "sk-one", anthropic: "sk-ant-two" };

describe("key vault", () => {
  it("opens with the right passphrase and refuses the wrong one", async () => {
    const s = await createSealer("a long test passphrase");
    const blob = await seal(s, keys);
    expect(JSON.stringify(blob)).not.toContain("sk-");
    expect((await openVault("a long test passphrase", blob))?.keys).toEqual(keys);
    expect(await openVault("a long test passphrasf", blob)).toBeNull();
  });

  it("uses a fresh IV every time it saves, with the same salt", async () => {
    const s = await createSealer("a long test passphrase");
    const a = await seal(s, keys);
    const b = await seal(s, keys);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
    expect(a.salt).toBe(b.salt);
  });

  it("gives back a sealer that can re-save after unlocking", async () => {
    const blob = await seal(await createSealer("a long test passphrase"), keys);
    const opened = (await openVault("a long test passphrase", blob))!;
    const again = await seal(opened.sealer, { ...keys, openai: "sk-new" });
    expect((await openVault("a long test passphrase", again))?.keys.openai).toBe("sk-new");
  });

  it("rejects tampered data", async () => {
    const blob = await seal(await createSealer("a long test passphrase"), keys);
    const bytes = atob(blob.data).split("");
    bytes[0] = String.fromCharCode(bytes[0].charCodeAt(0) ^ 1);
    expect(await openVault("a long test passphrase", { ...blob, data: btoa(bytes.join("")) })).toBeNull();
  });
});
