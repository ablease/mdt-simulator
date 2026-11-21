// What the progress line and the "waiting for you" panel say about a meeting on screen.
import type { MeetingView } from "./types";

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

export function progressOf(v: MeetingView) {
  const cards = v.rounds.flatMap((r) => r.cards);
  const answers = cards.filter((c) => c.status === "done").length;
  const failed = cards.filter((c) => c.status === "failed").length;
  // Calls that have ended one way or another, for the bar.
  const ended = cards.filter((c) => c.status === "done" || c.status === "failed" || c.status === "stopped").length;
  let where: string;
  if (v.paused) where = "Waiting for you";
  else if (v.running) where = v.steps[v.active] ?? "Starting";
  else where = v.record?.stoppedEarly ? "Stopped" : "Finished";
  return {
    label: `${where} · ${answers} of ${v.planned} answers` + (failed ? ` · ${failed} failed` : ""),
    fraction: v.planned ? Math.min(1, ended / v.planned) : 0,
  };
}

export interface Pause {
  title: string;
  body: string;
  retryLabel: string;
  carryOnLabel: string;
}

// Set while the meeting waits to hear whether to try failed seats again.
export function pauseOf(v: MeetingView): Pause | null {
  if (!v.paused) return null;
  const cards = v.rounds.flatMap((r) => r.cards).filter((c) => v.retryable.includes(c.id));
  if (cards.some((c) => c.imaging)) return {
    title: "The imaging review didn't work",
    body: "Try again, or carry on without an imaging report. The other consultants will then work from the written case alone.",
    retryLabel: "Try again", carryOnLabel: "Carry on without a report",
  };
  if (cards.some((c) => c.chair)) return {
    title: "The chair didn't give a decision",
    body: "Try again, or finish the meeting without a decision.",
    retryLabel: "Try again", carryOnLabel: "Finish without a decision",
  };
  const n = cards.length;
  return {
    title: n === 1 ? `The ${lowerFirst(cards[0].roleName)} didn't answer` : `${n} consultants didn't answer`,
    body: "Try again, or carry on without them. The next round won't start until you choose.",
    retryLabel: n === 1 ? "Try again" : `Try all ${n} again`,
    carryOnLabel: "Carry on without them",
  };
}

// A short sentence for screen readers when the meeting moves on. Empty for a meeting that wasn't
// run in this tab, so opening a saved one doesn't announce anything.
export function announcementOf(v: MeetingView, ranHere: boolean): string {
  if (!ranHere) return "";
  const pause = pauseOf(v);
  if (pause) return `The meeting is waiting for you. ${pause.title}.`;
  if (v.running) return v.steps[v.active] ? `${v.steps[v.active]} under way.` : "";
  return v.record?.stoppedEarly ? "The meeting was stopped." : "The meeting has finished.";
}
