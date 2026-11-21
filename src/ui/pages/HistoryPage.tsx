import { href } from "../route";

export function HistoryPage({ hasSession }: { hasSession: boolean }) {
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 tabIndex={-1}>History</h1>
          <p className="lede">Past meetings will be listed here, with search, notes and reports.</p>
        </div>
      </header>
      <section className="panel" aria-labelledby="saved-h">
        <h2 id="saved-h">Saved meetings</h2>
        <p className="hint">Meetings aren't saved yet. Until saving arrives in the next update, download the PDF or JSON at the end of each meeting.</p>
        {hasSession && <p className="hint"><a href={href({ page: "meeting" })}>Go back to this session's meeting</a></p>}
      </section>
    </div>
  );
}
