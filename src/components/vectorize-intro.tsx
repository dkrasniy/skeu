"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "./button";
import "@/styles/landing.css";
import { createEngine, DEFAULT_VECTOR_SETTINGS, fromDrawable, loadTracer, renderSample, type Sample, SAMPLES, traceOptions } from "@/lib/vectorize";

// The first screen of /vectorize. It shows what the tool does with a real trace: the logo sample at a small size,
// blown up so its pixels show on the left, and its vector on the right. Picking a sample hands its picture to the
// workspace, which grows it into the canvas (see Vectorizer).

const DEMO = SAMPLES[0];
const DEMO_SCALE = 0.5; // traced from a half-size copy, so the raster side is visibly blocky

export function VectorizeIntro({ leaving, onChoose, onSample }: { leaving: boolean; onChoose: () => void; onSample: (s: Sample, from: DOMRect | null) => void }) {
  return <div className="vec-intro" data-leaving={leaving || undefined} inert={leaving}>
    <nav className="landing-nav">
      <Link href="/" className="landing-brand"><img src="/logo.svg" alt="" width={24} height={24} />Skeu</Link>
      <Button href="/" variant="ghost">Screenshot editor</Button>
    </nav>
    <header className="vec-hero">
      <h1>Turn an image into an SVG</h1>
      <p>Trace a PNG or JPEG into shapes you can scale to any size, recolor and edit. It runs in your browser, so the image never leaves your device.</p>
      <div className="vec-hero-actions">
        <Button variant="primary" size="large" onClick={onChoose}>Choose image</Button>
        <span className="vec-hero-hint">or drop one anywhere, or paste with ⌘V</span>
      </div>
    </header>
    <Demo />
    <section className="vec-samples-section" aria-labelledby="vec-samples-title">
      <h2 id="vec-samples-title">Or start from a sample</h2>
      <div className="vec-samples">{SAMPLES.map(s => <SampleTile key={s.id} sample={s} onPick={onSample} />)}</div>
    </section>
  </div>;
}

function SampleTile({ sample, onPick }: { sample: Sample; onPick: (s: Sample, from: DOMRect | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const src = renderSample(sample), c = ref.current!;
    c.width = src.width; c.height = src.height;
    c.getContext("2d")!.drawImage(src, 0, 0);
  }, [sample]);
  return <button type="button" className="vec-sample" onClick={() => onPick(sample, ref.current?.getBoundingClientRect() ?? null)}>
    <span className="vec-sample-art"><canvas ref={ref} data-pixel={sample.pixel || undefined} /></span>
    <span className="vec-sample-name">{sample.name}</span>
    <span className="vec-sample-detail">{sample.detail}</span>
  </button>;
}

// Raster on the left of the divider, vector on the right. Once the trace is in, the divider sweeps from the right
// edge to the middle, once. Moving a pointer over the picture moves the divider with it; leaving lets it glide back.
function Demo() {
  const raster = useRef<HTMLCanvasElement>(null);
  const [svg, setSvg] = useState("");
  const [split, setSplit] = useState(1);
  const tween = useRef(0);
  const splitRef = useRef(1);
  useLayoutEffect(() => { splitRef.current = split; });

  useEffect(() => {
    const full = renderSample(DEMO);
    const small = document.createElement("canvas");
    small.width = Math.round(DEMO.w * DEMO_SCALE); small.height = Math.round(DEMO.h * DEMO_SCALE);
    const ctx = small.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(full, 0, 0, small.width, small.height);
    const c = raster.current!;
    c.width = small.width; c.height = small.height;
    c.getContext("2d")!.drawImage(small, 0, 0);

    const image = fromDrawable(small, small.width, small.height, DEMO.file);
    const engine = createEngine();
    let alive = true;
    Promise.all([loadTracer(), engine.run(image.pixels, image.w, image.h, traceOptions(DEFAULT_VECTOR_SETTINGS, image), () => {})])
      .then(([vt, res]) => { if (alive) setSvg(vt.compose(res, null, { bare: true })); })
      .catch(() => {});
    return () => { alive = false; engine.cancel(); };
  }, []);

  const glide = (to: number, ms: number) => {
    cancelAnimationFrame(tween.current);
    const from = splitRef.current;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setSplit(to); return; }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setSplit(from + (to - from) * (1 - Math.pow(1 - t, 4)));
      if (t < 1) tween.current = requestAnimationFrame(step);
    };
    tween.current = requestAnimationFrame(step);
  };
  useEffect(() => {
    if (!svg) return;
    const timer = setTimeout(() => glide(0.5, 620), 250);
    return () => { clearTimeout(timer); cancelAnimationFrame(tween.current); };
  }, [svg]);

  return <figure className="vec-demo" aria-label="The logo sample as a small raster image, beside its traced vector">
    <div className="vec-demo-picture"
      onPointerMove={e => { if (!svg || e.pointerType !== "mouse") return; cancelAnimationFrame(tween.current); const r = e.currentTarget.getBoundingClientRect(); setSplit(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))); }}
      onPointerLeave={() => { if (svg) glide(0.5, 420); }}>
      <canvas ref={raster} aria-hidden="true" />
      {svg && <div className="vec-demo-vector" style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }} dangerouslySetInnerHTML={{ __html: svg }} />}
      <span className="vec-demo-divider" data-on={!!svg || undefined} style={{ left: `${split * 100}%` }} />
    </div>
    <figcaption>
      <span>Original, 180 × 120 px</span>
      <span>Vector, any size</span>
    </figcaption>
  </figure>;
}
