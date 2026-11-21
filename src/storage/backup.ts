// Backup files: saved meetings, images included, in one JSON file that can be restored on any computer.
// A file being restored may have come from someone else, so every field is checked and copied across
// by name. Anything unexpected is left behind, and a meeting that doesn't fit is skipped.
import { emptyResearch } from "../meeting/summary";
import { RATINGS, type Entry, type MeetingRecord, type RecordImage, type Research, type SavedRecord, type Seat } from "../meeting/types";

export const BACKUP_FORMAT = "revision-mdt-simulator-backup";

export function makeBackup(recs: SavedRecord[], now = new Date()): string {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: now.toISOString(),
    note: "Simulated MDT meetings, AI-generated, for research only. Not clinical advice. Keep this file as carefully as the cases in it.",
    count: recs.length,
    meetings: recs,
  }, null, 2);
}

export class ImportError extends Error {}
// A meeting in the file that doesn't have the expected shape. Caught per meeting, so the rest still restore.
class Unreadable extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function obj(v: unknown, name: string): Obj {
  if (!isObj(v)) throw new Unreadable(name);
  return v;
}
function text(v: unknown, name: string, max = 200_000): string {
  if (typeof v !== "string" || v.length > max) throw new Unreadable(name);
  return v;
}
const nullableText = (v: unknown, name: string, max?: number) => (v === null ? null : text(v, name, max));
function int(v: unknown, name: string, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) throw new Unreadable(name);
  return v;
}
function bool(v: unknown, name: string): boolean {
  if (typeof v !== "boolean") throw new Unreadable(name);
  return v;
}
function list(v: unknown, name: string, max: number): unknown[] {
  if (!Array.isArray(v) || v.length > max) throw new Unreadable(name);
  return v;
}
function date(v: unknown, name: string): string {
  const s = text(v, name, 40);
  if (Number.isNaN(Date.parse(s))) throw new Unreadable(name);
  return s;
}
// Only include a field if the file has it, so the copy keeps the same shape as the original.
const maybe = <T>(o: Obj, key: string, read: (v: unknown) => T): Record<string, T> => (o[key] === undefined ? {} : { [key]: read(o[key]) });

const BASE64_JPEG = /^\/9j\/[A-Za-z0-9+/]*={0,2}$/;

function toImage(v: unknown): RecordImage {
  const o = obj(v, "image");
  const data = text(o.data, "image data", 16_000_000);
  if (o.mediaType !== "image/jpeg" || !BASE64_JPEG.test(data)) throw new Unreadable("image data");
  return {
    label: text(o.label, "image label", 50),
    caption: text(o.caption, "image caption", 500),
    mediaType: "image/jpeg",
    width: int(o.width, "image width", 1, 10_000),
    height: int(o.height, "image height", 1, 10_000),
    data,
  };
}

function toSeat(v: unknown): Seat {
  const o = obj(v, "seat");
  return {
    roleId: text(o.roleId, "seat", 40), role: text(o.role, "seat", 200), brief: text(o.brief, "seat", 5000),
    provider: text(o.provider, "seat", 40), model: text(o.model, "seat", 200),
  };
}

function toEntry(v: unknown): Entry {
  const o = obj(v, "answer");
  return {
    roleId: text(o.roleId, "answer", 40),
    role: text(o.role, "answer", 200),
    provider: text(o.provider, "answer", 40),
    model: text(o.model, "answer", 200),
    prompt: text(o.prompt, "prompt"),
    ...maybe(o, "images", (x) => list(x, "image labels", 10).map((l) => text(l, "image label", 600))),
    response: nullableText(o.response, "answer"),
    error: nullableText(o.error, "error", 5000),
    started: date(o.started, "time"),
    ...maybe(o, "earlierErrors", (x) => list(x, "earlier errors", 20).map((e) => text(e, "error", 5000))),
    ...maybe(o, "finished", (x) => date(x, "time")),
  };
}

