"use client";

import { type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { type Asset, type Rect, clamp, visibleRect } from "@/lib/editor-state";

type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const EDGES: Edge[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const MIN_SIZE = 32;

export function CropEditor({ asset, onApply, onCancel }: { asset: Asset; onApply: (crop: Rect | null) => void; onCancel: () => void }) {
  const [rect, setRect] = useState<Rect>(() => visibleRect(asset));
  const [scale, setScale] = useState(0);
  const box = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter") { e.preventDefault(); onApply(whole ? null : rect); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onApply, onCancel, rect, whole]);

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
    const dx = (e.clientX - d.clientX) / scale, dy = (e.clientY - d.clientY) / scale;
    const s = d.start;
    let { x, y, width, height } = s;
    if (d.edge === "move") {
      x = clamp(s.x + dx, 0, asset.width - s.width);
      y = clamp(s.y + dy, 0, asset.height - s.height);
    } else {
      if (d.edge.includes("w")) { x = clamp(s.x + dx, 0, s.x + s.width - MIN_SIZE); width = s.x + s.width - x; }
      if (d.edge.includes("e")) width = clamp(s.width + dx, MIN_SIZE, asset.width - s.x);
      if (d.edge.includes("n")) { y = clamp(s.y + dy, 0, s.y + s.height - MIN_SIZE); height = s.y + s.height - y; }
      if (d.edge.includes("s")) height = clamp(s.height + dy, MIN_SIZE, asset.height - s.y);
    }
    setRect({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
  }

  return <div ref={box} className="crop">
    {scale > 0 && <>
      <div className="crop-image" style={{ width: asset.width * scale, height: asset.height * scale }}>
        <img src={asset.src} alt={asset.name} draggable={false} />
        <div className="crop-shade"><i style={{ left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale }} /></div>
        <div className="crop-rect" style={{ left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale }}
          onPointerDown={e => grab("move", e)} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
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
