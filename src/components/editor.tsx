"use client";

import { type KeyboardEvent as ReactKeyboardEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown01Icon, ArrowDataTransferHorizontalIcon, Copy01Icon, RedoIcon, Tick02Icon, UndoIcon } from "@hugeicons/core-free-icons";
import { Artboard } from "./artboard";
import { CropEditor } from "./crop";
import { ColorChip, Icon, IconButton, Menu, PositionGrid, ResizeHandle, Segmented, Slider, SliderRow, TextSwap, TiltPad } from "./controls";
import { type Asset, type Settings, anchorOffsets, canvasDimensions, clamp, DEFAULT_SETTINGS, DEMO_ASSET, GRADIENTS, RATIOS, SOLIDS } from "@/lib/editor-state";
import { loadDocument, saveDocument } from "@/lib/storage";
import { useHistory } from "@/lib/use-history";

type ImageFormat = "png" | "jpeg" | "webp";
type Scale = "1" | "2" | "3";
const FORMAT_LABEL: Record<ImageFormat, string> = { png: "PNG", jpeg: "JPG", webp: "WebP" };
const MAX_PIXELS = 36_000_000;
const MAX_SIDE = 8192;

function Logo() {
  return <img className="logo" src="/logo.svg" alt="" width={24} height={24} />;
}

