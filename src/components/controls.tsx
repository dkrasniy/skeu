"use client";

import { type ComponentProps, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { TILT_MAX } from "@/lib/editor-state";

// A duration token in ms. The CSS build rewrites "150ms" as ".15s", so both units are read.
export function cssDuration(name: string, fallback: number) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(value);
  if (Number.isNaN(n)) return fallback;
  return value.endsWith("ms") ? n : value.endsWith("s") ? n * 1000 : n;
}

export function Icon({ icon, size = 16 }: { icon: IconSvgElement; size?: 14 | 16 | 18 | 20 }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.8} color="currentColor" aria-hidden="true" />;
}

export function IconButton({ label, icon, onClick, disabled }: { label: string; icon: IconSvgElement; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="icon-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}><Icon icon={icon} /></button>;
}

// Moves the pill under the selected tab. Without `animate` it jumps there (first paint, resizes).
function placePill(root: HTMLElement, animate: boolean) {
  const pill = root.querySelector<HTMLElement>(".t-tabs-pill");
  const tab = root.querySelector<HTMLElement>('[aria-selected="true"]');
  if (!pill || !tab) return;
  const prev = pill.style.transition;
  if (!animate) pill.style.transition = "none";
  pill.style.transform = `translateX(${tab.offsetLeft}px)`;
  pill.style.width = `${tab.offsetWidth}px`;
  if (!animate) { void pill.offsetWidth; pill.style.transition = prev; }
}

// The one tab switcher (frame, background, format, scale...): transitions.dev "Tabs sliding". Use it for any
// new choice of a few options so the pill always slides. JS measures the selected tab; CSS tweens the pill.
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const painted = useRef(false);
  useLayoutEffect(() => {
    if (bar.current) placePill(bar.current, painted.current);
    painted.current = true;
  }, [value]);
  // One observer for the component's life. Its first call fires right after observe(); skipping it matters,
  // since a jump then would cancel the slide that a selection just started.
  useEffect(() => {
    const root = bar.current;
    if (!root) return;
    let first = true;
    const observer = new ResizeObserver(() => { if (first) first = false; else placePill(root, false); });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  return <div ref={bar} className="t-tabs segmented" role="tablist" aria-label={label}>
    <span className="t-tabs-pill" aria-hidden="true" />
    {options.map(o => <button type="button" role="tab" key={o.value} className="t-tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
  </div>;
}

interface SliderProps { label: string; value: number; min: number; max: number; reset: number; onChange: (n: number) => void; begin: () => void; end: () => void; id?: string }

export function Slider({ label, value, min, max, reset, onChange, begin, end, id }: SliderProps) {
  return <input id={id} aria-label={id ? undefined : label} className="slider" type="range" min={min} max={max} value={value} title="Double-click to reset"
    onPointerDown={begin} onPointerUp={end} onPointerCancel={end}
    onKeyDown={e => { if (!e.repeat) begin(); }} onKeyUp={end}
    onDoubleClick={() => onChange(reset)}
    onChange={e => onChange(Number(e.target.value))} />;
}

export function SliderRow({ unit = "", ...props }: SliderProps & { unit?: string }) {
  const id = useId();
  return <div className="row">
    <label className="row-label" htmlFor={id}>{props.label}<span className="row-value">{props.value}{unit}</span></label>
    <Slider {...props} id={id} />
  </div>;
}

const KNOB_TRAVEL = 6;   // px the knob can move inside the pad at full tilt
const DRAG_RANGE = 40;   // px of pointer travel for full tilt
const STRETCH = 7;       // px the knob can be pulled past its travel
const SNAP = Math.tan(8 * Math.PI / 180); // within 8° of straight up, down, left or right, the tilt goes exactly there
// Focus so arrow keys work after a drag, without the keyboard ring (focusVisible isn't in the DOM types yet).
const POINTER_FOCUS = { preventScroll: true, focusVisible: false };
type Side = "up" | "down" | "left" | "right";
const SNAP_DOT: Record<Side, string> = { up: "0 -22px", down: "0 22px", left: "-22px 0", right: "22px 0" };

// The pad is small, so drag distance (not pointer position) sets the tilt. Past full tilt
// the knob keeps following with growing resistance, then eases back on release.
function knobOffset(tiltX: number, tiltY: number, overshoot = 0) {
  const px = tiltY / TILT_MAX, py = -tiltX / TILT_MAX;
  const r = Math.hypot(px, py);
  if (!r) return { x: 0, y: 0 };
  const reach = Math.min(r, 1) * KNOB_TRAVEL + STRETCH * (1 - 1 / (overshoot / 30 + 1));
  return { x: px / r * reach, y: py / r * reach };
}

export function TiltPad({ x, y, onChange, begin, end }: { x: number; y: number; onChange: (tiltX: number, tiltY: number) => void; begin: () => void; end: () => void }) {
  const grab = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(null);
  const [overshoot, setOvershoot] = useState<number | null>(null);
  const [snapped, setSnapped] = useState<Side | null>(null);
  // The dot fades out where it was, so the last side outlives the snap.
  const [dotSide, setDotSide] = useState<Side>("up");
  const shown = knobOffset(x, y, overshoot ?? 0);

  function track(e: ReactPointerEvent<HTMLDivElement>) {
    const g = grab.current;
    if (!g) return;
    if (!(e.buttons & 1)) { release(); return; }
    // Pointer travel in tilt units, starting from the tilt at grab time.
    const ty = g.y + (e.clientX - g.clientX) / DRAG_RANGE * TILT_MAX;
    const tx = g.x - (e.clientY - g.clientY) / DRAG_RANGE * TILT_MAX;
    const r = Math.hypot(tx, ty), k = r > TILT_MAX ? TILT_MAX / r : 1;
    let nx = tx * k, ny = ty * k, side: Side | null = null;
    if (Math.abs(ny) < Math.abs(nx) * SNAP) { ny = 0; side = nx > 0 ? "up" : "down"; }
    else if (Math.abs(nx) < Math.abs(ny) * SNAP) { nx = 0; side = ny > 0 ? "right" : "left"; }
    if (Math.hypot(nx, ny) < 1) side = null;
    if (side && side !== snapped) { setDotSide(side); navigator.vibrate?.(8); }
    setSnapped(side);
    onChange(Math.round(nx), Math.round(ny));
    setOvershoot(Math.max(0, (r - TILT_MAX) / TILT_MAX * DRAG_RANGE));
  }
  function release() {
    if (!grab.current) return;
    grab.current = null;
    setOvershoot(null);
    setSnapped(null);
    end();
  }

  return <div className={`tilt-pad ${overshoot !== null ? "is-moving" : ""}`} role="group" tabIndex={0}
    aria-label={`Tilt, ${x}° by ${y}°`} title="Drag to tilt. Arrow keys nudge. Double-click to reset."
    onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.focus(POINTER_FOCUS); e.currentTarget.setPointerCapture(e.pointerId); begin(); grab.current = { clientX: e.clientX, clientY: e.clientY, x, y }; setOvershoot(0); }}
    onPointerMove={track} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
    onDoubleClick={() => onChange(0, 0)}
    onKeyDown={e => {
      const d = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      if (!d && e.key !== "Home") return;
      e.preventDefault();
      if (!e.repeat) begin();
      if (!d) onChange(0, 0);
      else onChange(Math.max(-TILT_MAX, Math.min(TILT_MAX, x + d[0])), Math.max(-TILT_MAX, Math.min(TILT_MAX, y + d[1])));
    }} onKeyUp={end}>
    <span className="tilt-knob" style={{ transform: `translate(${shown.x}px, ${shown.y}px)` }} />
    <span className={`tilt-snap ${snapped ? "is-on" : ""}`} style={{ translate: SNAP_DOT[dotSide] }} aria-hidden="true" />
  </div>;
}

const ANCHORS = [-1, 0, 1].flatMap(row => [-1, 0, 1].map(col => ({ row, col })));
const ANCHOR_NAMES = [["top left", "top", "top right"], ["left", "center", "right"], ["bottom left", "bottom", "bottom right"]];

export function PositionGrid({ x, y, reach, onChange }: { x: number; y: number; reach: { x: number; y: number }; onChange: (x: number, y: number) => void }) {
  // When anchors coincide (no room to move, or no image yet), the center dot wins.
  const matches = ANCHORS.flatMap(({ row, col }, i) => Math.abs(x - col * reach.x) < .5 && Math.abs(y - row * reach.y) < .5 ? [i] : []);
  const selected = matches.includes(4) ? 4 : matches[0];
  return <div className="position-grid" role="group" aria-label="Position">
    {ANCHORS.map(({ row, col }, i) => {
      const ax = col * reach.x, ay = row * reach.y;
      const active = i === selected;
      return <button type="button" key={`${row}${col}`} className="position-dot" aria-pressed={active} aria-label={`Move to ${ANCHOR_NAMES[row + 1][col + 1]}`}
        title={ANCHOR_NAMES[row + 1][col + 1]} onClick={() => onChange(ax, ay)}><span /></button>;
    })}
  </div>;
}

export function ColorChip({ label, value, onChange, begin, end }: { label: string; value: string; onChange: (hex: string) => void; begin: () => void; end: () => void }) {
  return <label className="color-chip" style={{ background: value }} title={`${label} ${value.toUpperCase()}`}>
    <input type="color" aria-label={label} value={value} onFocus={begin} onBlur={end} onChange={e => onChange(e.target.value)} />
  </label>;
}

// transitions.dev "Menu dropdown": .is-open to show, .is-closing for the faster exit.
export function Menu({ open, onClose, label, origin, className = "", children }: { open: boolean; onClose: () => void; label: string; origin: "top-left" | "top-right" | "bottom-right"; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const pointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!node?.contains(target) && !target.closest("[data-menu-trigger]")) onClose();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", pointer);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", pointer); };
  }, [open, onClose]);

  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) return;
    const start = requestAnimationFrame(() => setClosing(true));
    const timer = setTimeout(() => setClosing(false), cssDuration("--dropdown-close-dur", 150));
    return () => { cancelAnimationFrame(start); clearTimeout(timer); setClosing(false); };
  }, [open]);

  return <div ref={ref} role="dialog" aria-label={label} inert={!open} data-origin={origin}
    className={`menu t-dropdown ${origin} ${className} ${open ? "is-open" : closing ? "is-closing" : ""}`}>{children}</div>;
}

