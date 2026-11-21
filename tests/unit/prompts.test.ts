// Freezes the prompt wording and role briefs. The parity tests prove these match the original app;
// if a snapshot changes, the prompts' meaning may have changed and needs agreement first.
import { describe, expect, it } from "vitest";
import { CASES } from "../../src/cases/cases";
import { chairPrompt, discussPrompt, FRAME, firstPrompt } from "../../src/prompts/prompts";
import { ALL_SEATS, ROLES } from "../../src/prompts/roles";

describe("prompts", () => {
  it("keeps the shared framing", () => expect(FRAME).toMatchSnapshot());
  it("keeps every role brief", () => expect(ALL_SEATS.map((r) => ({ id: r.id, name: r.name, brief: r.brief, focus: r.focus }))).toMatchSnapshot());
  it("keeps the first-opinion prompt", () => expect(firstPrompt(ROLES[0], "CASE")).toMatchSnapshot());
  it("keeps the discussion prompt", () => expect(discussPrompt(ROLES[1], "CASE", "### Someone\nview", 2)).toMatchSnapshot());
  it("keeps the chair prompt", () => expect(chairPrompt("CASE", "=== First opinions ===")).toMatchSnapshot());
  it("keeps the built-in cases", () => expect(CASES).toMatchSnapshot());
});
