import { useState, type CSSProperties } from "react";
import { downloadJson } from "../export/download";
import { downloadPdf } from "../export/pdf";
import type { CardView, MeetingRecord, MeetingView as View } from "../meeting/types";
import { describe } from "../storage/settings";
import { Markdown } from "./Markdown";

function Card({ card }: { card: CardView }) {
  let body;
  if (card.status === "retrying") body = <p className="thinking">{card.notice}</p>;
  else body = (
    <>
      {card.text ? <Markdown md={card.text} /> : !card.error && <p className="thinking">Thinking…</p>}
      {card.error && <p className="err">{card.error}</p>}
    </>
  );
  return (
    <article className={"card" + (card.chair ? " chair" : "")} style={{ "--c": card.colour } as CSSProperties}>
      <div className="who">
        <div><b>{card.roleName}</b><span className="mdl">{describe(card.choice)}</span></div>
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
  return (
    <div className="savers" id="savers">
      <button id="pdfBtn" className="small" type="button" disabled={busy} onClick={pdf}>Download PDF</button>
      <button id="jsonBtn" className="small" type="button" onClick={() => downloadJson(record)}>Download JSON</button>
      <span className={"saveNote" + (note.bad ? " bad" : "")} id="saveNote" role="status">{note.text}</span>
    </div>
  );
}

export function MeetingView({ view }: { view: View }) {
  const started = view.steps.length > 0;
  return (
    <main className="meeting">
      {started && (
        <div className="status" id="statusBar">
          <div className="steps" id="steps">
            {view.steps.map((l, i) => (
              <span key={l} className={"step" + (i < view.active ? " done" : i === view.active ? " on" : "")}>{l}</span>
            ))}
          </div>
          {!view.running && view.record && <Savers key={view.record.startedAt} record={view.record} />}
        </div>
      )}
      <div id="roundsOut">
        {view.rounds.map((r, i) => (
          <section className="round" key={i}>
            <div className="round-head"><h3>{r.name}</h3><p>{r.desc}</p></div>
            <div className={"cards" + (r.single ? " single" : "")}>
              {r.cards.map((c) => <Card key={c.id} card={c} />)}
            </div>
          </section>
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
          <span>Add an API key, pick a case and press <b>Hold the meeting</b>. A full run makes about 9 to 14 calls and takes a minute or two. Afterwards you can download the meeting as a PDF report or as JSON data.</span>
        </div>
      )}
    </main>
  );
}
