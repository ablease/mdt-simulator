import { shortWhen } from "../../meeting/summary";
import type { SavedRecord, MeetingView as View } from "../../meeting/types";
import { ConfirmButton } from "../ConfirmButton";
import { MeetingView } from "../MeetingView";
import { ResearchPanel } from "../ResearchPanel";

interface Props {
  view: View;
  title: string;
  // Set when showing a saved meeting; null for the one running now.
  saved: SavedRecord | null;
  // Why the meeting just run wasn't saved, if it wasn't.
  note: string | null;
  onStop: () => void;
  hasDetails: boolean;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onRerun: (rec: SavedRecord) => void;
  onDelete: (rec: SavedRecord) => Promise<void>;
}

export function MeetingPage({ view, title, saved, note, onStop, hasDetails, detailsOpen, onToggleDetails, onRerun, onDelete }: Props) {
  return (
    <div className="page meeting-page">
      <header className="page-head">
        <div>
          <h1 tabIndex={-1}>{title}</h1>
          <p className="lede">A simulated MDT meeting. Everything below is AI-generated and is not clinical advice.</p>
          {saved && (
            <p className="meta">
              {saved.research.caseTag && <span className="tag">{saved.research.caseTag}</span>}
              Held {shortWhen(saved.startedAt)}. Saved on this computer.{" "}
              {/* Not a "#" link: the part of the address after "#" picks the page. */}
              <button className="link" type="button" onClick={() => document.getElementById("research-h")?.focus()}>Go to research notes</button>
            </p>
          )}
        </div>
        <div className="head-actions">
          {hasDetails && (
            <button className="small" type="button" aria-expanded={detailsOpen} aria-controls="details" onClick={onToggleDetails}>
              {detailsOpen ? "Hide case and panel" : "Show case and panel"}
            </button>
          )}
          {saved && <button className="small" type="button" id="rerunBtn" onClick={() => onRerun(saved)}>Rerun this case</button>}
          {saved && (
            <ConfirmButton id="deleteBtn" label="Delete this meeting"
              question="Delete this meeting? It will be removed from this computer and can't be brought back unless it's in a backup."
              confirmLabel="Delete meeting" onConfirm={() => onDelete(saved)} />
          )}
        </div>
      </header>
      {note && <p className="note" role="status">{note}</p>}
      <MeetingView view={view} onStop={onStop} />
      {saved && <ResearchPanel key={saved.id} id={saved.id} initial={saved.research} />}
    </div>
  );
}
