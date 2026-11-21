import type { CSSProperties } from "react";
import { CASES } from "../cases/cases";
import { CHAIR } from "../prompts/roles";
import { describe } from "../storage/settings";
import { KeyMessage, UnlockForm } from "./KeysPanel";
import type { Readiness } from "./readiness";
import { href } from "./route";
import type { Draft } from "./useDraft";
import type { KeysApi } from "./useKeys";

interface Props {
  draft: Draft;
  k: KeysApi;
  ready: Readiness;
  running: boolean;
  hasRun: boolean;
  onRun: () => void;
}

export function ReviewStep({ draft: d, k, ready, running, hasRun, onRun }: Props) {
  const n = d.images.length;
  const edited = d.caseText !== CASES.find((c) => c.id === d.caseId)?.text;
  return (
    <>
      <section className="panel" aria-labelledby="review-h">
        <h2 id="review-h">Review and run</h2>
        <dl className="summary">
          <div>
            <dt>Case</dt>
            <dd>{d.caseTitle}{edited && <span className="tag">edited</span>} <a href={href({ page: "new", step: "case" })}>Change</a></dd>
          </div>
          {d.caseTag.trim() && (
            <div>
              <dt>Case ID</dt>
              <dd>{d.caseTag.trim()} <span className="hint">(saved with the meeting, not sent to the AI)</span></dd>
            </div>
          )}
          <div>
            <dt>Images</dt>
            <dd>
              {n ? `${n === 1 ? "1 image" : n + " images"} attached. ${d.showAll ? "Every consultant sees them." : "Only the radiologist sees them. The others read the radiologist's report."}` : "None."}
              {" "}<a href={href({ page: "new", step: "images" })}>Change</a>
            </dd>
          </div>
          <div>
            <dt>Discussion</dt>
            <dd>{d.rounds === 1 ? "1 round" : d.rounds + " rounds"} after first opinions. <a href={href({ page: "new", step: "panel" })}>Change</a></dd>
          </div>
        </dl>
        <table className="seat-table">
          <thead><tr><th scope="col">Seat</th><th scope="col">Model</th></tr></thead>
          <tbody>
            {d.chosen.concat([CHAIR]).map((r) => (
              <tr key={r.id} style={{ "--c": r.c } as CSSProperties}>
                <th scope="row"><span className="dot" />{r.name}</th>
                <td className="mdl">{describe(d.choiceFor(r))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {k.locked && <UnlockForm k={k} />}
        {k.locked && <KeyMessage k={k} />}
        <div className={"cost" + (ready.bad ? " bad" : "")} id="cost" role="status">{ready.msg}</div>
        {ready.fix && <p className="fix"><a href={href(ready.fix.to)}>{ready.fix.label}</a></p>}
        <div className="row">
          <button className="primary" id="runBtn" type="button" disabled={running || ready.bad} onClick={onRun}>
            {running ? "Meeting in progress…" : hasRun ? "Hold the meeting again" : "Hold the meeting"}
          </button>
          {running && <a href={href({ page: "meeting" })}>Go to the meeting in progress</a>}
        </div>
      </section>
      <section className="panel" aria-labelledby="next-h">
        <h2 id="next-h">What happens next</h2>
        <ol className="phases">
          {n > 0 && <li><b>Imaging review.</b> The radiologist looks at the images and writes a report for the others to read.</li>}
          <li><b>First opinions.</b> Each consultant reads the case on their own and gives a view, without seeing anyone else's.</li>
          <li><b>Discussion.</b> Everyone reads all the other opinions and says where they agree, disagree, or change their mind.</li>
          <li><b>Chair's decision.</b> The chair reads the whole discussion and writes the outcome, recording any dissent.</li>
        </ol>
        <p className="hint">A full meeting takes a minute or two. Answers appear as they're written, and you can stop at any point. The meeting is saved on this computer when it finishes, and you can download it as a PDF report, a Word document or JSON data.</p>
      </section>
    </>
  );
}
