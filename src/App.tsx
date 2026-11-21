import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MeetingEngine } from "./meeting/engine";
import { PROVIDERS } from "./providers";
import { imageLabel } from "./prompts/prompts";
import { CHAIR } from "./prompts/roles";
import { store } from "./storage/local";
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

export function App() {
  const k = useKeys();
  const keysRef = useRef(k.keys);
  keysRef.current = k.keys;
  const [engine] = useState(() => new MeetingEngine({ providers: PROVIDERS, getKey: (pid) => keysRef.current[pid] }));
  const view = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const d = useDraft();
  const route = useRoute();
  const [session, setSession] = useState<Session | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(() => store.get("mdt.ui.details") !== "closed");

  const ready = readiness({
    caseText: d.caseText, consultants: d.chosen.length, rounds: d.rounds,
    images: d.images.length, imagesChecked: d.images.every((img) => img.checked),
    locked: k.locked, hasKey: (pid) => !!k.keys[pid].trim(), usedChoices: d.usedChoices,
  });

  async function run() {
    if (view.running || ready.bad) return;
    const text = d.caseText.trim();
    setSession({
      caseTitle: d.caseTitle, caseText: text,
      images: d.images.map((img, i) => ({ label: imageLabel(i, img.caption), dataUrl: img.dataUrl })),
      imagesSeenByAll: d.showAll,
      seats: d.chosen.concat([CHAIR]).map((r) => ({ id: r.id, name: r.name, colour: r.c, choice: d.choiceFor(r) })),
      rounds: d.rounds, startedAt: new Date(),
    });
    go({ page: "meeting" });
    await engine.run({
      caseId: d.caseId, caseTitle: d.caseTitle, caseText: text,
      roles: d.chosen, discussionRounds: d.rounds, choiceFor: d.choiceFor,
      images: d.images.map(({ caption, mediaType, width, height, base64 }) => ({ caption, mediaType, width, height, base64 })),
      showImagesToAll: d.showAll,
    });
  }

  function toggleDetails() {
    store.set("mdt.ui.details", detailsOpen ? "closed" : "open");
    setDetailsOpen(!detailsOpen);
  }

  // On moving to another page, start at the top with focus on its heading, as a full page load would.
  const routeKey = href(route);
  const lastRoute = useRef(routeKey);
  useEffect(() => {
    if (lastRoute.current === routeKey) return;
    lastRoute.current = routeKey;
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true });
  }, [routeKey]);

  let page;
  if (route.page === "new") page = <NewMeetingPage step={route.step} draft={d} k={k} ready={ready} running={view.running} hasRun={!!session} onRun={run} />;
  else if (route.page === "meeting") page = <MeetingPage view={view} session={session} onStop={engine.stop} detailsOpen={detailsOpen} onToggleDetails={toggleDetails} />;
  else if (route.page === "history") page = <HistoryPage hasSession={!!session} />;
  else page = <SettingsPage k={k} draft={d} />;

  const showDetails = route.page === "meeting" && !!session;

  return (
    <div className="app">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to main content</a>
      <div className="notice-bar" role="note">
        <b>Research tool.</b> Simulated, AI-generated output. Not clinical advice. Fictional or fully anonymised cases only.
      </div>
      <div className={"shell" + (showDetails && detailsOpen ? " with-details" : "")}>
        <Sidebar route={route} view={view} session={session} />
        <main id="main" className="centre" tabIndex={-1}>{page}</main>
        {route.page === "meeting" && session && <MeetingDetails session={session} open={detailsOpen} />}
      </div>
    </div>
  );
}
