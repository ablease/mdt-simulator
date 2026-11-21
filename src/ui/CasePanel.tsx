import { CASES } from "../cases/cases";

interface Props {
  caseId: string;
  caseText: string;
  caseTag: string;
  onCase: (id: string) => void;
  onText: (text: string) => void;
  onTag: (tag: string) => void;
}

export function CasePanel({ caseId, caseText, caseTag, onCase, onText, onTag }: Props) {
  return (
    <section className="panel" aria-labelledby="case-h">
      <h2 id="case-h">The case</h2>
      <label className="fld" htmlFor="caseSel">Choose a test case
        <select id="caseSel" value={caseId} onChange={(e) => onCase(e.target.value)}>
          {CASES.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </label>
      <label className="fld" htmlFor="caseText"><span>Case summary <span className="tag">editable</span></span>
        <textarea id="caseText" spellCheck={false} value={caseText} onChange={(e) => onText(e.target.value)} />
      </label>
      <p className="hint">Change any detail (say, the aspirate result) and rerun to see whether the panel changes its mind. Choose "Blank case" to write your own. Use fictional or fully anonymised cases only: the text is sent to the AI providers you choose.</p>
      <label className="fld" htmlFor="caseTag"><span>Case ID <span className="tag">optional</span></span>
        <input type="text" id="caseTag" className="short" maxLength={100} autoComplete="off" placeholder="For example: PJI-01" value={caseTag} onChange={(e) => onTag(e.target.value)} />
        <span className="hint">Your own label for this case, so repeat runs of it are grouped together in History. It's saved with the meeting and isn't sent to the AI. Don't use a hospital number or anything else that could identify a patient.</span>
      </label>
    </section>
  );
}
