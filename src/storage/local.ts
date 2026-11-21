// Best-effort localStorage: private windows and blocked storage just mean nothing is remembered.
export const store = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} },
  del(k: string) { try { localStorage.removeItem(k); } catch {} },
  getJSON<T>(k: string, d: T): T { try { const v = JSON.parse(localStorage.getItem(k) as string); return v == null ? d : v; } catch { return d; } },
  setJSON(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
