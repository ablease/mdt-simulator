import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { downloadJson } from "../export/download";
import { downloadPdf } from "../export/pdf";
import { announcementOf, pauseOf, progressOf } from "../meeting/progress";
import type { CardView, MeetingRecord, RoundView, MeetingView as View } from "../meeting/types";
import { Markdown } from "./Markdown";
import { href } from "./route";

// What can be done to the meeting running in this tab. A saved meeting has nothing to stop or retry.
export interface MeetingControls {
  stop: () => void;
  retry: (cardId: string) => void;
  retryAll: () => void;
  carryOn: () => void;
}

function Card({ card, onRetry }: { card: CardView; onRetry?: () => void }) {
  const self = useRef<HTMLElement>(null);
  let body;
  if (card.status === "retrying") body = <p className="thinking">{card.notice}</p>;
  else body = (
    <>
      {card.text ? <Markdown md={card.text} /> : !card.error && <p className="thinking">Thinking…</p>}
      {card.error && <p className="err">{card.error}</p>}
      {onRetry && (
        <button className="small" type="button" aria-label={"Try again: " + card.roleName} onClick={() => { onRetry(); self.current?.focus(); }}>Try again</button>
      )}
    </>
  );
  return (
    <article ref={self} tabIndex={-1} className={"card" + (card.chair ? " chair" : "")} style={{ "--c": card.colour } as CSSProperties}>
      <div className="who">
        <div><b>{card.roleName}</b><span className="mdl">{card.model}</span></div>
        <span className="tag">{card.status}</span>
      </div>
      {card.imaging && <p className="ai-label">AI image interpretation. Unvalidated, for research only.</p>}
      {card.imaging && card.images && (
        <div className="thumbs">
          {card.images.map((im) => <figure key={im.label}><img src={im.dataUrl} alt={im.label} /><figcaption>{im.label}</figcaption></figure>)}
        </div>
      )}
      <div className="body">{body}</div>
      <details className="prompt">
        <summary>Show the exact prompt sent</summary>
        {card.images && <p className="sent-with">Sent with {card.images.length === 1 ? "1 image" : card.images.length + " images"} before the text: {card.images.map((im) => im.label).join("; ")}</p>}
        <pre>{card.prompt}</pre>
      </details>
    </article>
  );
}

