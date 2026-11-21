import { useRef, useState } from "react";
import { downloadText, today } from "../export/download";
import { cleanStoredImage } from "../images/process";
import type { SavedRecord } from "../meeting/types";
import { ImportError, makeBackup, parseImport } from "../storage/backup";
import { getRecords, getState, importRecords, noteBackup, type ImportResult } from "../storage/meetings";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Images restored from a file are checked, and redrawn if they carry anything besides pixels.
async function cleanImages(rec: SavedRecord): Promise<SavedRecord> {
  if (!rec.images?.length) return rec;
  const images = [];
  for (const img of rec.images) {
    const clean = await cleanStoredImage(img.data);
    images.push({ ...img, data: clean.base64, width: clean.width, height: clean.height });
  }
  return { ...rec, images };
}

function restoredMessage(r: ImportResult, skipped: number): string {
  const parts = [r.added ? `Restored ${plural(r.added, "meeting", "meetings")}.` : "No new meetings were added."];
  if (r.updated) parts.push(`${plural(r.updated, "meeting was", "meetings were")} replaced by a copy with newer notes.`);
  if (r.unchanged) parts.push(`${plural(r.unchanged, "meeting was", "meetings were")} already here and up to date.`);
  if (skipped) parts.push(`${plural(skipped, "meeting", "meetings")} couldn't be read and ${skipped === 1 ? "was" : "were"} skipped.`);
  return parts.join(" ");
}

export async function downloadBackup(recs: SavedRecord[], all: boolean) {
  const name = all ? `mdt-backup-${today()}.json` : `mdt-backup-${today()}-${recs.length}-${recs.length === 1 ? "meeting" : "meetings"}.json`;
  downloadText(makeBackup(recs), name, "application/json");
  if (all) noteBackup();
}

// "Back up all meetings" and "Restore from a backup", with a line saying how it went.
export function BackupControls({ idPrefix, count }: { idPrefix: string; count: number }) {
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function backupAll() {
    setBusy(true);
    try {
      const recs = await getRecords(getState().list.map((m) => m.id));
      await downloadBackup(recs, true);
      setMsg({ text: `Backup downloaded, with ${plural(recs.length, "meeting", "meetings")}. Keep it somewhere safe that your trust allows for research data.` });
    } catch {
      setMsg({ text: "The backup couldn't be made. Reload the page and try again.", bad: true });
    } finally {
      setBusy(false);
    }
  }

  async function restore(file: File) {
    if (file.size > 1024 ** 3) { setMsg({ text: "That file is larger than 1 GB, which is too big to be a backup from the simulator.", bad: true }); return; }
    setBusy(true);
    setMsg({ text: "Restoring…" });
    try {
      const { records, skipped } = await parseImport(await file.text());
      const clean: SavedRecord[] = [];
      let unreadable = skipped;
      for (const rec of records) {
        try { clean.push(await cleanImages(rec)); } catch { unreadable++; }
      }
      const result = clean.length ? await importRecords(clean) : { added: 0, updated: 0, unchanged: 0 };
      setMsg({ text: restoredMessage(result, unreadable), bad: !clean.length });
    } catch (e) {
      setMsg({ text: e instanceof ImportError ? e.message : "The backup couldn't be restored. Reload the page and try again.", bad: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="backup">
      <div className="row">
        <button className="small" id={idPrefix + "BackupAll"} type="button" disabled={busy || !count} onClick={backupAll}>Back up all meetings</button>
        <button className="small" type="button" disabled={busy} onClick={() => input.current?.click()}>Restore from a backup</button>
        <input ref={input} id={idPrefix + "Restore"} type="file" accept="application/json,.json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void restore(f); }} />
      </div>
      {msg && <p className={"connstate" + (msg.bad ? " bad" : " ok")} role="status">{msg.text}</p>}
    </div>
  );
}
