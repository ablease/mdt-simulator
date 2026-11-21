import { useEffect, useState, useSyncExternalStore } from "react";
import type { SavedRecord } from "../meeting/types";
import { getRecord, getState, subscribe, type MeetingsState } from "../storage/meetings";

export const useMeetings = () => useSyncExternalStore(subscribe, getState);

export type Opened =
  | { status: "none" }
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; rec: SavedRecord };

// Loads one saved meeting, and reloads it whenever saved meetings change (for example, notes edited in
// another tab). `known` is a copy already in hand, such as the meeting just saved, shown without waiting.
export function useSavedRecord(id: string | undefined, known: SavedRecord | null, meetings: MeetingsState): Opened {
  const [loaded, setLoaded] = useState<{ id: string; rec: SavedRecord | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let current = true;
    getRecord(id).then(
      (rec) => { if (current) setLoaded({ id, rec: rec ?? null }); },
      () => { if (current) setLoaded({ id, rec: null }); },
    );
    return () => { current = false; };
  }, [id, meetings]);
  if (!id) return { status: "none" };
  if (loaded?.id === id) return loaded.rec ? { status: "ready", rec: loaded.rec } : { status: "missing" };
  if (known?.id === id) return { status: "ready", rec: known };
  return { status: "loading" };
}
