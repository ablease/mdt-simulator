// Test images with planted identifiers in their metadata, so tests can prove the app strips them.
import type { Page } from "@playwright/test";

export const PLANTED = ["SMITH JOHN", "NHS 943 476 5919", "JONES MARY"];

// Draws a test picture in the browser: a grey gradient, a white block, and optionally burned-in text.
export async function makeImage(page: Page, opts: { width: number; height: number; type: "image/png" | "image/jpeg"; text?: string; fill?: string }): Promise<Buffer> {
  const b64 = await page.evaluate(({ width, height, type, text, fill }) => {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d")!;
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, width, height);
    } else {
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, "#333");
      g.addColorStop(1, "#ccc");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#fff";
      ctx.fillRect(width * 0.4, height * 0.3, width * 0.2, height * 0.4);
    }
    if (text) {
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.round(height / 12)}px sans-serif`;
      ctx.fillText(text, 10, Math.round(height / 10));
    }
    return c.toDataURL(type, 0.95).split(",")[1];
  }, opts);
  return Buffer.from(b64, "base64");
}

const u16 = (n: number) => Buffer.from([(n >> 8) & 0xff, n & 0xff]);
const u32 = (n: number) => Buffer.from([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);

// Adds an EXIF block (Artist, and optionally Orientation) and a comment segment straight after the JPEG start marker.
export function withJpegMetadata(jpeg: Buffer, opts: { artist: string; comment: string; orientation?: number }): Buffer {
  const artist = Buffer.from(opts.artist + "\0", "latin1");
  const entries: Buffer[] = [];
  const count = opts.orientation ? 2 : 1;
  const dataOffset = 8 + 2 + count * 12 + 4;
  if (opts.orientation) entries.push(Buffer.concat([u16(0x0112), u16(3), u32(1), u16(opts.orientation), u16(0)]));
  entries.push(Buffer.concat([u16(0x013b), u16(2), u32(artist.length), u32(dataOffset)]));
  const tiff = Buffer.concat([Buffer.from("MM\0*", "latin1"), u32(8), u16(count), ...entries, u32(0), artist]);
  const exif = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), u16(exif.length + 2), exif]);
  const text = Buffer.from(opts.comment, "latin1");
  const com = Buffer.concat([Buffer.from([0xff, 0xfe]), u16(text.length + 2), text]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, com, jpeg.subarray(2)]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// Adds a tEXt chunk after the PNG header chunk.
export function withPngText(png: Buffer, key: string, value: string): Buffer {
  const typeAndData = Buffer.concat([Buffer.from("tEXt", "latin1"), Buffer.from(key + "\0" + value, "latin1")]);
  const chunk = Buffer.concat([u32(typeAndData.length - 4), typeAndData, u32(crc32(typeAndData))]);
  const afterHeader = 8 + 25;
  return Buffer.concat([png.subarray(0, afterHeader), chunk, png.subarray(afterHeader)]);
}

// Reads a JPEG's pixel size from its start-of-frame segment.
export function jpegSize(buf: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error("No JPEG frame header found");
}

export const heicBytes = () => Buffer.concat([u32(24), Buffer.from("ftypheic", "latin1"), Buffer.alloc(200)]);
export const gifBytes = () => Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.alloc(200)]);
export const dicomBytes = () => Buffer.concat([Buffer.alloc(128), Buffer.from("DICM", "latin1"), Buffer.alloc(200)]);
