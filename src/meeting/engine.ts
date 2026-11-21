import { dataUrlOf } from "../images/process";
import type { ImageInput } from "../images/types";
import { friendly, friendlyImageError, ProviderError, type Part, type Provider, type ProviderId } from "../providers";
import { chairPrompt, discussPrompt, firstPrompt, imageLabel, imagingPrompt, seeImagesNote, withImagingReport } from "../prompts/prompts";
import { CHAIR, ROLES, type Role } from "../prompts/roles";
import type { Choice } from "../storage/settings";
import type { CardView, Entry, MeetingRecord, MeetingView, RoundView } from "./types";

export interface MeetingConfig {
  caseId: string;
  caseTitle?: string;
  caseText: string;
  // The consultants taking part, not including the chair. Must include the radiologist when there are images.
  roles: Role[];
  discussionRounds: number;
  choiceFor: (role: Role) => Choice;
  images?: ImageInput[];
  // Send the images with every first opinion, not just to the radiologist.
  showImagesToAll?: boolean;
}

export interface EngineDeps {
  providers: Record<ProviderId, Provider>;
  // Read at call time, so a key changed mid-meeting is used for later calls (as before).
  getKey: (pid: ProviderId) => string;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => Date;
}

interface CallOptions {
  images?: ImageInput[];
  imaging?: boolean;
}

const abortableSleep = (ms: number, signal: AbortSignal) => new Promise<void>((res, rej) => {
  const t = setTimeout(res, ms);
  signal.addEventListener("abort", () => { clearTimeout(t); rej(new DOMException("Aborted", "AbortError")); }, { once: true });
});

// Each image goes in as its label, then the picture, ahead of the prompt text.
const imageParts = (images: ImageInput[]): Part[] => images.flatMap((img, i): Part[] => [
  { type: "text", text: imageLabel(i, img.caption) },
  { type: "image", mediaType: img.mediaType, base64: img.base64 },
]);

const RADIOLOGIST = ROLES.find((r) => r.id === "rad")!;
const IDLE: MeetingView = { running: false, steps: [], active: 0, rounds: [], record: null };

// Runs one meeting at a time and publishes a fresh MeetingView after every change,
// in the shape React's useSyncExternalStore expects.
export class MeetingEngine {
  private view: MeetingView = IDLE;
  private listeners = new Set<() => void>();
  private stopped = false;
  private controllers = new Set<AbortController>();
  private sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  private now: () => Date;

  constructor(private deps: EngineDeps) {
    this.sleep = deps.sleep ?? abortableSleep;
    this.now = deps.now ?? (() => new Date());
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  getSnapshot = () => this.view;

  stop = () => {
    this.stopped = true;
    this.controllers.forEach((c) => c.abort());
  };

  private set(patch: Partial<MeetingView>) {
    this.view = { ...this.view, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  private addRound(name: string, desc: string, single = false): number {
    this.set({ rounds: [...this.view.rounds, { name, desc, single, cards: [] }] });
    return this.view.rounds.length - 1;
  }

  private addCard(round: number, card: CardView) {
    this.set({ rounds: this.view.rounds.map((r, i) => i === round ? { ...r, cards: [...r.cards, card] } : r) });
  }

  private patchCard(round: number, id: string, patch: Partial<CardView>) {
    this.set({
      rounds: this.view.rounds.map((r: RoundView, i) => i !== round ? r
        : { ...r, cards: r.cards.map((c) => c.id === id ? { ...c, ...patch } : c) }),
    });
  }

  // One AI call for one seat, retrying busy or rate-limited providers twice before giving up.
  private async call(round: number, role: Role, choice: Choice, prompt: string, entries: Entry[], opts: CallOptions = {}): Promise<string | null> {
    const p = this.deps.providers[choice.pid];
    const key = this.deps.getKey(choice.pid).trim();
    const id = round + ":" + role.id;
    const images = opts.images?.length ? opts.images : null;
    const labels = images?.map((img, i) => imageLabel(i, img.caption));
    this.addCard(round, {
      id, roleId: role.id, roleName: role.name, colour: role.c, choice, prompt, chair: role.id === CHAIR.id,
      imaging: !!opts.imaging, images: images && images.map((img, i) => ({ label: labels![i], dataUrl: dataUrlOf(img.base64) })),
      status: "waiting", text: "", notice: null, error: null,
    });
    const entry: Entry = {
      roleId: role.id, role: role.name, provider: p.label, model: choice.model, prompt,
      ...(labels ? { images: labels } : {}),
      response: null, error: null, started: this.now().toISOString(),
    };
    entries.push(entry);
    if (this.stopped) {
      this.patchCard(round, id, { status: "stopped", error: "Stopped." });
      entry.error = "stopped";
      return null;
    }
    const ctl = new AbortController();
    this.controllers.add(ctl);
    this.patchCard(round, id, { status: "thinking" });
    const parts: Part[] = [...(images ? imageParts(images) : []), { type: "text", text: prompt }];
    let lastText = "";
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const text = await p.stream({
            key, model: choice.model, parts, signal: ctl.signal,
            onText: (t) => { lastText = t; this.patchCard(round, id, { status: "speaking", text: t, notice: null }); },
          });
          if (!text.trim()) throw new ProviderError("The model returned an empty answer.", 0);
          this.patchCard(round, id, { status: "done", text, notice: null });
          entry.response = text;
          entry.finished = this.now().toISOString();
          return text;
        } catch (e) {
          const status = (e as ProviderError).status ?? 0;
          const retryable = (status === 429 || status >= 500) && !lastText && attempt < 2 && !this.stopped;
          if (!retryable) throw e;
          this.patchCard(round, id, { status: "retrying", notice: p.label + " is busy, retrying…" });
          await this.sleep(4000 * (attempt + 1), ctl.signal);
        }
      }
    } catch (e) {
      const err = e as { name?: string; status?: number; message?: string };
      const aborted = err.name === "AbortError";
      entry.error = aborted ? "stopped" : (err.status ? err.status + ": " : "") + err.message;
      // A bad key or no connection will fail every other call too, so end the meeting now.
      if (err.status === 401 || err.status === 403 || e instanceof TypeError) this.stop();
      let message = images ? friendlyImageError(e, p.label, choice.model, p.suggestions[0]) : friendly(e, p.label);
      if (opts.imaging && !this.stopped) message += " The meeting will carry on without an imaging report.";
      this.patchCard(round, id, { status: aborted ? "stopped" : "failed", text: lastText, notice: null, error: message });
      return null;
    } finally {
      this.controllers.delete(ctl);
    }
  }

