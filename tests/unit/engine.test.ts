import { describe, expect, it } from "vitest";
import { MeetingEngine, type MeetingConfig } from "../../src/meeting/engine";
import { ProviderError, type Provider, type ProviderId, type StreamRequest } from "../../src/providers";
import { ROLES } from "../../src/prompts/roles";
import { dec } from "../../src/storage/settings";

type Script = (prompt: string, req: StreamRequest) => Promise<string>;

// A provider whose answers come from a script, streamed in two halves.
function fake(id: ProviderId, script: Script): Provider {
  return {
    id, label: id === "openai" ? "OpenAI" : "Anthropic", suggestions: [], defaultModel: "m", keyPrefix: "", keyHelp: { url: "", linkText: "", after: "" },
    listModels: async () => [],
    async stream(req) {
      const prompt = (req.parts[0] as { text: string }).text;
      const text = await script(prompt, req);
      if (text) { req.onText(text.slice(0, 3)); req.onText(text); }
      return text;
    },
  };
}

const roleIn = (prompt: string) => prompt.includes("You are the chair") ? "chair" : ROLES.find((r) => prompt.includes(r.brief))!.id;

function setup(script: Script) {
  const sleeps: number[] = [];
  const provider = fake("openai", script);
  const engine = new MeetingEngine({
    providers: { openai: provider, anthropic: fake("anthropic", script) },
    getKey: () => "sk-test",
    sleep: async (ms, signal) => { sleeps.push(ms); if (signal.aborted) throw new DOMException("Aborted", "AbortError"); },
    now: () => new Date("2026-11-21T10:00:00Z"),
  });
  const cfg: MeetingConfig = {
    caseId: "pji-hip", caseTitle: "Test", caseText: "CASE TEXT",
    roles: ROLES.slice(0, 3), discussionRounds: 1, choiceFor: () => dec("openai|gpt-test"),
  };
  return { engine, cfg, sleeps };
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

  it("gives up after three attempts and keeps the meeting going", async () => {
    const { engine, cfg, sleeps } = setup(async (p) => {
      if (roleIn(p) === "surg" && p.includes("first opinion")) throw new ProviderError("Rate limit", 429);
      return "ok from " + roleIn(p);
    });
    const rec = await engine.run(cfg);
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
    const rec = await engine.run(cfg);
    expect(sleeps).toEqual([]);
    expect(engine.getSnapshot().rounds[0].cards[0]).toMatchObject({ status: "failed", text: "partial" });
    expect(rec.rounds[0].entries[0].response).toBeNull();
  });

  it("treats an empty answer as a failure without retrying", async () => {
    const { engine, cfg, sleeps } = setup(async (p) => roleIn(p) === "micro" ? "  " : "ok");
    const rec = await engine.run(cfg);
    expect(sleeps).toEqual([]);
    expect(rec.rounds[0].entries[1].error).toBe("The model returned an empty answer.");
  });

  it("stops the whole meeting when a key is rejected", async () => {
    const { engine, cfg } = setup(async () => { throw new ProviderError("bad key", 401); });
    const rec = await engine.run(cfg);
    expect(rec.stoppedEarly).toBe(true);
    expect(rec.rounds.map((r) => r.name)).toEqual(["First opinions"]);
    expect(engine.getSnapshot().active).toBe(-1);
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
});
