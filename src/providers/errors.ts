export class ProviderError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

export async function httpError(r: Response): Promise<ProviderError> {
  let msg = "";
  try {
    const j = await r.json();
    msg = (j.error && (j.error.message || j.error.type)) || "";
  } catch {}
  return new ProviderError(msg || "HTTP " + r.status, r.status);
}

// Turns any failure into a sentence that says what went wrong and what to do next.
export function friendly(e: unknown, provLabel?: string): string {
  const who = provLabel || "The provider";
  const err = e as { name?: string; status?: number; message?: string };
  if (err.name === "AbortError") return "Stopped.";
  if (e instanceof TypeError) return "Couldn't reach " + who + ". Check your internet connection. If you're on a hospital network, it may block AI services.";
  const s = err.status ?? 0;
  if (s === 401) return who + " rejected the API key. Check you pasted the whole key into the right box.";
  if (s === 403) return "This " + who + " key isn't allowed to use that model. Try another model, or check the key's permissions.";
  if (s === 404) return who + " doesn't recognise that model name. Press \"Check\" next to the key and pick a model from the list.";
  if (s === 429) return who + ": rate limit or credit limit reached. New accounts have low limits and need credit added. Wait a minute, or run fewer consultants on this provider.";
  if (s === 400) return who + " refused the request: " + err.message;
  if (s >= 500) return who + " had a temporary problem. Try again in a moment.";
  return "Something went wrong: " + err.message;
}
