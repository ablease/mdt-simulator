// Every image is redrawn through a canvas before use. The canvas output carries pixels only, so
// EXIF (including GPS), comments and PNG text chunks are gone. The original file, and its name,
// are never kept.
import { fitWithin, jpegHasMetadata, sniff } from "./sniff";
import { JPEG_QUALITY, MAX_FILE_BYTES, MAX_LONG_EDGE, type Box, type ImageInput } from "./types";

export class ImageError extends Error {}

const MB = (n: number) => Math.round(n / 1024 / 1024);

function rejectReason(name: string, kind: ReturnType<typeof sniff>): string | null {
  switch (kind) {
    case "png": case "jpeg": return null;
    case "heic": return `"${name}" is an iPhone (HEIC) photo. Only PNG and JPEG images can be used. Open it and export or share it as a JPEG, then try again.`;
    case "dicom": return `"${name}" is a DICOM file. These can't be used yet, because they usually contain patient details. Export the image from your viewer as a JPEG instead, then black out any details on it.`;
    default: return `"${name}" isn't a PNG or JPEG image. Save or export it as PNG or JPEG, then try again.`;
  }
}

function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function toJpeg(c: HTMLCanvasElement): Promise<string> {
  return new Promise((res, rej) => c.toBlob((blob) => {
    if (!blob) return rej(new ImageError("The browser couldn't save the image. Try again, or try a different browser."));
    const reader = new FileReader();
    reader.onload = () => res((reader.result as string).split(",")[1]);
    reader.onerror = () => rej(new ImageError("The browser couldn't save the image. Try again."));
    reader.readAsDataURL(blob);
  }, "image/jpeg", JPEG_QUALITY));
}

// Draws onto a white background (so transparent PNGs don't turn black), halving in steps first so
// large downscales stay sharp rather than aliased.
function drawScaled(src: CanvasImageSource, sw: number, sh: number, tw: number, th: number): HTMLCanvasElement {
  let cur: CanvasImageSource = src, w = sw, h = sh;
  while (w / 2 >= tw && h / 2 >= th) {
    const half = canvas(Math.round(w / 2), Math.round(h / 2));
    const ctx = half.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(cur, 0, 0, half.width, half.height);
    cur = half; w = half.width; h = half.height;
  }
  const out = canvas(tw, th);
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, tw, th);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cur, 0, 0, tw, th);
  return out;
}

export async function processFile(file: File): Promise<Omit<ImageInput, "caption">> {
  if (file.size > MAX_FILE_BYTES) throw new ImageError(`"${file.name}" is larger than ${MB(MAX_FILE_BYTES)} MB. Save a smaller copy, then try again.`);
  const reason = rejectReason(file.name, sniff(new Uint8Array(await file.slice(0, 132).arrayBuffer())));
  if (reason) throw new ImageError(reason);
  let bitmap: ImageBitmap;
  try {
    // Applies any EXIF rotation, so the picture stays the right way up once the metadata is gone.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError(`"${file.name}" couldn't be opened as an image. It may be damaged. Try saving it again.`);
  }
  const size = fitWithin(bitmap.width, bitmap.height, MAX_LONG_EDGE);
  const out = drawScaled(bitmap, bitmap.width, bitmap.height, size.width, size.height);
  bitmap.close();
  return { mediaType: "image/jpeg", width: size.width, height: size.height, base64: await toJpeg(out) };
}

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new ImageError("The image couldn't be loaded. Try removing it and adding it again."));
    img.src = dataUrl;
  });
}

// Paints the boxes solid black into the pixels and re-encodes. There's no way back to what was under them.
export async function burnBoxes(dataUrl: string, width: number, height: number, boxes: Box[]): Promise<string> {
  const img = await loadImage(dataUrl);
  const c = canvas(width, height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);
  ctx.fillStyle = "#000";
  // Rounded outwards, so a box never leaves a sliver of the original at its edges.
  for (const b of boxes) {
    const x0 = Math.floor(b.x), y0 = Math.floor(b.y);
    ctx.fillRect(x0, y0, Math.ceil(b.x + b.w) - x0, Math.ceil(b.y + b.h) - y0);
  }
  return toJpeg(c);
}

export const dataUrlOf = (base64: string) => "data:image/jpeg;base64," + base64;

// Checks an image restored from a backup. It's kept as it is if it's a plain JPEG within the size limit,
// as this app saves them. Otherwise it's redrawn the same way as a new upload, dropping anything but the pixels.
export async function cleanStoredImage(base64: string): Promise<{ base64: string; width: number; height: number }> {
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  if (sniff(bytes) !== "jpeg") throw new ImageError("An image in the backup isn't a JPEG.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }), { imageOrientation: "from-image" });
  } catch {
    throw new ImageError("An image in the backup couldn't be opened. The file may be damaged.");
  }
  const { width, height } = bitmap;
  if (!jpegHasMetadata(bytes) && Math.max(width, height) <= MAX_LONG_EDGE) {
    bitmap.close();
    return { base64, width, height };
  }
  const size = fitWithin(width, height, MAX_LONG_EDGE);
  const out = drawScaled(bitmap, width, height, size.width, size.height);
  bitmap.close();
  return { base64: await toJpeg(out), width: size.width, height: size.height };
}
