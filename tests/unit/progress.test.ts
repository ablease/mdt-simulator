import { describe, expect, it } from "vitest";
import { viewFromRecord } from "../../src/meeting/fromRecord";
import { announcementOf, pauseOf, progressOf } from "../../src/meeting/progress";
import type { CardStatus, MeetingView } from "../../src/meeting/types";
import { sampleRecord } from "../support/records";

// The sample meeting as it looked partway through: only as many cards as there are states given.
function live(statuses: CardStatus[], retryable: string[] = [], paused = retryable.length > 0): MeetingView {
  const v = viewFromRecord(sampleRecord());
  let k = 0;
  const rounds = v.rounds
    .map((r) => ({ ...r, cards: r.cards.flatMap((c) => (k < statuses.length ? [{ ...c, status: statuses[k++] }] : [])) }))
    .filter((r) => r.cards.length);
  return { ...v, running: true, active: rounds.length - 1, rounds, retryable, paused, record: null };
}

describe("progress line", () => {
  it("counts answers against the calls planned, and failures separately", () => {
    // Two consultants, one discussion round and the chair: five calls.
    const v = live(["done", "done", "speaking"]);
    expect(progressOf(v)).toEqual({ label: "Discussion 1 · 2 of 5 answers", fraction: 0.4 });
    expect(progressOf(live(["done", "failed", "done"])).label).toBe("Discussion 1 · 2 of 5 answers · 1 failed");
    expect(progressOf(live(["done", "failed"], ["0:micro"])).label).toBe("Waiting for you · 1 of 5 answers · 1 failed");
    expect(progressOf(live(["done", "failed"])).label).toBe("First opinions · 1 of 5 answers · 1 failed");
  });

  it("says how a saved meeting ended", () => {
    expect(progressOf(viewFromRecord(sampleRecord())).label).toBe("Finished · 3 of 5 answers · 1 failed");
    expect(progressOf(viewFromRecord(sampleRecord({ stoppedEarly: true }))).label).toMatch(/^Stopped · /);
  });
});

describe("waiting for you", () => {
  it("names a single seat, or counts several", () => {
    expect(pauseOf(live(["failed", "done"], ["0:surg"]))).toMatchObject({ title: "The revision arthroplasty surgeon didn't answer", retryLabel: "Try again", carryOnLabel: "Carry on without them" });
    expect(pauseOf(live(["failed", "failed"], ["0:surg", "0:micro"]))).toMatchObject({ title: "2 consultants didn't answer", retryLabel: "Try all 2 again" });
  });

  it("offers to finish without a decision when the chair fails", () => {
    const v = live(["done", "done", "done", "done", "failed"], ["2:chair"]);
    expect(pauseOf(v)).toMatchObject({ title: "The chair didn't give a decision", carryOnLabel: "Finish without a decision" });
  });

  it("waits only once nothing else is running", () => {
    expect(pauseOf(live(["failed", "thinking"], ["0:surg"], false))).toBeNull();
  });

  it("announces changes only for a meeting run in this tab", () => {
    expect(announcementOf(live(["done", "done", "thinking"]), true)).toBe("Discussion 1 under way.");
    expect(announcementOf(live(["failed", "done"], ["0:surg"]), true)).toBe("The meeting is waiting for you. The revision arthroplasty surgeon didn't answer.");
    expect(announcementOf(viewFromRecord(sampleRecord()), true)).toBe("The meeting has finished.");
    expect(announcementOf(viewFromRecord(sampleRecord()), false)).toBe("");
  });
});
