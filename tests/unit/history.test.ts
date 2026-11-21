import { describe, expect, it } from "vitest";
import { jpegHasMetadata } from "../../src/images/sniff";
import { MeetingEngine } from "../../src/meeting/engine";
import { viewFromRecord } from "../../src/meeting/fromRecord";
import { agreementOf, anyAnswer, outcomeOf, panelOf } from "../../src/meeting/summary";
import { ProviderError, PROVIDERS, type Provider, type ProviderId, type StreamRequest } from "../../src/providers";
import { ROLES } from "../../src/prompts/roles";
import { dec } from "../../src/storage/settings";
import { CHAIR_ANSWER, sampleRecord } from "../support/records";

const withChair = (answer: string) => sampleRecord({ rounds: [{ name: "Chair's decision", entries: [{ ...sampleRecord().rounds[2].entries[0], response: answer }] }] });

describe("meeting summary", () => {
  it("takes the first line of the chair's decision, without markdown", () => {
    expect(outcomeOf(sampleRecord())).toBe("Two-stage revision of the acetabular component.");
    expect(outcomeOf(withChair("## MDT decision\n- **Revise** the cup\n- Then rehab"))).toBe("Revise the cup");
    expect(outcomeOf(sampleRecord({ rounds: [] }))).toBe("");
  });

  it("reads the level of agreement from whichever term the chair names first", () => {
    const level = (line: string) => agreementOf(withChair(CHAIR_ANSWER.replace("Majority: the microbiologist differed.", line)));
    expect(level("Majority: the microbiologist differed.")).toBe("Majority");
    expect(level("Unanimous.")).toBe("Unanimous");
    expect(level("**No consensus**: split two ways.")).toBe("No consensus");
    expect(level("Not unanimous: a majority, with the sceptic against.")).toBe("Majority");
    expect(level("Hard to say.")).toBe("");
    expect(agreementOf(sampleRecord({ rounds: [] }))).toBe("");
  });

  it("groups the panel's models", () => {
    expect(panelOf(sampleRecord())).toBe("OpenAI gpt-5-mini ×2 · Anthropic claude-haiku-5-5");
  });

  it("knows whether anyone answered", () => {
    expect(anyAnswer(sampleRecord())).toBe(true);
    const failed = sampleRecord({ rounds: [{ name: "First opinions", entries: [{ ...sampleRecord().rounds[0].entries[1], error: "401: bad key" }] }] });
    expect(anyAnswer(failed)).toBe(false);
  });
});

describe("viewFromRecord", () => {
  it("shows a saved meeting's cards with the plain-English errors they had", () => {
    const view = viewFromRecord(sampleRecord());
    expect(view.steps).toEqual(["First opinions", "Discussion 1", "Chair's decision"]);
    expect(view.active).toBe(3);
    const cards = view.rounds.flatMap((r) => r.cards);
    expect(cards.map((c) => c.status)).toEqual(["done", "failed", "done", "stopped", "done"]);
    expect(cards[1].error).toMatch(/^OpenAI: rate limit or credit limit reached\./);
    expect(cards[3].error).toBe("Stopped.");
    expect(cards[4]).toMatchObject({ chair: true, model: "Anthropic · claude-haiku-5-5", colour: "var(--r-chair)" });
    expect(view.rounds.map((r) => r.single)).toEqual([false, false, true]);
  });

  it("matches what the screen showed while the meeting ran", async () => {
    // A meeting with images, a radiologist whose model can't read them, a busy provider and a network
    // failure, which ends the meeting before the chair.
    const fake = (id: ProviderId): Provider => ({
      id, label: PROVIDERS[id].label, suggestions: PROVIDERS[id].suggestions, defaultModel: "m", keyPrefix: "", keyHelp: { url: "", linkText: "", after: "" },
      listModels: async () => [],
      async stream(req: StreamRequest) {
        const prompt = (req.parts[req.parts.length - 1] as { text: string }).text;
        if (prompt.includes("structured report")) throw new ProviderError("image_url is only supported by certain models.", 400);
        if (prompt.includes("first opinion") && prompt.includes(ROLES[1].brief)) throw new ProviderError("Rate limit", 429);
        if (prompt.includes("Discussion round 1") && prompt.includes(ROLES[0].brief)) throw new TypeError("Failed to fetch");
        req.onText("## View\nfine");
        return "## View\nfine";
      },
    });
    const engine = new MeetingEngine({
      providers: { openai: fake("openai"), anthropic: fake("anthropic") }, getKey: () => "k",
      sleep: async () => {}, now: () => new Date("2026-11-21T10:00:00Z"),
    });
    const rec = await engine.run({
      caseId: "pji-hip", caseTitle: "Test", caseText: "CASE", roles: ROLES.slice(0, 3), discussionRounds: 1,
      choiceFor: (r) => dec(r.id === "chair" ? "anthropic|claude-x" : "openai|gpt-x"),
      images: [{ caption: "AP pelvis", mediaType: "image/jpeg", width: 2, height: 2, base64: "/9j/AAAA" }], showImagesToAll: true,
    });
    const live = engine.getSnapshot();
    const saved = viewFromRecord(rec);
    expect(saved.steps).toEqual(live.steps);
    expect(saved.active).toEqual(live.active);
    const pick = (v: typeof live) => v.rounds.map((r) => ({ ...r, cards: r.cards.map(({ notice, ...c }) => c) }));
    expect(pick(saved)).toEqual(pick(live));
    expect(saved.rounds.map((r) => r.name)).toEqual(["Imaging review", "First opinions", "Discussion 1"]);
    expect(saved.rounds[0].cards[0].error).toContain("such as gpt-5, and run the meeting again. The meeting will carry on without an imaging report.");
  });
});

describe("jpegHasMetadata", () => {
  const seg = (marker: number, len: number) => [0xff, marker, len >> 8, len & 0xff, ...Array(len - 2).fill(0)];
  const jpeg = (...segs: number[][]) => Uint8Array.from([0xff, 0xd8, ...segs.flat(), 0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]);

  it("passes a plain JPEG with just a JFIF header", () => {
    expect(jpegHasMetadata(jpeg(seg(0xe0, 16), seg(0xdb, 67), seg(0xc0, 17)))).toBe(false);
  });

  it("flags EXIF, comments, other APP blocks and JFIF thumbnails", () => {
    expect(jpegHasMetadata(jpeg(seg(0xe0, 16), seg(0xe1, 40)))).toBe(true);
    expect(jpegHasMetadata(jpeg(seg(0xfe, 20)))).toBe(true);
    expect(jpegHasMetadata(jpeg(seg(0xed, 30)))).toBe(true);
    expect(jpegHasMetadata(jpeg(seg(0xe0, 400)))).toBe(true);
  });

  it("flags a file that ends before the image data", () => {
    expect(jpegHasMetadata(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]))).toBe(true);
  });
});
