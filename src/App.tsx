import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MeetingEngine } from "./meeting/engine";
import { detailsFromRecord, viewFromRecord } from "./meeting/fromRecord";
import { anyAnswer, emptyResearch } from "./meeting/summary";
import type { SavedRecord } from "./meeting/types";
import { PROVIDERS } from "./providers";
import { imageLabel } from "./prompts/prompts";
import { CHAIR } from "./prompts/roles";
import { store } from "./storage/local";
import { askToKeep, deleteMeetings, refresh, saveRecord } from "./storage/meetings";
import { describe } from "./storage/settings";
import { MeetingDetails, type Session } from "./ui/MeetingDetails";
import { HistoryPage } from "./ui/pages/HistoryPage";
import { MeetingPage } from "./ui/pages/MeetingPage";
import { NewMeetingPage } from "./ui/pages/NewMeetingPage";
import { SettingsPage } from "./ui/pages/SettingsPage";
import { readiness } from "./ui/readiness";
import { go, href, useRoute } from "./ui/route";
import { Sidebar } from "./ui/Sidebar";
import { useDraft } from "./ui/useDraft";
import { useKeys } from "./ui/useKeys";
import { useMeetings, useSavedRecord } from "./ui/useMeetings";

// What happened to the meeting last run in this tab once it ended.
type Outcome = { saved: SavedRecord } | { saved: null; note: string };