  async run(cfg: MeetingConfig): Promise<MeetingRecord> {
    const { roles, caseText: text, discussionRounds: extra, choiceFor } = cfg;
    const images = cfg.images ?? [];
    const n = images.length;
    this.stopped = false;
    const labels = (n ? ["Imaging review"] : []).concat(["First opinions"], Array.from({ length: extra }, (_, i) => "Discussion " + (i + 1)), ["Chair's decision"]);
    const offset = n ? 1 : 0;
    const seats = roles.concat([CHAIR]).map((r) => ({
      roleId: r.id, role: r.name, brief: r.brief, provider: this.deps.providers[choiceFor(r).pid].label, model: choiceFor(r).model,
    }));
    const record: MeetingRecord = {
      tool: "Revision MDT Simulator (prototype)", note: "Not clinical advice.",
      caseId: cfg.caseId, caseTitle: cfg.caseTitle, caseText: text,
      ...(n ? {
        images: images.map((img, i) => ({ label: "Image " + (i + 1), caption: img.caption.trim(), mediaType: img.mediaType, width: img.width, height: img.height, data: img.base64 })),
        imagesSeenByAll: !!cfg.showImagesToAll,
      } : {}),
      seats, discussionRounds: extra, startedAt: this.now().toISOString(), rounds: [],
    };
    this.set({ running: true, steps: labels, active: 0, rounds: [], record: null });

    let round: number;
    let entries: Entry[];
    // What the consultants and chair see as the case: the case text, plus the imaging report if there is one.
    let caseForSeats = text;

    if (n) {
      const rad = roles.find((r) => r.id === RADIOLOGIST.id) ?? RADIOLOGIST;
      round = this.addRound("Imaging review", "The radiologist reviews the attached images before the meeting. The other consultants will read this report.", true);
      entries = [];
      record.rounds.push({ name: "Imaging review", entries });
      const report = await this.call(round, rad, choiceFor(rad), imagingPrompt(rad, text, n), entries, { images, imaging: true });
      if (report) caseForSeats = withImagingReport(text, report, n);
      if (!this.stopped) this.set({ active: offset });
    }

    let latest: Record<string, string> = {};
    if (!this.stopped) {
      round = this.addRound("First opinions", "Each consultant reads the case alone. Nobody has seen anyone else's view yet.");
      const firstEntries: Entry[] = [];
      record.rounds.push({ name: "First opinions", entries: firstEntries });
      const seeAll = n > 0 && !!cfg.showImagesToAll;
      const firstRound = round;
      await Promise.all(roles.map(async (r) => {
        const prompt = firstPrompt(r, caseForSeats, seeAll ? seeImagesNote(n) : "");
        const t = await this.call(firstRound, r, choiceFor(r), prompt, firstEntries, seeAll ? { images } : {});
        if (t) latest[r.id] = t;
      }));
    }

    for (let k = 1; k <= extra && !this.stopped; k++) {
      this.set({ active: offset + k });
      const discussionRound = this.addRound("Discussion " + k, "Everyone has now read all the other opinions and responds to them.");
      const discussionEntries: Entry[] = [];
      record.rounds.push({ name: "Discussion " + k, entries: discussionEntries });
      const snapshot = Object.assign({}, latest);
      const next: Record<string, string> = {};
      await Promise.all(roles.map(async (r) => {
        const others = roles.filter((o) => o.id !== r.id && snapshot[o.id]).map((o) => "### " + o.name + "\n" + snapshot[o.id]).join("\n\n") || "(No colleague opinions were available.)";
        const t = await this.call(discussionRound, r, choiceFor(r), discussPrompt(r, caseForSeats, others, k), discussionEntries);
        next[r.id] = t || snapshot[r.id];
      }));
      latest = next;
    }

    if (!this.stopped) {
      this.set({ active: labels.length - 1 });
      // The imaging report reaches the chair through the case text, so it isn't repeated in the transcript.
      const transcript = record.rounds.filter((rd) => rd.name !== "Imaging review")
        .map((rd) => "=== " + rd.name + " ===\n" + rd.entries.filter((e) => e.response).map((e) => "### " + e.role + "\n" + e.response).join("\n\n")).join("\n\n");
      round = this.addRound("Chair's decision", "The chair reads the whole discussion and records the outcome.", true);
      entries = [];
      record.rounds.push({ name: "Chair's decision", entries });
      await this.call(round, CHAIR, choiceFor(CHAIR), chairPrompt(caseForSeats, transcript), entries);
    }
    record.finishedAt = this.now().toISOString();
    record.stoppedEarly = this.stopped;
    this.set({ running: false, active: this.stopped ? -1 : labels.length, record });
    return record;
  }
}
