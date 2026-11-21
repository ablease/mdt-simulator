import type { MeetingEngine } from "../../src/meeting/engine";

export type PauseAnswer = "carry on" | "retry" | "stop";

// Answers each pause in a meeting in turn, as the person watching would, and notes which cards were
// waiting each time. Pauses beyond the list of answers are carried on from.
export function answerPauses(engine: MeetingEngine, answers: PauseAnswer[] = [], before?: () => void) {
  const seen: string[][] = [];
  let wasPaused = false;
  engine.subscribe(() => {
    const v = engine.getSnapshot();
    if (v.paused && !wasPaused) {
      seen.push(v.retryable);
      const answer = answers.shift() ?? "carry on";
      // After the engine has finished publishing, as a click would be.
      queueMicrotask(() => {
        before?.();
        if (answer === "retry") engine.retryAll();
        else if (answer === "stop") engine.stop();
        else engine.carryOn();
      });
    }
    wasPaused = v.paused;
  });
  return seen;
}
