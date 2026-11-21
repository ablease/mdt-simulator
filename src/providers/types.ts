export type ProviderId = "openai" | "anthropic";

// One piece of a message. The meeting engine only sends text today; images arrive with Feature 1.
export type Part =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: "image/png" | "image/jpeg"; base64: string };

export interface StreamRequest {
  key: string;
  model: string;
  parts: Part[];
  signal: AbortSignal;
  // Called with the whole answer so far each time more of it arrives.
  onText: (text: string) => void;
}

export interface Provider {
  id: ProviderId;
  label: string;
  suggestions: string[];
  defaultModel: string;
  keyPrefix: string;
  keyHelp: { url: string; linkText: string; after: string };
  listModels(key: string): Promise<string[]>;
  // Resolves with the full answer once the stream ends.
  stream(req: StreamRequest): Promise<string>;
}
