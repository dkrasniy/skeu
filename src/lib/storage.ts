import { type Settings, sanitizeSettings } from "./editor-state";

const STYLE_KEY = "skeu-style";

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
