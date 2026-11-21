// The saved record of a meeting: what "Download JSON" writes out and what's kept in the browser.
// Fields from the original app come first, in its order, so older exports stay comparable.
export interface Entry {
  roleId: string;
  role: string;
  provider: string;
  model: string;
  prompt: string;
  // Labels of the images sent before the prompt text, e.g. "Image 1: AP pelvis". Absent when none were sent.
  images?: string[];
  response: string | null;
  error: string | null;
  started: string;
  // What went wrong on earlier tries, oldest first, when the seat was tried again. Absent if it wasn't.
  earlierErrors?: string[];
  finished?: string;
}

export interface Seat { roleId: string; role: string; brief: string; provider: string; model: string }

// An attached image, cleaned and re-encoded, with its JPEG data as base64.
export interface RecordImage { label: string; caption: string; mediaType: "image/jpeg"; width: number; height: number; data: string }

// What the researcher adds about a meeting. Kept with the meeting and in every export, but never sent to an AI provider.
export const RATINGS = ["agree", "partly agree", "disagree"] as const;
export type Rating = "" | (typeof RATINGS)[number];

export interface Research {
  // The researcher's own label for the case, so repeat runs group together, e.g. "PJI-01".
  caseTag: string;
  actualDecision: string;
  rating: Rating;
  notes: string;
  // When any of these were last changed, used to pick the newer copy when restoring a backup. Null until edited.
  updatedAt: string | null;
}

export interface MeetingRecord {
  tool: string;
  note: string;
  // Set when the meeting is saved.
  id?: string;
  caseId: string;
  caseTitle?: string;
  caseText: string;
  // Only present when images were attached.
  images?: RecordImage[];
  imagesSeenByAll?: boolean;
  seats: Seat[];
  discussionRounds: number;
  startedAt: string;
  rounds: { name: string; entries: Entry[] }[];
  finishedAt?: string;
  stoppedEarly?: boolean;
  research?: Research;
}

// A meeting as kept in the browser: always has an id and research fields.
export type SavedRecord = MeetingRecord & { id: string; research: Research };

// What the screen shows while a meeting runs.
export type CardStatus = "waiting" | "thinking" | "speaking" | "retrying" | "done" | "failed" | "stopped";

export interface CardView {
  id: string;
  roleId: string;
  roleName: string;
  colour: string;
  // Provider and model, e.g. "OpenAI · gpt-5-mini".
  model: string;
  prompt: string;
  chair: boolean;
  // The radiologist's report on the attached images, shown with an "unvalidated" label.
  imaging: boolean;
  // Images sent with this call, if any.
  images: { label: string; dataUrl: string }[] | null;
  status: CardStatus;
  text: string;
  notice: string | null;
  error: string | null;
}

export interface RoundView { name: string; desc: string; single: boolean; cards: CardView[] }

export interface MeetingView {
  running: boolean;
  steps: string[];
  // Index of the current step; steps before it show as done. -1 after a stop.
  active: number;
  rounds: RoundView[];
  // Set once the meeting has finished or been stopped.
  record: MeetingRecord | null;
  // When the meeting started, which tells one meeting from another on screen.
  startedAt: string | null;
  // How many AI calls the meeting is set to make, for the progress line.
  planned: number;
  // Cards whose seat failed and can be tried again. The meeting won't move on until each is retried or let go.
  retryable: string[];
  // Nothing is running and the meeting is waiting to hear whether to try failed seats again or carry on.
  paused: boolean;
}
