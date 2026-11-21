// "Remember my keys" stores the API keys encrypted with a passphrase the user chooses.
// The passphrase is stretched with PBKDF2 into an AES-GCM key; only the salt, the IV and the
// ciphertext are saved. The passphrase and the plain keys are never written to storage.
import { PIDS, type ProviderId } from "../providers";
import { store } from "./local";

export type Keys = Record<ProviderId, string>;

export interface VaultBlob { v: 1; kdf: "PBKDF2-SHA256"; iter: number; salt: string; iv: string; data: string }

// Holds the derived key in memory after unlocking, so key changes can be re-saved without asking again.
export interface Sealer { key: CryptoKey; salt: Uint8Array<ArrayBuffer>; iter: number }

const VAULT = "mdt.vault";
export const MIN_PASSPHRASE = 12;
// OWASP's current recommendation for PBKDF2-HMAC-SHA256.
const ITERATIONS = 600_000;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function derive(passphrase: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: iter },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

export async function createSealer(passphrase: string): Promise<Sealer> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { key: await derive(passphrase, salt, ITERATIONS), salt, iter: ITERATIONS };
}

export async function seal(s: Sealer, keys: Keys): Promise<VaultBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(keys));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, s.key, plain));
  return { v: 1, kdf: "PBKDF2-SHA256", iter: s.iter, salt: b64(s.salt), iv: b64(iv), data: b64(data) };
}

// Resolves to null when the passphrase is wrong (AES-GCM refuses to decrypt).
export async function openVault(passphrase: string, blob: VaultBlob): Promise<{ keys: Keys; sealer: Sealer } | null> {
  const salt = unb64(blob.salt);
  const key = await derive(passphrase, salt, blob.iter);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(blob.iv) }, key, unb64(blob.data));
    const parsed = JSON.parse(new TextDecoder().decode(plain));
    const keys = Object.fromEntries(PIDS.map((pid) => [pid, typeof parsed[pid] === "string" ? parsed[pid] : ""])) as Keys;
    return { keys, sealer: { key, salt, iter: blob.iter } };
  } catch {
    return null;
  }
}

export function loadVault(): VaultBlob | null {
  const b = store.getJSON<Partial<VaultBlob> | null>(VAULT, null);
  return b && b.v === 1 && b.salt && b.iv && b.data && b.iter ? (b as VaultBlob) : null;
}

export const saveVault = (b: VaultBlob) => store.setJSON(VAULT, b);
export const clearVault = () => store.del(VAULT);

// Earlier versions saved keys in plain text. Take them out of storage; the caller decides what to tell the user.
export function takeLegacyKeys(): Keys | null {
  const found = Object.fromEntries(PIDS.map((pid) => [pid, store.get("mdt.key." + pid) || ""])) as Keys;
  PIDS.forEach((pid) => store.del("mdt.key." + pid));
  store.del("mdt.remember");
  return PIDS.some((pid) => found[pid]) ? found : null;
}
