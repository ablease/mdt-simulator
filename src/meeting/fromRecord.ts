// Rebuilds what the screen shows from a saved meeting record, so a past meeting looks as it did when it ran.
import { dataUrlOf } from "../images/process";
import { friendly, friendlyImageError, PIDS, PROVIDERS, ProviderError } from "../providers";
import { imageLabel } from "../prompts/prompts";
import { ALL_SEATS } from "../prompts/roles";
import { CHAIR_ROUND, FIRST, IMAGING, plannedRounds, roundDesc } from "./rounds";
import type { CardView, Entry, MeetingRecord, MeetingView } from "./types";

const colourOf = (roleId: string) => ALL_SEATS.find((r) => r.id === roleId)?.c ?? "var(--muted)";
const pidOf = (label: string) => PIDS.find((p) => PROVIDERS[p].label === label);

// The record keeps the provider's own error, e.g. "401: Incorrect API key provided".
// Turn it back into the plain-English message the card showed at the time.
export function shownError(e: Entry, imaging: boolean, meetingCarriedOn: boolean): string | null {
  if (!e.error) return null;
  if (e.error === "stopped") return "Stopped.";
  const m = e.error.match(/^(\d{3}): ([\s\S]*)$/);
  let err: unknown;
  if (m) err = new ProviderError(m[2], +m[1]);
  else if (/failed to fetch|networkerror|load failed/i.test(e.error)) err = new TypeError(e.error);
  else err = new ProviderError(e.error, 0);
  const pid = pidOf(e.provider);
  let message = e.images?.length ? friendlyImageError(err, e.provider, e.model, pid && PROVIDERS[pid].suggestions[0]) : friendly(err, e.provider);
  if (imaging && meetingCarriedOn) message += " The meeting will carry on without an imaging report.";
  return message;
}

export function viewFromRecord(rec: MeetingRecord): MeetingView {
  const images = rec.images ?? [];
  const steps = plannedRounds(images.length > 0, rec.discussionRounds);
  const carriedOn = rec.rounds.some((r) => r.name === FIRST);
  return {
    running: false,
    steps,
    active: rec.stoppedEarly ? -1 : steps.length,
    record: rec,
    rounds: rec.rounds.map((round, i) => ({
      name: round.name,
      desc: roundDesc(round.name),
      single: round.name === IMAGING || round.name === CHAIR_ROUND,
      cards: round.entries.map((e): CardView => ({
        id: i + ":" + e.roleId,
        roleId: e.roleId,
        roleName: e.role,
        colour: colourOf(e.roleId),
        model: e.provider + " · " + e.model,
        prompt: e.prompt,
        chair: e.roleId === "chair",
        imaging: round.name === IMAGING,
        // Entries list the labels of the images they were sent, in the order they were attached.
        images: e.images?.length ? e.images.map((label, k) => ({ label, dataUrl: dataUrlOf(images[k]?.data ?? "") })) : null,
        status: e.response ? "done" : e.error === "stopped" ? "stopped" : "failed",
        text: e.response ?? "",
        notice: null,
        error: e.response ? null : shownError(e, round.name === IMAGING, carriedOn),
      })),
    })),
  };
}

// The case, images and panel a meeting was run with, for the panel beside it.
export function detailsFromRecord(rec: MeetingRecord) {
  return {
    caseTitle: rec.caseTitle,
    caseText: rec.caseText,
    images: (rec.images ?? []).map((img, i) => ({ label: imageLabel(i, img.caption), dataUrl: dataUrlOf(img.data) })),
    imagesSeenByAll: !!rec.imagesSeenByAll,
    seats: rec.seats.map((s) => ({ id: s.roleId, name: s.role, colour: colourOf(s.roleId), model: s.provider + " · " + s.model })),
    rounds: rec.discussionRounds,
    startedAt: new Date(rec.startedAt),
  };
}
