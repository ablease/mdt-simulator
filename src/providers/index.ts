import { anthropic } from "./anthropic";
import { openai } from "./openai";
import type { Provider, ProviderId } from "./types";

export const PROVIDERS: Record<ProviderId, Provider> = { openai, anthropic };
export const PIDS = Object.keys(PROVIDERS) as ProviderId[];

export type { Part, Provider, ProviderId, StreamRequest } from "./types";
export { friendly, ProviderError } from "./errors";
