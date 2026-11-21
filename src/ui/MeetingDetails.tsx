import type { CSSProperties } from "react";

// What a meeting was run with, kept when it starts so later edits to the next meeting don't change it.
export interface Session {
  caseTitle?: string;
  caseText: string;
  images: { label: string; dataUrl: string }[];
  imagesSeenByAll: boolean;
  // Provider and model as shown, e.g. "OpenAI · gpt-5-mini".
  seats: { id: string; name: string; colour: string; model: string }[];
  rounds: number;
  startedAt: Date;
}

// The right-hand panel on the meeting page: a read-only copy of the case, images and panel.
export function MeetingDetails({ session: s, open }: { session: Session; open: boolean }) {
  return (
    <aside id="details" className="details" aria-labelledby="details-h" hidden={!open}>
      <div className="details-inner">
        <h2 id="details-h">Case and panel</h2>
        <section className="detail">
          <h3>Case</h3>
          {s.caseTitle && <p className="hint">{s.caseTitle}</p>}
          <pre className="case-copy">{s.caseText}</pre>
        </section>
        {s.images.length > 0 && (
          <section className="detail">
            <h3>Images</h3>
            <div className="thumbs">
              {s.images.map((im) => <figure key={im.label}><img src={im.dataUrl} alt={im.label} /><figcaption>{im.label}</figcaption></figure>)}
            </div>
            <p className="hint">{s.imagesSeenByAll ? "Every consultant saw these with their first opinion." : "Only the radiologist saw these. The others read the imaging report."}</p>
          </section>
        )}
        <section className="detail">
          <h3>Panel</h3>
          <ul className="seat-list">
            {s.seats.map((seat) => (
              <li key={seat.id} style={{ "--c": seat.colour } as CSSProperties}>
                <span className="dot" />
                <span><b>{seat.name}</b><span className="mdl">{seat.model}</span></span>
              </li>
            ))}
          </ul>
          <p className="hint">{s.rounds === 1 ? "1 round" : s.rounds + " rounds"} of discussion after first opinions.</p>
        </section>
      </div>
    </aside>
  );
}
