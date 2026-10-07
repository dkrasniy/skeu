// The vectorizer's engine side: the tracer (public/vectorizer/tracer.js, a plain script shared with its worker),
// loading images into pixels, the drawn samples, and how the panel's settings map to tracer options.

export interface Traced {
  width: number;
  height: number;
  mode: "stacked" | "cutout";
  gap: boolean;
  palette: { rgb: [number, number, number]; share: number }[];
  layers: { color: number; paths: string[] }[];
  stats: { nodes: number; smoothing: number };
}
interface TraceOptions { colors: number; pixels: number; maxUpscale: number; smoothing: number; cornerAngle: number; speck: number; mode: "stacked" | "cutout"; gapFill: boolean; removeBackground: boolean; outW: number; outH: number }
interface VTrace {
  traceSteps: (pixels: Uint8ClampedArray, w: number, h: number, o: TraceOptions) => Generator<string, Traced>;
  compose: (res: Traced, colors?: (string | null)[] | null, opt?: { bare?: boolean; outline?: boolean }) => string;
  hex: (rgb: [number, number, number]) => string;
}
declare global { interface Window { VTrace?: VTrace } }

const BASE = "/vectorizer/";

// The panel needs compose and hex on the main thread too, so the script loads here once either way.
let loading: Promise<VTrace> | null = null;
export function loadTracer(): Promise<VTrace> {
  if (window.VTrace) return Promise.resolve(window.VTrace);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${BASE}tracer.js`;
    script.onload = () => window.VTrace ? resolve(window.VTrace) : reject(new Error("tracer"));
    script.onerror = () => { loading = null; reject(new Error("tracer")); };
    document.head.appendChild(script);
  });
  return loading;
}

export const CANCELLED = { cancelled: true } as const;

// Traces in a Worker. If workers are blocked (or one never answers), it falls back to stepping the same code on the
// main thread, yielding between stages so the page stays responsive.
export function createEngine() {
  let worker: Worker | null = null, useWorker = true, job = 0;
  let settle: { reject: (e: unknown) => void } | null = null;

  function cancel() {
    job++;
    if (worker) { worker.terminate(); worker = null; }
    if (settle) { settle.reject(CANCELLED); settle = null; }
  }
  async function onMain(id: number, pixels: Uint8ClampedArray, w: number, h: number, opts: TraceOptions, onStage: (s: string) => void) {
    const steps = (await loadTracer()).traceSteps(pixels, w, h, opts);
    let r = steps.next();
    while (!r.done) {
      onStage(r.value);
      await new Promise(res => setTimeout(res, 0));
      if (id !== job) throw CANCELLED;
      r = steps.next();
    }
    return r.value;
  }
  function run(pixels: Uint8ClampedArray, w: number, h: number, opts: TraceOptions, onStage: (s: string) => void): Promise<Traced> {
    cancel();
    const id = job;
    if (useWorker) { try { worker = new Worker(`${BASE}worker.js`); } catch { worker = null; } }
    const mine = worker;
    if (!mine) { useWorker = false; return onMain(id, pixels, w, h, opts, onStage); }
    return new Promise<Traced>((resolve, reject) => {
      let heard = false;
      settle = { reject };
      const fallBack = () => {
        if (id !== job || heard) return;
        useWorker = false;
        mine.terminate();
        if (worker === mine) worker = null;
        settle = null;
        onMain(id, pixels, w, h, opts, onStage).then(resolve, reject);
      };
      const watchdog = setTimeout(fallBack, 2500);
      mine.onerror = () => { clearTimeout(watchdog); fallBack(); };
      mine.onmessage = (e: MessageEvent<{ type: string; id: number; stage?: string; res?: Traced; message?: string }>) => {
        const m = e.data;
        if (m.id !== id || id !== job) return;
        heard = true;
        clearTimeout(watchdog);
        if (m.type === "stage") onStage(m.stage!);
        else if (m.type === "done") { settle = null; resolve(m.res!); }
        else { settle = null; reject(new Error(m.message)); }
      };
      mine.postMessage({ id, pixels, w, h, opts });
    });
  }
  return { run, cancel };
}

/* Images */

// Big images are traced from a copy at most this size; the SVG still comes out at the original's dimensions.
const MAX_SIDE = 2200;

export interface SourceImage { name: string; natW: number; natH: number; w: number; h: number; canvas: HTMLCanvasElement; pixels: Uint8ClampedArray }

export function fromDrawable(drawable: CanvasImageSource, natW: number, natH: number, name: string): SourceImage {
  const scale = Math.min(1, MAX_SIDE / Math.max(natW, natH));
  const w = Math.max(1, Math.round(natW * scale)), h = Math.max(1, Math.round(natH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(drawable, 0, 0, w, h);
  return { name, natW, natH, w, h, canvas, pixels: ctx.getImageData(0, 0, w, h).data };
}

export async function loadFile(file: File): Promise<SourceImage> {
  let drawable: ImageBitmap | HTMLImageElement;
  try { drawable = await createImageBitmap(file); }
  catch {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    try { await img.decode(); } finally { URL.revokeObjectURL(img.src); }
    drawable = img;
  }
  const w = "naturalWidth" in drawable ? drawable.naturalWidth : drawable.width, h = "naturalHeight" in drawable ? drawable.naturalHeight : drawable.height;
  if (!w || !h) throw new Error("empty");
  return fromDrawable(drawable, w, h, file.name || "image");
}

/* Samples are drawn here rather than shipped as files. */

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r1: number, r2: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

export interface Sample { id: string; name: string; detail: string; file: string; w: number; h: number; pixel?: boolean; draw: (ctx: CanvasRenderingContext2D) => void }

export const SAMPLES: Sample[] = [
  {
    id: "logo", name: "Logo", detail: "Flat shapes and type", file: "logo.png", w: 360, h: 240,
    draw(ctx) {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 360, 240);
      ctx.fillStyle = "#e5533d"; ctx.beginPath(); ctx.roundRect(36, 34, 150, 124, 26); ctx.fill();
      ctx.fillStyle = "#2f6fe4"; ctx.beginPath(); ctx.arc(196, 132, 62, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f2b632"; starPath(ctx, 292, 62, 40, 16); ctx.fill();
      ctx.fillStyle = "#23a26d"; ctx.beginPath(); ctx.moveTo(272, 150); ctx.lineTo(328, 150); ctx.lineTo(300, 198); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#16181d"; ctx.font = '700 62px Inter, "Helvetica Neue", Arial, sans-serif'; ctx.textBaseline = "alphabetic";
      ctx.fillText("Ag", 30, 218);
    },
  },
  {
    id: "scene", name: "Landscape", detail: "Soft gradients", file: "landscape.png", w: 420, h: 280,
    draw(ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, 280);
      sky.addColorStop(0, "#27407f"); sky.addColorStop(0.55, "#c9728a"); sky.addColorStop(1, "#f6c58d");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, 420, 280);
      ctx.fillStyle = "#ffe6ab"; ctx.beginPath(); ctx.arc(292, 150, 38, 0, Math.PI * 2); ctx.fill();
      const hills: [string, number, number, number, number][] = [["#6b4f86", 190, 26, 61, 0.4], ["#43386a", 220, 22, 43, 2.1], ["#221d3c", 246, 16, 77, 4.0]];
      for (const [color, base, amp, period, phase] of hills) {
        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, 280);
        for (let x = 0; x <= 420; x += 2) ctx.lineTo(x, base + amp * Math.sin(x / period + phase) + amp * 0.4 * Math.sin(x / (period * 0.37) + phase * 2));
        ctx.lineTo(420, 280); ctx.closePath(); ctx.fill();
      }
    },
  },
  {
    id: "pixel", name: "Pixel art", detail: "Hard, stepped edges", file: "pixel-art.png", w: 120, h: 80, pixel: true,
    draw(ctx) {
      const rows = [
        "................", "..kkk.....kkk...", ".krrrk...krrrk..", "krwwrrk.krrrrrk.", "krwrrrrkrrrrrrk.", "krrrrrrrrrrrrrk.",
        "krrrrrrrrrrrrrk.", ".krrrrrrrrrrrk..", "..krrrrrrrrrk...", "...krrrrrrrk....", "....krrrrrk.....", ".....krrrk......",
        "......krk.......", ".......k........", "................", "................",
      ];
      const ink: Record<string, string> = { ".": "#fdf3e7", k: "#2b1a2e", r: "#e23d4f", w: "#ffd9dc" };
      ctx.fillStyle = ink["."]; ctx.fillRect(0, 0, 120, 80);
      rows.forEach((row, y) => [...row].forEach((ch, x) => { ctx.fillStyle = ink[ch]; ctx.fillRect(x * 5 + 22, y * 5 + 3, 5, 5); }));
    },
  },
];

export function renderSample(sample: Sample) {
  const canvas = document.createElement("canvas");
  canvas.width = sample.w; canvas.height = sample.h;
  sample.draw(canvas.getContext("2d", { willReadFrequently: true })!);
  return canvas;
}

/* Settings */

export const DETAIL = [
  { label: "Low", pixels: 300_000, maxUpscale: 1.5 },
  { label: "Medium", pixels: 800_000, maxUpscale: 2 },
  { label: "High", pixels: 1_800_000, maxUpscale: 3 },
];
export const SMOOTH_NAMES = ["Minimal", "Light", "Medium", "Strong", "Heavy", "Maximum"];
export const CORNER_ANGLES = [110, 90, 75, 60, 50, 40, 30];
export const SPECKS = [0, 1, 2, 4, 8, 16, 32, 64];

export interface VectorSettings { colors: number; detail: number; smoothing: number; corner: number; speck: number; mode: "stacked" | "cutout"; gapFill: boolean; removeBackground: boolean }
export const DEFAULT_VECTOR_SETTINGS: VectorSettings = { colors: 1, detail: 1, smoothing: -1, corner: 3, speck: 3, mode: "stacked", gapFill: true, removeBackground: false };

export function traceOptions(o: VectorSettings, image: SourceImage): TraceOptions {
  return {
    colors: o.colors <= 1 ? 0 : o.colors,
    pixels: DETAIL[o.detail].pixels, maxUpscale: DETAIL[o.detail].maxUpscale,
    smoothing: o.smoothing, cornerAngle: CORNER_ANGLES[o.corner], speck: SPECKS[o.speck],
    mode: o.mode, gapFill: o.gapFill, removeBackground: o.removeBackground,
    outW: image.natW, outH: image.natH,
  };
}

export const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
