import { useState } from "react";
import { CASES } from "../cases/cases";
import type { CaseImage } from "../images/types";
import { CHAIR, ROLES, type Role } from "../prompts/roles";
import { dec, loadDefaultChoice, loadSeatChoices, saveDefaultChoice, saveSeatChoices } from "../storage/settings";

// The meeting being set up: the case, its images, who sits at the table and on which models.
// Model choices are saved in the browser as before; the case and images are held in memory only.
export function useDraft() {
  const [defaultChoice, setDefaultChoiceState] = useState(loadDefaultChoice);
  const [seatChoice, setSeatChoiceState] = useState(loadSeatChoices);
  const [roleOn, setRoleOn] = useState(() => Object.fromEntries(ROLES.map((r) => [r.id, !!r.on])));
  const [rounds, setRounds] = useState(1);
  const [caseId, setCaseId] = useState(CASES[0].id);
  const [caseText, setCaseText] = useState(CASES[0].text);
  const [images, setImages] = useState<CaseImage[]>([]);
  const [showAll, setShowAll] = useState(false);

  const hasImages = images.length > 0;
  const lockedOn: Record<string, string> = hasImages ? { rad: "Reads the attached images first, so stays at the table while there are images." } : {};
  const chosen = ROLES.filter((r) => roleOn[r.id] || lockedOn[r.id]);
  const choiceFor = (r: Role) => dec(seatChoice[r.id] || defaultChoice);

  return {
    defaultChoice, seatChoice, roleOn, rounds, caseId, caseText, images, showAll,
    hasImages, lockedOn, chosen, choiceFor,
    caseTitle: CASES.find((c) => c.id === caseId)?.title,
    usedChoices: chosen.concat([CHAIR]).map(choiceFor),
    setDefaultChoice(v: string) { setDefaultChoiceState(v); saveDefaultChoice(v); },
    setSeatChoice(id: string, v: string) {
      const next = { ...seatChoice };
      if (v) next[id] = v; else delete next[id];
      setSeatChoiceState(next);
      saveSeatChoices(next);
    },
    toggleRole: (id: string, on: boolean) => setRoleOn((v) => ({ ...v, [id]: on })),
    setRounds,
    chooseCase(id: string) { setCaseId(id); setCaseText(CASES.find((c) => c.id === id)!.text); },
    setCaseText,
    setImages,
    setShowAll,
  };
}

export type Draft = ReturnType<typeof useDraft>;
