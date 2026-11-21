import { describe, expect, it, vi } from "vitest";
import { buildPdf } from "../../src/export/pdfDocument";
import { MeetingEngine, type MeetingConfig } from "../../src/meeting/engine";
import { ProviderError, type Provider, type ProviderId, type StreamRequest } from "../../src/providers";
import { ROLES } from "../../src/prompts/roles";
import { dec } from "../../src/storage/settings";
import { answerPauses } from "../support/pauses";

type Script = (prompt: string, req: StreamRequest) => Promise<string>;

const IMAGES = [
  { caption: "AP pelvis", mediaType: "image/jpeg" as const, width: 10, height: 8, base64: "AAAA" },
  { caption: "", mediaType: "image/jpeg" as const, width: 10, height: 8, base64: "BBBB" },
];

// A provider whose answers come from a script, streamed in two halves.
function fake(id: ProviderId, script: Script): Provider {
  return {
    id, label: id === "openai" ? "OpenAI" : "Anthropic", suggestions: ["vision-model"], defaultModel: "m", keyPrefix: "", keyHelp: { url: "", linkText: "", after: "" },
    listModels: async () => [],
    async stream(req) {
      // The main prompt is always the last part; image labels and images come before it.
      const prompt = (req.parts[req.parts.length - 1] as { text: string }).text;
      const text = await script(prompt, req);
      if (text) { req.onText(text.slice(0, 3)); req.onText(text); }
      return text;
    },
  };
}

const roleIn = (prompt: string) => prompt.includes("You are the chair") ? "chair" : ROLES.find((r) => prompt.includes(r.brief))!.id;
const isImaging = (prompt: string) => prompt.includes("write a structured report on these images");

function setup(script: Script, getKey = () => "sk-test") {
  const sleeps: number[] = [];
  const sent: { prompt: string; types: string[]; key: string }[] = [];
  const provider = fake("openai", async (p, req) => { sent.push({ prompt: p, types: req.parts.map((x) => x.type), key: req.key }); return script(p, req); });
  const engine = new MeetingEngine({
    providers: { openai: provider, anthropic: fake("anthropic", script) },
    getKey,
    sleep: async (ms, signal) => { sleeps.push(ms); if (signal.aborted) throw new DOMException("Aborted", "AbortError"); },
    now: () => new Date("2026-11-21T10:00:00Z"),
  });
  const cfg: MeetingConfig = {
    caseId: "pji-hip", caseTitle: "Test", caseText: "CASE TEXT",
    roles: ROLES.slice(0, 3), discussionRounds: 1, choiceFor: () => dec("openai|gpt-test"),
  };
  return { engine, cfg, sleeps, sent };
}

