import { friendly, ProviderError, type Provider, type ProviderId } from "../providers";
import { chairPrompt, discussPrompt, firstPrompt } from "../prompts/prompts";
import { CHAIR, type Role } from "../prompts/roles";
import type { Choice } from "../storage/settings";
import type { CardView, Entry, MeetingRecord, MeetingView, RoundView } from "./types";

export interface MeetingConfig {
  caseId: string;
  caseTitle?: string;
  caseText: string;
  // The consultants taking part, not including the chair.
  roles: Role[];
  discussionRounds: number;
  choiceFor: (role: Role) => Choice;
}

export interface EngineDeps {
  providers: Record<ProviderId, Provider>;
  // Read at call time, so a key changed mid-meeting is used for later calls (as before).
  getKey: (pid: ProviderId) => string;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => Date;
}

const abortableSleep = (ms: number, signal: AbortSignal) => new Promise<void>((res, rej) => {
  const t = setTimeout(res, ms);
  signal.addEventListener("abort", () => { clearTimeout(t); rej(new DOMException("Aborted", "AbortError")); }, { once: true });
});

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
  private async call(round: number, role: Role, choice: Choice, prompt: string, entries: Entry[]): Promise<string | null> {
    const p = this.deps.providers[choice.pid];
    const key = this.deps.getKey(choice.pid).trim();
    const id = round + ":" + role.id;
    this.addCard(round, {
      id, roleId: role.id, roleName: role.name, colour: role.c, choice, prompt, chair: role.id === CHAIR.id,
      status: "waiting", text: "", notice: null, error: null,
    });
    const entry: Entry = { roleId: role.id, role: role.name, provider: p.label, model: choice.model, prompt, response: null, error: null, started: this.now().toISOString() };
    entries.push(entry);
    if (this.stopped) {
      this.patchCard(round, id, { status: "stopped", error: "Stopped." });
      entry.error = "stopped";
      return null;
    }
    const ctl = new AbortController();
    this.controllers.add(ctl);
    this.patchCard(round, id, { status: "thinking" });
    let lastText = "";
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const text = await p.stream({
            key, model: choice.model, parts: [{ type: "text", text: prompt }], signal: ctl.signal,
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
      this.patchCard(round, id, { status: aborted ? "stopped" : "failed", text: lastText, notice: null, error: friendly(e, p.label) });
      // A bad key or no connection will fail every other call too, so end the meeting now.
      if (err.status === 401 || err.status === 403 || e instanceof TypeError) this.stop();
      return null;
    } finally {
      this.controllers.delete(ctl);
    }
  }

  async run(cfg: MeetingConfig): Promise<MeetingRecord> {
    const { roles, caseText: text, discussionRounds: extra, choiceFor } = cfg;
    this.stopped = false;
    const labels = ["First opinions"].concat(Array.from({ length: extra }, (_, i) => "Discussion " + (i + 1)), ["Chair's decision"]);
    const seats = roles.concat([CHAIR]).map((r) => ({
      roleId: r.id, role: r.name, brief: r.brief, provider: this.deps.providers[choiceFor(r).pid].label, model: choiceFor(r).model,
    }));
    const record: MeetingRecord = {
      tool: "Revision MDT Simulator (prototype)", note: "Not clinical advice.",
      caseId: cfg.caseId, caseTitle: cfg.caseTitle, caseText: text,
      seats, discussionRounds: extra, startedAt: this.now().toISOString(), rounds: [],
    };
    this.set({ running: true, steps: labels, active: 0, rounds: [], record: null });

    let round = this.addRound("First opinions", "Each consultant reads the case alone. Nobody has seen anyone else's view yet.");
    let entries: Entry[] = [];
    record.rounds.push({ name: "First opinions", entries });
    let latest: Record<string, string> = {};
    await Promise.all(roles.map(async (r) => {
      const t = await this.call(round, r, choiceFor(r), firstPrompt(r, text), entries);
      if (t) latest[r.id] = t;
    }));

    for (let k = 1; k <= extra && !this.stopped; k++) {
      this.set({ active: k });
      round = this.addRound("Discussion " + k, "Everyone has now read all the other opinions and responds to them.");
      entries = [];
      record.rounds.push({ name: "Discussion " + k, entries });
      const snapshot = Object.assign({}, latest);
      const next: Record<string, string> = {};
      await Promise.all(roles.map(async (r) => {
        const others = roles.filter((o) => o.id !== r.id && snapshot[o.id]).map((o) => "### " + o.name + "\n" + snapshot[o.id]).join("\n\n") || "(No colleague opinions were available.)";
        const t = await this.call(round, r, choiceFor(r), discussPrompt(r, text, others, k), entries);
        next[r.id] = t || snapshot[r.id];
      }));
      latest = next;
    }

    if (!this.stopped) {
      this.set({ active: labels.length - 1 });
      const transcript = record.rounds.map((rd) => "=== " + rd.name + " ===\n" + rd.entries.filter((e) => e.response).map((e) => "### " + e.role + "\n" + e.response).join("\n\n")).join("\n\n");
      round = this.addRound("Chair's decision", "The chair reads the whole discussion and records the outcome.", true);
      entries = [];
      record.rounds.push({ name: "Chair's decision", entries });
      await this.call(round, CHAIR, choiceFor(CHAIR), chairPrompt(text, transcript), entries);
    }
    record.finishedAt = this.now().toISOString();
    record.stoppedEarly = this.stopped;
    this.set({ running: false, active: this.stopped ? -1 : labels.length, record });
    return record;
  }
}
