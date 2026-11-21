// Saved meetings, kept in this browser on this computer only. Clearing the browser's site data deletes them.
import { summarise, type MeetingSummary } from "../meeting/summary";
import type { Research, SavedRecord } from "../meeting/types";
import { RECORDS, request, SUMMARIES, transact } from "./db";
import { store } from "./local";

// When the user last downloaded a backup of every meeting, kept alongside the other settings.
const LAST_BACKUP = "mdt.lastBackup";

export interface MeetingsState {
  // "unavailable" when the browser won't let this page store anything, for example some private windows.
  status: "loading" | "ready" | "unavailable";
  // Newest first.
  list: MeetingSummary[];
  lastBackup: string | null;
}

let state: MeetingsState = { status: "loading", list: [], lastBackup: store.get(LAST_BACKUP) };
const emit = () => listeners.forEach((fn) => fn());
const listeners = new Set<() => void>();
// Tells the simulator's other open tabs to reload their lists after a change.
const channel = typeof window === "undefined" || typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("mdt-meetings");

export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
export const getState = () => state;

export async function refresh() {
  try {
    const list = await transact([SUMMARIES], "readonly", (tx) => request(tx.objectStore(SUMMARIES).getAll() as IDBRequest<MeetingSummary[]>));
    state = { status: "ready", list: list.sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.savedAt.localeCompare(a.savedAt)), lastBackup: store.get(LAST_BACKUP) };
  } catch {
    state = { status: "unavailable", list: [], lastBackup: store.get(LAST_BACKUP) };
  }
  emit();
}

if (channel) channel.onmessage = () => { void refresh(); };

async function changed() {
  await refresh();
  channel?.postMessage("changed");
}

export async function saveRecord(rec: SavedRecord) {
  const savedAt = new Date().toISOString();
  await transact([SUMMARIES, RECORDS], "readwrite", (tx) => {
    tx.objectStore(RECORDS).put(rec);
    tx.objectStore(SUMMARIES).put(summarise(rec, savedAt));
  });
  await changed();
}

export function getRecord(id: string): Promise<SavedRecord | undefined> {
  return transact([RECORDS], "readonly", (tx) => request(tx.objectStore(RECORDS).get(id) as IDBRequest<SavedRecord | undefined>));
}

// In the order asked for, skipping any that have since been deleted.
export async function getRecords(ids: string[]): Promise<SavedRecord[]> {
  const found = await transact([RECORDS], "readonly", (tx) =>
    Promise.all(ids.map((id) => request(tx.objectStore(RECORDS).get(id) as IDBRequest<SavedRecord | undefined>))));
  return found.filter((r): r is SavedRecord => !!r);
}

export async function updateResearch(id: string, research: Research) {
  await transact([SUMMARIES, RECORDS], "readwrite", async (tx) => {
    const records = tx.objectStore(RECORDS), summaries = tx.objectStore(SUMMARIES);
    const [rec, old] = await Promise.all([
      request(records.get(id) as IDBRequest<SavedRecord | undefined>),
      request(summaries.get(id) as IDBRequest<MeetingSummary | undefined>),
    ]);
    if (!rec) return;
    const next = { ...rec, research };
    records.put(next);
    summaries.put(summarise(next, old?.savedAt ?? new Date().toISOString()));
  });
  await changed();
}

export async function deleteMeetings(ids: string[]) {
  await transact([SUMMARIES, RECORDS], "readwrite", (tx) => {
    for (const id of ids) {
      tx.objectStore(RECORDS).delete(id);
      tx.objectStore(SUMMARIES).delete(id);
    }
  });
  await changed();
}

export async function deleteAll() {
  await transact([SUMMARIES, RECORDS], "readwrite", (tx) => {
    tx.objectStore(RECORDS).clear();
    tx.objectStore(SUMMARIES).clear();
  });
  await changed();
}

export interface ImportResult { added: number; updated: number; unchanged: number }

// Adds meetings from a backup. A meeting that's already here is replaced only if the incoming copy's
// research fields were edited more recently, so restoring an old backup never undoes newer notes.
export async function importRecords(recs: SavedRecord[]): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, unchanged: 0 };
  const savedAt = new Date().toISOString();
  await transact([SUMMARIES, RECORDS], "readwrite", async (tx) => {
    const records = tx.objectStore(RECORDS), summaries = tx.objectStore(SUMMARIES);
    for (const rec of recs) {
      const old = await request(records.get(rec.id) as IDBRequest<SavedRecord | undefined>);
      if (old && (rec.research.updatedAt ?? "") <= (old.research.updatedAt ?? "")) { result.unchanged++; continue; }
      records.put(rec);
      summaries.put(summarise(rec, savedAt));
      if (old) result.updated++; else result.added++;
    }
  });
  await changed();
  return result;
}

// Asks the browser not to clear saved meetings when the computer runs low on space. Asked once per visit;
// Chrome and Edge decide quietly, Firefox asks the user.
let askedToKeep = false;
export async function askToKeep() {
  if (askedToKeep) return;
  askedToKeep = true;
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {}
}

export interface StorageInfo { persisted: boolean | null; usage: number | null }

export async function storageInfo(): Promise<StorageInfo> {
  const info: StorageInfo = { persisted: null, usage: null };
  try { info.persisted = await navigator.storage.persisted(); } catch {}
  try { info.usage = (await navigator.storage.estimate()).usage ?? null; } catch {}
  return info;
}

export function noteBackup() {
  const at = new Date().toISOString();
  store.set(LAST_BACKUP, at);
  state = { ...state, lastBackup: at };
  emit();
}
