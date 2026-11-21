import type { MeetingView } from "../meeting/types";
import type { Session } from "./MeetingDetails";
import { href, type Route } from "./route";

interface Props {
  route: Route;
  view: MeetingView;
  session: Session | null;
}

export function Sidebar({ route, view, session }: Props) {
  const current = (page: Route["page"]) => (route.page === page ? "page" : undefined);
  const status = view.running ? "In progress" : view.record?.stoppedEarly ? "Stopped early" : "Finished";
  return (
    <div className="sidebar">
      <div className="sidebar-inner">
        <div className="brand">
          <b>Revision MDT Simulator</b>
          <span className="eyebrow">Research prototype</span>
        </div>
        <nav aria-label="Main">
          <ul className="nav">
            <li><a href={href({ page: "new", step: "case" })} aria-current={current("new")}>New meeting</a></li>
            <li><a href={href({ page: "history" })} aria-current={current("history")}>History</a></li>
            <li><a href={href({ page: "settings" })} aria-current={current("settings")}>Settings</a></li>
          </ul>
        </nav>
        <section className="session" aria-labelledby="session-h">
          <h2 id="session-h">This session</h2>
          {session ? (
            <a className="session-item" href={href({ page: "meeting" })} aria-current={current("meeting")}>
              <b>{session.caseTitle || "Meeting"}</b>
              <span>{status}, started {session.startedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
            </a>
          ) : <p className="hint">The meeting you run will appear here.</p>}
          <p className="hint">Meetings aren't saved yet, so download the PDF or JSON before you close this tab.</p>
        </section>
      </div>
    </div>
  );
}