export function Editor() {
  const { doc, update, begin, end, undo, redo, restore, adjusting, canUndo, canRedo } = useHistory();
  const s = doc.settings;
  const [ready, setReady] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [menu, setMenu] = useState<"size" | "export" | "shadow" | null>(null);
  const [toast, setToast] = useState({ text: "", open: false });
  const [format, setFormat] = useState<ImageFormat>("png");
  const [scaleChoice, setScaleChoice] = useState<Scale>("2");
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
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
  const importId = useRef(0);
  const drag = useRef<{ clientX: number; clientY: number; x: number; y: number; width: number; height: number } | null>(null);
  const sizing = useRef<{ clientX: number; clientY: number; width: number; height: number; maxWidth: number; maxHeight: number } | null>(null);

  const dims = canvasDimensions(s, doc.asset);
  const fits = (n: number) => dims.width * dims.height * n * n <= MAX_PIXELS && Math.max(dims.width, dims.height) * n <= MAX_SIDE;
  const exportScale = [Number(scaleChoice), 2, 1].find(fits) ?? 1;

  const notify = useCallback((text: string) => {
    setToast({ text, open: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, open: false })), 2600);
  }, []);
  const change = useCallback((patch: Partial<Settings>) => update(d => ({ ...d, settings: { ...d.settings, ...patch } })), [update]);
  const closeMenu = useCallback(() => setMenu(null), []);
  const toggleMenu = (next: "size" | "export" | "shadow") => setMenu(m => m === next ? null : next);

  useEffect(() => {
    let active = true;
    loadDocument()
      .then(saved => { if (active && saved) restore(saved); })
      .catch(() => { if (active) setSaveFailed(true); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; clearTimeout(toastTimer.current); clearTimeout(copiedTimer.current); };
  }, [restore]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const timer = setTimeout(() => {
      saveDocument(doc).then(() => { if (active) setSaveFailed(false); }).catch(() => { if (active) setSaveFailed(true); });
    }, 450);
    return () => { active = false; clearTimeout(timer); };
  }, [doc, ready]);

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
      setAsset({ src, name, width: image.naturalWidth, height: image.naturalHeight, crop: null }, name);
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

  const render = useCallback(async (type: ImageFormat) => {
    const node = artboard.current;
    if (!node) throw new Error("Nothing to export");
    await Promise.all(Array.from(node.querySelectorAll("img")).map(img => img.decode()));
    const { toCanvas } = await import("html-to-image");
    const canvas = await toCanvas(node, { width: dims.width, height: dims.height, pixelRatio: exportScale, skipFonts: true, cacheBust: false });
    if (type === "jpeg") {
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable");
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Export failed")), `image/${type}`, .96));
  }, [dims.width, dims.height, exportScale]);

  const download = useCallback(async () => {
    if (exporting || !doc.asset || cropping) return;
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
      if (!(e.metaKey || e.ctrlKey)) return;
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
    if (e.button !== 0 || !artboard.current) return;
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
    const x = clamp(d.x + (e.clientX - d.clientX) / d.width * 100, -50, 50);
    const y = clamp(d.y + (e.clientY - d.clientY) / d.height * 100, -50, 50);
    change({ x: Math.abs(x) < .8 ? 0 : Math.round(x * 10) / 10, y: Math.abs(y) < .8 ? 0 : Math.round(y * 10) / 10 });
  }
  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
    setDragging(false);
    end();
  }

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
    change({ ratio: "custom",
      width: Math.round(clamp(r.width + 2 * (e.clientX - r.clientX) / fit, 320, Math.max(320, r.maxWidth))),
      height: Math.round(clamp(r.height + 2 * (e.clientY - r.clientY) / fit, 320, Math.max(320, r.maxHeight))) });
  }
  function endResize(e: PointerEvent<HTMLButtonElement>) {
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
  const moved = s.x !== 0 || s.y !== 0 || s.rotation !== 0 || s.tiltX !== 0 || s.tiltY !== 0;
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
            {doc.asset && <TextSwap className="save-state" text={saveFailed ? "Not saved" : "Saved"} />}
          </div>
          <div className="bar-actions">
            {doc.asset && <>
              <button type="button" className="button ghost" aria-pressed={cropping} onClick={() => { setMenu(null); setCropping(c => !c); }}>Crop</button>
              <button type="button" className="button ghost" title="Replace image (⌘O)" onClick={() => fileInput.current?.click()}>Replace</button>
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
            </div>
          </div>
        </header>

        <div className="stage" ref={stage}>
          {doc.asset && cropping ? <CropEditor asset={doc.asset} onCancel={() => setCropping(false)}
            onApply={crop => { update(d => d.asset ? { ...d, asset: { ...d.asset, crop } } : d); setCropping(false); }} />
          : doc.asset ? <div className="preview" style={{ width: dims.width * fit, height: dims.height * fit }}>
            <div className="preview-scaler" style={{ transform: `scale(${fit})` }}>
              <Artboard settings={s} asset={doc.asset} artboardRef={artboard} dragging={dragging} adjusting={adjusting} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} />
            </div>
            <div className="resize-corner">
              <ResizeHandle label="Resize canvas" hint="Drag to resize canvas" active={resizing}
                onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={endResize} onKeyDown={keyResize} onKeyUp={end} />
            </div>
            {dragging && <div className="guides">{s.x === 0 && <i className="guide vertical" />}{s.y === 0 && <i className="guide horizontal" />}</div>}
          </div> : <div className="empty">
            <p className="empty-title">Add a screenshot</p>
            <p className="empty-hint">Drop an image here, or paste one with ⌘V.</p>
            <div className="empty-actions">
              <button type="button" className="button primary" onClick={() => fileInput.current?.click()}>Choose image</button>
              <button type="button" className="button secondary" onClick={() => setAsset(DEMO_ASSET, "Demo")}>Use demo image</button>
            </div>
          </div>}
        </div>
      </section>

      <aside className="sheet panel" aria-label="Style">
        <div className="panel-scroll">
          <section className="group">
            <h2 className="group-title">Screenshot</h2>
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
                {slider("shadowX", "X offset", -100, 100)}
                {slider("shadowY", "Y offset", -100, 100)}
                {slider("shadowBlur", "Blur", 0, 200)}
                {slider("shadowSpread", "Spread", -50, 50)}
                <div className="row"><span className="row-label">Color</span>
                  <ColorChip label="Shadow color" value={s.shadowColor} onChange={shadowColor => change({ shadowColor })} begin={begin} end={end} /></div>
              </Menu>
            </div>
          </section>

          <section className="group">
            <div className="group-title"><h2>Position</h2>
              {moved && <button type="button" className="link group-action" onClick={() => change({ x: 0, y: 0, rotation: 0, tiltX: 0, tiltY: 0 })}>Reset</button>}</div>
            {slider("rotation", "Rotate", -180, 180, "°")}
            <div className="row split">
              <div className="cell"><span className="row-label">Tilt
                  <button type="button" className="chip-button" disabled={!s.tiltX && !s.tiltY} onClick={() => change({ tiltX: 0, tiltY: 0 })}>Reset</button></span>
                <TiltPad x={s.tiltX} y={s.tiltY} onChange={(tiltX, tiltY) => change({ tiltX, tiltY })} begin={begin} end={end} /></div>
              <div className="cell"><span className="row-label">Position</span>
                <PositionGrid x={s.x} y={s.y} reach={doc.asset ? anchorOffsets(s, doc.asset) : { x: 0, y: 0 }} onChange={(x, y) => change({ x, y })} /></div>
            </div>
          </section>

          <section className="group">
            <h2 className="group-title">Background</h2>
            <div className="row"><span className="row-label">Type</span>
              <Segmented label="Background type" value={s.background} onChange={background => change({ background })} options={[{ value: "gradient", label: "Gradient" }, { value: "solid", label: "Solid" }]} /></div>
            <div className="row swatches">
              {s.background === "gradient"
                ? GRADIENTS.map(([name, color1, color2]) => <button type="button" key={name} className="swatch" title={name} aria-label={name}
                    aria-pressed={s.color1 === color1 && s.color2 === color2} style={{ background: `linear-gradient(135deg, ${color1}, ${color2})` }} onClick={() => change({ color1, color2 })} />)
                : SOLIDS.map(color => <button type="button" key={color} className="swatch" title={color} aria-label={color}
                    aria-pressed={s.color1 === color} style={{ background: color }} onClick={() => change({ color1: color })} />)}
            </div>
            <div className="row"><span className="row-label">{s.background === "gradient" ? "Colors" : "Color"}</span>
              <div className="chips">
                <ColorChip label={s.background === "gradient" ? "Start color" : "Color"} value={s.color1} onChange={color1 => change({ color1 })} begin={begin} end={end} />
                {s.background === "gradient" && <>
                  <ColorChip label="End color" value={s.color2} onChange={color2 => change({ color2 })} begin={begin} end={end} />
                  <IconButton label="Swap colors" icon={ArrowDataTransferHorizontalIcon} onClick={() => change({ color1: s.color2, color2: s.color1 })} />
                </>}
              </div>
            </div>
            {s.background === "gradient" && slider("angle", "Angle", 0, 360, "°")}
          </section>
        </div>

        <footer className="panel-footer">
          <button type="button" className="button secondary" title="Copy image (⌘C)" disabled={!doc.asset || cropping || exporting} onClick={() => void copy()}>
            <span className="t-icon-swap" data-state={copied ? "b" : "a"}>
              <span className="t-icon" data-icon="a"><Icon icon={Copy01Icon} /></span>
              <span className="t-icon" data-icon="b"><Icon icon={Tick02Icon} /></span>
            </span>Copy
          </button>
          <div className="anchor split">
            <button type="button" className="button primary split-main" title="Download (⌘S)" disabled={!doc.asset || cropping || exporting} onClick={() => void download()}>Download {FORMAT_LABEL[format]}</button>
            <button type="button" className="button primary split-toggle" aria-label="Download options" disabled={!doc.asset || cropping} data-menu-trigger aria-expanded={menu === "export"} onClick={() => toggleMenu("export")}><Icon icon={ArrowDown01Icon} size={14} /></button>
            <Menu open={menu === "export"} onClose={closeMenu} label="Download options" origin="bottom-right">
              <div className="row"><span className="row-label">Format</span>
                <Segmented label="Format" value={format} onChange={setFormat} options={[{ value: "png", label: "PNG" }, { value: "jpeg", label: "JPG" }, { value: "webp", label: "WebP" }]} /></div>
              <div className="row"><span className="row-label">Scale</span>
                <Segmented label="Scale" value={String(exportScale) as Scale} onChange={setScaleChoice} options={[{ value: "1", label: "1×" }, { value: "2", label: "2×" }, { value: "3", label: "3×" }]} /></div>
              <p className="menu-meta num">{dims.width * exportScale} × {dims.height * exportScale} px</p>
            </Menu>
          </div>
        </footer>
      </aside>
    </main>

    <div className="toast-layer"><div className={`toast t-toast ${toast.open ? "is-open" : ""}`} role="status" aria-live="polite">{toast.text}</div></div>
  </div>;
}
