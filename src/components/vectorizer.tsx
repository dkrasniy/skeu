"use client";

import Link from "next/link";
import { type CSSProperties, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Add01Icon, ArrowHorizontalIcon, Copy01Icon, MinusSignIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { ColorChip, Icon, IconButton, Segmented, Slider, Switch } from "./controls";
import { useConfetti } from "./confetti";
import { VectorizeIntro } from "./vectorize-intro";
import "@/styles/vectorize.css";
import { MorphText } from "./morph-text";
import {
  CANCELLED, CORNER_ANGLES, createEngine, DEFAULT_VECTOR_SETTINGS, DETAIL, fileSize, fromDrawable, loadFile, loadTracer, plural,
  renderSample, type Sample, SMOOTH_NAMES, type SourceImage, SPECKS, type Traced, traceOptions, type VectorSettings,
} from "@/lib/vectorize";

// Vectorize: traces a PNG or JPEG into an SVG in the browser. Same shell as the editor: the canvas column on the
// left (header sheet + stage), the settings panel on the right with Copy and Download in its footer.

const EASE_OUT_QUART = (t: number) => 1 - Math.pow(1 - t, 4);
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const noop = () => {};

type View = "compare" | "vector" | "original" | "outline";
const VIEWS: { value: View; label: string }[] = [
  { value: "compare", label: "Compare" }, { value: "vector", label: "Vector" }, { value: "original", label: "Original" }, { value: "outline", label: "Outline" },
];
const PAD = { x: 32, top: 32, bottom: 72 };

/* Stage: pan, pinch and wheel zoom, and a divider that wipes between the original and the vector. */

const VectorLayer = memo(function VectorLayer({ svg, clip, fade }: { svg: string; clip: number; fade: boolean }) {
  return <div className="vec-layer" data-fade={fade || undefined} style={{ clipPath: `inset(0 0 0 ${clip}px)` }} dangerouslySetInnerHTML={{ __html: svg }} />;
});

function OriginalLayer({ image }: { image: SourceImage }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current!;
    c.width = image.w; c.height = image.h;
    c.getContext("2d")!.drawImage(image.canvas, 0, 0);
  }, [image]);
  return <canvas ref={ref} aria-hidden="true" />;
}

// The ease-settle spring from the fluid-interfaces skill: a 1.5% overshoot, settled in 480ms. Only the picture uses it.
const EASE_SETTLE = "linear(0, 0.086, 0.267, 0.464, 0.639, 0.776, 0.875, 0.941, 0.981, 1.003, 1.012, 1.015, 1.014, 1.011, 1.008, 1.006, 1)";

