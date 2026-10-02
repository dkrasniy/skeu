export type Frame = "none" | "light" | "dark";
export type Background = "gradient" | "solid";
export type Ratio = "auto" | "16:9" | "4:3" | "1:1" | "3:2" | "9:16" | "custom";

export interface Settings {
  frame: Frame;
  size: number;
  radius: number;
  shadow: number;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowSpread: number;
  shadowColor: string;
  inset: number;
  rotation: number;
  tiltX: number;
  tiltY: number;
  x: number;
  y: number;
  background: Background;
  color1: string;
  color2: string;
  angle: number;
  ratio: Ratio;
  width: number;
  height: number;
}

export interface Rect { x: number; y: number; width: number; height: number }
// `width`/`height` are the source image's; `crop` (source pixels) is the part shown, or null for all of it.
export interface Asset { src: string; name: string; width: number; height: number; crop: Rect | null }
export interface EditorDocument { name: string; asset: Asset | null; settings: Settings }

export const DEFAULT_SETTINGS: Settings = {
  frame: "light", size: 80, radius: 12, shadow: 40, shadowX: 0, shadowY: 28, shadowBlur: 72, shadowSpread: -8, shadowColor: "#141828", inset: 0,
  rotation: 0, tiltX: 0, tiltY: 0, x: 0, y: 0,
  background: "gradient", color1: "#b9cafa", color2: "#ebd1e6", angle: 135,
  ratio: "4:3", width: 1600, height: 1200,
};

export function visibleRect(asset: Asset): Rect {
  return asset.crop ?? { x: 0, y: 0, width: asset.width, height: asset.height };
}
export const INITIAL_DOCUMENT: EditorDocument = { name: "Untitled", asset: null, settings: DEFAULT_SETTINGS };

export const RATIOS: { value: Ratio; label: string }[] = [
  { value: "auto", label: "Match image" }, { value: "16:9", label: "16:9" }, { value: "4:3", label: "4:3" },
  { value: "1:1", label: "1:1" }, { value: "3:2", label: "3:2" }, { value: "9:16", label: "9:16" },
];

export const GRADIENTS: [string, string, string][] = [
  ["Daydream", "#b9cafa", "#ebd1e6"], ["Lavender", "#e9cbff", "#aba5ef"], ["Apricot", "#ffe2af", "#ff9e9e"],
  ["Glacier", "#b2eee7", "#9fbbef"], ["Butter", "#f5f5bf", "#a9e3c4"], ["Rose", "#ffe0e6", "#f8a5c1"],
  ["Ocean", "#a5cee4", "#5e85c6"], ["Dusk", "#dcc9e8", "#f5d8af"], ["Tangerine", "#ffcd89", "#ff846f"],
  ["Orchid", "#bc82e9", "#6859cf"], ["Lagoon", "#80d8c0", "#267c83"], ["Sage", "#e0e9c8", "#8cad95"],
  ["Steel", "#dce3e7", "#94aab7"], ["Frost", "#f1f1f2", "#c7cbd1"], ["Sand", "#eee5d6", "#cfbba1"],
  ["Cobalt", "#859ff5", "#494bb7"], ["Ink", "#49516e", "#202536"], ["Midnight", "#303749", "#15181f"],
];

export const SOLIDS = ["#ffffff", "#f0f0f0", "#dce0e5", "#777e8c", "#272a32", "#111111", "#efd3e0", "#e1ccf2", "#c9d5f3", "#c7e8ec", "#cfdfc9", "#f2e9bd"];

export function backgroundCSS(s: Pick<Settings, "background" | "angle" | "color1" | "color2">) {
  return s.background === "solid" ? s.color1 : `linear-gradient(${s.angle}deg, ${s.color1}, ${s.color2})`;
}

