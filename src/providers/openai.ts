import { openaiContent } from "./content";
import { httpError, ProviderError } from "./errors";
import { readSSE } from "./sse";
import type { Provider } from "./types";

export const openai: Provider = {
  id: "openai",
  label: "OpenAI",
  suggestions: ["gpt-5", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini"],
  defaultModel: "gpt-5-mini",
  keyPrefix: "sk-",
  keyHelp: { url: "https://platform.openai.com/api-keys", linkText: "platform.openai.com/api-keys", after: ". Separate from ChatGPT: add credit under Billing first." },

  async listModels(key) {
    const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: "Bearer " + key } });
    if (!r.ok) throw await httpError(r);
    const j = await r.json();
    return ((j.data || []) as { id: string }[]).map((m) => m.id)
      .filter((id) => /^(gpt|o\d|chatgpt)/i.test(id) && !/(audio|realtime|transcribe|tts|image|search|embedding|instruct|moderation)/i.test(id))
      .sort();
  },

  async stream({ key, model, parts, signal, onText }) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model, stream: true, messages: [{ role: "user", content: openaiContent(parts) }] }),
    });
    if (!r.ok) throw await httpError(r);
    let text = "";
    await readSSE(r, (data) => {
      if (data === "[DONE]") return;
      let j; try { j = JSON.parse(data); } catch { return; }
      if (j.error) throw new ProviderError(j.error.message || "Provider error");
      const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
      if (d) { text += d; onText(text); }
    });
    return text;
  },
};
