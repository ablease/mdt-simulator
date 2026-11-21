import { anthropicContent } from "./content";
import { httpError, ProviderError } from "./errors";
import { readSSE } from "./sse";
import type { Provider } from "./types";

const headers = (key: string) => ({
  "x-api-key": key,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
});

export const anthropic: Provider = {
  id: "anthropic",
  label: "Anthropic",
  suggestions: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"],
  defaultModel: "claude-sonnet-5-5",
  keyPrefix: "sk-ant-",
  keyHelp: { url: "https://console.anthropic.com/settings/keys", linkText: "console.anthropic.com", after: ". Separate from a Claude subscription: add credit under Billing first." },

  async listModels(key) {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=100", { headers: headers(key) });
    if (!r.ok) throw await httpError(r);
    const j = await r.json();
    return ((j.data || []) as { id: string }[]).map((m) => m.id).sort();
  },

  async stream({ key, model, parts, signal, onText }) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal,
      headers: Object.assign({ "Content-Type": "application/json" }, headers(key)),
      body: JSON.stringify({ model, max_tokens: 2000, stream: true, messages: [{ role: "user", content: anthropicContent(parts) }] }),
    });
    if (!r.ok) throw await httpError(r);
    let text = "";
    await readSSE(r, (data) => {
      let j; try { j = JSON.parse(data); } catch { return; }
      if (j.type === "error") throw new ProviderError((j.error && j.error.message) || "Provider error", j.error && j.error.type === "overloaded_error" ? 529 : 0);
      if (j.type === "content_block_delta" && j.delta && j.delta.type === "text_delta") { text += j.delta.text; onText(text); }
    });
    return text;
  },
};
