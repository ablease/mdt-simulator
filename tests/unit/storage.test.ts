import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { ImportError, makeBackup, parseImport } from "../../src/storage/backup";
import { deleteAll, deleteMeetings, getRecord, getRecords, getState, importRecords, refresh, saveRecord, updateResearch } from "../../src/storage/meetings";
import { sampleRecord, savedRecord } from "../support/records";

beforeEach(async () => { await deleteAll(); });

describe("saved meetings", () => {
  it("saves a meeting and lists its summary, newest first", async () => {
    await saveRecord(savedRecord("a", { caseTag: "PJI-01" }));
    await saveRecord(savedRecord("b", {}, { startedAt: "2026-11-22T09:00:00.000Z" }));
    const { status, list } = getState();
    expect(status).toBe("ready");
    expect(list.map((m) => m.id)).toEqual(["b", "a"]);
    expect(list[1]).toMatchObject({
      caseTag: "PJI-01", caseTitle: "Painful hip, possible infection", outcome: "Two-stage revision of the acetabular component.",
      agreement: "Majority", panel: "OpenAI gpt-5-mini ×2 · Anthropic claude-haiku-5-5", providers: ["OpenAI", "Anthropic"], rating: "",
    });
    expect(await getRecord("a")).toEqual(savedRecord("a", { caseTag: "PJI-01" }));
  });

  it("updates research fields without changing when the meeting was saved", async () => {
    await saveRecord(savedRecord("a"));
    const savedAt = getState().list[0].savedAt;
    await updateResearch("a", { caseTag: "K-2", actualDecision: "Single-stage", rating: "partly agree", notes: "n", updatedAt: "2026-11-23T08:00:00.000Z" });
    expect(getState().list[0]).toMatchObject({ caseTag: "K-2", rating: "partly agree", actualDecision: "Single-stage", savedAt });
    const rec = (await getRecord("a"))!;
    expect(rec.research.rating).toBe("partly agree");
    // The research fields stay last, after the original app's fields.
    expect(Object.keys(rec).at(-1)).toBe("research");
  });

  it("deletes chosen meetings, or all of them", async () => {
    for (const id of ["a", "b", "c"]) await saveRecord(savedRecord(id));
    await deleteMeetings(["a", "c"]);
    expect(getState().list.map((m) => m.id)).toEqual(["b"]);
    expect(await getRecords(["a", "b", "c"])).toHaveLength(1);
    await deleteAll();
    await refresh();
    expect(getState().list).toEqual([]);
  });

  it("restores a backup without undoing newer notes", async () => {
    await saveRecord(savedRecord("a", { notes: "newer", updatedAt: "2026-11-25T00:00:00.000Z" }));
    await saveRecord(savedRecord("b", { notes: "old", updatedAt: "2026-11-20T00:00:00.000Z" }));
    const result = await importRecords([
      savedRecord("a", { notes: "older", updatedAt: "2026-11-24T00:00:00.000Z" }),
      savedRecord("b", { notes: "edited by supervisor", updatedAt: "2026-11-26T00:00:00.000Z" }),
      savedRecord("c"),
    ]);
    expect(result).toEqual({ added: 1, updated: 1, unchanged: 1 });
    const [a, b] = await getRecords(["a", "b"]);
    expect(a.research.notes).toBe("newer");
    expect(b.research.notes).toBe("edited by supervisor");
  });
});

describe("backup files", () => {
  it("round-trips meetings, images and research fields", async () => {
    const image = { label: "Image 1", caption: "AP pelvis", mediaType: "image/jpeg" as const, width: 4, height: 3, data: "/9j/4AAQSkZJRg==" };
    const recs = [savedRecord("a", { caseTag: "PJI-01", rating: "agree" }, { images: [image], imagesSeenByAll: false }), savedRecord("b")];
    const json = makeBackup(recs, new Date("2026-11-21T12:00:00Z"));
    expect(JSON.parse(json)).toMatchObject({ format: "revision-mdt-simulator-backup", version: 1, count: 2 });
    expect(await parseImport(json)).toEqual({ records: recs, skipped: 0 });
  });

  it("accepts a meeting's JSON download from before meetings were saved, giving it a stable id", async () => {
    const old = JSON.stringify(sampleRecord());
    const first = await parseImport(old);
    const again = await parseImport(old);
    expect(first.records[0].id).toMatch(/^imported-[0-9a-f]{24}$/);
    expect(again.records[0].id).toBe(first.records[0].id);
    expect(first.records[0].research).toEqual({ caseTag: "", actualDecision: "", rating: "", notes: "", updatedAt: null });
    expect(Object.keys(first.records[0]).slice(0, 4)).toEqual(["tool", "note", "id", "caseId"]);
  });

  it("copies only the fields it knows", async () => {
    const tampered = { ...savedRecord("a"), extra: "<script>", constructor: "x" };
    const json = `{"format":"revision-mdt-simulator-backup","version":1,"meetings":[${JSON.stringify(tampered).replace(/^\{/, '{"__proto__":{"polluted":true},')}]}`;
    const { records } = await parseImport(json);
    expect(records[0]).toEqual(savedRecord("a"));
    expect(Object.prototype.hasOwnProperty.call(records[0], "extra")).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("skips meetings that don't fit, and keeps the rest", async () => {
    const png = { label: "Image 1", caption: "", mediaType: "image/jpeg", width: 4, height: 3, data: "iVBORw0KGgo=" };
    const bad = [
      { ...savedRecord("x"), images: [png] },
      { ...savedRecord("y"), research: { ...savedRecord("y").research, rating: "brilliant" } },
      { ...savedRecord("z"), seats: "everyone" },
      { ...savedRecord("w"), id: "../../etc" },
    ];
    const json = JSON.stringify({ format: "revision-mdt-simulator-backup", version: 1, meetings: [...bad, savedRecord("ok")] });
    const { records, skipped } = await parseImport(json);
    expect(records.map((r) => r.id)).toEqual(["ok"]);
    expect(skipped).toBe(4);
  });

  it("keeps the most recently edited copy when a file has the same meeting twice", async () => {
    const json = makeBackup([savedRecord("a", { notes: "2", updatedAt: "2026-11-22T00:00:00Z" }), savedRecord("a", { notes: "1", updatedAt: "2026-11-21T00:00:00Z" })]);
    expect((await parseImport(json)).records.map((r) => r.research.notes)).toEqual(["2"]);
  });

  it("explains files it can't use", async () => {
    await expect(parseImport("not json")).rejects.toThrow(/isn't a backup or a meeting from the Revision MDT Simulator/);
    await expect(parseImport(JSON.stringify({ hello: 1 }))).rejects.toThrow(ImportError);
    await expect(parseImport(JSON.stringify({ ...sampleRecord(), tool: "Something else" }))).rejects.toThrow(/None of the meetings in this file could be read/);
    await expect(parseImport(JSON.stringify({ format: "revision-mdt-simulator-backup", version: 2, meetings: [] }))).rejects.toThrow(/newer version/);
    await expect(parseImport(makeBackup([]))).rejects.toThrow(/no meetings in it/);
  });
});
