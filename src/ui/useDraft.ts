import { useState } from "react";
import { CASES } from "../cases/cases";
import { dataUrlOf } from "../images/process";
import type { CaseImage } from "../images/types";
import type { SavedRecord } from "../meeting/types";
import { PIDS, PROVIDERS } from "../providers";
import { CHAIR, ROLES, type Role } from "../prompts/roles";
import { dec, enc, loadDefaultChoice, loadSeatChoices, saveDefaultChoice, saveSeatChoices } from "../storage/settings";

// The meeting being set up: the case, its images, who sits at the table and on which models.
// Model choices are saved in the browser as before; the case and images are held in memory until the meeting runs.
export function useDraft() {
  const [defaultChoice, setDefaultChoiceState] = useState(loadDefaultChoice);
  const [seatChoice, setSeatChoiceState] = useState(loadSeatChoices);
  const [roleOn, setRoleOn] = useState(() => Object.fromEntries(ROLES.map((r) => [r.id, !!r.on])));
  const [rounds, setRounds] = useState(1);
  const [caseId, setCaseId] = useState(CASES[0].id);
  const [caseText, setCaseText] = useState(CASES[0].text);
  // The researcher's own label for the case, saved with the meeting but never sent to the AI.
  const [caseTag, setCaseTag] = useState("");
  const [images, setImages] = useState<CaseImage[]>([]);
  const [showAll, setShowAll] = useState(false);

  const hasImages = images.length > 0;
  const lockedOn: Record<string, string> = hasImages ? { rad: "Reads the attached images first, so stays at the table while there are images." } : {};
  const chosen = ROLES.filter((r) => roleOn[r.id] || lockedOn[r.id]);
  const choiceFor = (r: Role) => dec(seatChoice[r.id] || defaultChoice);

  return {
    defaultChoice, seatChoice, roleOn, rounds, caseId, caseText, caseTag, images, showAll,
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
    setCaseTag,
    setImages,
    setShowAll,
    // Sets up a rerun of a saved meeting: the same case, images and panel. Images need ticking again.
    load(rec: SavedRecord) {
      setCaseId(CASES.some((c) => c.id === rec.caseId) ? rec.caseId : "blank");
      setCaseText(rec.caseText);
      setCaseTag(rec.research.caseTag);
      setImages((rec.images ?? []).map((img) => ({
        id: crypto.randomUUID(), caption: img.caption, mediaType: img.mediaType, width: img.width, height: img.height,
        base64: img.data, dataUrl: dataUrlOf(img.data), checked: false,
      })));
      setShowAll(!!rec.imagesSeenByAll);
      const seated = new Set(rec.seats.map((s) => s.roleId));
      setRoleOn(Object.fromEntries(ROLES.map((r) => [r.id, seated.has(r.id)])));
      const seats = { ...seatChoice };
      for (const s of rec.seats) {
        const pid = PIDS.find((p) => PROVIDERS[p].label === s.provider);
        if (pid) seats[s.roleId] = enc(pid, s.model);
      }
      setSeatChoiceState(seats);
      saveSeatChoices(seats);
      setRounds(Math.min(2, Math.max(1, rec.discussionRounds)));
    },
  };
}

export type Draft = ReturnType<typeof useDraft>;
