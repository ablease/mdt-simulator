import type { MeetingRecord } from "../meeting/types";

// Named after the researcher's case ID if there is one, otherwise the built-in case, then the start time.
const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
export const fileStem = (rec: MeetingRecord) => "mdt-" + (safe(rec.research?.caseTag ?? "") || rec.caseId || "case") + "-" + rec.startedAt.slice(0, 16).replace(/[:T]/g, "-");

// A date for file names, in local time: 2026-11-21.
export const today = (d = new Date()) => [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, "0")).join("-");

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadJson(rec: MeetingRecord) {
  saveBlob(new Blob([JSON.stringify(rec, null, 2)], { type: "application/json" }), fileStem(rec) + ".json");
}

export function downloadText(text: string, name: string, type: string) {
  saveBlob(new Blob([text], { type }), name);
}
