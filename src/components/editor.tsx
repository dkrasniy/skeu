"use client";

import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown01Icon, ArrowDataTransferHorizontalIcon, Copy01Icon, Delete02Icon, HelpCircleIcon, RedoIcon, Tick02Icon, UndoIcon } from "@hugeicons/core-free-icons";
import { Artboard } from "./artboard";
import { CropEditor } from "./crop";
import { HowItWorks } from "./how-it-works";
import { MorphText } from "./morph-text";
import { ColorChip, Icon, IconButton, Menu, PositionGrid, ResizeHandle, Segmented, Slider, SliderRow, TiltPad } from "./controls";
import { type Asset, type Settings, anchorOffsets, canvasDimensions, clamp, DEFAULT_SETTINGS, GRADIENTS, INITIAL_DOCUMENT, RATIOS, SOLIDS } from "@/lib/editor-state";
import { clearSavedDocument, loadStyle, saveStyle } from "@/lib/storage";
import { HOME_HREF, rememberEditor } from "@/lib/returning";
import { renderImage } from "@/lib/render";
import { fitImage, MAX_SIDE } from "@/lib/image";
import { useHistory } from "@/lib/use-history";

type ImageFormat = "png" | "jpeg" | "webp";
type Scale = "1" | "2" | "3";

// Keeps a card's bottom in view while it grows (an accordion opening inside it), scrolling its panel along with
// the growth so the new options never open out of sight. It never scrolls the card's top out of view.
function keepInView(el: HTMLElement, ms = 400) {
  // The panel scrolls on its own on wide screens; on narrow ones the page does.
  const panel = el.closest<HTMLElement>(".panel-scroll");
  const scroller = panel && /auto|scroll/.test(getComputedStyle(panel).overflowY) ? panel : null;
  const end = performance.now() + ms;
  const step = () => {
    const box = el.getBoundingClientRect();
    const view = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const by = Math.min(box.bottom + 8 - view.bottom, box.top - view.top - 8);
    if (by > 0.5) { if (scroller) scroller.scrollTop += by; else window.scrollBy(0, by); }
    if (performance.now() < end) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const FORMAT_LABEL: Record<ImageFormat, string> = { png: "PNG", jpeg: "JPG", webp: "WebP" };
const SHADOW_KEYS = ["shadow", "shadowX", "shadowY", "shadowBlur", "shadowSpread", "shadowColor"] as const satisfies readonly (keyof Settings)[];
// Each panel tray resets its own settings; canvas size lives in the size menu and is left alone.
const SCREENSHOT_KEYS = ["frame", "size", "radius", "inset", ...SHADOW_KEYS] as const satisfies readonly (keyof Settings)[];
const POSITION_KEYS = ["x", "y", "rotation", "tiltX", "tiltY"] as const satisfies readonly (keyof Settings)[];
const BACKGROUND_KEYS = ["background", "color1", "color2", "angle"] as const satisfies readonly (keyof Settings)[];
const isDefault = (s: Settings, keys: readonly (keyof Settings)[]) => keys.every(k => s[k] === DEFAULT_SETTINGS[k]);
const defaults = (keys: readonly (keyof Settings)[]): Partial<Settings> => Object.fromEntries(keys.map(k => [k, DEFAULT_SETTINGS[k]]));
const CONFETTI = ["#6f86ff", "#9b78f2", "#f08bbd", "#ffbd44", "#00c84e", "#ff625a"];

interface Particle { dx: number; apex: number; fall: number; dur: number; delay: number; spin: number; flip: number; r0: number; w: number; h: number; round: boolean; color: string }

// Thrown mostly upward: each piece rises and slows, then falls under gravity while tumbling.
function confetti(count = 22): Particle[] {
  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  return Array.from({ length: count }, (_, i) => {
    const shape = i % 3;
    const side = i % 2 ? 1 : -1;
    return {
      dx: side * rand(18, 135), apex: -rand(72, 150), fall: rand(30, 90),
      dur: rand(1050, 1500), delay: rand(0, 60),
      spin: side * rand(240, 720), flip: rand(360, 1080), r0: rand(0, 360),
      w: shape === 0 ? rand(3.5, 4.5) : rand(5, 6.5), h: shape === 0 ? rand(8, 11) : rand(5, 6.5), round: shape === 2,
      color: CONFETTI[i % CONFETTI.length],
    };
  });
}

// Opens the home page in a new tab: the image lives only in this page, so leaving it would lose the work.
function Logo() {
  return <a className="logo" href={HOME_HREF} target="_blank" rel="noopener" aria-label="About Skeu"><img src="/logo.svg" alt="" width={24} height={24} /></a>;
}

export function Editor() {
  const { doc, update, begin, end, undo, redo, restore, adjusting, canUndo, canRedo } = useHistory();
  const s = doc.settings;
  const backgroundTray = useRef<HTMLElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const [menu, setMenu] = useState<"size" | "export" | "shadow" | null>(null);
  const [toast, setToast] = useState<{ text: string; open: boolean; undoable: boolean }>({ text: "", open: false, undoable: false });
  const [format, setFormat] = useState<ImageFormat>("png");
  const [scaleChoice, setScaleChoice] = useState<Scale>("2");
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [burst, setBurst] = useState<{ id: number; particles: Particle[] } | null>(null);
  const [fit, setFit] = useState(.5);
  const [dragging, setDragging] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [cropping, setCropping] = useState(false);
  const artboard = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const burstTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const importId = useRef(0);
  const drag = useRef<{ clientX: number; clientY: number; x: number; y: number; width: number; height: number } | null>(null);
  const sizing = useRef<{ clientX: number; clientY: number; width: number; height: number; maxWidth: number; maxHeight: number } | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ gap: number; size: number } | null>(null);
  const wheelSize = useRef<number | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dims = canvasDimensions(s, doc.asset);
  // A scale that would pass MAX_SIDE is scaled back to land on it, so 3× of a big canvas still comes out as large as allowed.
  const exportScale = Math.min(Number(scaleChoice), MAX_SIDE / Math.max(dims.width, dims.height));

  const notify = useCallback((text: string, undoable = false) => {
    setToast({ text, open: true, undoable });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, open: false })), 2600);
  }, []);
  const change = useCallback((patch: Partial<Settings>) => update(d => ({ ...d, settings: { ...d.settings, ...patch } })), [update]);
  const closeMenu = useCallback(() => setMenu(null), []);
  const toggleMenu = (next: "size" | "export" | "shadow") => setMenu(m => m === next ? null : next);

  // Each visit starts with an empty canvas; only the style carries over.
  useEffect(() => {
    clearSavedDocument();
    rememberEditor();
    const style = loadStyle();
    if (style) restore({ ...INITIAL_DOCUMENT, settings: style });
    return () => { clearTimeout(toastTimer.current); clearTimeout(copiedTimer.current); clearTimeout(burstTimer.current); clearTimeout(wheelTimer.current); };
  }, [restore]);
  useEffect(() => {
    const timer = setTimeout(() => saveStyle(s), 300);
    return () => clearTimeout(timer);
  }, [s]);

  // The view scale holds still while the canvas is being resized, then refits on release.
  useEffect(() => {
    const el = stage.current;
    if (!el || resizing) return;
    const resize = () => {
      const pad = el.clientWidth < 600 ? 32 : 80;
      setFit(Math.min((el.clientWidth - pad) / dims.width, (el.clientHeight - pad) / dims.height, 1));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [dims.width, dims.height, resizing]);

  const setAsset = useCallback((asset: Asset, name: string) => {
    update(d => ({ ...d, asset, name, settings: { ...d.settings, x: 0, y: 0 } }));
    setCropping(false);
  }, [update]);

  // Undoable instead of confirmed: the toast offers Undo, and ⌘Z works too. Style settings stay for the next image.
  const removeImage = useCallback(() => {
    update(d => ({ ...d, asset: null, name: "Untitled", settings: { ...d.settings, x: 0, y: 0 } }));
    setCropping(false);
    setMenu(null);
    notify("Image removed", true);
  }, [update, notify]);

  const importFile = useCallback(async (file: File) => {
    if (!/^image\/(png|jpe?g|webp|avif|gif)$/.test(file.type)) { notify("Choose a PNG, JPG, WebP, AVIF, or GIF image"); return; }
    if (file.size > 30 * 1024 * 1024) { notify("This image is over 30 MB. Choose a smaller one."); return; }
    const id = ++importId.current;
    try {
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const image = new Image();
      image.src = src;
      await image.decode();
      if (id !== importId.current) return;
      if (image.naturalWidth * image.naturalHeight > 60_000_000) { notify("This image is over 60 megapixels. Choose a smaller one."); return; }
      const name = file.name.replace(/\.[^.]+$/, "");
      const fitted = await fitImage(image);
      if (id !== importId.current) return;
      setAsset({ src, name, width: image.naturalWidth, height: image.naturalHeight, crop: null, ...fitted }, name);
    } catch { notify("This image couldn’t be opened. Try a PNG or JPG."); }
  }, [notify, setAsset]);

  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.items ?? []).find(item => item.type.startsWith("image/"))?.getAsFile();
      if (file) { e.preventDefault(); void importFile(file); }
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, [importFile]);

  // The background is always opaque, so JPEG needs no matte.
  const render = useCallback(async (type: ImageFormat) => {
    if (!doc.asset) throw new Error("Nothing to export");
    const canvas = await renderImage(s, doc.asset, exportScale);
    return new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Export failed")), `image/${type}`, .96));
  }, [s, doc.asset, exportScale]);

  const download = useCallback(async () => {
    if (exporting || !doc.asset || cropping) return;
    // Celebrate on the click itself; rendering a large image can take a moment.
    setBurst(b => ({ id: (b?.id ?? 0) + 1, particles: confetti() }));
    clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurst(null), 1700);
    setExporting(true);
    try {
      const url = URL.createObjectURL(await render(format));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${doc.name.replace(/[^a-z0-9 _-]/gi, "").trim() || "screenshot"}.${format === "jpeg" ? "jpg" : format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      setMenu(null);
    } catch { notify("The download didn’t finish. Try a smaller size."); }
    finally { setExporting(false); }
  }, [exporting, doc.asset, cropping, doc.name, render, format, notify]);

  const copy = useCallback(async () => {
    if (exporting || !doc.asset || cropping) return;
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") { notify("This browser can’t copy images. Download it instead."); return; }
    setExporting(true);
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": render("png") })]);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch { notify("Clipboard access was blocked. Download the image instead."); }
    finally { setExporting(false); }
  }, [exporting, doc.asset, cropping, render, notify]);

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input:not([type="range"]), textarea, [contenteditable="true"]')) return;
      if (!(e.metaKey || e.ctrlKey) || document.querySelector("dialog[open]")) return;
      const key = e.key.toLowerCase();
      if (key === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (key === "s") { e.preventDefault(); void download(); }
      else if (key === "o") { e.preventDefault(); fileInput.current?.click(); }
      else if (key === "c" && !window.getSelection()?.toString()) { e.preventDefault(); void copy(); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [undo, redo, download, copy]);

  function startDrag(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || !artboard.current || pinch.current) return;
    e.preventDefault();
    begin();
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const bounds = artboard.current.getBoundingClientRect();
    drag.current = { clientX: e.clientX, clientY: e.clientY, x: s.x, y: s.y, width: bounds.width, height: bounds.height };
  }
  function moveDrag(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    if (!(e.buttons & 1)) { endDrag(e); return; }
    const x = clamp(d.x + (e.clientX - d.clientX) / d.width * 100, -50, 50);
    const y = clamp(d.y + (e.clientY - d.clientY) / d.height * 100, -50, 50);
    change({ x: Math.abs(x) < .8 ? 0 : Math.round(x * 10) / 10, y: Math.abs(y) < .8 ? 0 : Math.round(y * 10) / 10 });
  }
  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
    setDragging(false);
    end();
  }

  // Pinch anywhere on the canvas scales the screenshot. Runs in the capture phase so a second
  // finger takes over before the card can start a drag with it.
  const fingerGap = () => {
    const [a, b] = [...touches.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  function pinchDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" || !doc.asset) return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.current.size !== 2) return;
    if (drag.current) { drag.current = null; setDragging(false); end(); }
    e.currentTarget.setPointerCapture(e.pointerId);
    begin();
    pinch.current = { gap: fingerGap(), size: s.size };
  }
  function pinchMove(e: PointerEvent<HTMLDivElement>) {
    if (!touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pinch.current;
    if (!p || touches.current.size < 2 || !p.gap) return;
    change({ size: clamp(Math.round(p.size * fingerGap() / p.gap), 20, 150) });
  }
  function pinchUp(e: PointerEvent<HTMLDivElement>) {
    touches.current.delete(e.pointerId);
    if (pinch.current && touches.current.size < 2) { pinch.current = null; end(); }
  }

  // Mobile: as the page scrolls, collapse the sticky canvas and shrink the preview to fit what is still showing.
  useEffect(() => {
    const el = stage.current;
    const column = el?.parentElement;
    const workspace = column?.parentElement;
    if (!el || !column || !workspace) return;
    const mobile = matchMedia("(max-width: 860px)");
    const RATIO = .42;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!mobile.matches) {
        for (const name of ["--collapse", "--collapse-ratio", "--stick"]) column.style.removeProperty(name);
        el.style.removeProperty("--shrink");
        return;
      }
      const collapse = Math.round(el.offsetHeight * RATIO);
      // The stage's static top in the page (column top, minus its negative margin, plus the stage's offset in it).
      const start = workspace.getBoundingClientRect().top + window.scrollY + parseFloat(getComputedStyle(column).marginTop) + el.offsetTop;
      // Stick once the top bar is gone and `collapse` px of the stage has scrolled under the top edge.
      column.style.setProperty("--stick", `${-(el.offsetTop + collapse)}px`);
      column.style.setProperty("--collapse", `${collapse}px`);
      column.style.setProperty("--collapse-ratio", String(RATIO));
      el.style.setProperty("--shrink", String(clamp((window.scrollY - start) / collapse, 0, 1)));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    mobile.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      mobile.removeEventListener("change", schedule);
    };
  }, [doc.asset]);

  // A trackpad pinch arrives as ctrl + wheel; treat it like a touch pinch over the canvas.
  useEffect(() => {
    const el = stage.current;
    if (!el || !doc.asset) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (wheelSize.current === null) { wheelSize.current = s.size; begin(); }
      wheelSize.current = clamp(wheelSize.current * Math.exp(-e.deltaY / 100), 20, 150);
      change({ size: Math.round(wheelSize.current) });
      clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => { wheelSize.current = null; end(); }, 250);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [doc.asset, s.size, begin, end, change]);

  // The canvas grows from its center, so the corner moves half as far as the size changes.
  function startResize(e: PointerEvent<HTMLButtonElement>) {
    const el = stage.current;
    if (e.button !== 0 || !el) return;
    e.preventDefault();
    begin();
    setResizing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    sizing.current = { clientX: e.clientX, clientY: e.clientY, width: dims.width, height: dims.height,
      maxWidth: Math.min(4096, (el.clientWidth - 16) / fit), maxHeight: Math.min(4096, (el.clientHeight - 16) / fit) };
  }
  function moveResize(e: PointerEvent<HTMLButtonElement>) {
    const r = sizing.current;
    if (!r) return;
    if (!(e.buttons & 1)) { endResize(e); return; }
    change({ ratio: "custom",
      width: Math.round(clamp(r.width + 2 * (e.clientX - r.clientX) / fit, 320, Math.max(320, r.maxWidth))),
      height: Math.round(clamp(r.height + 2 * (e.clientY - r.clientY) / fit, 320, Math.max(320, r.maxHeight))) });
  }
  function endResize(e: PointerEvent<HTMLButtonElement>) {
    if (!sizing.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    sizing.current = null;
    setResizing(false);
    end();
  }
  function keyResize(e: ReactKeyboardEvent<HTMLButtonElement>) {
    const step = e.shiftKey ? 100 : 10;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!delta) return;
    e.preventDefault();
    if (!e.repeat) begin();
    change({ ratio: "custom", width: clamp(dims.width + delta[0], 320, 4096), height: clamp(dims.height + delta[1], 320, 4096) });
  }

  const slider = (key: "size" | "radius" | "inset" | "rotation" | "tiltX" | "tiltY" | "angle" | "shadowX" | "shadowY" | "shadowBlur" | "shadowSpread", label: string, min: number, max: number, unit = "") =>
    <SliderRow label={label} value={s[key]} min={min} max={max} unit={unit} reset={DEFAULT_SETTINGS[key]} onChange={n => change({ [key]: n })} begin={begin} end={end} />;
  const gradient = s.background === "gradient";
  // Swatches are keyed by position, so switching palettes recolors the same buttons (and the colors can fade).
  const swatch = (i: number, name: string, color1: string, color2: string, pick: Partial<Settings>) =>
    <button type="button" key={i} className="swatch" title={name} aria-label={name}
      aria-pressed={s.color1 === color1 && (!gradient || s.color2 === color2)} style={{ "--swatch-1": color1, "--swatch-2": color2 } as CSSProperties} onClick={() => change(pick)} />;
  const ratioLabel = s.ratio === "custom" ? `${dims.width} × ${dims.height}` : RATIOS.find(r => r.value === s.ratio)?.label;

  return <div className={`app ${dropping ? "is-dropping" : ""}`}
    onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDropping(true); } }}
    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false); }}
    onDrop={e => { e.preventDefault(); setDropping(false); const file = e.dataTransfer.files[0]; if (file) void importFile(file); }}>
    <input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
      onChange={e => { const file = e.target.files?.[0]; if (file) void importFile(file); e.target.value = ""; }} />

    <main className="workspace">
      <section className="canvas-column" aria-label="Canvas">
        <header className="sheet canvas-bar">
          <div className="doc-title">
            <Logo />
            <input className="doc-name" aria-label="Screenshot name" value={doc.name} maxLength={80}
              onFocus={begin} onChange={e => update(d => ({ ...d, name: e.target.value }))}
              onBlur={e => { if (!e.target.value.trim()) update(d => ({ ...d, name: "Untitled" })); end(); }} />
          </div>
          <div className="bar-actions">
            {doc.asset && <>
              <button type="button" className="button ghost" aria-pressed={cropping} onClick={() => { setMenu(null); setCropping(c => !c); }}>Crop</button>
              <button type="button" className="button ghost" title="Replace image (⌘O)" onClick={() => fileInput.current?.click()}>Replace</button>
              <IconButton label="Remove image" icon={Delete02Icon} onClick={removeImage} />
            </>}
            <div className="anchor">
              <button type="button" className="button ghost" data-menu-trigger aria-expanded={menu === "size"} onClick={() => toggleMenu("size")}>
                <span className="num">{ratioLabel}</span><Icon icon={ArrowDown01Icon} size={14} />
              </button>
              <Menu open={menu === "size"} onClose={closeMenu} label="Canvas size" origin="top-right">
                {RATIOS.map(r => <button type="button" key={r.value} className="menu-item" aria-pressed={s.ratio === r.value} onClick={() => { change({ ratio: r.value }); setMenu(null); }}>
                  <span className="num">{r.label}</span>{s.ratio === r.value && <Icon icon={Tick02Icon} />}
                </button>)}
                <div className="menu-fields">
                  <label>Width<input className="num" type="number" min={320} max={4096} value={s.width} onFocus={begin} onBlur={end} onChange={e => change({ width: clamp(Number(e.target.value), 320, 4096) })} /></label>
                  <label>Height<input className="num" type="number" min={320} max={4096} value={dims.height} onFocus={begin} onBlur={end} onChange={e => change({ height: clamp(Number(e.target.value), 320, 4096), ratio: "custom" })} /></label>
                </div>
              </Menu>
            </div>
            <div className="icon-group">
              <IconButton label="Undo (⌘Z)" icon={UndoIcon} onClick={undo} disabled={!canUndo} />
              <IconButton label="Redo (⌘⇧Z)" icon={RedoIcon} onClick={redo} disabled={!canRedo} />
              <IconButton label="How it works" icon={HelpCircleIcon} onClick={() => { setMenu(null); setHelpOpen(true); }} />
            </div>
          </div>
        </header>

        <div className="stage" ref={stage} onPointerDownCapture={pinchDown} onPointerMoveCapture={pinchMove} onPointerUpCapture={pinchUp} onPointerCancelCapture={pinchUp}>
          {doc.asset && cropping ? <CropEditor asset={doc.asset} onCancel={() => setCropping(false)}
            onApply={crop => { update(d => d.asset ? { ...d, asset: { ...d.asset, crop } } : d); setCropping(false); }} />
          : doc.asset ? <div className="preview" style={{ width: dims.width * fit, height: dims.height * fit }}>
            <div className="preview-scaler" style={{ transform: `scale(${fit})` }}>
              <Artboard settings={s} asset={doc.asset} artboardRef={artboard} dragging={dragging} adjusting={adjusting} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} />
            </div>
            <div className="resize-corner">
              <ResizeHandle label="Resize canvas" hint="Drag to resize canvas" active={resizing}
                onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={endResize} onLostPointerCapture={endResize} onKeyDown={keyResize} onKeyUp={end} />
            </div>
            {dragging && <div className="guides">{s.x === 0 && <i className="guide vertical" />}{s.y === 0 && <i className="guide horizontal" />}</div>}
          </div> : <div className="empty">
            <p className="empty-title">Add a screenshot</p>
            <p className="empty-hint">Drop an image here, or paste one with ⌘V.</p>
            <div className="empty-actions">
              <button type="button" className="button primary" onClick={() => fileInput.current?.click()}>Choose image</button>
              <button type="button" className="button secondary" onClick={() => setHelpOpen(true)}>How it works</button>
            </div>
          </div>}
        </div>
      </section>

      <aside className="sheet panel" aria-label="Style">
        <div className="panel-scroll">
          <section className="tray">
            <div className="tray-head"><h2>Screenshot</h2>
              {!isDefault(s, SCREENSHOT_KEYS) && <button type="button" className="link" onClick={() => change(defaults(SCREENSHOT_KEYS))}>Reset</button>}</div>
            <div className="tray-card">
            <div className="row"><span className="row-label">Frame</span>
              <Segmented label="Frame" value={s.frame} onChange={frame => change({ frame })} options={[{ value: "none", label: "None" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} /></div>
            {slider("size", "Size", 20, 150, "%")}
            {slider("radius", "Roundness", 0, 48)}
            {slider("inset", "Padding", 0, 40)}
            <div className="row anchor">
              <span className="row-label">
                <button type="button" className="label-button" data-menu-trigger aria-expanded={menu === "shadow"} onClick={() => toggleMenu("shadow")}>
                  Shadow<Icon icon={ArrowDown01Icon} size={14} />
                </button>
                <span className="row-value">{s.shadow}%</span>
              </span>
              <Slider label="Shadow strength" value={s.shadow} min={0} max={100} reset={DEFAULT_SETTINGS.shadow} onChange={shadow => change({ shadow })} begin={begin} end={end} />
              <Menu open={menu === "shadow"} onClose={closeMenu} label="Shadow" origin="top-left">
                <div className="menu-head"><span>Shadow</span>
                  <button type="button" className="chip-button" disabled={isDefault(s, SHADOW_KEYS)} onClick={() => change(defaults(SHADOW_KEYS))}>Reset</button></div>
                {slider("shadowX", "X offset", -100, 100)}
                {slider("shadowY", "Y offset", -100, 100)}
                {slider("shadowBlur", "Blur", 0, 200)}
                {slider("shadowSpread", "Spread", -50, 50)}
                <div className="row"><span className="row-label">Color</span>
                  <ColorChip label="Shadow color" value={s.shadowColor} onChange={shadowColor => change({ shadowColor })} begin={begin} end={end} /></div>
              </Menu>
            </div>
            </div>
          </section>

          <section className="tray">
            <div className="tray-head"><h2>Position</h2>
              {!isDefault(s, POSITION_KEYS) && <button type="button" className="link" onClick={() => change(defaults(POSITION_KEYS))}>Reset</button>}</div>
            <div className="tray-card">
            {slider("rotation", "Rotate", -180, 180, "°")}
            <div className="row split">
              <div className="cell"><span className="row-label">Tilt
                  <button type="button" className="chip-button" disabled={!s.tiltX && !s.tiltY} onClick={() => change({ tiltX: 0, tiltY: 0 })}>Reset</button></span>
                <TiltPad x={s.tiltX} y={s.tiltY} onChange={(tiltX, tiltY) => change({ tiltX, tiltY })} begin={begin} end={end} /></div>
              <div className="cell"><span className="row-label">Position</span>
                <PositionGrid x={s.x} y={s.y} reach={doc.asset ? anchorOffsets(s, doc.asset) : { x: 0, y: 0 }} onChange={(x, y) => change({ x, y })} /></div>
            </div>
            </div>
          </section>

          <section className="tray" ref={backgroundTray}>
            <div className="tray-head"><h2>Background</h2>
              {!isDefault(s, BACKGROUND_KEYS) && <button type="button" className="link" onClick={() => change(defaults(BACKGROUND_KEYS))}>Reset</button>}</div>
            {/* Gradient ↔ Solid: the first two rows of swatches stay put and fade between palettes; the third row,
                the end color and the angle open and close like the transitions.dev accordion. */}
            <div className="tray-card t-acc" data-open={gradient}>
            <div className="row"><span className="row-label">Type</span>
              <Segmented label="Background type" value={s.background} onChange={background => { change({ background }); if (background === "gradient" && backgroundTray.current) keepInView(backgroundTray.current); }} options={[{ value: "gradient", label: "Gradient" }, { value: "solid", label: "Solid" }]} /></div>
            <div className="row swatches">
              <div className="swatch-grid">
                {gradient
                  ? GRADIENTS.slice(0, SOLIDS.length).map(([name, color1, color2], i) => swatch(i, name, color1, color2, { color1, color2 }))
                  : SOLIDS.map((color, i) => swatch(i, color, color, color, { color1: color }))}
              </div>
              <div className="t-acc-panel" inert={!gradient}><div className="t-acc-panel-inner">
                <div className="swatch-grid">{GRADIENTS.slice(SOLIDS.length).map(([name, color1, color2], i) => swatch(SOLIDS.length + i, name, color1, color2, { color1, color2 }))}</div>
              </div></div>
            </div>
            <div className="row background-colors"><span className="row-label">{gradient ? "Colors" : "Color"}</span>
              <div className="chips">
                <ColorChip label={gradient ? "Start color" : "Color"} value={s.color1} onChange={color1 => change({ color1 })} begin={begin} end={end} />
                <div className="t-acc-panel chips-more" inert={!gradient}><div className="t-acc-panel-inner"><div className="chips">
                  <ColorChip label="End color" value={s.color2} onChange={color2 => change({ color2 })} begin={begin} end={end} />
                  <IconButton label="Swap colors" icon={ArrowDataTransferHorizontalIcon} onClick={() => change({ color1: s.color2, color2: s.color1 })} />
                </div></div></div>
              </div>
            </div>
            <div className="t-acc-panel background-angle" inert={!gradient}><div className="t-acc-panel-inner">{slider("angle", "Angle", 0, 360, "°")}</div></div>
            </div>
          </section>
        </div>

        <footer className="panel-footer">
          <button type="button" className="button secondary" title="Copy image (⌘C)" disabled={!doc.asset || cropping || exporting} onClick={() => void copy()}>
            <span className="t-icon-swap" data-state={copied ? "b" : "a"}>
              <span className="t-icon" data-icon="a"><Icon icon={Copy01Icon} /></span>
              <span className="t-icon" data-icon="b"><Icon icon={Tick02Icon} /></span>
            </span>Copy
          </button>
          <div className="anchor split-button">
            {burst && <span className="confetti" key={burst.id} aria-hidden="true">
              {burst.particles.map((pt, i) => <i key={i} style={{ "--dx": `${pt.dx}px`, "--apex": `${pt.apex}px`, "--fall": `${pt.fall}px`, "--dur": `${pt.dur}ms`, "--delay": `${pt.delay}ms`,
                "--spin": `${pt.spin}deg`, "--flip": `${pt.flip}deg`, "--r0": `${pt.r0}deg` } as CSSProperties}>
                <b><s style={{ width: pt.w, height: pt.h, background: pt.color, borderRadius: pt.round ? "50%" : 1 }} /></b>
              </i>)}
            </span>}
            <button type="button" className="button primary split-main" title="Download (⌘S)" disabled={!doc.asset || cropping || exporting} onClick={() => void download()}><MorphText text={`Download ${FORMAT_LABEL[format]}`} /></button>
            <button type="button" className="button primary split-toggle" aria-label="Download options" disabled={!doc.asset || cropping || exporting} data-menu-trigger aria-expanded={menu === "export"} onClick={() => toggleMenu("export")}><Icon icon={ArrowDown01Icon} size={14} /></button>
            <Menu open={menu === "export"} onClose={closeMenu} label="Download options" origin="bottom-right" className="export-menu">
              <div className="row"><span className="row-label">Format</span>
                <Segmented label="Format" value={format} onChange={setFormat} options={[{ value: "png", label: "PNG" }, { value: "jpeg", label: "JPG" }, { value: "webp", label: "WebP" }]} /></div>
              <div className="row"><span className="row-label">Scale</span>
                <Segmented label="Scale" value={scaleChoice} onChange={setScaleChoice} options={[{ value: "1", label: "1×" }, { value: "2", label: "2×" }, { value: "3", label: "3×" }]} /></div>
              <p className="menu-meta num">{Math.round(dims.width * exportScale)} × {Math.round(dims.height * exportScale)} px</p>
            </Menu>
          </div>
        </footer>
      </aside>
    </main>

    <HowItWorks open={helpOpen} onClose={closeHelp} />
    <div className="toast-layer"><div className={`toast t-toast ${toast.open ? "is-open" : ""}`} role="status" aria-live="polite" inert={!toast.open}>
      {toast.text}
      {toast.undoable && <button type="button" className="toast-action" onClick={() => { undo(); setToast(t => ({ ...t, open: false })); clearTimeout(toastTimer.current); }}>Undo</button>}
    </div></div>
  </div>;
}
