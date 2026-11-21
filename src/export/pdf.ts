// pdfmake 0.2.7's font file attaches itself to a global `pdfMake`, so both files are loaded as
// classic scripts, as the original app did, but from this site rather than a CDN.
import pdfmakeUrl from "pdfmake/build/pdfmake.min.js?url";
import vfsUrl from "pdfmake/build/vfs_fonts.js?url";
import type { MeetingRecord } from "../meeting/types";
import { fileStem, saveBlob } from "./download";
import { buildPdf } from "./pdfDocument";

interface PdfMake {
  vfs?: unknown;
  createPdf(doc: unknown): { getBlob(cb: (blob: Blob) => void): void };
}
interface TrustedTypesFactory {
  createPolicy(name: string, rules: { createScriptURL(url: string): string }): { createScriptURL(url: string): unknown };
}
declare global {
  interface Window { pdfMake?: PdfMake; trustedTypes?: TrustedTypesFactory }
}

// The Content Security Policy requires Trusted Types for script URLs. This policy is the only
// way to create one, and it only accepts the two pdfmake files.
let policy: { createScriptURL(url: string): unknown } | null | undefined;
function scriptUrl(url: string): string {
  if (policy === undefined) {
    policy = window.trustedTypes?.createPolicy("pdfmake", {
      createScriptURL(u) {
        if (u === pdfmakeUrl || u === vfsUrl) return u;
        throw new Error("Refusing to load an unexpected script: " + u);
      },
    }) ?? null;
  }
  return policy ? (policy.createScriptURL(url) as string) : url;
}

function loadScript(src: string) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = scriptUrl(src);
    s.onload = res;
    s.onerror = () => rej(new Error("load"));
    document.head.append(s);
  });
}

let pdfReady: Promise<void> | null = null;
function ensurePdfMake() {
  if (!pdfReady) pdfReady = (async () => {
    for (const u of [pdfmakeUrl, vfsUrl]) await loadScript(u);
    if (!window.pdfMake || !window.pdfMake.vfs) throw new Error("pdfmake");
  })();
  pdfReady.catch(() => { pdfReady = null; });
  return pdfReady;
}

export async function downloadPdf(rec: MeetingRecord) {
  await ensurePdfMake();
  const doc = window.pdfMake!.createPdf(buildPdf(rec));
  await new Promise<void>((res) => doc.getBlob((blob) => { saveBlob(blob, fileStem(rec) + ".pdf"); res(); }));
}
