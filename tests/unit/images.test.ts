import { describe, expect, it } from "vitest";
import { fitWithin, sniff } from "../../src/images/sniff";
import { anthropicContent, openaiContent } from "../../src/providers/content";
import type { Part } from "../../src/providers";

const bytes = (...parts: (number[] | string)[]) => new Uint8Array(parts.flatMap((p) => typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p));

describe("sniff", () => {
  it("recognises files by their first bytes", () => {
    expect(sniff(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(sniff(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniff(bytes([0, 0, 0, 24], "ftypheic"))).toBe("heic");
    expect(sniff(bytes("GIF89a"))).toBe("gif");
    expect(sniff(bytes("RIFF", [0, 0, 0, 0], "WEBP"))).toBe("webp");
    expect(sniff(bytes(Array(128).fill(0), "DICM"))).toBe("dicom");
    expect(sniff(bytes("%PDF-1.7"))).toBe("unknown");
  });
});

describe("fitWithin", () => {
  it("caps the long edge and keeps the shape", () => {
    expect(fitWithin(3000, 2000, 1568)).toEqual({ width: 1568, height: 1045 });
    expect(fitWithin(2000, 4000, 1568)).toEqual({ width: 784, height: 1568 });
  });
  it("never enlarges", () => expect(fitWithin(800, 600, 1568)).toEqual({ width: 800, height: 600 }));
});

const parts: Part[] = [
  { type: "text", text: "Image 1: AP pelvis" },
  { type: "image", mediaType: "image/jpeg", base64: "AAAA" },
  { type: "text", text: "PROMPT" },
];

describe("provider content", () => {
  it("sends text-only messages as a plain string, as before", () => {
    expect(openaiContent([{ type: "text", text: "hi" }])).toBe("hi");
    expect(anthropicContent([{ type: "text", text: "hi" }])).toBe("hi");
  });
  it("uses OpenAI's image_url parts with a data URL at high detail", () => {
    expect(openaiContent(parts)).toEqual([
      { type: "text", text: "Image 1: AP pelvis" },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA", detail: "high" } },
      { type: "text", text: "PROMPT" },
    ]);
  });
  it("uses Anthropic's base64 image blocks", () => {
    expect(anthropicContent(parts)).toEqual([
      { type: "text", text: "Image 1: AP pelvis" },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" } },
      { type: "text", text: "PROMPT" },
    ]);
  });
});