function Savers({ record }: { record: MeetingRecord }) {
  const [note, setNote] = useState({ text: "", bad: false });
  const [busy, setBusy] = useState(false);
  async function pdf() {
    setBusy(true);
    setNote({ text: "Preparing PDF…", bad: false });
    try {
      await downloadPdf(record);
      setNote({ text: "PDF downloaded.", bad: false });
    } catch {
      setNote({ text: "Couldn't create the PDF. It needs an internet connection the first time. Try again, or download the JSON instead.", bad: true });
    } finally {
      setBusy(false);
    }
  }
  async function word() {
    setBusy(true);
    setNote({ text: "Preparing Word file…", bad: false });
    try {
      // Loaded only when needed: the Word library is large.
      const { downloadWord } = await import("../export/word");
      await downloadWord(record);
      setNote({ text: "Word file downloaded.", bad: false });
    } catch {
      setNote({ text: "Couldn't create the Word file. Reload the page and try again, or download the PDF instead.", bad: true });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="savers" id="savers">
      <button id="pdfBtn" className="small" type="button" disabled={busy} onClick={pdf}>Download PDF</button>
      <button id="wordBtn" className="small" type="button" disabled={busy} onClick={word}>Download Word</button>
      <button id="jsonBtn" className="small" type="button" onClick={() => downloadJson(record)}>Download JSON</button>
      <span className={"saveNote" + (note.bad ? " bad" : "")} id="saveNote" role="status">{note.text}</span>
    </div>
  );
}

// Four cards sit two by two; five or six, three across. Narrow screens take fewer.
const columnsFor = (r: RoundView) => (r.single ? 1 : r.cards.length <= 3 ? Math.max(1, r.cards.length) : r.cards.length === 4 ? 2 : 3);

function Round({ round, index, open, onToggle, view, controls }: { round: RoundView; index: number; open: boolean; onToggle: () => void; view: View; controls?: MeetingControls }) {
  const id = "round-" + index;
  return (
    <section className={"round" + (open ? "" : " folded")} aria-labelledby={id + "-h"}>
      <div className="round-head">
        <h3 id={id + "-h"}>
          <button type="button" className="round-toggle" aria-expanded={open} aria-controls={id} onClick={onToggle}>{round.name}</button>
        </h3>
        <p>{round.desc}</p>
      </div>
      {!open && (
        <ul className="strip">
          {round.cards.map((c) => (
            <li key={c.id} style={{ "--c": c.colour } as CSSProperties}>
              <span className="dot" aria-hidden="true" />{c.roleName}{c.status !== "done" && <span className="tag">{c.status}</span>}
            </li>
          ))}
        </ul>
      )}
      <div id={id} className={"cards" + (round.single ? " single" : "")} hidden={!open} style={{ "--cols": columnsFor(round) } as CSSProperties}>
        {round.cards.map((c) => (
          <Card key={c.id} card={c} onRetry={controls && view.retryable.includes(c.id) ? () => controls.retry(c.id) : undefined} />
        ))}
      </div>
    </section>
  );
}

function PausePanel({ view, controls, after }: { view: View; controls: MeetingControls; after: () => void }) {
  const pause = pauseOf(view);
  if (!pause) return null;
  return (
    <section className="pause" aria-labelledby="pause-h" id="pausePanel">
      <h2 id="pause-h">Waiting for you</h2>
      <p><b>{pause.title}.</b> {pause.body}</p>
      <p className="hint">Each card says what went wrong. If a key was rejected, correct it in Settings first. The meeting waits here, and you can come back to it from Recent meetings.</p>
      <div className="row">
        <button className="primary" type="button" id="retryAllBtn" onClick={() => { controls.retryAll(); after(); }}>{pause.retryLabel}</button>
        <button type="button" id="carryOnBtn" onClick={() => { controls.carryOn(); after(); }}>{pause.carryOnLabel}</button>
      </div>
    </section>
  );
}

// controls is only passed for the meeting running in this tab.
export function MeetingView({ view, controls }: { view: View; controls?: MeetingControls }) {
  const started = view.steps.length > 0;
  const progress = progressOf(view);
  const progressLine = useRef<HTMLParagraphElement>(null);
  // Rounds folded or opened by hand. Otherwise only the latest round is open.
  const [opened, setOpened] = useState<Record<number, boolean>>({});
  const ranHere = useRef(false);
  if (view.running) ranHere.current = true;
  // When the meeting ends, Stop disappears. If it had focus, keep keyboard users in the same place.
  const wasRunning = useRef(view.running);
  useLayoutEffect(() => {
    if (wasRunning.current && !view.running && (!document.activeElement || document.activeElement === document.body)) {
      progressLine.current?.focus({ preventScroll: true });
    }
    wasRunning.current = view.running;
  }, [view.running]);
  const last = view.rounds.length - 1;
  const isOpen = (i: number) => opened[i] ?? i === last;
  const allOpen = view.rounds.every((_, i) => isOpen(i));
  return (
    <div className="meeting">
      {started && (
        <div className={"status" + (view.running ? " live" : "")} id="statusBar">
          <div className="status-row">
            <div className="steps" id="steps">
              {view.steps.map((l, i) => (
                <span key={l} className={"step" + (i < view.active ? " done" : i === view.active ? " on" : "")}>{l}</span>
              ))}
            </div>
            {view.running && controls && <button id="stopBtn" type="button" onClick={controls.stop}>Stop</button>}
            {!view.running && view.record && <Savers key={view.record.startedAt} record={view.record} />}
          </div>
          <div className="progress">
            <span className="bar" aria-hidden="true"><span style={{ inlineSize: Math.round(progress.fraction * 100) + "%" }} /></span>
            <p id="progressText" ref={progressLine} tabIndex={-1}>{progress.label}</p>
          </div>
          {controls && <PausePanel view={view} controls={controls} after={() => progressLine.current?.focus()} />}
          <p className="sr-only" role="status">{announcementOf(view, ranHere.current)}</p>
        </div>
      )}
      {view.rounds.length > 1 && (
        <div className="rounds-tools">
          <button type="button" className="link" id="foldBtn"
            onClick={() => setOpened(allOpen ? {} : Object.fromEntries(view.rounds.map((_, i) => [i, true])))}>
            {allOpen ? "Fold earlier rounds" : "Show every round"}
          </button>
        </div>
      )}
      <div id="roundsOut" className="rounds">
        {view.rounds.map((r, i) => (
          <Round key={i} round={r} index={i} open={isOpen(i)} view={view} controls={controls}
            onToggle={() => setOpened((o) => ({ ...o, [i]: !(o[i] ?? i === last) }))} />
        ))}
      </div>
      {!started && (
        <div className="empty" id="emptyState">
          <b>The meeting hasn't started.</b>
          <ol>
            <li><b>First opinions.</b> Each consultant reads the case on their own and gives a view, without seeing anyone else's.</li>
            <li><b>Discussion.</b> Everyone reads all the other opinions and says where they agree, disagree, or change their mind.</li>
            <li><b>Chair's decision.</b> The chair reads the whole discussion and writes the outcome, recording any dissent.</li>
          </ol>
          <span>Set one up under <a href={href({ page: "new", step: "case" })}>New meeting</a>. A full run takes a minute or two. Afterwards you can download the meeting as a PDF report or as JSON data.</span>
        </div>
      )}
    </div>
  );
}
