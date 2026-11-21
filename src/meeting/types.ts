import type { Choice } from "../storage/settings";

// The saved record of a meeting: what "Download JSON" writes out. Field order matches the
// original app so exports stay comparable.
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
  finished?: string;
}

export interface Seat { roleId: string; role: string; brief: string; provider: string; model: string }

// An attached image, cleaned and re-encoded, with its JPEG data as base64.
export interface RecordImage { label: string; caption: string; mediaType: "image/jpeg"; width: number; height: number; data: string }

export interface MeetingRecord {
  tool: string;
  note: string;
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
}

// What the screen shows while a meeting runs.
export type CardStatus = "waiting" | "thinking" | "speaking" | "retrying" | "done" | "failed" | "stopped";

export interface CardView {
  id: string;
  roleId: string;
  roleName: string;
  colour: string;
  choice: Choice;
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
}
