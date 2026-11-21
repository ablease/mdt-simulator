// An image as the meeting engine and exports see it: already cleaned, downscaled and re-encoded.
export interface ImageInput {
  caption: string;
  mediaType: "image/jpeg";
  width: number;
  height: number;
  base64: string;
}

// An image attached to the case on screen. `checked` is the user's confirmation that they've
// looked for identifiers; it's cleared whenever the image changes.
export interface CaseImage extends ImageInput {
  id: string;
  dataUrl: string;
  checked: boolean;
}

// A black-out box in image pixels.
export interface Box { x: number; y: number; w: number; h: number }

export const MAX_IMAGES = 10;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
// Anthropic's standard-tier limit; below OpenAI's 2,048 px "high" detail cap.
export const MAX_LONG_EDGE = 1568;
export const JPEG_QUALITY = 0.9;
