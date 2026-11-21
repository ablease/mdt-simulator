import { dataUrlOf } from "../images/process";
import type { ImageInput } from "../images/types";
import { friendly, friendlyImageError, ProviderError, type Part, type Provider, type ProviderId } from "../providers";
import { chairPrompt, discussPrompt, firstPrompt, imageLabel, imagingPrompt, seeImagesNote, withImagingReport } from "../prompts/prompts";
import { CHAIR, ROLES, type Role } from "../prompts/roles";
import type { Choice } from "../storage/settings";
import { CHAIR_ROUND, discussionName, FIRST, IMAGING, IMAGING_CARRY_ON, plannedRounds, roundDesc } from "./rounds";
import type { CardView, Entry, MeetingRecord, MeetingView } from "./types";

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
const IDLE: MeetingView = { running: false, steps: [], active: 0, rounds: [], record: null, startedAt: null, planned: 0, retryable: [], paused: false };

// Runs one meeting at a time and publishes a fresh MeetingView after every change,
// in the shape React's useSyncExternalStore expects.
export class MeetingEngine {
  private view: MeetingView = IDLE;
  private listeners = new Set<() => void>();
  private stopped = false;
  private controllers = new Set<AbortController>();
  // Failed seats waiting to hear whether to try again (true) or carry on without them (false), by card id.
  private decisions = new Map<string, (retry: boolean) => void>();
  // Seats with a call on the way. The meeting is paused when none are and some are waiting for a decision.
  private working = new Set<string>();
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
    this.decide([...this.decisions.keys()], false);
  };

  // Try one failed seat again.
  retry = (id: string) => this.decide([id], true);
  retryAll = () => this.decide([...this.decisions.keys()], true);
  // Let the failed seats go and move on to the next round.
  carryOn = () => this.decide([...this.decisions.keys()], false);

  private decide(ids: string[], retry: boolean) {
    for (const id of ids) {
      const answer = this.decisions.get(id);
      if (!answer) continue;
      this.decisions.delete(id);
      // Marked as working straight away, so the meeting doesn't look paused while the call gets going.
      if (retry) {
        this.working.add(id);
        this.patchCard(id, { status: "waiting", text: "", notice: null, error: null });
      }
      answer(retry);
    }
    this.set({});
  }

  private set(patch: Partial<MeetingView>) {
    const view = { ...this.view, ...patch };
    // In seat order, whichever failed first.
    view.retryable = view.rounds.flatMap((r) => r.cards.map((c) => c.id)).filter((id) => this.decisions.has(id));
    view.paused = view.retryable.length > 0 && this.working.size === 0;
    this.view = view;
    this.listeners.forEach((fn) => fn());
  }

  private addRound(name: string, single = false): number {
    this.set({ rounds: [...this.view.rounds, { name, desc: roundDesc(name), single, cards: [] }] });
    return this.view.rounds.length - 1;
  }

  private addCard(round: number, card: CardView) {
    this.set({ rounds: this.view.rounds.map((r, i) => i === round ? { ...r, cards: [...r.cards, card] } : r) });
  }

  // Card ids are unique across the meeting: the round number and the seat.
  private patchCard(id: string, patch: Partial<CardView>) {
    this.set({
      rounds: this.view.rounds.map((r) => r.cards.some((c) => c.id === id)
        ? { ...r, cards: r.cards.map((c) => c.id === id ? { ...c, ...patch } : c) } : r),
    });
  }

  private card(id: string): CardView | undefined {
    return this.view.rounds.flatMap((r) => r.cards).find((c) => c.id === id);
  }

  // One seat's turn in a round. If its call fails, the seat waits until it's tried again or let go,
  // so every later round sees the answer from the retry.
  private async call(round: number, role: Role, choice: Choice, prompt: string, entries: Entry[], opts: CallOptions = {}): Promise<string | null> {
    const p = this.deps.providers[choice.pid];
    const id = round + ":" + role.id;
    this.working.add(id);
    const images = opts.images?.length ? opts.images : null;
    const labels = images?.map((img, i) => imageLabel(i, img.caption));
    this.addCard(round, {
      id, roleId: role.id, roleName: role.name, colour: role.c, model: p.label + " · " + choice.model, prompt, chair: role.id === CHAIR.id,
      imaging: !!opts.imaging, images: images && images.map((img, i) => ({ label: labels![i], dataUrl: dataUrlOf(img.base64) })),
      status: "waiting", text: "", notice: null, error: null,
    });
    const entry: Entry = {
      roleId: role.id, role: role.name, provider: p.label, model: choice.model, prompt,
      ...(labels ? { images: labels } : {}),
      response: null, error: null, started: this.now().toISOString(),
    };
    entries.push(entry);
    const parts: Part[] = [...(images ? imageParts(images) : []), { type: "text", text: prompt }];
    try {
      for (;;) {
        const text = await this.attempt(id, p, choice, parts, entry, !!images);
        if (text !== null || this.stopped) return text;
        const retry = await new Promise<boolean>((answer) => {
          this.working.delete(id);
          this.decisions.set(id, answer);
          this.set({});
        });
        if (!retry) return null;
        entry.earlierErrors = [...(entry.earlierErrors ?? []), entry.error!];
        entry.error = null;
        entry.started = this.now().toISOString();
      }
    } finally {
      if (this.working.delete(id)) this.set({});
    }
  }

  // One AI call, retrying busy or rate-limited providers twice before giving up.
  private async attempt(id: string, p: Provider, choice: Choice, parts: Part[], entry: Entry, withImages: boolean): Promise<string | null> {
    if (this.stopped) {
      this.patchCard(id, { status: "stopped", error: "Stopped." });
      entry.error = "stopped";
      return null;
    }
    // Read now, so a key fixed in Settings while the meeting waits is the one used.
    const key = this.deps.getKey(choice.pid).trim();
    const ctl = new AbortController();
    this.controllers.add(ctl);
    this.patchCard(id, { status: "thinking" });
    let lastText = "";
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const text = await p.stream({
            key, model: choice.model, parts, signal: ctl.signal,
            onText: (t) => { lastText = t; this.patchCard(id, { status: "speaking", text: t, notice: null }); },
          });
          if (!text.trim()) throw new ProviderError("The model returned an empty answer.", 0);
          this.patchCard(id, { status: "done", text, notice: null });
          entry.response = text;
          entry.finished = this.now().toISOString();
          return text;
        } catch (e) {
          const status = (e as ProviderError).status ?? 0;
          const retryable = (status === 429 || status >= 500) && !lastText && attempt < 2 && !this.stopped;
          if (!retryable) throw e;
          this.patchCard(id, { status: "retrying", notice: p.label + " is busy, retrying…" });
          await this.sleep(4000 * (attempt + 1), ctl.signal);
        }
      }
    } catch (e) {
      const err = e as { name?: string; status?: number; message?: string };
      const aborted = err.name === "AbortError";
      entry.error = aborted ? "stopped" : (err.status ? err.status + ": " : "") + err.message;
      const message = withImages ? friendlyImageError(e, p.label, choice.model, p.suggestions[0]) : friendly(e, p.label);
      this.patchCard(id, { status: aborted ? "stopped" : "failed", text: lastText, notice: null, error: message });
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
    this.decisions.clear();
    this.working.clear();
    const labels = plannedRounds(n > 0, extra);
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
    this.set({
      running: true, steps: labels, active: 0, rounds: [], record: null, startedAt: record.startedAt,
      planned: (n ? 1 : 0) + roles.length * (1 + extra) + 1,
    });

    let round: number;
    let entries: Entry[];
    // What the consultants and chair see as the case: the case text, plus the imaging report if there is one.
    let caseForSeats = text;

    if (n) {
      const rad = roles.find((r) => r.id === RADIOLOGIST.id) ?? RADIOLOGIST;
      round = this.addRound(IMAGING, true);
      entries = [];
      record.rounds.push({ name: IMAGING, entries });
      const report = await this.call(round, rad, choiceFor(rad), imagingPrompt(rad, text, n), entries, { images, imaging: true });
      if (report) caseForSeats = withImagingReport(text, report, n);
      else if (!this.stopped) {
        const id = round + ":" + rad.id;
        this.patchCard(id, { error: this.card(id)!.error + IMAGING_CARRY_ON });
      }
      if (!this.stopped) this.set({ active: offset });
    }

    let latest: Record<string, string> = {};
    if (!this.stopped) {
      round = this.addRound(FIRST);
      const firstEntries: Entry[] = [];
      record.rounds.push({ name: FIRST, entries: firstEntries });
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
      const discussionRound = this.addRound(discussionName(k));
      const discussionEntries: Entry[] = [];
      record.rounds.push({ name: discussionName(k), entries: discussionEntries });
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
      const transcript = record.rounds.filter((rd) => rd.name !== IMAGING)
        .map((rd) => "=== " + rd.name + " ===\n" + rd.entries.filter((e) => e.response).map((e) => "### " + e.role + "\n" + e.response).join("\n\n")).join("\n\n");
      round = this.addRound(CHAIR_ROUND, true);
      entries = [];
      record.rounds.push({ name: CHAIR_ROUND, entries });
      await this.call(round, CHAIR, choiceFor(CHAIR), chairPrompt(caseForSeats, transcript), entries);
    }
    record.finishedAt = this.now().toISOString();
    record.stoppedEarly = this.stopped;
    this.set({ running: false, active: this.stopped ? -1 : labels.length, record });
    return record;
  }
}
