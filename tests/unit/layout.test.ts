import { describe, expect, it } from "vitest";
import type { ProviderId } from "../../src/providers";
import { readiness, type ReadinessInput } from "../../src/ui/readiness";
import { href, parseRoute } from "../../src/ui/route";

describe("parseRoute", () => {
  it("reads each page and step from the address", () => {
    expect(parseRoute("#/new/panel")).toEqual({ page: "new", step: "panel" });
    expect(parseRoute("#/settings")).toEqual({ page: "settings" });
    expect(parseRoute("#/meeting")).toEqual({ page: "meeting" });
  });

  it("opens the first step for an empty or unknown address", () => {
    for (const hash of ["", "#", "#/", "#/new", "#/new/nowhere", "#/admin"]) expect(parseRoute(hash)).toEqual({ page: "new", step: "case" });
  });

  it("round-trips through href", () => {
    for (const hash of ["#/new/case", "#/new/images", "#/new/review", "#/history", "#/settings", "#/meeting"]) expect(href(parseRoute(hash))).toBe(hash);
  });
});

describe("readiness", () => {
  const both = (pid: ProviderId) => pid === "openai" || pid === "anthropic";
  const ok: ReadinessInput = {
    caseText: "CASE", consultants: 4, rounds: 1, images: 0, imagesChecked: true, locked: false, hasKey: both,
    usedChoices: [{ pid: "openai", model: "gpt-5" }, { pid: "anthropic", model: "claude-sonnet-5-5" }],
  };

  it("counts the calls and names the providers, as the original app did", () => {
    expect(readiness(ok)).toEqual({ msg: "4 consultants × 2 rounds + chair = 9 AI calls on OpenAI and Anthropic", bad: false });
    expect(readiness({ ...ok, rounds: 2, images: 3 }).msg).toBe("Imaging review + 4 consultants × 3 rounds + chair = 14 AI calls on OpenAI and Anthropic");
  });

  it("names the first problem and where to fix it", () => {
    expect(readiness({ ...ok, caseText: " \n" }).fix?.to).toEqual({ page: "new", step: "case" });
    expect(readiness({ ...ok, consultants: 1 })).toMatchObject({ msg: "Choose at least two consultants.", bad: true });
    // The passphrase box sits right above the message, so there's nowhere else to send them.
    expect(readiness({ ...ok, locked: true })).not.toHaveProperty("fix");
    expect(readiness({ ...ok, hasKey: (pid) => pid === "openai" })).toMatchObject({
      msg: "Add your Anthropic API key, or switch those seats to a provider you have a key for.", fix: { to: { page: "settings" } },
    });
    expect(readiness({ ...ok, images: 2, imagesChecked: false }).fix?.to).toEqual({ page: "new", step: "images" });
  });
});