describe("MeetingEngine", () => {
  it("runs first opinions, discussion and the chair, recording every call in seat order", async () => {
    const { engine, cfg } = setup(async (p) => "## View\nfrom " + roleIn(p));
    const rec = await engine.run(cfg);
    expect(rec.rounds.map((r) => r.name)).toEqual(["First opinions", "Discussion 1", "Chair's decision"]);
    expect(rec.rounds[0].entries.map((e) => e.roleId)).toEqual(["surg", "micro", "rad"]);
    expect(rec.seats.map((s) => s.roleId)).toEqual(["surg", "micro", "rad", "chair"]);
    expect(rec.stoppedEarly).toBe(false);
    const chairPrompt = rec.rounds[2].entries[0].prompt;
    expect(chairPrompt).toContain("=== First opinions ===\n### Revision arthroplasty surgeon\n## View\nfrom surg");
    const view = engine.getSnapshot();
    expect(view.running).toBe(false);
    expect(view.active).toBe(3);
    expect(view.rounds.flatMap((r) => r.cards.map((c) => c.status))).toEqual(Array(7).fill("done"));
    expect(view.planned).toBe(7);
    expect(rec.rounds.flatMap((r) => r.entries).some((e) => "earlierErrors" in e)).toBe(false);
  });

  it("retries a busy provider twice with growing waits, then succeeds", async () => {
    let tries = 0;
    const { engine, cfg, sleeps } = setup(async (p) => {
      if (roleIn(p) === "surg" && p.includes("first opinion") && tries++ < 2) throw new ProviderError("busy", 529);
      return "ok";
    });
    const rec = await engine.run(cfg);
    expect(sleeps).toEqual([4000, 8000]);
    expect(rec.rounds[0].entries[0].response).toBe("ok");
  });

  it("gives up after three attempts, then carries on without the seat when told to", async () => {
    const { engine, cfg, sleeps } = setup(async (p) => {
      if (roleIn(p) === "surg" && p.includes("first opinion")) throw new ProviderError("Rate limit", 429);
      return "ok from " + roleIn(p);
    });
    const pauses = answerPauses(engine, ["carry on"]);
    const rec = await engine.run(cfg);
    expect(pauses).toEqual([["0:surg"]]);
    expect(sleeps).toEqual([4000, 8000]);
    expect(rec.rounds[0].entries[0].error).toBe("429: Rate limit");
    expect(rec.rounds).toHaveLength(3);
    // The failed seat's view is missing from colleagues' discussion prompts rather than blank.
    expect(rec.rounds[1].entries[1].prompt).not.toContain("### Revision arthroplasty surgeon");
    const card = engine.getSnapshot().rounds[0].cards[0];
    expect(card.status).toBe("failed");
    expect(card.error).toMatch(/^OpenAI: rate limit or credit limit reached\./);
  });

  it("doesn't retry once part of an answer has arrived", async () => {
    const { engine, cfg, sleeps } = setup(async (p, req) => {
      if (roleIn(p) === "surg") { req.onText("partial"); throw new ProviderError("dropped", 500); }
      return "ok";
    });
    answerPauses(engine);
    const rec = await engine.run(cfg);
    expect(sleeps).toEqual([]);
    expect(engine.getSnapshot().rounds[0].cards[0]).toMatchObject({ status: "failed", text: "partial" });
    expect(rec.rounds[0].entries[0].response).toBeNull();
  });

  it("treats an empty answer as a failure without retrying", async () => {
    const { engine, cfg, sleeps } = setup(async (p) => roleIn(p) === "micro" ? "  " : "ok");
    answerPauses(engine);
    const rec = await engine.run(cfg);
    expect(sleeps).toEqual([]);
    expect(rec.rounds[0].entries[1].error).toBe("The model returned an empty answer.");
  });

  it("waits after a rejected key, then uses the corrected key when the seats are tried again", async () => {
    let key = "sk-wrong";
    const { engine, cfg, sent } = setup(async (_p, req) => {
      if (req.key !== "sk-right") throw new ProviderError("bad key", 401);
      return "ok";
    }, () => key);
    const pauses = answerPauses(engine, ["retry"], () => { key = "sk-right"; });
    const rec = await engine.run(cfg);
    expect(pauses).toEqual([["0:surg", "0:micro", "0:rad"]]);
    expect(rec.stoppedEarly).toBe(false);
    expect(rec.rounds.map((r) => r.name)).toEqual(["First opinions", "Discussion 1", "Chair's decision"]);
    expect(rec.rounds[0].entries.map((e) => [e.response, e.error, e.earlierErrors])).toEqual(Array(3).fill(["ok", null, ["401: bad key"]]));
    // The same prompt each time.
    expect(sent.filter((s) => roleIn(s.prompt) === "surg" && s.prompt.includes("first opinion")).map((s) => s.key)).toEqual(["sk-wrong", "sk-right"]);
    expect(new Set(sent.slice(0, 6).map((s) => s.prompt)).size).toBe(3);
    expect(engine.getSnapshot().rounds[0].cards.map((c) => [c.status, c.error])).toEqual(Array(3).fill(["done", null]));
  });

  it("gives the retried answer to the discussion and the chair", async () => {
    let failed = false;
    const { engine, cfg } = setup(async (p) => {
      if (roleIn(p) === "micro" && p.includes("first opinion") && !failed) { failed = true; throw new ProviderError("Overloaded", 529); }
      return "view from " + roleIn(p);
    });
    // The busy provider is retried twice automatically before the seat is given up on.
    let calls = 0;
    answerPauses(engine, ["retry"], () => { calls++; });
    const rec = await engine.run(cfg);
    expect(calls).toBe(0);
    expect(rec.rounds[0].entries[1].response).toBe("view from micro");

    let tries = 0;
    const second = setup(async (p) => {
      if (roleIn(p) === "micro" && p.includes("first opinion") && tries++ < 3) throw new ProviderError("Overloaded", 529);
      return "view from " + roleIn(p);
    });
    const pauses = answerPauses(second.engine, ["retry"]);
    const rec2 = await second.engine.run(second.cfg);
    expect(pauses).toEqual([["0:micro"]]);
    expect(rec2.rounds[0].entries[1]).toMatchObject({ response: "view from micro", error: null, earlierErrors: ["529: Overloaded"] });
    expect(rec2.rounds[1].entries[0].prompt).toContain("### Consultant microbiologist\nview from micro");
    expect(rec2.rounds[2].entries[0].prompt).toContain("=== First opinions ===\n### Revision arthroplasty surgeon\nview from surg\n\n### Consultant microbiologist\nview from micro");
  });

  it("only pauses once the rest of the round has finished, and can retry one seat at a time", async () => {
    let release!: () => void;
    const held = new Promise<void>((res) => { release = res; });
    let micro = 0;
    const { engine, cfg } = setup(async (p) => {
      const role = roleIn(p);
      if (!p.includes("first opinion")) return "ok";
      if (role === "surg") throw new ProviderError("bad request", 400);
      if (role === "micro" && micro++ === 0) throw new ProviderError("bad request", 400);
      if (role === "rad") await held;
      return "ok";
    });
    const running = engine.run(cfg);
    await vi.waitFor(() => expect(engine.getSnapshot().retryable).toEqual(["0:surg", "0:micro"]));
    // The radiologist is still answering, so the meeting isn't paused yet, but the failed seats can already be retried.
    expect(engine.getSnapshot().paused).toBe(false);
    engine.retry("0:micro");
    await vi.waitFor(() => expect(engine.getSnapshot().rounds[0].cards[1].status).toBe("done"));
    expect(engine.getSnapshot().retryable).toEqual(["0:surg"]);
    release();
    await vi.waitFor(() => expect(engine.getSnapshot().paused).toBe(true));
    expect(engine.getSnapshot().active).toBe(0);
    engine.carryOn();
    const rec = await running;
    expect(engine.getSnapshot()).toMatchObject({ paused: false, retryable: [] });
    expect(rec.rounds.map((r) => r.entries.filter((e) => e.response).length)).toEqual([2, 3, 1]);
    expect(rec.rounds[0].entries[0].earlierErrors).toBeUndefined();
  });

  it("ends the meeting if Stop is pressed while it waits", async () => {
    const { engine, cfg } = setup(async (p) => { if (roleIn(p) === "rad") throw new ProviderError("Overloaded", 503); return "ok"; });
    answerPauses(engine, ["stop"]);
    const rec = await engine.run(cfg);
    expect(rec.stoppedEarly).toBe(true);
    expect(rec.rounds.map((r) => r.name)).toEqual(["First opinions"]);
    expect(rec.rounds[0].entries[2].error).toBe("503: Overloaded");
    expect(engine.getSnapshot()).toMatchObject({ active: -1, running: false, paused: false, retryable: [] });
  });

  it("marks seats that hadn't started as stopped when Stop is pressed", async () => {
    const { engine, cfg } = setup(async (p, req) => {
      if (p.includes("Discussion round")) {
        engine.stop();
        // Like fetch: reject at once if already aborted, otherwise when the abort comes.
        return new Promise<string>((_, rej) => {
          const abort = () => rej(new DOMException("Aborted", "AbortError"));
          if (req.signal.aborted) abort(); else req.signal.addEventListener("abort", abort);
        });
      }
      return "ok";
    });
    const rec = await engine.run(cfg);
    expect(rec.stoppedEarly).toBe(true);
    expect(rec.rounds[1].entries.map((e) => e.error)).toEqual(["stopped", "stopped", "stopped"]);
    expect(engine.getSnapshot().rounds[1].cards.map((c) => [c.status, c.error])).toEqual(Array(3).fill(["stopped", "Stopped."]));
  });

  describe("with images", () => {
    it("runs the imaging review first and gives everyone the report as part of the case", async () => {
      const { engine, cfg, sent } = setup(async (p) => isImaging(p) ? "## Findings\nloose cup" : "ok from " + roleIn(p));
      const rec = await engine.run({ ...cfg, images: IMAGES });
      expect(rec.rounds.map((r) => r.name)).toEqual(["Imaging review", "First opinions", "Discussion 1", "Chair's decision"]);
      expect(sent[0].types).toEqual(["text", "image", "text", "image", "text"]);
      expect(sent.slice(1).every((s) => s.types.length === 1)).toBe(true);
      for (const s of sent.slice(1)) expect(s.prompt).toContain("IMAGING REPORT (written by the radiologist from 2 attached anonymised images before the meeting):\n## Findings\nloose cup");
      expect(sent[sent.length - 1].prompt).not.toContain("=== Imaging review ===");
      expect(rec.images!.map((i) => i.label)).toEqual(["Image 1", "Image 2"]);
      expect(rec.rounds[0].entries[0].images).toEqual(["Image 1: AP pelvis", "Image 2 (no caption)"]);
      expect(rec.rounds[1].entries[0].images).toBeUndefined();
      const view = engine.getSnapshot();
      expect(view.steps).toEqual(["Imaging review", "First opinions", "Discussion 1", "Chair's decision"]);
      expect(view.active).toBe(4);
      expect(view.rounds[0].cards[0]).toMatchObject({ imaging: true, roleId: "rad" });
    });

    it("sends the images with every first opinion only when asked", async () => {
      const { engine, cfg, sent } = setup(async () => "ok");
      await engine.run({ ...cfg, images: IMAGES, showImagesToAll: true });
      const firsts = sent.filter((s) => s.prompt.includes("Give your first opinion"));
      expect(firsts.every((s) => s.types.filter((t) => t === "image").length === 2)).toBe(true);
      expect(firsts[0].prompt).toContain("The same images are attached above");
      expect(sent.filter((s) => s.prompt.includes("Discussion round")).every((s) => s.types.length === 1)).toBe(true);
    });

    it("carries on without a report if the imaging review fails", async () => {
      const { engine, cfg, sent } = setup(async (p) => { if (isImaging(p)) throw new ProviderError("image_url is only supported by certain models", 400); return "ok"; });
      let whilePaused = "";
      answerPauses(engine, ["carry on"], () => { whilePaused = engine.getSnapshot().rounds[0].cards[0].error!; });
      const rec = await engine.run({ ...cfg, images: IMAGES });
      expect(whilePaused).toMatch(/run the meeting again\.$/);
      expect(rec.stoppedEarly).toBe(false);
      expect(rec.rounds).toHaveLength(4);
      expect(sent.slice(1).every((s) => !s.prompt.includes("IMAGING REPORT"))).toBe(true);
      expect(engine.getSnapshot().rounds[0].cards[0].error).toBe("OpenAI couldn't read the images with gpt-test. It said: \"image_url is only supported by certain models\". Choose a model that can read images for this seat, such as vision-model, and run the meeting again. The meeting will carry on without an imaging report.");
    });

    it("ends the meeting after the imaging review if it's stopped there", async () => {
      const { engine, cfg } = setup(async () => { throw new ProviderError("bad key", 401); });
      answerPauses(engine, ["stop"]);
      const rec = await engine.run({ ...cfg, images: IMAGES });
      expect(engine.getSnapshot().planned).toBe(8);
      expect(rec.rounds.map((r) => r.name)).toEqual(["Imaging review"]);
      expect(engine.getSnapshot().rounds[0].cards[0].error).toBe("OpenAI rejected the API key. Check you pasted the whole key into the right box.");
    });

    it("puts the images and the labelled report in the PDF", async () => {
      const { engine, cfg } = setup(async (p) => isImaging(p) ? "## Findings\nloose cup" : "ok");
      const pdf = JSON.stringify(buildPdf(await engine.run({ ...cfg, images: IMAGES })));
      expect(pdf).toContain("Images and imaging review");
      expect(pdf).toContain("AI image interpretation. Unvalidated, for research only. ");
      expect(pdf).toContain("data:image/jpeg;base64,AAAA");
      expect(pdf).toContain("Image 1: AP pelvis");
      expect(pdf).toContain("2 attached");
      const plain = JSON.stringify(buildPdf(await engine.run(cfg)));
      expect(plain).not.toContain("Images and imaging review");
    });
  });
});
