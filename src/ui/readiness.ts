import { PROVIDERS, type ProviderId } from "../providers";
import type { Choice } from "../storage/settings";
import type { Route } from "./route";

// Whether the meeting can run. If it can, the message gives the number of AI calls and the providers used;
// if not, it says what's missing, and `fix` points to the page where it can be put right.
export interface Readiness { msg: string; bad: boolean; fix?: { label: string; to: Route } }

export interface ReadinessInput {
  caseText: string;
  consultants: number;
  rounds: number;
  images: number;
  imagesChecked: boolean;
  locked: boolean;
  hasKey: (pid: ProviderId) => boolean;
  usedChoices: Choice[];
}

export function readiness(i: ReadinessInput): Readiness {
  if (!i.caseText.trim()) return { msg: "The case is empty. Choose a test case, or write your own.", bad: true, fix: { label: "Go to the case", to: { page: "new", step: "case" } } };
  if (i.consultants < 2) return { msg: "Choose at least two consultants.", bad: true, fix: { label: "Choose consultants", to: { page: "new", step: "panel" } } };
  if (i.locked) return { msg: "Unlock your saved keys above. If you've forgotten the passphrase, press \"Forget keys\" in Settings and paste your keys in again.", bad: true };
  const missing = [...new Set(i.usedChoices.filter((c) => !i.hasKey(c.pid)).map((c) => PROVIDERS[c.pid].label))];
  if (missing.length) return { msg: "Add your " + missing.join(" and ") + " API key, or switch those seats to a provider you have a key for.", bad: true, fix: { label: "Add a key in Settings", to: { page: "settings" } } };
  if (!i.imagesChecked) return { msg: "Tick the box under each image to confirm you've checked it for identifiers.", bad: true, fix: { label: "Go to the images", to: { page: "new", step: "images" } } };
  const provs = [...new Set(i.usedChoices.map((c) => PROVIDERS[c.pid].label))];
  const calls = i.consultants * (1 + i.rounds) + 1 + (i.images ? 1 : 0);
  return { msg: `${i.images ? "Imaging review + " : ""}${i.consultants} consultants × ${1 + i.rounds} rounds + chair = ${calls} AI calls on ${provs.join(" and ")}`, bad: false };
}
