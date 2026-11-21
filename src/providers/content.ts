import type { Part } from "./types";

// Text-only messages are sent as a plain string, exactly as the original single-file app did.
// Image parts get provider-specific shapes once Feature 1 lands.
export function textOnly(parts: Part[]): string {
  return parts.map((p) => {
    if (p.type !== "text") throw new Error("Image input isn't supported yet.");
    return p.text;
  }).join("\n\n");
}
