import { PIDS } from "../../providers";
import { CaseImages } from "../CaseImages";
import { CasePanel } from "../CasePanel";
import type { Readiness } from "../readiness";
import { ReviewStep } from "../ReviewStep";
import { href, STEPS, type StepId } from "../route";
import { SeatsPanel } from "../SeatsPanel";
import type { Draft } from "../useDraft";
import type { KeysApi } from "../useKeys";

interface Props {
  step: StepId;
  draft: Draft;
  k: KeysApi;
  ready: Readiness;
  running: boolean;
  hasRun: boolean;
  onRun: () => void;
}

// Setting up a meeting in four steps. Each step can be visited in any order; nothing is lost moving between them.
export function NewMeetingPage({ step, draft: d, k, ready, running, hasRun, onRun }: Props) {
  const i = STEPS.findIndex((s) => s.id === step);
  const prev = STEPS[i - 1];
  const next = STEPS[i + 1];
  const noKeys = !k.locked && !PIDS.some((pid) => k.keys[pid].trim());

  let body;
  if (step === "case") body = <CasePanel caseId={d.caseId} caseText={d.caseText} caseTag={d.caseTag} onCase={d.chooseCase} onText={d.setCaseText} onTag={d.setCaseTag} />;
  else if (step === "images") body = <CaseImages images={d.images} setImages={d.setImages} showAll={d.showAll} onShowAll={d.setShowAll} />;
  else if (step === "panel") body = (
    <SeatsPanel
      roleOn={d.roleOn} lockedOn={d.lockedOn} onToggle={d.toggleRole}
      seatChoice={d.seatChoice} onSeatChoice={d.setSeatChoice} defaultChoice={d.defaultChoice} keys={k.keys}
      rounds={d.rounds} onRounds={d.setRounds}
    />
  );
  else body = <ReviewStep draft={d} k={k} ready={ready} running={running} hasRun={hasRun} onRun={onRun} />;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 tabIndex={-1}>New meeting</h1>
          {step === "case" && <p className="lede">Several AI "consultants" each give an opinion on a case, read each other's views and argue it out, then a chair records a final decision. Every card is one call to an AI provider using your own API key, and each seat at the table can use a different model.</p>}
        </div>
      </header>
      <nav aria-label="Steps">
        <ol className="stepper">
          {STEPS.map((s, n) => (
            <li key={s.id}>
              <a href={href({ page: "new", step: s.id })} aria-current={s.id === step ? "step" : undefined}>
                <span className="num">{n + 1}</span> {s.label}{s.id === "images" && <> <span className="opt">optional</span></>}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {noKeys && <p className="note">Before your first meeting, add an API key in <a href={href({ page: "settings" })}>Settings</a>.</p>}
      <div className="step-body">{body}</div>
      <div className="step-nav">
        {prev ? <a className="btn" href={href({ page: "new", step: prev.id })}>Back</a> : <span />}
        {next && <a className="btn primary" href={href({ page: "new", step: next.id })}>Next: {next.label}</a>}
      </div>
    </div>
  );
}
