import type { MeetingRecord } from "../meeting/types";

export const fileStem = (rec: MeetingRecord) => "mdt-" + (rec.caseId || "case") + "-" + rec.startedAt.slice(0, 16).replace(/[:T]/g, "-");

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