export function App() {
  const k = useKeys();
  const keysRef = useRef(k.keys);
  keysRef.current = k.keys;
  const [engine] = useState(() => new MeetingEngine({ providers: PROVIDERS, getKey: (pid) => keysRef.current[pid] }));
  const view = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const d = useDraft();
  const route = useRoute();
  const meetings = useMeetings();
  const [session, setSession] = useState<Session | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(() => store.get("mdt.ui.details") !== "closed");

  useEffect(() => { void refresh(); }, []);

  const ready = readiness({
    caseText: d.caseText, consultants: d.chosen.length, rounds: d.rounds,
    images: d.images.length, imagesChecked: d.images.every((img) => img.checked),
    locked: k.locked, hasKey: (pid) => !!k.keys[pid].trim(), usedChoices: d.usedChoices,
  });

  async function run() {
    if (view.running || ready.bad) return;
    const text = d.caseText.trim();
    const caseTag = d.caseTag.trim();
    setSession({
      caseTitle: d.caseTitle, caseText: text,
      images: d.images.map((img, i) => ({ label: imageLabel(i, img.caption), dataUrl: img.dataUrl })),
      imagesSeenByAll: d.showAll,
      seats: d.chosen.concat([CHAIR]).map((r) => ({ id: r.id, name: r.name, colour: r.c, model: describe(d.choiceFor(r)) })),
      rounds: d.rounds, startedAt: new Date(),
    });
    setOutcome(null);
    go({ page: "meeting" });
    const rec = await engine.run({
      caseId: d.caseId, caseTitle: d.caseTitle, caseText: text,
      roles: d.chosen, discussionRounds: d.rounds, choiceFor: d.choiceFor,
      images: d.images.map(({ caption, mediaType, width, height, base64 }) => ({ caption, mediaType, width, height, base64 })),
      showImagesToAll: d.showAll,
    });
    // Every meeting with at least one answer is kept; one where every call failed (a wrong key, say) isn't.
    if (!anyAnswer(rec)) {
      setOutcome({ saved: null, note: "This meeting wasn't saved, because no consultant answered. Check the messages on the cards, then try again." });
      return;
    }
    const { tool, note, ...rest } = rec;
    const saved: SavedRecord = { tool, note, id: crypto.randomUUID(), ...rest, research: emptyResearch(caseTag) };
    try {
      await saveRecord(saved);
      void askToKeep();
      setOutcome({ saved });
    } catch {
      setOutcome({ saved: null, note: "This meeting couldn't be saved in this browser. Download the PDF or JSON now to keep a copy." });
    }
  }

  // Once the meeting on screen is saved, show the saved copy, which can take research notes.
  // The cards stay where they are, so this happens without moving the page or the focus.
  const quiet = useRef(false);
  const savedId = outcome?.saved?.id;
  useEffect(() => {
    if (route.page === "meeting" && !route.id && !view.running && savedId) {
      quiet.current = true;
      location.replace(href({ page: "meeting", id: savedId }));
    }
  }, [route, view.running, savedId]);

  const opened = useSavedRecord(route.page === "meeting" ? route.id : undefined, outcome?.saved ?? null, meetings);
  const openedRec = opened.status === "ready" ? opened.rec : null;
  const savedView = useMemo(() => openedRec && viewFromRecord(openedRec), [openedRec]);
  const savedDetails = useMemo(() => openedRec && detailsFromRecord(openedRec), [openedRec]);

  function toggleDetails() {
    store.set("mdt.ui.details", detailsOpen ? "closed" : "open");
    setDetailsOpen(!detailsOpen);
  }

  function rerun(rec: SavedRecord) {
    d.load(rec);
    go({ page: "new", step: "review" });
  }

  async function remove(rec: SavedRecord) {
    await deleteMeetings([rec.id]);
    if (outcome?.saved?.id === rec.id) { setOutcome(null); setSession(null); }
    go({ page: "history" });
  }

  // On moving to another page, start at the top with focus on its heading, as a full page load would.
  const routeKey = href(route);
  const lastRoute = useRef(routeKey);
  useEffect(() => {
    if (lastRoute.current === routeKey) return;
    lastRoute.current = routeKey;
    if (quiet.current) { quiet.current = false; return; }
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true });
  }, [routeKey]);

  // Say so in the tab's title while a meeting waits, in case another tab is in front.
  useEffect(() => {
    if (!view.paused) return;
    const before = document.title;
    document.title = "Waiting for you · " + before;
    return () => { document.title = before; };
  }, [view.paused]);

  const meetingProps = { detailsOpen, onToggleDetails: toggleDetails, onRerun: rerun, onDelete: remove };
  let page;
  let details: Session | null = null;
  if (route.page === "new") {
    page = <NewMeetingPage step={route.step} draft={d} k={k} ready={ready} running={view.running} hasRun={!!session} onRun={run} />;
  } else if (route.page === "meeting" && route.id) {
    if (openedRec && savedView) {
      details = savedDetails;
      page = <MeetingPage {...meetingProps} view={savedView} title={openedRec.caseTitle || "Meeting"} saved={openedRec} note={null} hasDetails />;
    } else {
      page = (
        <div className="page">
          <header className="page-head"><div><h1 tabIndex={-1}>{opened.status === "missing" ? "Meeting not found" : "Opening the meeting…"}</h1></div></header>
          {opened.status === "missing" && <p className="note">This meeting isn't saved on this computer. It may have been deleted, or saved in another browser. <a href={href({ page: "history" })}>Go to History</a></p>}
        </div>
      );
    }
  } else if (route.page === "meeting") {
    details = session;
    page = <MeetingPage {...meetingProps} view={view} title={session?.caseTitle || "Meeting"} saved={null} note={outcome && !outcome.saved ? outcome.note : null} controls={engine} hasDetails={!!session} />;
  } else if (route.page === "history") {
    page = <HistoryPage meetings={meetings} />;
  } else {
    page = <SettingsPage k={k} draft={d} meetings={meetings} />;
  }

  // The meeting run in this tab gets its own sidebar entry until it's saved.
  const live = session && (view.running || !outcome?.saved) ? session : null;

  return (
    <div className="app">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to main content</a>
      <div className="notice-bar" role="note">
        <b>Research tool.</b> Simulated, AI-generated output. Not clinical advice. Fictional or fully anonymised cases only.
      </div>
      <div className={"shell" + (details && detailsOpen ? " with-details" : "")}>
        <Sidebar route={route} view={view} live={live} meetings={meetings} />
        <main id="main" className="centre" tabIndex={-1}>{page}</main>
        {details && <MeetingDetails session={details} open={detailsOpen} />}
      </div>
    </div>
  );
}
