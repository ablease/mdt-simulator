import { useState } from "react";
import { PIDS, PROVIDERS, type ProviderId } from "../providers";
import { addCustomModel } from "../storage/settings";
import type { Keys } from "../storage/vault";
import { ModelSelect } from "./ModelSelect";

interface Props {
  keys: Keys;
  defaultChoice: string;
  onDefaultChange: (v: string) => void;
  onModelsChanged: () => void;
}

export function ModelsPanel({ keys, defaultChoice, onDefaultChange, onModelsChanged }: Props) {
  const [addProv, setAddProv] = useState<ProviderId>(PIDS[0]);
  const [addName, setAddName] = useState("");

  function add() {
    const name = addName.trim();
    if (!name) return;
    addCustomModel(addProv, name);
    setAddName("");
    onModelsChanged();
  }

  return (
    <section className="panel" aria-labelledby="models-h">
      <h2 id="models-h">Models</h2>
      <label className="fld" htmlFor="defaultModel">Default model
        <ModelSelect id="defaultModel" value={defaultChoice} onChange={onDefaultChange} keys={keys} />
        <span className="hint">Used by every seat set to "Default model" when you set up a meeting.</span>
      </label>
      <details className="more">
        <summary>Model not in the list?</summary>
        <p className="hint">Type the exact model name from your provider's documentation and add it.</p>
        <div className="addrow">
          <select id="addProv" className="compact" aria-label="Provider for the new model" value={addProv} onChange={(e) => setAddProv(e.target.value as ProviderId)}>
            {PIDS.map((pid) => <option key={pid} value={pid}>{PROVIDERS[pid].label}</option>)}
          </select>
          <input type="text" id="addName" className="mono" spellCheck={false} autoComplete="off" placeholder="model-name" aria-label="Model name"
            value={addName} onChange={(e) => setAddName(e.target.value)} />
          <button className="small" id="addBtn" type="button" onClick={add}>Add</button>
        </div>
      </details>
    </section>
  );
}
