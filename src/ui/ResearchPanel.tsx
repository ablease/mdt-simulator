import { useEffect, useRef, useState } from "react";
import { RATINGS, type Rating, type Research } from "../meeting/types";
import { ratingLabel } from "../meeting/summary";
import { updateResearch } from "../storage/meetings";

// The researcher's notes on a saved meeting. Changes are saved as they're typed, a moment after the last key press.
export function ResearchPanel({ id, initial }: { id: string; initial: Research }) {
  const [r, setR] = useState(initial);
  const [status, setStatus] = useState<{ text: string; bad?: boolean }>({ text: "" });
  const latest = useRef(r);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef(false);
  // Counts edits, so "Saved." only shows once the latest edit is the one that was saved.
  const edits = useRef(0);

  async function save() {
    window.clearTimeout(timer.current);
    if (!pending.current) return;
    pending.current = false;
    const saving = edits.current;
    try {
      await updateResearch(id, latest.current);
      if (edits.current === saving) setStatus({ text: "Saved." });
    } catch {
      setStatus({ text: "Your notes couldn't be saved. Copy them somewhere safe, reload the page and try again.", bad: true });
    }
  }

  function change(patch: Partial<Research>) {
    const next = { ...latest.current, ...patch, updatedAt: new Date().toISOString() };
    latest.current = next;
    pending.current = true;
    edits.current++;
    setR(next);
    setStatus({ text: "" });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(save, 600);
  }

  // Leaving the page, or closing the tab, saves anything not yet saved.
  useEffect(() => {
    const now = () => { void save(); };
    addEventListener("pagehide", now);
    return () => { removeEventListener("pagehide", now); now(); };
  }, []);

  return (
    <section className="panel research" id="research" aria-labelledby="research-h">
      <h2 id="research-h" tabIndex={-1}>Research notes</h2>
      <p className="hint">Saved with this meeting on this computer, and included in its PDF, Word and JSON files. The AI never sees these.</p>
      <label className="fld" htmlFor="rTag"><span>Case ID</span>
        <input type="text" id="rTag" className="short" maxLength={100} autoComplete="off" placeholder="For example: PJI-01" value={r.caseTag}
          onChange={(e) => change({ caseTag: e.target.value })} onBlur={save} />
      </label>
      <label className="fld" htmlFor="rActual"><span>Actual MDT decision</span>
        <textarea id="rActual" className="prose" rows={3} maxLength={20_000} value={r.actualDecision}
          onChange={(e) => change({ actualDecision: e.target.value })} onBlur={save} />
      </label>
      <fieldset className="rating">
        <legend>Do you agree with the simulated decision?</legend>
        {([...RATINGS, ""] as Rating[]).map((v) => (
          <label className="check" key={v || "none"}>
            <input type="radio" name="rating" value={v} checked={r.rating === v} onChange={() => { change({ rating: v }); void save(); }} />
            <span>{v ? ratingLabel(v) : "Not rated yet"}</span>
          </label>
        ))}
      </fieldset>
      <label className="fld" htmlFor="rNotes"><span>Notes</span>
        <textarea id="rNotes" className="prose" rows={4} maxLength={50_000} value={r.notes}
          onChange={(e) => change({ notes: e.target.value })} onBlur={save} />
      </label>
      <div className={"connstate" + (status.bad ? " bad" : " ok")} role="status" id="researchStatus">{status.text}</div>
    </section>
  );
}
