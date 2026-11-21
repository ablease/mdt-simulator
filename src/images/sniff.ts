// Works out what a file really is from its first bytes, not its name or the browser's guess.
export type Sniffed = "png" | "jpeg" | "heic" | "gif" | "webp" | "dicom" | "unknown";

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

export function sniff(b: Uint8Array): Sniffed {
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 4) === "PNG" && b[4] === 0x0d && b[5] === 0x0a) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 12 && ascii(b, 4, 8) === "ftyp" && /^(heic|heix|hevc|heim|heis|mif1|msf1|avif)$/.test(ascii(b, 8, 12))) return "heic";
  if (b.length >= 6 && /^GIF8[79]a$/.test(ascii(b, 0, 6))) return "gif";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "webp";
  if (b.length >= 132 && ascii(b, 128, 132) === "DICM") return "dicom";
  return "unknown";
}

// The size to draw at: the long edge capped at `max`, never enlarged.
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
