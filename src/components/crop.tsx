"use client";

import { type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { type Asset, type Rect, clamp, visibleRect } from "@/lib/editor-state";
import { type Edges, findEdges, snapTo } from "@/lib/edges";

type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const EDGES: Edge[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const MIN_SIZE = 32;
const SNAP = 6; // screen pixels; hold ⇧, ⌃, ⌥ or ⌘ to drag freely

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

// The crop view grows out of the screenshot instead of replacing it. `from` is where the visible part of the image
// sits in the editor; the crop box starts exactly there and the cropped-away edges unfold around it. When `leaving`
// is set (the rect that will show), it flies back to `target()` and calls `onLeft`. Without a `from` (a tilted or
// rotated card, where the shapes don't line up) it dissolves instead.
export function CropEditor({ asset, from, leaving, target, onApply, onCancel, onLeft }: {
  asset: Asset;
  from: DOMRect | null;
  leaving: Rect | null;
  target: () => DOMRect | null;
  onApply: (crop: Rect | null) => void;
  onCancel: () => void;
  onLeft: () => void;
}) {
  const [rect, setRect] = useState<Rect>(() => visibleRect(asset));
  const [scale, setScale] = useState(0);
  const [edges, setEdges] = useState<Edges | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const box = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  const exit = useRef({ target, onLeft });
  useEffect(() => { exit.current = { target, onLeft }; }, [target, onLeft]);
  const drag = useRef<{ edge: Edge | "move"; clientX: number; clientY: number; start: Rect } | null>(null);
  const whole = rect.x === 0 && rect.y === 0 && rect.width === asset.width && rect.height === asset.height;
  const apply = () => onApply(whole ? null : rect);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min((el.clientWidth - 96) / asset.width, (el.clientHeight - 136) / asset.height, 1));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [asset.width, asset.height]);

  // In: from the screenshot's place in the editor (or a plain dissolve).
  useLayoutEffect(() => {
    const el = image.current;
    if (!el || !scale || entered.current) return;
    entered.current = true;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(from ? [frame(el, from, rect, scale), FULL] : DISSOLVE, { duration: 250, easing: EASE });
  }, [scale, from, rect]);

  // Out: back into the editor at the rect that will show. It waits a frame so the editor has re-fit the canvas to the
  // new crop before its spot is measured.
  useEffect(() => {
    const el = image.current;
    if (!leaving) return;
    if (!el || !scale || matchMedia("(prefers-reduced-motion: reduce)").matches) { exit.current.onLeft(); return; }
    let anim: Animation | undefined;
    const start = requestAnimationFrame(() => {
      const to = exit.current.target();
      anim = el.animate(to ? [FULL, frame(el, to, leaving, scale)] : [...DISSOLVE].reverse(), { duration: 220, easing: EASE, fill: "forwards" });
      anim.onfinish = () => exit.current.onLeft();
    });
    return () => { cancelAnimationFrame(start); anim?.cancel(); };
  }, [leaving, scale]);

  useEffect(() => {
    let live = true;
    findEdges(asset.src, asset.width, asset.height).then(found => { if (live) setEdges(found); }, () => { /* no snapping */ });
    return () => { live = false; };
  }, [asset.src, asset.width, asset.height]);

  useEffect(() => {
    if (leaving) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter") { e.preventDefault(); onApply(whole ? null : rect); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onApply, onCancel, rect, whole, leaving]);

  function grab(edge: Edge | "move", e: PointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { edge, clientX: e.clientX, clientY: e.clientY, start: rect };
  }

  // Edges move independently in source pixels; the opposite edge stays put.
  function move(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || !scale) return;
    if (!(e.buttons & 1)) { release(); return; }
    const dx = (e.clientX - d.clientX) / scale, dy = (e.clientY - d.clientY) / scale;
    const s = d.start;
    let { x, y, width, height } = s;
    const next = { x: null as number | null, y: null as number | null };
    // A dragged edge snaps to a nearby line in the image, so a sliver of address bar doesn't survive the crop.
    const snap = (value: number, axis: "x" | "y", side: "start" | "end") => {
      const free = e.shiftKey || e.ctrlKey || e.altKey || e.metaKey;
      const hit = free || !edges ? null : snapTo(value, axis === "x" ? edges.cols : edges.rows, side, SNAP / scale);
      if (hit !== null) next[axis] = hit;
      return hit ?? value;
    };
    if (d.edge === "move") {
      x = clamp(s.x + dx, 0, asset.width - s.width);
      y = clamp(s.y + dy, 0, asset.height - s.height);
    } else {
      if (d.edge.includes("w")) { x = clamp(snap(s.x + dx, "x", "start"), 0, s.x + s.width - MIN_SIZE); width = s.x + s.width - x; }
      if (d.edge.includes("e")) width = clamp(snap(s.x + s.width + dx, "x", "end"), s.x + MIN_SIZE, asset.width) - s.x;
      if (d.edge.includes("n")) { y = clamp(snap(s.y + dy, "y", "start"), 0, s.y + s.height - MIN_SIZE); height = s.y + s.height - y; }
      if (d.edge.includes("s")) height = clamp(snap(s.y + s.height + dy, "y", "end"), s.y + MIN_SIZE, asset.height) - s.y;
    }
    setRect({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
    setGuides(g => g.x === next.x && g.y === next.y ? g : next);
  }

  function release() {
    drag.current = null;
    setGuides({ x: null, y: null });
  }

  return <div ref={box} className={`crop ${leaving ? "is-leaving" : ""}`} inert={!!leaving}>
    {scale > 0 && <>
      <div ref={image} className="crop-image" style={{ width: asset.width * scale, height: asset.height * scale }}>
        <img src={asset.src} alt={asset.name} draggable={false} />
        <div className="crop-shade"><i style={{ left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale }} /></div>
        {guides.x !== null && <i className="crop-guide vertical" style={{ left: guides.x * scale }} />}
        {guides.y !== null && <i className="crop-guide horizontal" style={{ top: guides.y * scale }} />}
        <div className="crop-rect" style={{ left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale }}
          onPointerDown={e => grab("move", e)} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
          <i className="crop-thirds" />
          {EDGES.map(edge => <span key={edge} className={`crop-handle ${edge}`} onPointerDown={e => grab(edge, e)} />)}
        </div>
      </div>
      <div className="crop-bar">
        <span className="crop-size num">{rect.width} × {rect.height}</span>
        <button type="button" className="button ghost" disabled={whole} onClick={() => setRect({ x: 0, y: 0, width: asset.width, height: asset.height })}>Reset</button>
        <button type="button" className="button secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="button primary" onClick={apply}>Apply crop</button>
      </div>
    </>}
  </div>;
}

const FULL = { transform: "none", clipPath: "inset(0px 0px 0px 0px)" };
const DISSOLVE = [{ opacity: 0, transform: "scale(.97)" }, { opacity: 1, transform: "none" }];

// The transform and clip that put `r` (image pixels) of the crop view exactly over `screen`, with everything outside
// `r` clipped away. The element's transform origin is its top-left corner.
function frame(el: HTMLElement, screen: DOMRect, r: Rect, scale: number) {
  const box = el.getBoundingClientRect();
  const k = screen.width / (r.width * scale);
  const tx = screen.left - box.left - r.x * scale * k, ty = screen.top - box.top - r.y * scale * k;
  const clip = `inset(${r.y * scale}px ${box.width - (r.x + r.width) * scale}px ${box.height - (r.y + r.height) * scale}px ${r.x * scale}px)`;
  return { transform: `translate(${tx}px, ${ty}px) scale(${k})`, clipPath: clip };
}
