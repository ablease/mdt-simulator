// The one-line facts about a meeting that the history list, comparison report and CSV show.
import { parseMd, runs } from "../markdown/markdown";
import { CHAIR_ROUND } from "./rounds";
import type { MeetingRecord, Rating, SavedRecord } from "./types";

export type Agreement = "Unanimous" | "Majority" | "No consensus" | "";

export interface MeetingSummary {
  id: string;
  savedAt: string;
  startedAt: string;
  caseId: string;
  caseTitle: string;
  caseTag: string;
  // Every seat's provider and model, grouped, e.g. "OpenAI gpt-5-mini ×4 · Anthropic claude-haiku-5-5".
  panel: string;
  providers: string[];
  models: string[];
  discussionRounds: number;
  imageCount: number;
  // The first line of the chair's decision, or "" if the chair never answered.
  outcome: string;
  agreement: Agreement;
  rating: Rating;
  actualDecision: string;
  notes: string;
  stoppedEarly: boolean;
}

const plain = (s: string) => runs(s).map((r) => r.text).join("").trim();

// The first line under a "## heading" of the chair's answer, without markdown.
function firstLineUnder(md: string, heading: RegExp): string {
  const blocks = parseMd(md);
  const i = blocks.findIndex((b) => b.t === "h" && heading.test(b.text));
  const next = i >= 0 ? blocks[i + 1] : undefined;
  if (!next || next.t === "h") return "";
  return plain(next.t === "ul" ? next.items[0] : next.text);
}

export const chairAnswer = (rec: MeetingRecord) => rec.rounds.find((r) => r.name === CHAIR_ROUND)?.entries[0]?.response ?? null;

export const outcomeOf = (rec: MeetingRecord) => {
  const md = chairAnswer(rec);
  return md ? firstLineUnder(md, /^MDT decision/i) : "";
};

// The chair is asked for "unanimous / majority / no consensus"; whichever it names first is taken.
export function agreementOf(rec: MeetingRecord): Agreement {
  const md = chairAnswer(rec);
  if (!md) return "";
  const line = firstLineUnder(md, /^Level of agreement/i).toLowerCase().replace(/\bnot unanimous\b/g, "");
  const found = ([["unanimous", "Unanimous"], ["majority", "Majority"], ["no consensus", "No consensus"]] as const)
    .map(([word, label]) => ({ at: line.indexOf(word), label }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at);
  return found[0]?.label ?? "";
}

export function panelOf(rec: MeetingRecord): string {
  const counts = new Map<string, number>();
  for (const s of rec.seats) {
    const key = s.provider + " " + s.model;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join(" · ");
}

export function summarise(rec: SavedRecord, savedAt: string): MeetingSummary {
  return {
    id: rec.id,
    savedAt,
    startedAt: rec.startedAt,
    caseId: rec.caseId,
    caseTitle: rec.caseTitle || "Case discussion",
    caseTag: rec.research.caseTag,
    panel: panelOf(rec),
    providers: [...new Set(rec.seats.map((s) => s.provider))],
    models: [...new Set(rec.seats.map((s) => s.provider + " · " + s.model))],
    discussionRounds: rec.discussionRounds,
    imageCount: rec.images?.length ?? 0,
    outcome: outcomeOf(rec),
    agreement: agreementOf(rec),
    rating: rec.research.rating,
    actualDecision: rec.research.actualDecision,
    notes: rec.research.notes,
    stoppedEarly: !!rec.stoppedEarly,
  };
}

// True if at least one seat answered, so the meeting is worth keeping.
export const anyAnswer = (rec: MeetingRecord) => rec.rounds.some((r) => r.entries.some((e) => e.response));

export const emptyResearch = (caseTag = "") => ({ caseTag, actualDecision: "", rating: "" as Rating, notes: "", updatedAt: null });
