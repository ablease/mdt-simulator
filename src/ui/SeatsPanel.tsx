import type { CSSProperties } from "react";
import { CHAIR, ROLES, type Role } from "../prompts/roles";
import type { Keys } from "../storage/vault";
import { ModelSelect } from "./ModelSelect";

interface Props {
  roleOn: Record<string, boolean>;
  // Seats that must attend, such as the radiologist while images are attached, with the reason shown.
  lockedOn: Record<string, string>;
  onToggle: (id: string, on: boolean) => void;
  seatChoice: Record<string, string>;
  onSeatChoice: (id: string, value: string) => void;
  defaultChoice: string;
  keys: Keys;
  rounds: number;
  onRounds: (n: number) => void;
}

export function SeatsPanel(props: Props) {
  const { rounds, onRounds } = props;
  return (
    <section className="panel" aria-labelledby="panel-h">
      <h2 id="panel-h">Who sits at the table</h2>
      <p className="hint">Tick the consultants you want. You need at least two, and the chair always attends. Each seat can use the default model or one of its own. You can change the default model in <a href="#/settings">Settings</a>.</p>
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
    </section>
  );
}

function SeatRow({ role: r, fixed, roleOn, lockedOn, onToggle, seatChoice, onSeatChoice, defaultChoice, keys }: Props & { role: Role; fixed?: boolean }) {
  const lock = lockedOn[r.id];
  const on = fixed || !!lock || roleOn[r.id];
  const text = <span><b>{r.name}</b><span className="desc">{r.focus}</span>{lock && <span className="desc lock-note">{lock}</span>}</span>;
  return (
    <div className={"role-opt" + (on ? "" : " off")} style={{ "--c": r.c } as CSSProperties}>
      {fixed ? (
        <div className="role-main fixed"><span /><span className="dot" />{text}</div>
      ) : (
        <label className="role-main" htmlFor={"role-" + r.id}>
          <input type="checkbox" id={"role-" + r.id} checked={on} disabled={!!lock} onChange={(e) => onToggle(r.id, e.target.checked)} />
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
