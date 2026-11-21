import { shortWhen } from "../meeting/summary";
import type { MeetingView } from "../meeting/types";
import type { MeetingsState } from "../storage/meetings";
import type { Session } from "./MeetingDetails";
import { href, type Route } from "./route";

interface Props {
  route: Route;
  view: MeetingView;
  // The meeting run in this tab, while it runs, or afterwards if it wasn't saved.
  live: Session | null;
  meetings: MeetingsState;
}

const RECENT = 8;

export function Sidebar({ route, view, live, meetings }: Props) {
  const current = (page: Route["page"]) => (route.page === page ? "page" : undefined);
  const { status, list, lastBackup } = meetings;
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
        <section className="session" aria-labelledby="recent-h">
          <h2 id="recent-h">Recent meetings</h2>
          {live && (
            <a className="session-item" href={href({ page: "meeting" })} aria-current={route.page === "meeting" && !route.id ? "page" : undefined}>
              <b>{live.caseTitle || "Meeting"}</b>
              <span>{view.running ? "In progress" : "Not saved"}, started {live.startedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
            </a>
          )}
          {list.slice(0, RECENT).map((m) => (
            <a className="session-item" key={m.id} href={href({ page: "meeting", id: m.id })} aria-current={route.page === "meeting" && route.id === m.id ? "page" : undefined}>
              <b>{m.caseTag ? m.caseTag + " · " : ""}{m.caseTitle}</b>
              <span>{shortWhen(m.startedAt)}{m.agreement ? " · " + m.agreement : ""}</span>
            </a>
          ))}
          {list.length > RECENT && <a className="more-link" href={href({ page: "history" })}>All {list.length} meetings</a>}
          {status === "ready" && !list.length && !live && <p className="hint">Meetings you run are saved and listed here.</p>}
          {status === "unavailable"
            ? <p className="hint">This browser window can't save meetings, so download them before you close the tab.</p>
            : <p className="hint">Saved on this computer only. {lastBackup ? `Last backup ${shortWhen(lastBackup)}.` : "Not backed up yet."}</p>}
        </section>
      </div>
    </div>
  );
}
