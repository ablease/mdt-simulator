import { useEffect, useState } from "react";
import { shortWhen } from "../../meeting/summary";
import { deleteAll, storageInfo, type MeetingsState, type StorageInfo } from "../../storage/meetings";
import { BackupControls } from "../BackupControls";
import { ConfirmButton } from "../ConfirmButton";
import { KeysPanel } from "../KeysPanel";
import { ModelsPanel } from "../ModelsPanel";
import type { Draft } from "../useDraft";
import type { KeysApi } from "../useKeys";
import type { Theme, ThemeApi } from "../useTheme";

const THEMES: [Theme, string][] = [["system", "Match my computer"], ["light", "Light"], ["dark", "Dark"]];

function AppearancePanel({ theme }: { theme: ThemeApi }) {
  return (
    <section className="panel" aria-labelledby="appearance-h">
      <h2 id="appearance-h">Appearance</h2>
      <fieldset className="choices">
        <legend>Theme</legend>
        {THEMES.map(([value, label]) => (
          <label className="check" key={value}>
            <input type="radio" name="theme" value={value} checked={theme.theme === value} onChange={() => theme.choose(value)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <p className="hint">Saved in this browser. Reports and downloads always use the light colours.</p>
    </section>
  );
}

const size = (bytes: number) => bytes < 1024 ** 2 ? "less than 1 MB" : `about ${Math.round(bytes / 1024 ** 2)} MB`;

function StoragePanel({ meetings }: { meetings: MeetingsState }) {
  const { status, list, lastBackup } = meetings;
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [done, setDone] = useState("");
  useEffect(() => { void storageInfo().then(setInfo); }, [list]);
  const n = list.length;
  return (
    <section className="panel" aria-labelledby="storage-h">
      <h2 id="storage-h">Saved meetings and backups</h2>
      {status === "unavailable" ? (
        <p className="note bad">This browser isn't letting the simulator save anything, so meetings can't be kept. This can happen in a private window. Download each meeting's PDF or JSON before you close the tab.</p>
      ) : (
        <>
          <p className="hint" id="storageSummary">
            {n === 0 ? "No meetings are saved yet." : `${n} ${n === 1 ? "meeting is" : "meetings are"} saved in this browser on this computer${info?.usage != null ? `, using ${size(info.usage)}` : ""}.`}
            {" "}They're not stored anywhere else. Clearing your browser's data for this site deletes them, so back them up regularly.
          </p>
          {info?.persisted != null && (
            <p className="hint">{info.persisted
              ? "Your browser has agreed to keep them even if the computer runs short of space."
              : "Your browser may delete them if the computer runs short of space. Another reason to back up."}</p>
          )}
          <p className="hint">{lastBackup ? `Last full backup: ${shortWhen(lastBackup)}.` : "You haven't backed up your meetings yet."}</p>
          <BackupControls idPrefix="settings" count={n} />
          <ConfirmButton id="deleteAllBtn" label="Delete all saved meetings" disabled={!n}
            question={`Delete all ${n} saved meetings from this computer? This can't be undone. Back them up first if you might need them.`}
            confirmLabel={`Delete all ${n} meetings`}
            onConfirm={async () => { await deleteAll(); setDone("All saved meetings have been deleted from this computer."); }} />
          {done && <p className="connstate ok" role="status">{done}</p>}
        </>
      )}
    </section>
  );
}

export function SettingsPage({ k, draft: d, meetings, theme }: { k: KeysApi; draft: Draft; meetings: MeetingsState; theme: ThemeApi }) {
  // The model menus read their lists from the browser, so redraw them after "Check" or "Add".
  const [, setModelsVersion] = useState(0);
  const modelsChanged = () => setModelsVersion((x) => x + 1);
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 tabIndex={-1}>Settings</h1>
          <p className="lede">Your API keys, model choices, saved meetings and how the page looks. They're kept in this browser and nowhere else.</p>
        </div>
      </header>
      <div className="settings">
        <KeysPanel k={k} usedChoices={d.usedChoices} onModelsChanged={modelsChanged} />
        <div className="stack">
          <ModelsPanel keys={k.keys} defaultChoice={d.defaultChoice} onDefaultChange={d.setDefaultChoice} onModelsChanged={modelsChanged} />
          <StoragePanel meetings={meetings} />
          <AppearancePanel theme={theme} />
          <section className="panel" aria-labelledby="privacy-h">
            <h2 id="privacy-h">Privacy</h2>
            <p className="hint">This page has no server. It runs entirely in your browser and talks directly to the providers you choose. Your keys, your cases and your saved meetings are not sent to whoever hosts this page. Usage is billed to your own provider accounts, so it's sensible to set a monthly spending limit there.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
