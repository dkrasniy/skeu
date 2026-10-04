"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useRef } from "react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { cssDuration, Icon } from "./controls";

// The one dialog: a native <dialog> (top layer, focus kept inside) that opens and closes like the transitions.dev
// modal. Escape, the close button and a click outside all close it. `onClosed` runs once it has gone, to reset
// what's inside. On open, focus goes to the element marked data-autofocus, except on touch screens, where there's no
// keyboard to move it and a ring would only look like a stray selection: there the dialog itself takes focus.
export function Dialog({ open, onClose, onClosed, labelledBy, className = "", onKeyDown, children }: {
  open: boolean;
  onClose: () => void;
  onClosed?: () => void;
  labelledBy: string;
  className?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLDialogElement>) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closed = useRef(onClosed);
  useEffect(() => { closed.current = onClosed; }, [onClosed]);

  // Open: into the top layer first, then the class that starts the transition. Close: the exit, then out.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
      d.classList.remove("is-closing");
      void d.offsetWidth;
      d.classList.add("is-open");
      const start = touch() ? d : d.querySelector<HTMLElement>("[data-autofocus]") ?? d;
      start.focus({ preventScroll: true });
      return;
    }
    if (!d.open) return;
    d.classList.remove("is-open");
    d.classList.add("is-closing");
    const timer = setTimeout(() => { d.close(); d.classList.remove("is-closing"); closed.current?.(); }, cssDuration("--modal-close-dur", 150));
    return () => clearTimeout(timer);
  }, [open]);

  return <dialog ref={ref} className={`dialog t-modal ${className}`} aria-labelledby={labelledBy} tabIndex={-1}
    onCancel={e => { e.preventDefault(); onClose(); }}
    onClose={() => { if (open) onClose(); }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    onKeyDown={e => {
      // Escape is handled here so the close animates; the browser's own close request would skip it.
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else onKeyDown?.(e);
    }}>
    <div className="dialog-box">
      <button type="button" className="icon-button dialog-close" aria-label="Close" onClick={onClose}><Icon icon={Cancel01Icon} /></button>
      {children}
    </div>
  </dialog>;
}

// Sizes `box` to `content` and keeps it there as the content changes. The first size after the box was cleared
// (style emptied, as on close) lands instantly because `auto` doesn't animate; later ones animate.
export function fitTo(box: HTMLElement, content: HTMLElement, width = false) {
  const fit = () => {
    if (!content.offsetHeight) return;
    box.style.height = `${content.offsetHeight}px`;
    if (width) box.style.width = `${content.offsetWidth}px`;
  };
  const observer = new ResizeObserver(fit);
  observer.observe(content);
  return () => observer.disconnect();
}

// Touch screens: there's no keyboard to move focus, so nothing gets focused (and ringed) on its own.
export const touch = () => matchMedia("(pointer: coarse)").matches;
