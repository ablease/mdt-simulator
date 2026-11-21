// Stands in for api.openai.com and api.anthropic.com so whole meetings run without real keys.
// Replies are streamed as server-sent events in the shapes each provider really uses.
import type { Page, Route } from "@playwright/test";
import { ALL_SEATS, CHAIR } from "../../src/prompts/roles";

export type MockProvider = "openai" | "anthropic";

export interface Call {
  provider: MockProvider;
  index: number;
  headers: Record<string, string>;
  rawBody: string;
  body: { model: string; stream: boolean; max_tokens?: number; messages: { role: string; content: string }[] };
  prompt: string;
  // Seat id ("surg", "chair", …) and round ("first", "discussion 1", "chair"), worked out from the prompt.
  role: string;
  round: string;
}

export type Reply =
  | { kind: "stream"; text: string }
  | { kind: "error"; status: number; message: string; type?: string }
  // Leave the request open until release() is called, to test stopping mid-call.
  | { kind: "hold" };

export interface MockOptions {
  reply?: (call: Call, calls: Call[]) => Reply | undefined;
  models?: Partial<Record<MockProvider, string[]>>;
}

export function roleOf(prompt: string): string {
  if (prompt.includes("You are the chair of the MDT.")) return CHAIR.id;
  const role = ALL_SEATS.find((r) => prompt.includes("You are " + r.brief));
  return role ? role.id : "unknown";
}

export function roundOf(prompt: string): string {
  if (prompt.includes("Give your first opinion independently.")) return "first";
  const m = prompt.match(/Discussion round (\d+)\./);
  if (m) return "discussion " + m[1];
  if (prompt.includes("You are the chair of the MDT.")) return "chair";
  return "unknown";
}

export function defaultText(call: Pick<Call, "role" | "round" | "provider" | "body">): string {
  const tag = `${call.role} on ${call.provider} (${call.body.model})`;
  if (call.round === "first") {
    return `## Key concerns\n- Concern raised by **${tag}**\n- Raised inflammatory markers\n\n## What I'd want to know\n1. Repeat aspirate off antibiotics\n2. CT with metal artefact reduction\n\n## My recommendation\nTwo-stage revision, says ${call.role}.\n\n## Confidence (low / moderate / high, with one line why)\nModerate: this is a mocked answer.`;
  }
  if (call.round.startsWith("discussion")) {
    return `## Where I agree\n- Agree with the microbiologist (${tag})\n\n## Where I disagree\n- Nothing major\n\n## My position now (say clearly whether it has changed and why)\nUnchanged after ${call.round}.`;
  }
  return `## MDT decision\n**Two-stage revision** of the acetabular component (${tag}).\n\n## Rationale\n- Probable infection\n- Loose cup\n\n## Before surgery (investigations or optimisation still needed)\n- Optimise diabetes\n\n## Dissent recorded\nNone.\n\n## Level of agreement (unanimous / majority / no consensus, and who differed)\nMajority.`;
}

const chunks = (text: string, size = 24) => text.match(new RegExp(`[\\s\\S]{1,${size}}`, "g")) ?? [];

export function openaiSSE(text: string): string {
  const ev = (o: unknown) => "data: " + JSON.stringify(o) + "\n\n";
  return ev({ id: "chatcmpl-mock", object: "chat.completion.chunk", choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] })
    + chunks(text).map((c) => ev({ id: "chatcmpl-mock", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: c }, finish_reason: null }] })).join("")
    + ev({ id: "chatcmpl-mock", object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })
    + "data: [DONE]\n\n";
}

export function anthropicSSE(text: string): string {
  const ev = (type: string, o: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...o })}\n\n`;
  return ev("message_start", { message: { id: "msg_mock", type: "message", role: "assistant", content: [], model: "mock", stop_reason: null, usage: { input_tokens: 10, output_tokens: 1 } } })
    + ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } })
    + ev("ping", {})
    + chunks(text).map((c) => ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: c } })).join("")
    + ev("content_block_stop", { index: 0 })
    + ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 50 } })
    + ev("message_stop", {});
}

const DEFAULT_MODELS: Record<MockProvider, string[]> = {
  openai: ["gpt-5", "gpt-5-mini", "gpt-4.1", "whisper-1", "text-embedding-3-small"],
  anthropic: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"],
};

export async function mockProviders(page: Page, opts: MockOptions = {}) {
  const calls: Call[] = [];
  const held: (() => void)[] = [];

  const handler = (provider: MockProvider) => async (route: Route) => {
    const req = route.request();
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": req.headers()["access-control-request-headers"] ?? "*",
    };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (new URL(req.url()).pathname === "/v1/models") {
      const models = opts.models?.[provider] ?? DEFAULT_MODELS[provider];
      return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify({ data: models.map((id) => ({ id })) }) });
    }
    const rawBody = req.postData() ?? "";
    const body = JSON.parse(rawBody);
    const prompt = body.messages[0].content as string;
    const call: Call = { provider, index: calls.length, headers: req.headers(), rawBody, body, prompt, role: roleOf(prompt), round: roundOf(prompt) };
    calls.push(call);
    const reply = opts.reply?.(call, calls) ?? { kind: "stream", text: defaultText(call) };

    if (reply.kind === "hold") {
      await new Promise<void>((r) => held.push(r));
      await route.abort().catch(() => {});
      return;
    }
    if (reply.kind === "error") {
      const type = reply.type ?? "api_error";
      const err = provider === "openai" ? { error: { message: reply.message, type } } : { type: "error", error: { type, message: reply.message } };
      return route.fulfill({ status: reply.status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(err) });
    }
    return route.fulfill({
      status: 200,
      headers: { ...cors, "content-type": "text/event-stream", "cache-control": "no-cache" },
      body: provider === "openai" ? openaiSSE(reply.text) : anthropicSSE(reply.text),
    });
  };

  await page.route("https://api.openai.com/**", handler("openai"));
  await page.route("https://api.anthropic.com/**", handler("anthropic"));
  return { calls, release: () => held.splice(0).forEach((r) => r()) };
}