type HandleEvents = Pick<ComponentProps<"button">, "onPointerDown" | "onPointerMove" | "onPointerUp" | "onLostPointerCapture" | "onKeyDown" | "onKeyUp">;

// transitions.dev "Tooltip": the bubble is measured and placed while hidden, so only the appear animates.
export function ResizeHandle({ label, hint, active, ...events }: { label: string; hint: string; active: boolean } & HandleEvents) {
  const id = useId();
  const group = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const show = hovered && !active;

  function place(trigger: HTMLElement) {
    const g = group.current;
    const t = tip.current;
    const text = t?.firstElementChild;
    if (!g || !t || !text) return;
    const cs = getComputedStyle(t);
    const width = Math.ceil(text.scrollWidth + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight));
    // Right-aligned rather than centered: the handle sits in the canvas corner.
    const x = trigger.getBoundingClientRect().right - g.getBoundingClientRect().left - width;
    t.style.transition = "none";
    t.style.width = `${width}px`;
    t.style.setProperty("--tt-x", `${x}px`);
    void t.offsetWidth;
    t.style.transition = "";
    setHovered(true);
  }

  return <span ref={group} className="t-tt-group" onPointerLeave={() => setHovered(false)}>
    <button type="button" className="t-tt-trigger resize-grip" aria-label={label} aria-describedby={id}
      onPointerEnter={e => place(e.currentTarget)} onFocus={e => place(e.currentTarget)} onBlur={() => setHovered(false)} {...events} />
    <span ref={tip} id={id} className="t-tt" role="tooltip" aria-hidden={!show} data-show={show}><span className="t-tt-text">{hint}</span></span>
  </span>;
}
