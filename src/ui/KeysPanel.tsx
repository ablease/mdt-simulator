import { useState, type FormEvent } from "react";
import { friendly, PIDS, PROVIDERS, type ProviderId } from "../providers";
import { addCustomModel, saveModels, type Choice } from "../storage/settings";
import { MIN_PASSPHRASE } from "../storage/vault";
import { ModelSelect } from "./ModelSelect";
import type { KeysApi } from "./useKeys";

interface Status { msg: string; cls?: "ok" | "bad" }

interface Props {
  k: KeysApi;
  usedChoices: Choice[];
  defaultChoice: string;
  onDefaultChange: (v: string) => void;
  onModelsChanged: () => void;
  onKeysEdited: () => void;
  onForget: () => void;
}

export function KeysPanel({ k, usedChoices, defaultChoice, onDefaultChange, onModelsChanged, onKeysEdited, onForget }: Props) {
  const [status, setStatus] = useState<Partial<Record<ProviderId, Status>>>({});
  const [shown, setShown] = useState<Partial<Record<ProviderId, boolean>>>({});
  const [addProv, setAddProv] = useState<ProviderId>(PIDS[0]);
  const [addName, setAddName] = useState("");

  const setState = (pid: ProviderId, s: Status) => setStatus((prev) => ({ ...prev, [pid]: s }));

  async function check(pid: ProviderId) {
    const p = PROVIDERS[pid];
    const key = k.keys[pid].trim();
    if (!key) { setState(pid, { msg: "Paste your " + p.label + " key first.", cls: "bad" }); return; }
    setState(pid, { msg: "Checking…" });
    try {
      const models = await p.listModels(key);
      if (models.length) saveModels(pid, models);
      onModelsChanged();
      const used = usedChoices.filter((c) => c.pid === pid && models.length && !models.includes(c.model)).map((c) => c.model);
      const note = used.length ? ` Not available to you: ${[...new Set(used)].join(", ")}. Pick another from the model menus.` : "";
      setState(pid, { msg: `Key works. ${models.length} ${p.label} models available to you, now in the model menus.${note}`, cls: note ? "bad" : "ok" });
    } catch (e) {
      setState(pid, { msg: friendly(e, p.label), cls: "bad" });
    }
  }

  function add() {
    const name = addName.trim();
    if (!name) return;
    addCustomModel(addProv, name);
    setAddName("");
    onModelsChanged();
  }

  return (
    <section className="panel" aria-labelledby="conn-h">
      <h2 id="conn-h">Your API keys</h2>
      {k.locked ? <UnlockForm k={k} /> : (
        <>
          <p className="hint">Add a key for one provider, or both if you want consultants on different providers.</p>
          <div id="keyBlocks">
            {PIDS.map((pid) => {
              const p = PROVIDERS[pid];
              const s = status[pid];
              return (
                <div className="keyblock" key={pid}>
                  <label className="fld" htmlFor={"key-" + pid}>{p.label} API key</label>
                  <div className="keyrow">
                    <input type={shown[pid] ? "text" : "password"} id={"key-" + pid} className="mono" autoComplete="off" spellCheck={false}
                      placeholder={p.keyPrefix + "..."} value={k.keys[pid]}
                      onChange={(e) => { k.setKey(pid, e.target.value); setState(pid, { msg: "" }); onKeysEdited(); }} />
                    <button className="small" type="button" onClick={() => setShown((v) => ({ ...v, [pid]: !v[pid] }))}>{shown[pid] ? "Hide" : "Show"}</button>
                    <button className="small chk" type="button" onClick={() => check(pid)}>Check</button>
                  </div>
                  <p className="hint">Get one at <a href={p.keyHelp.url} target="_blank" rel="noopener">{p.keyHelp.linkText}</a>{p.keyHelp.after}</p>
                  <div className={"connstate" + (s?.cls ? " " + s.cls : "")} role="status">{s?.msg}</div>
                </div>
              );
            })}
          </div>
          <label className="check" htmlFor="remember">
            <input type="checkbox" id="remember" checked={k.remember} onChange={(e) => k.setRememberOn(e.target.checked)} />
            <span>Remember my keys on this computer, locked with a passphrase. They are stored only in this browser and never sent anywhere except the provider they belong to.</span>
          </label>
          {k.remember && !k.sealed && <PassphraseForm k={k} />}
        </>
      )}
      {k.message && <div className={"connstate" + (k.message.cls ? " " + k.message.cls : "")} role="status" id="keyMessage">{k.message.text}</div>}
      <div className="row"><button className="small" id="forgetBtn" type="button" onClick={() => { k.forget(); setStatus({}); onForget(); }}>Forget keys</button></div>
      <label className="fld" htmlFor="defaultModel">Default model
        <ModelSelect id="defaultModel" value={defaultChoice} onChange={onDefaultChange} keys={k.keys} />
        <span className="hint">Used by every seat set to "Default model" below.</span>
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

function UnlockForm({ k }: { k: KeysApi }) {
  const [pass, setPass] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault(); if (pass) void k.unlock(pass); };
  return (
    <form className="vault" onSubmit={submit}>
      <label className="fld" htmlFor="unlockPass">Your keys are saved on this computer, locked with a passphrase
        <span className="keyrow two">
          <input type="password" id="unlockPass" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} />
          <button className="small primary" type="submit" disabled={k.busy || !pass}>{k.busy ? "Unlocking…" : "Unlock"}</button>
        </span>
      </label>
      <p className="hint">Forgotten it? Press "Forget keys" below and paste your keys in again.</p>
    </form>
  );
}

function PassphraseForm({ k }: { k: KeysApi }) {
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault(); void k.choosePassphrase(first, second); };
  return (
    <form className="vault" onSubmit={submit}>
      <label className="fld" htmlFor="newPass">Choose a passphrase
        <input type="password" id="newPass" autoComplete="new-password" value={first} onChange={(e) => setFirst(e.target.value)} />
      </label>
      <label className="fld" htmlFor="newPass2">Type it again
        <input type="password" id="newPass2" autoComplete="new-password" value={second} onChange={(e) => setSecond(e.target.value)} />
      </label>
      <p className="hint">At least {MIN_PASSPHRASE} characters. Three or four unrelated words work well. You'll type it each time you open the simulator. There's no way to recover it: if you forget it, press "Forget keys" and paste your keys in again.</p>
      <div className="row"><button className="small" type="submit" disabled={k.busy}>{k.busy ? "Saving…" : "Save my keys"}</button></div>
    </form>
  );
}
