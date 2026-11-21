import { useState } from "react";
import { KeysPanel } from "../KeysPanel";
import { ModelsPanel } from "../ModelsPanel";
import type { Draft } from "../useDraft";
import type { KeysApi } from "../useKeys";

export function SettingsPage({ k, draft: d }: { k: KeysApi; draft: Draft }) {
  // The model menus read their lists from the browser, so redraw them after "Check" or "Add".
  const [, setModelsVersion] = useState(0);
  const modelsChanged = () => setModelsVersion((x) => x + 1);
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 tabIndex={-1}>Settings</h1>
          <p className="lede">Your API keys and model choices. They're kept in this browser and nowhere else.</p>
        </div>
      </header>
      <div className="settings">
        <KeysPanel k={k} usedChoices={d.usedChoices} onModelsChanged={modelsChanged} />
        <div className="stack">
          <ModelsPanel keys={k.keys} defaultChoice={d.defaultChoice} onDefaultChange={d.setDefaultChoice} onModelsChanged={modelsChanged} />
          <section className="panel" aria-labelledby="storage-h">
            <h2 id="storage-h">Saved meetings and backups</h2>
            <p className="hint">Meetings aren't saved yet. Download the PDF or JSON at the end of each meeting to keep a copy. Saving meetings on this computer, and backing them up, is coming in the next update.</p>
          </section>
          <section className="panel" aria-labelledby="privacy-h">
            <h2 id="privacy-h">Privacy</h2>
            <p className="hint">This page has no server. It runs entirely in your browser and talks directly to the providers you choose. Your keys and your cases are not sent to whoever hosts this page. Usage is billed to your own provider accounts, so it's sensible to set a monthly spending limit there.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
