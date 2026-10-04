"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "./button";
import { useConfetti } from "./confetti";
import { Dialog } from "./dialog";
import { MorphText } from "./morph-text";

// "How it works": four steps in a dialog. Every step shows the same screenshot, so the picture above the text is one
// scene that changes shape instead of four pictures: the plain screenshot gets a background and a window bar, tilts,
// then shrinks to a thumbnail while the export card grows out from behind it. The text below dissolves (old fades out
// in place, new fades in from .97). Every step has the same shape of text, and all four share one area sized to the
// tallest, so the height never changes and Next stays under your pointer. The close button, dots and footer stay put.

const LEAVE_MS = 150;

// Same shape for every step: a title, about two lines, and one small line for a shortcut or a tip.
const STEPS: { title: string; text: string; note: string }[] = [
  { title: "Add a screenshot", text: "Drop it on the canvas, paste it or choose a file. It never leaves your device.", note: "⌘V pastes, ⌘O opens a file." },
  { title: "Give it a style", text: "Pick a frame, a background and a shadow. The canvas updates as you go.", note: "Your style is kept for next time." },
  { title: "Tilt it and place it", text: "Drag the tilt pad to angle it in 3D, rotate it, or snap it to an edge or a corner.", note: "Crop trims the image itself." },
  { title: "Copy or download", text: "Copy it into a post or a doc, or download a PNG, JPG or WebP at up to 3×.", note: "⌘C copies, ⌘S downloads." },
];

export function HowItWorks({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const finishing = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [confetti, celebrate] = useConfetti();
  const last = index === STEPS.length - 1;

  // Done: a burst from the button, then close once the pieces have peaked. Reduced motion skips straight to closing.
  function finish() {
    if (finishing.current) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { onClose(); return; }
    celebrate();
    finishing.current = setTimeout(() => { finishing.current = undefined; onClose(); }, 800);
  }

  function go(to: number) {
    const next = Math.max(0, Math.min(STEPS.length - 1, to));
    if (next === index) return;
    setLeaving(index);
    setIndex(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLeaving(null), LEAVE_MS);
  }

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    clearTimeout(finishing.current);
    finishing.current = undefined;
    setIndex(0);
    setLeaving(null);
  }, []);

  return <Dialog open={open} onClose={onClose} onClosed={reset} labelledBy="how-title" className="how"
    onKeyDown={e => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
    }}>
    <Scene step={index} />
    <div className="how-text">
      {STEPS.map((step, i) => <section key={step.title} className={i === index ? `is-current ${leaving !== null ? "dissolve-in" : ""}` : i === leaving ? "dissolve-out" : undefined}
        inert={i !== index} aria-hidden={i !== index}>
        <h2 id={i === index ? "how-title" : undefined}>{step.title}</h2>
        <p>{step.text}</p>
        <p className="how-note">{step.note}</p>
      </section>)}
    </div>
    <footer className="how-foot">
      <div className="how-dots" role="img" aria-label={`Step ${index + 1} of ${STEPS.length}`}>
        {STEPS.map((step, i) => <i key={step.title} className={i === index ? "on" : undefined} />)}
      </div>
      <div className="how-actions">
        <Button size="large" rounded={false} disabled={index === 0} onClick={() => go(index - 1)}>Back</Button>
        <div className="anchor">
          {confetti}
          <Button variant="primary" size="large" rounded={false} data-autofocus onClick={() => last ? finish() : go(index + 1)}>
            <MorphText text={last ? "Done" : "Next"} />
          </Button>
        </div>
      </div>
    </footer>
  </Dialog>;
}

// One drawing for all four steps; CSS moves its pieces by data-step. The screenshot is the hub everything flows through.
function Scene({ step }: { step: number }) {
  return <div className="how-scene" data-step={step} aria-hidden="true">
    <div className="how-canvas">
      <div className="how-bg" />
      <div className="how-window">
        <div className="how-window-bar"><i /><i /><i /></div>
        <div className="how-window-body">
          <div className="how-side"><b /><b /><b /></div>
          <div className="how-main"><b className="wide" /><b /><b /><b className="short" /></div>
        </div>
      </div>
    </div>
    <span className="how-paste"><kbd>⌘</kbd><kbd>V</kbd></span>
    <div className="how-tilt"><span className="how-pad"><i /></span></div>
    <div className="how-export">
      <div className="how-seg"><span className="on">PNG</span><span>JPG</span><span>WebP</span></div>
      <div className="how-seg"><span>1×</span><span className="on">2×</span><span>3×</span></div>
      <span className="how-download">Download</span>
    </div>
  </div>;
}
