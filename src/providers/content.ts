import type { Part } from "./types";

// Text-only messages are sent as a plain string, exactly as the original single-file app did.
// Messages with images become a list of parts, in the order given (labels and images first, then
// the prompt, as both providers recommend).
const allText = (parts: Part[]): parts is Extract<Part, { type: "text" }>[] => parts.every((p) => p.type === "text");

export function openaiContent(parts: Part[]) {
  if (allText(parts)) return parts.map((p) => p.text).join("\n\n");
  return parts.map((p) => p.type === "text"
    ? { type: "text", text: p.text }
    // "high" detail: radiographs need it, and at 1,568 px it isn't downscaled further.
    : { type: "image_url", image_url: { url: `data:${p.mediaType};base64,${p.base64}`, detail: "high" } });
}

export function anthropicContent(parts: Part[]) {
  if (allText(parts)) return parts.map((p) => p.text).join("\n\n");
  return parts.map((p) => p.type === "text"
    ? { type: "text", text: p.text }
    : { type: "image", source: { type: "base64", media_type: p.mediaType, data: p.base64 } });
}