function toResearch(v: unknown): Research {
  const o = obj(v, "research fields");
  const rating = o.rating;
  if (rating !== "" && !RATINGS.includes(rating as (typeof RATINGS)[number])) throw new Unreadable("rating");
  return {
    caseTag: text(o.caseTag, "case ID", 100),
    actualDecision: text(o.actualDecision, "actual decision", 20_000),
    rating: rating as Research["rating"],
    notes: text(o.notes, "notes", 50_000),
    updatedAt: o.updatedAt === null ? null : date(o.updatedAt, "research fields"),
  };
}

const ID = /^[A-Za-z0-9_-]{1,80}$/;

export function toRecord(v: unknown): MeetingRecord {
  const o = obj(v, "meeting");
  const tool = text(o.tool, "tool", 200);
  if (!tool.startsWith("Revision MDT Simulator")) throw new Unreadable("tool");
  const images = o.images === undefined ? undefined : list(o.images, "images", 10).map(toImage);
  const rec: MeetingRecord = {
    tool,
    note: text(o.note, "note", 500),
    ...maybe(o, "id", (x) => { const id = text(x, "id", 80); if (!ID.test(id)) throw new Unreadable("id"); return id; }),
    caseId: text(o.caseId, "case", 100),
    ...maybe(o, "caseTitle", (x) => text(x, "case title", 300)),
    caseText: text(o.caseText, "case"),
    ...(images ? { images, imagesSeenByAll: o.imagesSeenByAll === undefined ? false : bool(o.imagesSeenByAll, "images") } : {}),
    seats: list(o.seats, "seats", 10).map(toSeat),
    discussionRounds: int(o.discussionRounds, "rounds", 0, 5),
    startedAt: date(o.startedAt, "start time"),
    rounds: list(o.rounds, "rounds", 10).map((r) => {
      const ro = obj(r, "round");
      return { name: text(ro.name, "round", 100), entries: list(ro.entries, "round", 10).map(toEntry) };
    }),
    ...maybe(o, "finishedAt", (x) => date(x, "finish time")),
    ...maybe(o, "stoppedEarly", (x) => bool(x, "status")),
    ...maybe(o, "research", toResearch),
  };
  if (!rec.seats.length) throw new Unreadable("seats");
  return rec;
}

// Meetings downloaded before saving existed have no id. Give each one an id made from its contents,
// so restoring the same file twice doesn't add it twice.
async function withId(rec: MeetingRecord): Promise<SavedRecord> {
  const research = rec.research ?? emptyResearch();
  if (rec.id) return { ...rec, id: rec.id, research };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(rec)));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const { tool, note, ...rest } = rec;
  return { tool, note, id: "imported-" + hex.slice(0, 24), ...rest, research };
}

const NOT_OURS = "This file isn't a backup or a meeting from the Revision MDT Simulator. Choose a file that was downloaded from the simulator.";

export interface ParsedImport { records: SavedRecord[]; skipped: number }

// Reads a backup file, or the JSON file of a single meeting.
export async function parseImport(json: string): Promise<ParsedImport> {
  let data: unknown;
  try { data = JSON.parse(json); } catch { throw new ImportError(NOT_OURS); }
  let items: unknown[];
  if (isObj(data) && data.format === BACKUP_FORMAT) {
    if (data.version !== 1) throw new ImportError("This backup was made by a newer version of the simulator. Reload the page to get the latest version, then try again.");
    if (!Array.isArray(data.meetings)) throw new ImportError(NOT_OURS);
    items = data.meetings;
  } else if (isObj(data) && typeof data.tool === "string" && Array.isArray(data.rounds)) {
    items = [data];
  } else {
    throw new ImportError(NOT_OURS);
  }
  const byId = new Map<string, SavedRecord>();
  let skipped = 0;
  for (const item of items) {
    let rec: SavedRecord;
    try {
      rec = await withId(toRecord(item));
    } catch (e) {
      if (!(e instanceof Unreadable)) throw e;
      skipped++;
      continue;
    }
    const seen = byId.get(rec.id);
    if (!seen || (rec.research.updatedAt ?? "") > (seen.research.updatedAt ?? "")) byId.set(rec.id, rec);
  }
  if (!byId.size) throw new ImportError(skipped ? "None of the meetings in this file could be read. It may be damaged, or from a different program." : "This backup has no meetings in it.");
  return { records: [...byId.values()], skipped };
}
