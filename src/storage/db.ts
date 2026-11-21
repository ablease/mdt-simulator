// A thin promise wrapper over IndexedDB, the browser's built-in database. Everything stays on this computer.
const NAME = "mdt-simulator";
const VERSION = 1;

// "meetings" holds the short summary of each meeting for the history list; "records" holds the full
// meeting, images included, and is only read when a meeting is opened or exported.
export const SUMMARIES = "meetings";
export const RECORDS = "records";

let opening: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SUMMARIES)) db.createObjectStore(SUMMARIES, { keyPath: "id" });
        if (!db.objectStoreNames.contains(RECORDS)) db.createObjectStore(RECORDS, { keyPath: "id" });
      };
      req.onsuccess = () => {
        const db = req.result;
        // Another tab is upgrading the database: step aside, and reopen on next use.
        db.onversionchange = () => { db.close(); opening = null; };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
    });
    opening.catch(() => { opening = null; });
  }
  return opening;
}

export const request = <T>(req: IDBRequest<T>) => new Promise<T>((res, rej) => {
  req.onsuccess = () => res(req.result);
  req.onerror = () => rej(req.error);
});

// Runs `fn` in one transaction across the given stores, resolving once everything is written.
export async function transact<T>(stores: string[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => Promise<T> | T): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(stores, mode);
  const finished = new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error ?? new Error("The save was cancelled."));
  });
  const out = await fn(tx);
  await finished;
  return out;
}
