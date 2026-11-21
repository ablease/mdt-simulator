import { useRef, useState, useSyncExternalStore } from "react";
import { CASES } from "./cases/cases";
import { MeetingEngine } from "./meeting/engine";
import { PROVIDERS, type ProviderId } from "./providers";
import { CHAIR, ROLES, type Role } from "./prompts/roles";
import { dec, loadDefaultChoice, loadSeatChoices, saveDefaultChoice, saveSeatChoices } from "./storage/settings";
import { CasePanel } from "./ui/CasePanel";
import { KeysPanel } from "./ui/KeysPanel";
import { MeetingView } from "./ui/MeetingView";
import { SeatsPanel } from "./ui/SeatsPanel";
import { useKeys } from "./ui/useKeys";

export function App() {
  const k = useKeys();
  const keysRef = useRef(k.keys);
  keysRef.current = k.keys;
  const [engine] = useState(() => new MeetingEngine({ providers: PROVIDERS, getKey: (pid) => keysRef.current[pid] }));
  const view = useSyncExternalStore(engine.subscribe, engine.getSnapshot);

  const [defaultChoice, setDefaultChoice] = useState(loadDefaultChoice);
  const [seatChoice, setSeatChoice] = useState(loadSeatChoices);
  const [, setModelsVersion] = useState(0);
  const [roleOn, setRoleOn] = useState(() => Object.fromEntries(ROLES.map((r) => [r.id, !!r.on])));
  const [rounds, setRounds] = useState(1);
  const [caseId, setCaseId] = useState(CASES[0].id);
  const [caseText, setCaseText] = useState(CASES[0].text);
  // A one-off message (such as "Keys cleared") shown in place of the call count until the next change.
  const [notice, setNotice] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const hasKey = (pid: ProviderId) => !!k.keys[pid].trim();
  const chosen = ROLES.filter((r) => roleOn[r.id]);
  const choiceFor = (r: Role) => dec(seatChoice[r.id] || defaultChoice);
  const usedChoices = chosen.concat([CHAIR]).map(choiceFor);

  const n = chosen.length;
  const missing = [...new Set(usedChoices.filter((c) => !hasKey(c.pid)).map((c) => PROVIDERS[c.pid].label))];
  let cost = { msg: "", bad: false };
  if (n < 2) cost = { msg: "Choose at least two consultants.", bad: true };
  else if (k.locked) cost = { msg: "Unlock your saved keys above, or press \"Forget keys\" and paste them in again.", bad: true };
  else if (missing.length) cost = { msg: "Add your " + missing.join(" and ") + " API key, or switch those seats to a provider you have a key for.", bad: true };
  else {
    const provs = [...new Set(usedChoices.map((c) => PROVIDERS[c.pid].label))];
    cost = { msg: `${n} consultants × ${1 + rounds} rounds + chair = ${n * (1 + rounds) + 1} AI calls on ${provs.join(" and ")}`, bad: false };
  }
  const canRun = !view.running && !cost.bad;
  if (notice) cost = { msg: notice, bad: false };

  const edited = () => setNotice(null);

  async function run() {
    const text = caseText.trim();
    if (chosen.length < 2 || !text) return;
    setNotice(null);
    setHasRun(true);
    await engine.run({
      caseId, caseTitle: CASES.find((c) => c.id === caseId)?.title, caseText: text,
      roles: chosen, discussionRounds: rounds, choiceFor,
    });
  }

  return (
    <div className="wrap">
      <header className="top">
        <div className="eyebrow">Research prototype · Arthroplasty revision MDT</div>
        <h1>Revision MDT Simulator</h1>
        <p className="lede">Several AI "consultants" each give an opinion on a case, read each other's views and argue it out, then a chair records a final decision. Every card is one call to an AI provider using your own API key, and each seat at the table can use a different model.</p>
      </header>

      <div className="banner"><strong>Fictional or fully anonymised cases only.</strong> Text you run here is sent to the AI providers you choose. Do not enter identifiable patient information unless your trust's information governance has approved it. Output is not clinical advice.</div>

      <div className="grid">
        <aside className="side">
          <KeysPanel
            k={k}
            usedChoices={usedChoices}
            defaultChoice={defaultChoice}
            onDefaultChange={(v) => { setDefaultChoice(v); saveDefaultChoice(v); edited(); }}
            onModelsChanged={() => setModelsVersion((x) => x + 1)}
            onKeysEdited={edited}
            onForget={() => setNotice("Keys cleared from this browser.")}
          />
          <CasePanel
            caseId={caseId}
            caseText={caseText}
            onCase={(id) => { setCaseId(id); setCaseText(CASES.find((c) => c.id === id)!.text); }}
            onText={setCaseText}
          />
          <SeatsPanel
            roleOn={roleOn}
            onToggle={(id, on) => { setRoleOn((v) => ({ ...v, [id]: on })); edited(); }}
            seatChoice={seatChoice}
            onSeatChoice={(id, v) => {
              const next = { ...seatChoice };
              if (v) next[id] = v; else delete next[id];
              setSeatChoice(next);
              saveSeatChoices(next);
              edited();
            }}
            defaultChoice={defaultChoice}
            keys={k.keys}
            rounds={rounds}
            onRounds={(r) => { setRounds(r); edited(); }}
            runLabel={view.running ? "Meeting in progress…" : hasRun ? "Hold the meeting again" : "Hold the meeting"}
            canRun={canRun}
            running={view.running}
            onRun={run}
            onStop={engine.stop}
            cost={cost}
          />
        </aside>

        <MeetingView view={view} />
      </div>

      <footer>This page has no server. It runs entirely in your browser and talks directly to the providers you choose. Your keys and your cases are not sent to whoever hosts this page. Usage is billed to your own provider accounts, so it's sensible to set a monthly spending limit there.</footer>
    </div>
  );
}
