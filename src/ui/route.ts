import { useEffect, useState } from "react";

// Pages live in the address after "#", so GitHub Pages can serve every page from index.html.
export const STEPS = [
  { id: "case", label: "Case" },
  { id: "images", label: "Images" },
  { id: "panel", label: "Panel and models" },
  { id: "review", label: "Review and run" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

export type Route =
  | { page: "new"; step: StepId }
  | { page: "meeting" }
  | { page: "history" }
  | { page: "settings" };

export const href = (r: Route) => "#/" + (r.page === "new" ? "new/" + r.step : r.page);

// Anything unrecognised, including an empty address, opens the first step of a new meeting.
export function parseRoute(hash: string): Route {
  const [page, step] = hash.replace(/^#\/?/, "").split("/");
  if (page === "meeting" || page === "history" || page === "settings") return { page };
  return { page: "new", step: STEPS.find((s) => s.id === step)?.id ?? "case" };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(location.hash));
    addEventListener("hashchange", onChange);
    return () => removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const go = (r: Route) => { location.hash = href(r); };
