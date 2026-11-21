// Freezes the prompt wording and role briefs. The parity tests prove these match the original app;
// if a snapshot changes, the prompts' meaning may have changed and needs agreement first.
import { describe, expect, it } from "vitest";
import { CASES } from "../../src/cases/cases";
import { chairPrompt, discussPrompt, FRAME, firstPrompt, imageLabel, imagingPrompt, seeImagesNote, withImagingReport } from "../../src/prompts/prompts";
import { ALL_SEATS, ROLES } from "../../src/prompts/roles";

describe("prompts", () => {
  it("keeps the shared framing", () => expect(FRAME).toMatchSnapshot());
  it("keeps every role brief", () => expect(ALL_SEATS.map((r) => ({ id: r.id, name: r.name, brief: r.brief, focus: r.focus }))).toMatchSnapshot());
  it("keeps the first-opinion prompt", () => expect(firstPrompt(ROLES[0], "CASE")).toMatchSnapshot());
  it("keeps the discussion prompt", () => expect(discussPrompt(ROLES[1], "CASE", "### Someone\nview", 2)).toMatchSnapshot());
  it("keeps the chair prompt", () => expect(chairPrompt("CASE", "=== First opinions ===")).toMatchSnapshot());
  it("keeps the built-in cases", () => expect(CASES).toMatchSnapshot());
});

describe("image prompts", () => {
  it("keeps the imaging review prompt", () => expect(imagingPrompt(ROLES[2], "CASE", 3)).toMatchSnapshot());
  it("words the imaging review for a single image", () => expect(imagingPrompt(ROLES[2], "CASE", 1)).toMatchSnapshot());
  it("labels images with or without a caption", () => {
    expect(imageLabel(0, "  AP pelvis ")).toBe("Image 1: AP pelvis");
    expect(imageLabel(1, " ")).toBe("Image 2 (no caption)");
  });
  it("adds the report to the case as a colleague's report", () => {
    expect(withImagingReport("CASE", "## Findings\nX\n", 2)).toBe("CASE\n\nIMAGING REPORT (written by the radiologist from 2 attached anonymised images before the meeting):\n## Findings\nX");
  });
  it("only changes the first-opinion prompt when images are shown to everyone", () => {
    expect(firstPrompt(ROLES[0], "CASE", "")).toBe(firstPrompt(ROLES[0], "CASE"));
    expect(firstPrompt(ROLES[0], "CASE", seeImagesNote(2))).toMatchSnapshot();
    expect(seeImagesNote(1)).toBe("The same image is attached above, labelled Image 1. You may look at it yourself, but describe only what you can see.");
  });
});
