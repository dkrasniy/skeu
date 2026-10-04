"use client";

import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { Dialog, fitTo } from "./dialog";
import { ExportArt, FrameArt, TiltArt } from "./landing";
import { MorphText } from "./morph-text";
import "@/styles/landing.css";

// "How it works": a few slides in a dialog. The dialog opens like the transitions.dev modal, slides move
// with its page slide (forward goes left, back goes right), and the box grows or shrinks to each slide's height.
// The close button, dots and footer stay put while the slides change.

const KEYS = (keys: string[]) => keys.map(key => <kbd key={key}>{key}</kbd>);

const SLIDES: { title: string; text: string; art?: ReactNode; extra?: ReactNode }[] = [
  {
    title: "Add a screenshot",
    text: "Bring in an image any of three ways. It stays on your device.",
    extra: <dl className="how-list">
      <div><dt>Drop it</dt><dd>onto the canvas</dd></div>
      <div><dt>Paste it</dt><dd>{KEYS(["⌘", "V"])}</dd></div>
      <div><dt>Choose a file</dt><dd>{KEYS(["⌘", "O"])}</dd></div>
    </dl>,
  },
  {
    title: "Give it a style",
    text: "Pick a frame, a shadow and a background. The canvas updates as you go.",
    art: <FrameArt />,
  },
  {
    title: "Tilt it and place it",
    text: "Drag the tilt pad to angle it in 3D, or rotate it. The position grid snaps it to an edge or a corner, and Crop trims the image itself.",
    art: <TiltArt />,
  },
  {
    title: "Copy or download",
    text: "Copy it straight into a post or a doc, or download a PNG, JPG or WebP at up to 3×.",
    art: <ExportArt />,
    extra: <dl className="how-list">
      <div><dt>Copy</dt><dd>{KEYS(["⌘", "C"])}</dd></div>
      <div><dt>Download</dt><dd>{KEYS(["⌘", "S"])}</dd></div>
      <div><dt>Undo</dt><dd>{KEYS(["⌘", "Z"])}</dd></div>
    </dl>,
  },
];

export function HowItWorks({ open, onClose }: { open: boolean; onClose: () => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  // The box takes the current slide's height: instantly as it opens, animated between slides.
  useLayoutEffect(() => {
    const box = viewport.current;
    const slide = box?.children[index] as HTMLElement | undefined;
    if (box && slide) return fitTo(box, slide);
  }, [index]);

  const go = (to: number) => setIndex(Math.max(0, Math.min(SLIDES.length - 1, to)));
  const reset = useCallback(() => { setIndex(0); viewport.current?.style.removeProperty("height"); }, []);

  return <Dialog open={open} onClose={onClose} onClosed={reset} labelledBy="how-title" className="how"
    onKeyDown={e => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
    }}>
    <div ref={viewport} className="how-slides t-page-slide t-resize">
      {SLIDES.map((slide, i) => <section key={slide.title} className="how-slide t-page" data-pos={i < index ? "before" : i > index ? "after" : "current"}
        inert={i !== index} aria-hidden={i !== index}>
        {slide.art && <div className="how-art" aria-hidden="true">{slide.art}</div>}
        <h2 id={i === index ? "how-title" : undefined}>{slide.title}</h2>
        <p>{slide.text}</p>
        {slide.extra}
      </section>)}
    </div>
    <footer className="how-foot">
      <button type="button" className="button ghost how-back" disabled={index === 0} onClick={() => go(index - 1)}>Back</button>
      <div className="how-dots" aria-label={`Step ${index + 1} of ${SLIDES.length}`} role="img">
        {SLIDES.map((slide, i) => <i key={slide.title} className={i === index ? "on" : undefined} />)}
      </div>
      <button type="button" className="button primary how-next" data-autofocus onClick={() => last ? onClose() : go(index + 1)}>
        <MorphText text={last ? "Done" : "Next"} />
      </button>
    </footer>
  </Dialog>;
}