export function canvasDimensions(s: Settings, asset: Asset | null) {
  const width = s.width;
  if (s.ratio === "custom") return { width, height: s.height };
  const [w, h] = s.ratio === "auto" ? asset ? [visibleRect(asset).width, visibleRect(asset).height] : [4, 3] : s.ratio.split(":").map(Number);
  return { width, height: Math.round(width * h / w) };
}

// The window bar is a fixed share of the card's width, so the frame keeps its proportions at any size.
const BAR_RATIO = 36 / 960;

// The screenshot card's size in canvas pixels. `unit` scales user settings (padding, roundness) with the canvas;
// `chrome` scales the window frame (bar, dots) with the card itself.
export function cardBox(s: Settings, asset: Asset) {
  const { width, height } = canvasDimensions(s, asset);
  const unit = width / 1200;
  const image = visibleRect(asset);
  const ratio = image.width / image.height;
  const k = s.frame === "none" ? 0 : BAR_RATIO;
  // At 100% the card fits the canvas including its own bar: w = min(W, (H - k·w)·ratio).
  const fullWidth = Math.min(width, height * ratio / (1 + k * ratio));
  const cardWidth = fullWidth * s.size / 100;
  const bar = k * cardWidth;
  const inset = Math.min(s.inset * unit, cardWidth * .2);
  const cardHeight = (cardWidth - inset * 2) * image.height / image.width + bar + inset * 2;
  return { width, height, unit, chrome: bar / 36, bar, inset, cardWidth, cardHeight };
}

// Offsets (in % of the canvas) that put the card against an edge, keeping a small margin.
export function anchorOffsets(s: Settings, asset: Asset) {
  const { width, height, cardWidth, cardHeight } = cardBox(s, asset);
  const reach = (card: number, total: number) => Math.round(Math.max(0, (total - card) / 2 - total * .05) / total * 1000) / 10;
  return { x: reach(cardWidth, width), y: reach(cardHeight, height) };
}

export function hexToRgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}, ${alpha})`;
}

// Matches pika.style: at most 16° each way, with perspective scaled to the canvas width.
export const TILT_MAX = 16;
export const PERSPECTIVE = 1.25;

export function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }

const BOUNDS = {
  size: [20, 150], radius: [0, 48], shadow: [0, 100], shadowX: [-100, 100], shadowY: [-100, 100], shadowBlur: [0, 200], shadowSpread: [-50, 50], inset: [0, 40], rotation: [-180, 180],
  tiltX: [-TILT_MAX, TILT_MAX], tiltY: [-TILT_MAX, TILT_MAX], x: [-50, 50], y: [-50, 50], angle: [0, 360],
  width: [320, 4096], height: [320, 4096],
} satisfies Partial<Record<keyof Settings, [number, number]>>;

const ENUMS = {
  frame: ["none", "light", "dark"], background: ["gradient", "solid"],
  ratio: ["auto", "16:9", "4:3", "1:1", "3:2", "9:16", "custom"],
} satisfies Partial<Record<keyof Settings, string[]>>;

// Saved data is untrusted: validate it before it reaches CSS, canvas sizes, or history.
export function sanitizeSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") return { ...DEFAULT_SETTINGS };
  const raw: Record<string, unknown> = { ...value };
  // Earlier versions stored the frame as "macos" plus a separate frameTheme.
  if (raw.frame === "macos") raw.frame = raw.frameTheme === "dark" ? "dark" : "light";
  const next = { ...DEFAULT_SETTINGS };
  for (const [key, [min, max]] of Object.entries(BOUNDS)) {
    const n = raw[key];
    if (typeof n === "number" && Number.isFinite(n)) Object.assign(next, { [key]: clamp(n, min, max) });
  }
  for (const key of ["color1", "color2", "shadowColor"] as const) {
    const color = raw[key];
    if (typeof color === "string" && /^#[\da-f]{6}$/i.test(color)) next[key] = color;
  }
  for (const [key, values] of Object.entries(ENUMS)) {
    if (values.includes(String(raw[key]))) Object.assign(next, { [key]: raw[key] });
  }
  return next;
}
