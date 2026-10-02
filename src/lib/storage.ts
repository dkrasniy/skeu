import { type Asset, type EditorDocument, type Rect, sanitizeSettings } from "./editor-state";

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("skeu", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("documents");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDocument(document: EditorDocument) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("documents", "readwrite");
      tx.objectStore("documents").put(document, "current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

function parseCrop(value: unknown, width: number, height: number): Rect | null {
  if (!value || typeof value !== "object") return null;
  const { x, y, width: w, height: h } = value as Record<string, unknown>;
  if (![x, y, w, h].every(n => typeof n === "number" && Number.isFinite(n))) return null;
  const r = { x: x as number, y: y as number, width: w as number, height: h as number };
  return r.x >= 0 && r.y >= 0 && r.width >= 1 && r.height >= 1 && r.x + r.width <= width && r.y + r.height <= height ? r : null;
}

function parseAsset(value: unknown): Asset | null {
  if (!value || typeof value !== "object") return null;
  const { src, name, width, height } = value as Record<string, unknown>;
  if (typeof src !== "string" || !src.startsWith("data:image/")) return null;
  if (typeof width !== "number" || typeof height !== "number" || !(width > 0) || !(height > 0)) return null;
  return { src, name: typeof name === "string" ? name : "Screenshot", width, height, crop: parseCrop((value as Record<string, unknown>).crop, width, height) };
}

export async function loadDocument(): Promise<EditorDocument | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("documents").objectStore("documents").get("current");
      request.onsuccess = () => {
        const saved: unknown = request.result;
        if (!saved || typeof saved !== "object") return resolve(null);
        const { name, asset, settings } = saved as Record<string, unknown>;
        resolve({ name: typeof name === "string" && name.trim() ? name : "Untitled", asset: parseAsset(asset), settings: sanitizeSettings(settings) });
      };
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
