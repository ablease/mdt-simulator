import { describe, expect, it } from "vitest";
import { parseMd, runs } from "../../src/markdown/markdown";

describe("parseMd", () => {
  it("reads headings, bullet and numbered lists, and paragraphs", () => {
    expect(parseMd("## Key **concerns**\n- one\n* two\n1. three\n\nPlain text\n2) four")).toEqual([
      { t: "h", text: "Key concerns" },
      { t: "ul", items: ["one", "two", "three"] },
      { t: "p", text: "Plain text" },
      { t: "ul", items: ["four"] },
    ]);
  });
  it("starts a new list after a blank line or heading", () => {
    expect(parseMd("- a\n\n- b\n# H\n- c").filter((b) => b.t === "ul")).toHaveLength(3);
  });
});

describe("runs", () => {
  it("marks **bold** spans", () => {
    expect(runs("a **b** c **d**")).toEqual([{ text: "a " }, { text: "b", bold: true }, { text: " c " }, { text: "d", bold: true }]);
  });
  it("leaves unmatched asterisks alone", () => {
    expect(runs("5 ** 2 = 25")).toEqual([{ text: "5 ** 2 = 25" }]);
    expect(runs("****")).toEqual([{ text: "****" }]);
  });
});
