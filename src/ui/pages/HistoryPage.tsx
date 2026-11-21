import { useState } from "react";
import { toCsv } from "../../export/csv";
import { downloadText, today } from "../../export/download";
import { downloadComparisonPdf } from "../../export/pdf";
import { ratingLabel, shortWhen, type MeetingSummary } from "../../meeting/summary";
import { deleteMeetings, getRecords, type MeetingsState } from "../../storage/meetings";
import { BackupControls, downloadBackup } from "../BackupControls";
import { ConfirmButton } from "../ConfirmButton";
import { href } from "../route";

// Repeat runs of a case group under the researcher's case ID, or the case title if there isn't one.
const caseKey = (m: MeetingSummary) => (m.caseTag ? "tag:" + m.caseTag : "title:" + m.caseTitle);
const caseName = (m: MeetingSummary) => (m.caseTag ? m.caseTag + ": " + m.caseTitle : m.caseTitle);
const localDay = (iso: string) => {
  const d = new Date(iso);
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
};
const unique = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));
const oldestFirst = (a: MeetingSummary, b: MeetingSummary) => a.startedAt.localeCompare(b.startedAt);

export function HistoryPage({ meetings }: { meetings: MeetingsState }) {
  const { status, list, lastBackup } = meetings;
  const [search, setSearch] = useState("");
  const [caseFilter, setCaseFilter] = useState("");
  const [model, setModel] = useState("");
  const [provider, setProvider] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const cases = [...new Map(list.map((m) => [caseKey(m), caseName(m)])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = list.filter((m) => {
    const day = localDay(m.startedAt);
    const haystack = [m.caseTag, m.caseTitle, m.outcome, m.panel, m.notes, m.actualDecision, m.agreement].join(" ").toLowerCase();
    return (!caseFilter || caseKey(m) === caseFilter)
      && (!model || m.models.includes(model))
      && (!provider || m.providers.includes(provider))
      && (!from || day >= from)
      && (!to || day <= to)
      && words.every((w) => haystack.includes(w));
  });
  const filtered = !!(search || caseFilter || model || provider || from || to);
  // Only meetings that still exist and are on screen count as chosen.
  const chosen = shown.filter((m) => picked.has(m.id));
  const allShownPicked = shown.length > 0 && chosen.length === shown.length;

  const toggle = (id: string, on: boolean) => setPicked((s) => { const next = new Set(s); if (on) next.add(id); else next.delete(id); return next; });
  const clearFilters = () => { setSearch(""); setCaseFilter(""); setModel(""); setProvider(""); setFrom(""); setTo(""); };

  async function act(what: string, fn: () => Promise<void>) {
    setBusy(true);
    setNote(null);
    try { await fn(); } catch { setNote({ text: `The ${what} couldn't be made. Reload the page and try again.`, bad: true }); } finally { setBusy(false); }
  }
  const compare = () => act("comparison report", async () => {
    await downloadComparisonPdf(await getRecords([...chosen].sort(oldestFirst).map((m) => m.id)));
    setNote({ text: "Comparison report downloaded." });
  });
  const csv = () => act("spreadsheet", async () => {
    downloadText(toCsv([...chosen].sort(oldestFirst)), `mdt-meetings-${today()}.csv`, "text/csv");
    setNote({ text: "Spreadsheet downloaded." });
  });
  const backup = () => act("backup", async () => {
    await downloadBackup(await getRecords(chosen.map((m) => m.id)), false);
    setNote({ text: "Backup of the chosen meetings downloaded." });
  });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 tabIndex={-1}>History</h1>
          <p className="lede">Every meeting is saved here when it finishes. They're kept in this browser on this computer only, so clearing your browser's data for this site deletes them. Back them up regularly.</p>
        </div>
      </header>

      <section className="panel" aria-labelledby="backup-h">
        <h2 id="backup-h">Backups</h2>
        <p className="hint" id="lastBackup">{lastBackup ? `Last full backup: ${shortWhen(lastBackup)}.` : "You haven't backed up your meetings yet."} A backup is one file holding every meeting, images included. Restore it here or on another computer.</p>
        <BackupControls idPrefix="history" count={list.length} />
      </section>

      {status === "loading" && <p className="hint">Loading saved meetings…</p>}
      {status === "unavailable" && <p className="note bad" role="alert">This browser isn't letting the simulator save anything, so meetings can't be kept here. This can happen in a private window. Download each meeting's PDF or JSON before closing the tab.</p>}
      {status === "ready" && !list.length && <p className="note">No saved meetings yet. They'll appear here as soon as one finishes.</p>}

      {list.length > 0 && (
        <section className="panel" aria-labelledby="meetings-h">
          <h2 id="meetings-h">Saved meetings</h2>
          <div className="filters">
            <label className="fld" htmlFor="hSearch">Search
              <input type="search" id="hSearch" placeholder="Case, decision, notes…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <label className="fld" htmlFor="hCase">Case
              <select id="hCase" value={caseFilter} onChange={(e) => setCaseFilter(e.target.value)}>
                <option value="">All cases</option>
                {cases.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
              </select>
            </label>
            <label className="fld" htmlFor="hModel">Model
              <select id="hModel" value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="">All models</option>
                {unique(list.flatMap((m) => m.models)).map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="fld" htmlFor="hProvider">Provider
              <select id="hProvider" value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="">All providers</option>
                {unique(list.flatMap((m) => m.providers)).map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="fld" htmlFor="hFrom">From
              <input type="date" id="hFrom" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="fld" htmlFor="hTo">To
              <input type="date" id="hTo" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <p className="hint" role="status" id="shownCount">
            {filtered ? `Showing ${shown.length} of ${list.length} meetings.` : `${list.length} ${list.length === 1 ? "meeting" : "meetings"}.`}
            {filtered && <> <button className="link" type="button" onClick={clearFilters}>Clear filters</button></>}
          </p>

          <div className="selection" aria-label="Chosen meetings">
            <span>{chosen.length ? `${chosen.length} chosen` : "Tick meetings to compare them, export them or delete them."}</span>
            <button className="small" type="button" id="compareBtn" disabled={busy || !chosen.length} onClick={compare}>Comparison report (PDF)</button>
            <button className="small" type="button" id="csvBtn" disabled={busy || !chosen.length} onClick={csv}>Spreadsheet (CSV)</button>
            <button className="small" type="button" id="backupChosenBtn" disabled={busy || !chosen.length} onClick={backup}>Back up these</button>
            <ConfirmButton id="deleteChosenBtn" label="Delete these" disabled={busy || !chosen.length}
              question={`Delete ${chosen.length === 1 ? "this meeting" : `these ${chosen.length} meetings`}? ${chosen.length === 1 ? "It" : "They"} will be removed from this computer and can't be brought back unless ${chosen.length === 1 ? "it's" : "they're"} in a backup.`}
              confirmLabel={chosen.length === 1 ? "Delete 1 meeting" : `Delete ${chosen.length} meetings`}
              onConfirm={async () => { await deleteMeetings(chosen.map((m) => m.id)); setPicked(new Set()); setNote({ text: "Deleted." }); }} />
          </div>
          {note && <p className={"connstate" + (note.bad ? " bad" : " ok")} role="status">{note.text}</p>}

          {shown.length ? (
            <div className="table-wrap">
              <table className="history">
                <thead>
                  <tr>
                    <th scope="col"><input type="checkbox" aria-label="Choose every meeting shown" checked={allShownPicked}
                      onChange={(e) => setPicked(e.target.checked ? new Set(shown.map((m) => m.id)) : new Set())} /></th>
                    <th scope="col">Date</th>
                    <th scope="col">Case</th>
                    <th scope="col">Panel</th>
                    <th scope="col">Decision</th>
                    <th scope="col">Agreement</th>
                    <th scope="col">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((m) => (
                    <tr key={m.id}>
                      <td><input type="checkbox" aria-label={`Choose ${caseName(m)}, ${shortWhen(m.startedAt)}`} checked={picked.has(m.id)} onChange={(e) => toggle(m.id, e.target.checked)} /></td>
                      <td className="nowrap">{shortWhen(m.startedAt)}</td>
                      <td>
                        {m.caseTag && <span className="tag">{m.caseTag}</span>}
                        <a href={href({ page: "meeting", id: m.id })}>{m.caseTitle}</a>
                        {m.stoppedEarly && <span className="hint"> Stopped early.</span>}
                      </td>
                      <td className="mdl">{m.panel}</td>
                      <td>{m.outcome || <span className="hint">No decision recorded</span>}</td>
                      <td>{m.agreement || <span className="hint">Not stated</span>}</td>
                      <td>{ratingLabel(m.rating) || <span className="hint">Not rated</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="note">No meetings match. <button className="link" type="button" onClick={clearFilters}>Clear filters</button></p>}
        </section>
      )}
    </div>
  );
}
