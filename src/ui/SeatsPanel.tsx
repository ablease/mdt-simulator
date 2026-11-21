import type { CSSProperties } from "react";
import { CHAIR, ROLES, type Role } from "../prompts/roles";
import type { Keys } from "../storage/vault";
import { ModelSelect } from "./ModelSelect";

interface Props {
  roleOn: Record<string, boolean>;
  onToggle: (id: string, on: boolean) => void;
  seatChoice: Record<string, string>;
  onSeatChoice: (id: string, value: string) => void;
  defaultChoice: string;
  keys: Keys;
  rounds: number;
  onRounds: (n: number) => void;
  runLabel: string;
  canRun: boolean;
  running: boolean;
  onRun: () => void;
  onStop: () => void;
  cost: { msg: string; bad: boolean };
}

export function SeatsPanel(props: Props) {
  const { rounds, onRounds, runLabel, canRun, running, onRun, onStop, cost } = props;
  return (
    <section className="panel" aria-labelledby="panel-h">
      <h2 id="panel-h">Who sits at the table</h2>
      <div className="roles" id="roles">
        {ROLES.map((r) => <SeatRow key={r.id} role={r} {...props} />)}
        <SeatRow role={CHAIR} fixed {...props} />
      </div>
      <label className="fld" htmlFor="rounds">Rounds of discussion after first opinions
        <select id="rounds" value={rounds} onChange={(e) => onRounds(+e.target.value)}>
          <option value="1">1 round</option>
          <option value="2">2 rounds</option>
        </select>
      </label>
      <div className="row">
        <button className="primary" id="runBtn" type="button" disabled={!canRun} onClick={onRun}>{runLabel}</button>
        {running && <button id="stopBtn" type="button" onClick={onStop}>Stop</button>}
      </div>
      <div className={"cost" + (cost.bad ? " bad" : "")} id="cost" role="status">{cost.msg}</div>
    </section>
  );
}

function SeatRow({ role: r, fixed, roleOn, onToggle, seatChoice, onSeatChoice, defaultChoice, keys }: Props & { role: Role; fixed?: boolean }) {
  const on = fixed || roleOn[r.id];
  const text = <span><b>{r.name}</b><span className="desc">{r.focus}</span></span>;
  return (
    <div className={"role-opt" + (on ? "" : " off")} style={{ "--c": r.c } as CSSProperties}>
      {fixed ? (
        <div className="role-main fixed"><span /><span className="dot" />{text}</div>
      ) : (
        <label className="role-main" htmlFor={"role-" + r.id}>
          <input type="checkbox" id={"role-" + r.id} checked={!!roleOn[r.id]} onChange={(e) => onToggle(r.id, e.target.checked)} />
          <span className="dot" />{text}
        </label>
      )}
      <div className="role-model">
        <ModelSelect id={"model-" + r.id} className="compact" ariaLabel={"Model for " + r.name}
          value={seatChoice[r.id] || ""} onChange={(v) => onSeatChoice(r.id, v)} keys={keys} defaultChoice={defaultChoice} />
      </div>
    </div>
  );
}
