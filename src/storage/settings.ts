import { PIDS, PROVIDERS, type ProviderId } from "../providers";
import { store } from "./local";

// A model choice is stored as "pid|model". On a seat, "" means "use the default model".
export interface Choice { pid: ProviderId; model: string }

export const enc = (pid: ProviderId, model: string) => pid + "|" + model;
export const dec = (v: string): Choice => {
  const i = v.indexOf("|");
  return { pid: v.slice(0, i) as ProviderId, model: v.slice(i + 1) };
};
export const describe = (c: Choice) => PROVIDERS[c.pid].label + " · " + c.model;

// Models from the provider's list (after "Check") plus any typed in by hand, else the built-in suggestions.
export function modelsFor(pid: ProviderId): string[] {
  const loaded = store.getJSON<string[]>("mdt.models." + pid, []);
  const custom = store.getJSON<string[]>("mdt.custom." + pid, []);
  const base = loaded.length ? loaded : PROVIDERS[pid].suggestions;
  return [...new Set(custom.concat(base))].sort();
}

export function saveModels(pid: ProviderId, models: string[]) {
  store.setJSON("mdt.models." + pid, models);
}

export function addCustomModel(pid: ProviderId, name: string) {
  const list = store.getJSON<string[]>("mdt.custom." + pid, []);
  if (!list.includes(name)) list.push(name);
  store.setJSON("mdt.custom." + pid, list);
}

export function loadDefaultChoice(): string {
  const saved = store.get("mdt.default");
  if (saved && PIDS.includes(dec(saved).pid)) return saved;
  // migrate from the single-provider version
  const oldP = store.get("mdt.provider");
  const pid: ProviderId = oldP && PIDS.includes(oldP as ProviderId) ? (oldP as ProviderId) : "openai";
  return enc(pid, store.get("mdt.model." + pid) || PROVIDERS[pid].defaultModel);
}

export function saveDefaultChoice(v: string) {
  store.set("mdt.default", v);
}

export function loadSeatChoices(): Record<string, string> {
  return store.getJSON<Record<string, string>>("mdt.seats", {});
}

export function saveSeatChoices(v: Record<string, string>) {
  store.setJSON("mdt.seats", v);
}
