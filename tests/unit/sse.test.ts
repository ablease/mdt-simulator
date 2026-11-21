import { describe, expect, it } from "vitest";
import { readSSE } from "../../src/providers/sse";

// A Response whose body arrives in the given pieces, to test lines split across network chunks.
const streamOf = (pieces: string[]) => new Response(new ReadableStream({
  start(c) { const enc = new TextEncoder(); pieces.forEach((p) => c.enqueue(enc.encode(p))); c.close(); },
}));

async function collect(pieces: string[]) {
  const out: string[] = [];
  await readSSE(streamOf(pieces), (d) => out.push(d));
  return out;
}

describe("readSSE", () => {
  it("joins data lines split across chunks", async () => {
    expect(await collect(['data: {"a"', ':1}\n\nda', 'ta: [DONE]\n\n'])).toEqual(['{"a":1}', "[DONE]"]);
  });
  it("ignores event names, comments and blank lines, and handles CRLF", async () => {
    expect(await collect(["event: ping\r\n: keep-alive\r\ndata: x\r\n\r\n"])).toEqual(["x"]);
  });
  it("reads a final data line with no newline", async () => {
    expect(await collect(["data: one\n", "data: two"])).toEqual(["one", "two"]);
  });
  it("splits a multi-byte character across chunks correctly", async () => {
    const bytes = new TextEncoder().encode("data: µL\n");
    const res = new Response(new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, 7)); c.enqueue(bytes.slice(7)); c.close(); } }));
    const out: string[] = [];
    await readSSE(res, (d) => out.push(d));
    expect(out).toEqual(["µL"]);
  });
  it("stops with the error a handler throws", async () => {
    await expect(readSSE(streamOf(["data: bad\n"]), () => { throw new Error("boom"); })).rejects.toThrow("boom");
  });
});
