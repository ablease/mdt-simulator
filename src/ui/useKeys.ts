import { useRef, useState } from "react";
import { PIDS, type ProviderId } from "../providers";
import {
  clearVault, createSealer, loadVault, MIN_PASSPHRASE, openVault, saveVault, seal, takeLegacyKeys,
  type Keys, type Sealer, type VaultBlob,
} from "../storage/vault";

export interface KeyMessage { text: string; cls: "ok" | "bad" | "" }

const emptyKeys = () => Object.fromEntries(PIDS.map((p) => [p, ""])) as Keys;
const trimmed = (k: Keys) => Object.fromEntries(PIDS.map((p) => [p, k[p].trim()])) as Keys;

const LEGACY_NOTE = "Your keys were saved on this computer without a passphrase. For safety they've been removed from storage, but they're still in the boxes above until you close this tab. To keep them, tick \"Remember my keys\" and choose a passphrase.";

// Storage is read once per page load, outside React, so Strict Mode's double render can't run the migration twice.
let boot: { legacy: Keys | null; blob: VaultBlob | null } | null = null;
const getBoot = () => (boot ??= { legacy: takeLegacyKeys(), blob: loadVault() });

// The API keys for this tab, plus the optional passphrase-locked copy saved in the browser.
export function useKeys() {
  const b = getBoot();
  const [keys, setKeys] = useState<Keys>(() => b.legacy ?? emptyKeys());
  const [locked, setLocked] = useState(() => !!b.blob);
  const [remember, setRemember] = useState(() => !!b.blob);
  // True once a passphrase is in use for this tab, so key changes are saved without asking again.
  const [sealed, setSealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<KeyMessage | null>(() => b.legacy ? { text: LEGACY_NOTE, cls: "bad" } : null);
  const keysRef = useRef(keys);
  const sealer = useRef<Sealer | null>(null);
  const queue = useRef(Promise.resolve());

  // Saves are queued so a burst of typing can't finish out of order and leave an older copy behind.
  const persist = (next: Keys) => {
    queue.current = queue.current.then(async () => {
      const s = sealer.current;
      if (!s) return;
      const blob = await seal(s, trimmed(next));
      if (sealer.current === s) saveVault(blob);
    }).catch(() => {});
  };

  const update = (next: Keys) => {
    keysRef.current = next;
    setKeys(next);
    persist(next);
  };

  const setKey = (pid: ProviderId, value: string) => update({ ...keysRef.current, [pid]: value });

  async function unlock(passphrase: string) {
    const blob = loadVault();
    if (!blob) { setLocked(false); return; }
    setBusy(true);
    setMessage(null);
    const res = await openVault(passphrase, blob);
    setBusy(false);
    if (!res) {
      setMessage({ text: "That passphrase didn't unlock your keys. Check it and try again, or press \"Forget keys\" in Settings and paste your keys in again.", cls: "bad" });
      return;
    }
    sealer.current = res.sealer;
    keysRef.current = res.keys;
    setKeys(res.keys);
    setLocked(false);
    setSealed(true);
    setRemember(true);
  }

  async function choosePassphrase(first: string, second: string) {
    if (first.length < MIN_PASSPHRASE) {
      setMessage({ text: `Use at least ${MIN_PASSPHRASE} characters. Three or four unrelated words work well.`, cls: "bad" });
      return;
    }
    if (first !== second) {
      setMessage({ text: "The two passphrases don't match. Type the same passphrase in both boxes.", cls: "bad" });
      return;
    }
    setBusy(true);
    setMessage(null);
    const s = await createSealer(first);
    sealer.current = s;
    saveVault(await seal(s, trimmed(keysRef.current)));
    setBusy(false);
    setSealed(true);
    setMessage({ text: "Your keys are saved on this computer, locked with your passphrase. You'll need it each time you open the simulator.", cls: "ok" });
  }

  function setRememberOn(on: boolean) {
    setRemember(on);
    setMessage(null);
    if (on || (!sealer.current && !loadVault())) return;
    sealer.current = null;
    clearVault();
    setSealed(false);
    setMessage({ text: "Your saved keys have been removed from this computer. The keys above stay until you close this tab.", cls: "" });
  }

  function forget() {
    sealer.current = null;
    clearVault();
    update(emptyKeys());
    setRemember(false);
    setSealed(false);
    setLocked(false);
    setMessage({ text: "Keys cleared from this browser.", cls: "" });
  }

  return { keys, setKey, locked, remember, sealed, busy, message, unlock, choosePassphrase, setRememberOn, forget };
}

export type KeysApi = ReturnType<typeof useKeys>;
