// Saved meeting records for unit tests, shaped like the ones the engine writes.
import { emptyResearch } from "../../src/meeting/summary";
import type { Entry, MeetingRecord, Research, SavedRecord } from "../../src/meeting/types";

export const CHAIR_ANSWER = "## MDT decision\n**Two-stage revision** of the acetabular component.\n\n## Rationale\n- Probable infection\n\n## Level of agreement (unanimous / majority / no consensus, and who differed)\nMajority: the microbiologist differed.";

const entry = (roleId: string, role: string, provider: string, model: string, response: string | null, error: string | null = null): Entry => ({
  roleId, role, provider, model, prompt: `Prompt for ${roleId}`, response, error,
  started: "2026-11-21T10:15:01.000Z", ...(response ? { finished: "2026-11-21T10:15:09.000Z" } : {}),
});

export function sampleRecord(over: Partial<MeetingRecord> = {}): MeetingRecord {
  return {
    tool: "Revision MDT Simulator (prototype)",
    note: "Not clinical advice.",
    caseId: "pji-hip",
    caseTitle: "Painful hip, possible infection",
    caseText: "FICTIONAL TEST CASE 1",
    seats: [
      { roleId: "surg", role: "Revision arthroplasty surgeon", brief: "a surgeon", provider: "OpenAI", model: "gpt-5-mini" },
      { roleId: "micro", role: "Consultant microbiologist", brief: "a microbiologist", provider: "OpenAI", model: "gpt-5-mini" },
      { roleId: "chair", role: "MDT chair", brief: "the chair", provider: "Anthropic", model: "claude-haiku-5-5" },
    ],
    discussionRounds: 1,
    startedAt: "2026-11-21T10:15:00.000Z",
    rounds: [
      { name: "First opinions", entries: [
        entry("surg", "Revision arthroplasty surgeon", "OpenAI", "gpt-5-mini", "## Key concerns\n- Loose cup"),
        entry("micro", "Consultant microbiologist", "OpenAI", "gpt-5-mini", null, "429: Rate limit reached"),
      ] },
      { name: "Discussion 1", entries: [
        entry("surg", "Revision arthroplasty surgeon", "OpenAI", "gpt-5-mini", "## Where I agree\n- Mostly"),
        entry("micro", "Consultant microbiologist", "OpenAI", "gpt-5-mini", null, "stopped"),
      ] },
      { name: "Chair's decision", entries: [entry("chair", "MDT chair", "Anthropic", "claude-haiku-5-5", CHAIR_ANSWER)] },
    ],
    finishedAt: "2026-11-21T10:16:00.000Z",
    stoppedEarly: false,
    ...over,
  };
}

export function savedRecord(id: string, research: Partial<Research> = {}, over: Partial<MeetingRecord> = {}): SavedRecord {
  const { tool, note, ...rest } = sampleRecord(over);
  return { tool, note, id, ...rest, research: { ...emptyResearch(), ...research } };
}
