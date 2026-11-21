import type { MeetingView as View } from "../../meeting/types";
import type { Session } from "../MeetingDetails";
import { MeetingView } from "../MeetingView";

interface Props {
  view: View;
  session: Session | null;
  onStop: () => void;
  detailsOpen: boolean;
  onToggleDetails: () => void;
}

export function MeetingPage({ view, session, onStop, detailsOpen, onToggleDetails }: Props) {
  return (
    <div className="page meeting-page">
      <header className="page-head">
        <div>
          <h1 tabIndex={-1}>{session?.caseTitle || "Meeting"}</h1>
          <p className="lede">A simulated MDT meeting. Everything below is AI-generated and is not clinical advice.</p>
        </div>
        {session && (
          <button className="small" type="button" aria-expanded={detailsOpen} aria-controls="details" onClick={onToggleDetails}>
            {detailsOpen ? "Hide case and panel" : "Show case and panel"}
          </button>
        )}
      </header>
      <MeetingView view={view} onStop={onStop} />
    </div>
  );
}
