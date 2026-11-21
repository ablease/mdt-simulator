import type { Dispatch, SetStateAction } from "react";
import { CASES } from "../cases/cases";
import type { CaseImage } from "../images/types";
import { CaseImages } from "./CaseImages";

interface Props {
  caseId: string;
  caseText: string;
  onCase: (id: string) => void;
  onText: (text: string) => void;
  images: CaseImage[];
  setImages: Dispatch<SetStateAction<CaseImage[]>>;
  showAll: boolean;
  onShowAll: (on: boolean) => void;
}

export function CasePanel({ caseId, caseText, onCase, onText, images, setImages, showAll, onShowAll }: Props) {
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
      <p className="hint">Change any detail (say, the aspirate result) and rerun to see whether the panel changes its mind. Choose "Blank case" to write your own.</p>
      <CaseImages images={images} setImages={setImages} showAll={showAll} onShowAll={onShowAll} />
    </section>
  );
}