function Stage({ image, svg, view: mode, onView, reveal, status, from }: { image: SourceImage; svg: string; view: View; onView: (v: View) => void; reveal: boolean; status: string; from?: DOMRect | null }) {
  const el = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ z: 1, tx: 0, ty: 0 });
  const [panning, setPanning] = useState(false);
  const [split, setSplit] = useState(1); // where the divider sits, 0..1 across the stage
  const viewRef = useRef(view);
  const splitRef = useRef(split);
  const fitted = useRef(true);
  const userSplit = useRef(0.5);
  const tween = useRef(0);
  const hasVector = !!svg;
  const picture = useRef<HTMLDivElement>(null);
  const grown = useRef(false);
  useLayoutEffect(() => { viewRef.current = view; splitRef.current = split; });

  const fitView = useCallback((sz: { w: number; h: number }) => {
    const z = Math.min(16, Math.max(0.01, Math.min((sz.w - PAD.x * 2) / image.natW, (sz.h - PAD.top - PAD.bottom) / image.natH)));
    return { z, tx: (sz.w - image.natW * z) / 2, ty: PAD.top + (sz.h - PAD.top - PAD.bottom - image.natH * z) / 2 };
  }, [image]);

  useLayoutEffect(() => {
    const node = el.current!;
    const measure = () => {
      const r = node.getBoundingClientRect(), sz = { w: r.width, h: r.height };
      setSize(sz);
      if (fitted.current && sz.w > 0) setView(fitView(sz));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [fitView]);

  // The divider glides to where the chosen view puts it: off the left edge for the vector alone, off the right for
  // the original alone. The first trace of a visit sweeps it in from the right; later ones just appear.
  const glide = useCallback((to: number, ms: number) => {
    cancelAnimationFrame(tween.current);
    const from = splitRef.current;
    if (reducedMotion() || ms === 0 || Math.abs(from - to) < 0.001) { setSplit(to); return; }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setSplit(from + (to - from) * EASE_OUT_QUART(t));
      if (t < 1) tween.current = requestAnimationFrame(step);
    };
    tween.current = requestAnimationFrame(step);
  }, []);
  const wasVector = useRef<boolean | null>(null);
  useEffect(() => {
    const target = !hasVector || mode === "original" ? 1 : mode === "compare" ? userSplit.current : 0;
    if (wasVector.current === null) { wasVector.current = hasVector; glide(target, 0); return; }
    const arrived = hasVector && !wasVector.current;
    wasVector.current = hasVector;
    glide(target, arrived ? (reveal ? 520 : 0) : 320);
  }, [mode, hasVector, glide, reveal]);
  useEffect(() => () => cancelAnimationFrame(tween.current), []);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    const v = viewRef.current, fit = fitView(size).z, min = fit * 0.25, max = Math.max(32, fit * 8);
    const z = Math.min(max, Math.max(min, v.z * factor)), k = z / v.z;
    fitted.current = false;
    setView({ z, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k });
  }, [fitView, size]);

  useEffect(() => {
    const node = el.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = node.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ kind: "pan"; x: number; y: number; v: typeof view } | { kind: "pinch"; d: number; mx: number; my: number; v: typeof view } | null>(null);
  const beginGesture = () => {
    const pts = [...pointers.current.values()], v = viewRef.current;
    if (pts.length === 1) gesture.current = { kind: "pan", x: pts[0].x, y: pts[0].y, v };
    else if (pts.length >= 2) gesture.current = { kind: "pinch", d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2, v };
    else gesture.current = null;
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-nopan]") || (e.pointerType === "mouse" && e.button !== 0)) return;
    el.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    beginGesture();
    setPanning(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current, pts = [...pointers.current.values()];
    if (!g) return;
    fitted.current = false;
    if (g.kind === "pan") setView({ z: g.v.z, tx: g.v.tx + pts[0].x - g.x, ty: g.v.ty + pts[0].y - g.y });
    else if (pts.length >= 2) {
      const r = el.current!.getBoundingClientRect();
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
      const z = Math.min(64, Math.max(0.02, g.v.z * (d / g.d))), k = z / g.v.z, ax = g.mx - r.left, ay = g.my - r.top;
      setView({ z, tx: ax - (ax - g.v.tx) * k + (mx - g.mx), ty: ay - (ay - g.v.ty) * k + (my - g.my) });
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    beginGesture();
    if (!pointers.current.size) setPanning(false);
  };

  const dragging = useRef(false);
  const dragSplit = (e: React.PointerEvent) => {
    const r = el.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    userSplit.current = f;
    cancelAnimationFrame(tween.current);
    setSplit(f);
  };
  const splitKey = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowLeft" ? -0.02 : e.key === "ArrowRight" ? 0.02 : 0;
    if (!step) return;
    e.preventDefault();
    userSplit.current = Math.min(1, Math.max(0, userSplit.current + step));
    setSplit(userSplit.current);
  };

  // A sample picked on the intro is the same picture as the one on the canvas, so it grows from the tile into place
  // instead of appearing. Files chosen from disk have no tile, and just fade in.
  useLayoutEffect(() => {
    const el = picture.current;
    if (grown.current || !el || !size.w) return;
    grown.current = true;
    if (reducedMotion()) return;
    const to = el.getBoundingClientRect();
    if (from && to.width) {
      const k = from.width / to.width;
      el.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${k})`, borderRadius: `${12 / k}px` }, { transform: "none", borderRadius: "0px" }],
        { duration: 480, easing: EASE_SETTLE });
    } else {
      el.animate([{ opacity: 0, transform: "scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    }
  }, [size.w, from]);

  const boxW = image.natW * view.z, boxH = image.natH * view.z;
  const clip = Math.max(0, Math.min(boxW, split * size.w - view.tx));
  const comparing = hasVector && mode === "compare";
  const fit = size.w ? fitView(size) : view;
  const atFit = Math.abs(view.z - fit.z) < 0.001 && Math.abs(view.tx - fit.tx) < 0.5 && Math.abs(view.ty - fit.ty) < 0.5;

  return <div className="vec-stage" ref={el} data-panning={panning || undefined}
    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
    <div className="vec-picture" ref={picture} data-pixel={view.z * (image.natW / image.w) >= 2 || undefined} data-outline={(hasVector && mode === "outline") || undefined}
      style={{ left: view.tx, top: view.ty, width: boxW, height: boxH }}>
      <OriginalLayer image={image} />
      {hasVector && <VectorLayer svg={svg} clip={clip} fade={!reveal} />}
    </div>
    <span className="vec-tag left" data-on={comparing || undefined}>Original</span>
    <span className="vec-tag right" data-on={comparing || undefined}>Vector</span>
    <span className="vec-status" data-on={!!status || undefined} aria-live="polite">{status && `${status}…`}</span>
    <div className="vec-split" data-nopan="" data-on={comparing || undefined} style={{ left: split * size.w }}
      role="slider" tabIndex={comparing ? 0 : -1} aria-label="Divider between original and vector" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(split * 100)}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; dragSplit(e); }}
      onPointerMove={e => { if (dragging.current) dragSplit(e); }}
      onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }} onKeyDown={splitKey}>
      <span className="vec-split-knob"><Icon icon={ArrowHorizontalIcon} /></span>
    </div>
    <div className="vec-dock" style={{ "--i": 2 } as CSSProperties}>
      <div data-nopan=""><Segmented label="View" value={mode} options={VIEWS} onChange={onView} /></div>
      <div className="vec-float vec-zoom" data-nopan="">
        <IconButton label="Zoom out" icon={MinusSignIcon} onClick={() => zoomAt(1 / 1.5, size.w / 2, size.h / 2)} />
        <button type="button" className="vec-zoom-value num" title="Fit to view" aria-label={`Zoom ${Math.round(view.z * 100)} percent. Fit to view`}
          disabled={atFit} onClick={() => { fitted.current = true; setView(fitView(size)); }}>{Math.round(view.z * 100)}%</button>
        <IconButton label="Zoom in" icon={Add01Icon} onClick={() => zoomAt(1.5, size.w / 2, size.h / 2)} />
      </div>
    </div>
  </div>;
}

/* Panel rows */

function ValueRow({ label, display, value, min, max, reset, onChange }: { label: string; display: string; value: number; min: number; max: number; reset: number; onChange: (n: number) => void }) {
  const id = `vec-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return <div className="row">
    <label className="row-label" htmlFor={id}>{label}<span className="row-value">{display}</span></label>
    <Slider id={id} label={label} value={value} min={min} max={max} reset={reset} onChange={onChange} begin={noop} end={noop} />
  </div>;
}

const COLOR_KEYS = ["colors", "removeBackground"] as const;
const SHAPE_KEYS = ["detail", "smoothing", "corner", "speck"] as const;
const OUTPUT_KEYS = ["mode", "gapFill"] as const;
const isDefault = (o: VectorSettings, keys: readonly (keyof VectorSettings)[]) => keys.every(k => o[k] === DEFAULT_VECTOR_SETTINGS[k]);
const defaults = (keys: readonly (keyof VectorSettings)[]) => Object.fromEntries(keys.map(k => [k, DEFAULT_VECTOR_SETTINGS[k]])) as Partial<VectorSettings>;

function Logo() {
  return <Link className="logo" href="/" aria-label="Skeu"><img src="/logo.svg" alt="" width={24} height={24} /></Link>;
}

/* Page */

export function Vectorizer() {
  const [engine] = useState(createEngine);
  const [vt, setVt] = useState<Awaited<ReturnType<typeof loadTracer>> | null>(null);
  const [image, setImage] = useState<SourceImage | null>(null);
  const [imageKey, setImageKey] = useState(0);
  const [traced, setTraced] = useState<{ res: Traced; image: SourceImage } | null>(null);
  const [status, setStatus] = useState("");
  const [opts, setOpts] = useState(DEFAULT_VECTOR_SETTINGS);
  const [recolor, setRecolor] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [view, setView] = useState<View>("compare");
  const [reveal, setReveal] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState({ text: "", open: false });
  const [confetti, celebrate] = useConfetti();
  const fileInput = useRef<HTMLInputElement>(null);
  const revealUsed = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const set = useCallback((patch: Partial<VectorSettings>) => setOpts(o => ({ ...o, ...patch })), []);

  const notify = useCallback((text: string) => {
    setToast({ text, open: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, open: false })), 3000);
  }, []);

  useEffect(() => {
    loadTracer().then(setVt, () => notify("The tracer couldn’t load. Reload the page to try again."));
    return () => { engine.cancel(); clearTimeout(toastTimer.current); clearTimeout(copiedTimer.current); };
  }, [engine, notify]);

  // Leaving the intro: it fades out over the workspace while the workspace rises in (see .vec-app.is-entering).
  const [handoff, setHandoff] = useState<{ from: DOMRect | null } | null>(null);
  const [introLeaving, setIntroLeaving] = useState(false);
  const hasImage = useRef(false);
  const handoffTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => handoffTimers.current.forEach(clearTimeout), []);

  const open = useCallback((img: SourceImage, from: DOMRect | null = null) => {
    if (!hasImage.current) {
      hasImage.current = true;
      setHandoff({ from });
      setIntroLeaving(true);
      handoffTimers.current.push(setTimeout(() => setIntroLeaving(false), 200), setTimeout(() => setHandoff(null), 1000));
    }
    setTraced(null);
    setRecolor({});
    setPicked(null);
    setView("compare");
    setReveal(!revealUsed.current); // the first image of a visit gets the sweeping reveal; later ones just appear
    revealUsed.current = true;
    setImageKey(k => k + 1);
    setImage(img);
  }, []);
  const openFile = useCallback(async (file: File) => {
    if (file.type && !file.type.startsWith("image/")) { notify("That file isn’t an image. Choose a PNG or JPEG."); return; }
    try { open(await loadFile(file)); } catch { notify("That image couldn’t be read. Try saving it as a PNG or JPEG first."); }
  }, [open, notify]);
  const openSample = useCallback((sample: Sample, from: DOMRect | null) => {
    const c = renderSample(sample);
    open(fromDrawable(c, c.width, c.height, sample.file), from);
  }, [open]);

  // Trace whenever the image or a setting changes. Setting changes wait a moment so dragging a slider doesn't start
  // a trace per step. The last result stays on screen until the new one is ready.
  const lastImage = useRef<SourceImage | null>(null);
  useEffect(() => {
    if (!image) return;
    let alive = true;
    const wait = lastImage.current === image ? 160 : 0;
    lastImage.current = image;
    const timer = setTimeout(() => {
      setStatus("Starting");
      engine.run(image.pixels, image.w, image.h, traceOptions(opts, image), s => { if (alive) setStatus(s); })
        .then(res => { if (alive) { setTraced({ res, image }); setStatus(""); } })
        .catch(err => { if (alive && err !== CANCELLED) { setStatus(""); notify("The trace didn’t finish. Try a lower detail setting."); } });
    }, wait);
    return () => { alive = false; clearTimeout(timer); engine.cancel(); };
  }, [image, opts, engine, notify]);

  const res = traced && traced.image === image ? traced.res : null;
  const overrides = useMemo(() => (res && vt ? res.palette.map(p => recolor[vt.hex(p.rgb)] || null) : null), [res, vt, recolor]);
  const viewSvg = useMemo(() => (res && vt ? vt.compose(res, overrides, { bare: true, outline: view === "outline" }) : ""), [res, vt, overrides, view]);
  const fileSvg = useMemo(() => (res && vt ? vt.compose(res, overrides) : ""), [res, vt, overrides]);

  // A retrace of the same image keeps the last result until the new one lands, so the swatches don't flicker.
  const swatches = useMemo(() => res && vt
    ? res.layers.map(l => ({ orig: vt.hex(res.palette[l.color].rgb), share: res.palette[l.color].share })).sort((a, b) => b.share - a.share)
    : null, [res, vt]);
  const pickedLive = picked && swatches?.some(s => s.orig === picked) ? picked : null;
  const current = pickedLive ? recolor[pickedLive] || pickedLive : "#000000";
  const pick = (orig: string | null) => { setPicked(orig); if (orig) setDraft(recolor[orig] || orig); };
  const applyColor = (value: string, fromHex = false) => {
    if (!pickedLive) return;
    if (!fromHex) setDraft(value.toLowerCase());
    setRecolor(r => {
      const next = { ...r };
      if (value.toLowerCase() === pickedLive) delete next[pickedLive]; else next[pickedLive] = value.toLowerCase();
      return next;
    });
  };
  const draftValid = /^#[0-9a-f]{6}$/i.test(draft);

  // Files arriving by drop or paste.
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.items ?? []).find(i => i.kind === "file" && i.type.startsWith("image/"))?.getAsFile();
      if (file) { e.preventDefault(); void openFile(file); }
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, [openFile]);

  const baseName = image ? image.name.replace(/\.[^.]+$/, "") || "image" : "image";
  const download = useCallback(() => {
    if (!fileSvg) return;
    celebrate();
    const url = URL.createObjectURL(new Blob([fileSvg], { type: "image/svg+xml" }));
    const link = document.createElement("a");
    link.href = url; link.download = `${baseName}.svg`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }, [fileSvg, baseName, celebrate]);
  const copy = useCallback(async () => {
    if (!fileSvg) return;
    try {
      await navigator.clipboard.writeText(fileSvg);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch { notify("Clipboard access was blocked. Download the SVG instead."); }
  }, [fileSvg, notify]);

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input:not([type="range"]), textarea, [contenteditable="true"]')) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "s") { e.preventDefault(); download(); }
      else if (key === "o") { e.preventDefault(); fileInput.current?.click(); }
      else if (key === "c" && !window.getSelection()?.toString()) { e.preventDefault(); void copy(); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [download, copy]);

  const found = res ? res.layers.length : 0;
  const colorsDisplay = opts.colors <= 1 ? (found ? `Auto, ${found}` : "Auto") : found && found < opts.colors ? `${opts.colors}, ${found} found` : `${opts.colors}`;
  const cutout = opts.mode === "cutout";

  return <div className={`app vec-app ${dropping ? "is-dropping" : ""} ${handoff ? "is-entering" : ""} ${image ? "" : "is-intro"}`}
    onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDropping(true); } }}
    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false); }}
    onDrop={e => { e.preventDefault(); setDropping(false); const file = e.dataTransfer.files[0]; if (file) void openFile(file); }}>
    <input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
      onChange={e => { const file = e.target.files?.[0]; if (file) void openFile(file); e.target.value = ""; }} />

    {(!image || introLeaving) && <VectorizeIntro leaving={!!image} onChoose={() => fileInput.current?.click()} onSample={openSample} />}

    {image && <main className="workspace">
      <section className="canvas-column" aria-label="Image">
        <header className="sheet canvas-bar" style={{ "--i": 0 } as CSSProperties}>
          <div className="doc-title">
            <Logo />
            <h1 className="vec-title">Vectorize</h1>
            {image && <span className="vec-file" title={image.name}>{image.name}</span>}
          </div>
          <div className="bar-actions">
            {image && <button type="button" className="button ghost" title="New image (⌘O)" onClick={() => fileInput.current?.click()}>New image</button>}
          </div>
        </header>

        <div className="stage">
          <Stage key={imageKey} image={image} svg={viewSvg} view={view} onView={setView} reveal={reveal} status={status} from={handoff?.from} />
        </div>
      </section>

      <aside className="sheet panel" aria-label="Settings" style={{ "--i": 1 } as CSSProperties}>
        <div className="panel-scroll">
          <section className="tray" style={{ "--i": 2 } as CSSProperties}>
            <div className="tray-head"><h2>Colors</h2>
              {!isDefault(opts, COLOR_KEYS) && <button type="button" className="link" onClick={() => set(defaults(COLOR_KEYS))}>Reset</button>}</div>
            <div className="tray-card t-acc" data-open={!!pickedLive}>
              <div className="row swatches">
                <div className="swatch-grid" aria-label="Colors in the vector. Choose one to change it">
                  {swatches ? swatches.map(s => {
                    const color = recolor[s.orig] || s.orig;
                    return <button type="button" key={s.orig} className="swatch" aria-label={`Color ${color}`} title={color} aria-pressed={pickedLive === s.orig}
                      style={{ "--swatch-1": color, "--swatch-2": color } as CSSProperties} onClick={() => pick(pickedLive === s.orig ? null : s.orig)} />;
                  }) : Array.from({ length: 6 }, (_, i) => <span key={i} className="swatch vec-swatch-ghost" aria-hidden="true" />)}
                </div>
                {!swatches && <p className="vec-note">The colors found in your image show up here. Choose one to change it.</p>}
              </div>
              <div className="t-acc-panel" inert={!pickedLive}><div className="t-acc-panel-inner">
                <div className="row vec-edit">
                  <span className="row-label">Replace with</span>
                  <div className="vec-edit-controls">
                    <ColorChip label="Replacement color" value={current} onChange={applyColor} begin={noop} end={noop} />
                    <input className="vec-hex num" aria-label="Replacement color as hex" spellCheck={false} maxLength={7} value={draft} aria-invalid={draft !== "" && !draftValid}
                      onChange={e => { const v = e.target.value.trim(); setDraft(v); if (/^#[0-9a-f]{6}$/i.test(v)) applyColor(v, true); }} />
                    <button type="button" className="chip-button" disabled={!pickedLive || !recolor[pickedLive]} onClick={() => pickedLive && applyColor(pickedLive)}>Reset</button>
                  </div>
                </div>
              </div></div>
              <ValueRow label="Number of colors" display={colorsDisplay} value={opts.colors} min={1} max={32} reset={DEFAULT_VECTOR_SETTINGS.colors} onChange={colors => set({ colors })} />
              <Switch label="Remove background" checked={opts.removeBackground} onChange={removeBackground => set({ removeBackground })} />
            </div>
          </section>

          <section className="tray" style={{ "--i": 3 } as CSSProperties}>
            <div className="tray-head"><h2>Shape</h2>
              {!isDefault(opts, SHAPE_KEYS) && <button type="button" className="link" onClick={() => set(defaults(SHAPE_KEYS))}>Reset</button>}</div>
            <div className="tray-card">
              <div className="row"><span className="row-label">Detail</span>
                <Segmented label="Detail" value={String(opts.detail)} options={DETAIL.map((d, i) => ({ value: String(i), label: d.label }))} onChange={v => set({ detail: Number(v) })} /></div>
              <ValueRow label="Smoothing" value={opts.smoothing} min={-1} max={5} reset={DEFAULT_VECTOR_SETTINGS.smoothing} onChange={smoothing => set({ smoothing })}
                display={opts.smoothing < 0 ? (res ? `Auto, ${SMOOTH_NAMES[res.stats.smoothing].toLowerCase()}` : "Auto") : SMOOTH_NAMES[opts.smoothing]} />
              <ValueRow label="Corners" value={opts.corner} min={0} max={CORNER_ANGLES.length - 1} reset={DEFAULT_VECTOR_SETTINGS.corner} onChange={corner => set({ corner })}
                display={`Over ${CORNER_ANGLES[opts.corner]}°`} />
              <ValueRow label="Remove specks" value={opts.speck} min={0} max={SPECKS.length - 1} reset={DEFAULT_VECTOR_SETTINGS.speck} onChange={speck => set({ speck })}
                display={SPECKS[opts.speck] ? `Under ${SPECKS[opts.speck]} px` : "Off"} />
            </div>
          </section>

          <section className="tray" style={{ "--i": 4 } as CSSProperties}>
            <div className="tray-head"><h2>Output</h2>
              {!isDefault(opts, OUTPUT_KEYS) && <button type="button" className="link" onClick={() => set(defaults(OUTPUT_KEYS))}>Reset</button>}</div>
            <div className="tray-card t-acc" data-open={cutout}>
              <div className="row"><span className="row-label">Shapes</span>
                <Segmented label="Shapes" value={opts.mode} onChange={mode => set({ mode })} options={[{ value: "stacked", label: "Stacked" }, { value: "cutout", label: "Cut-outs" }]} /></div>
              <div className="t-acc-panel" inert={!cutout}><div className="t-acc-panel-inner">
                <Switch label="Fill hairline gaps" checked={opts.gapFill} onChange={gapFill => set({ gapFill })} />
              </div></div>
            </div>
            <p className="vec-note">{cutout ? "Colors sit side by side like puzzle pieces, with no overlap." : "Each color lies on top of the ones beneath it, so nothing shows through."}</p>
          </section>
        </div>

        <footer className="panel-footer" style={{ "--i": 5 } as CSSProperties}>
          <p className="vec-meta num" aria-live="polite">
            {res ? `${plural(res.layers.length, "color")}, ${plural(res.stats.nodes, "point")}, ${fileSize(fileSvg.length)}` : image ? "Tracing…" : "Add an image to trace it."}
          </p>
          <button type="button" className="button secondary" title="Copy SVG (⌘C)" disabled={!fileSvg} onClick={() => void copy()}>
            <span className="t-icon-swap" data-state={copied ? "b" : "a"}>
              <span className="t-icon" data-icon="a"><Icon icon={Copy01Icon} /></span>
              <span className="t-icon" data-icon="b"><Icon icon={Tick02Icon} /></span>
            </span>Copy
          </button>
          <div className="anchor vec-download">
            {confetti}
            <button type="button" className="button primary" title="Download SVG (⌘S)" disabled={!fileSvg} onClick={download}><MorphText text="Download SVG" /></button>
          </div>
        </footer>
      </aside>
    </main>}

    <div className="toast-layer"><div className={`toast t-toast ${toast.open ? "is-open" : ""}`} role="status" aria-live="polite" inert={!toast.open}>{toast.text}</div></div>
  </div>;
}
