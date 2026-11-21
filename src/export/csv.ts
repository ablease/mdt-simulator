// The comparison table as CSV, for Excel, SPSS or R. One row per meeting.
import { ratingLabel, type MeetingSummary } from "../meeting/summary";

const local = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const COLUMNS: [string, (s: MeetingSummary) => string][] = [
  ["Meeting ID", (s) => s.id],
  ["Date", (s) => local(s.startedAt)],
  ["Case ID", (s) => s.caseTag],
  ["Case", (s) => s.caseTitle],
  ["Panel models", (s) => s.panel],
  ["Providers", (s) => s.providers.join("; ")],
  ["Discussion rounds", (s) => String(s.discussionRounds)],
  ["Images", (s) => String(s.imageCount)],
  ["Decision", (s) => s.outcome],
  ["Level of agreement", (s) => s.agreement],
  ["Actual MDT decision", (s) => s.actualDecision],
  ["Reviewer rating", (s) => ratingLabel(s.rating)],
  ["Notes", (s) => s.notes],
  ["Status", (s) => (s.stoppedEarly ? "Stopped early" : "Complete")],
];

// Spreadsheets treat a cell starting with = + - or @ as a formula. AI-written text could start that way,
// so those cells get a leading apostrophe and are shown as plain text.
function cell(value: string): string {
  let v = value.replace(/\r\n?/g, "\n");
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return '"' + v.replace(/"/g, '""') + '"';
}

// With a byte order mark, so Excel reads the file as UTF-8.
export function toCsv(list: MeetingSummary[]): string {
  const rows = [COLUMNS.map(([name]) => name), ...list.map((s) => COLUMNS.map(([, get]) => get(s)))];
  return "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
