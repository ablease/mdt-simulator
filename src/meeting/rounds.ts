// The rounds of a meeting, in order, with the line shown under each heading.
export const IMAGING = "Imaging review";
export const FIRST = "First opinions";
export const CHAIR_ROUND = "Chair's decision";
export const discussionName = (k: number) => "Discussion " + k;
// Added to a failed imaging review's message once the meeting has moved on without it.
export const IMAGING_CARRY_ON = " The meeting will carry on without an imaging report.";

export function roundDesc(name: string): string {
  if (name === IMAGING) return "The radiologist reviews the attached images before the meeting. The other consultants will read this report.";
  if (name === FIRST) return "Each consultant reads the case alone. Nobody has seen anyone else's view yet.";
  if (name === CHAIR_ROUND) return "The chair reads the whole discussion and records the outcome.";
  return "Everyone has now read all the other opinions and responds to them.";
}

// Every round a meeting is set to have, whether or not it got that far.
export const plannedRounds = (hasImages: boolean, discussionRounds: number) =>
  (hasImages ? [IMAGING] : []).concat([FIRST], Array.from({ length: discussionRounds }, (_, i) => discussionName(i + 1)), [CHAIR_ROUND]);
