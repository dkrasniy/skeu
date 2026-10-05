import { type Settings, sanitizeSettings } from "./editor-state";

const STYLE_KEY = "skeu-style";
const TOUR_KEY = "skeu-tour-seen";

// Only the style is remembered between visits; every visit starts with an empty canvas.
export function loadStyle(): Settings | null {
  try {
    const saved = localStorage.getItem(STYLE_KEY);
    return saved ? sanitizeSettings(JSON.parse(saved)) : null;
  } catch { return null; }
}

export function saveStyle(settings: Settings) {
  try { localStorage.setItem(STYLE_KEY, JSON.stringify(settings)); } catch { /* storage blocked or full: the style just isn't remembered */ }
}

// Earlier versions autosaved the whole document, image included, to IndexedDB. Free that space.
export function clearSavedDocument() {
  try { indexedDB.deleteDatabase("skeu"); } catch { /* IndexedDB unavailable */ }
}

// The How it works tour opens by itself once, on a first visit. If storage is blocked it counts as seen, so it
// never reopens on every visit.
export function tourSeen() {
  try { return localStorage.getItem(TOUR_KEY) !== null; } catch { return true; }
}

export function markTourSeen() {
  try { localStorage.setItem(TOUR_KEY, "1"); } catch { /* storage blocked: it won't reopen anyway */ }
}
