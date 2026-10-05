import Link from "next/link";
import type { ReactNode } from "react";
import { Arrow, Button } from "@/components/button";
import "@/styles/landing.css";

// The home page: what Skeu does, in words search engines and AI assistants can read.
// The pictures are simplified drawings of the real controls, not screenshots, so they never go stale.

export const FAQ: { question: string; answer: string }[] = [
  { question: "Is Skeu free?", answer: "Yes. There’s no account, no watermark and no limit on how many screenshots you make." },
  { question: "Are my screenshots uploaded?", answer: "No. Your image is opened and drawn in your browser and never leaves your device. Skeu remembers your style for next time; the image is cleared when you leave." },
  { question: "What can I export?", answer: "PNG, JPG or WebP at 1×, 2× or 3× resolution, or a copy straight to the clipboard to paste into Slack, Figma or a doc." },
  { question: "Which images can I open?", answer: "PNG, JPG, WebP, AVIF and GIF up to 30 MB. Drop one on the page, paste it with ⌘V, or choose a file." },
  { question: "Does it work on a phone?", answer: "Yes. The canvas stays at the top while you scroll through the controls, and you can pinch it to scale the screenshot." },
];

const FEATURES: { title: string; text: string; art: ReactNode }[] = [
  {
    title: "Frames, shadows and backgrounds",
    text: "Put your screenshot in a light or dark window, lift it off the page with a soft shadow, and set it on a gradient or any color you like.",
    art: <FrameArt />,
  },
  {
    title: "Tilt it in 3D",
    text: "Drag the tilt pad to angle the screenshot toward the viewer. Rotate it, or snap it to an edge or a corner of the canvas.",
    art: <TiltArt />,
  },
  {
    title: "Crop that finds the edges",
    text: "Trim the image without leaving the editor. Crop edges snap to straight lines, so a browser’s address bar comes off cleanly.",
    art: <CropArt />,
  },
  {
    title: "Copy or download in one click",
    text: "Export a PNG, JPG or WebP at up to 3× resolution, or copy it straight to the clipboard.",
    art: <ExportArt />,
  },
];

export function Landing() {
  return <div className="landing">
    <nav className="landing-nav">
      <Link href="/about" className="landing-brand"><img src="/logo.svg" alt="" width={24} height={24} />Skeu</Link>
      <Button href="/" variant="primary" size="large" arrow>Open editor</Button>
    </nav>

    <main>
      <header className="landing-hero">
        <h1>Make beautiful screenshots</h1>
        <p>Drop in a screenshot, choose a frame, a background and a shadow, and copy or download it for a post, a doc or a slide. It all happens in your browser.</p>
        <Button href="/" variant="primary" size="large" arrow>Open editor</Button>
      </header>

      <div className="features">
        {FEATURES.map(feature => <article key={feature.title} className="feature">
          <div className="feature-text">
            <h2>{feature.title}</h2>
            <p>{feature.text}</p>
          </div>
          <div className="feature-art" aria-hidden="true">{feature.art}</div>
        </article>)}
      </div>

      <section className="faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Questions</h2>
        <dl>
          {FAQ.map(({ question, answer }) => <div key={question}><dt>{question}</dt><dd>{answer}</dd></div>)}
        </dl>
      </section>
    </main>

    <footer className="landing-foot">
      <span>© 2026 Skeu</span>
      <Link href="/" className="landing-foot-link t-learn">Open editor<Arrow /></Link>
    </footer>
  </div>;
}

function Window({ className = "" }: { className?: string }) {
  return <div className={`art-window ${className}`}>
    <div className="art-window-bar"><i /><i /><i /></div>
    <div className="art-window-body">
      <div className="art-side"><b /><b /><b /><b /></div>
      <div className="art-main"><b className="wide" /><b /><b /><b className="short" /><b /></div>
    </div>
  </div>;
}

function FrameArt() {
  return <div className="art-canvas art-frame"><Window /></div>;
}

function TiltArt() {
  return <>
    <div className="art-canvas art-tilt"><Window className="is-tilted" /></div>
    <div className="art-card art-tilt-card">
      <span className="art-label">Tilt</span>
      <span className="art-pad"><i /></span>
    </div>
  </>;
}

function CropArt() {
  return <div className="art-crop">
    <div className="art-shot">
      <div className="art-shot-bar"><i /><i /><i /><span /></div>
      <div className="art-main"><b className="wide" /><b /><b /><b className="short" /><b /><b /></div>
    </div>
    <div className="art-crop-rect"><i className="nw" /><i className="n" /><i className="ne" /><i className="e" /><i className="se" /><i className="s" /><i className="sw" /><i className="w" /></div>
    <div className="art-snap" />
    <div className="art-crop-size">1600 × 919</div>
  </div>;
}

// The burst that fires on download, caught mid-flight.
const CONFETTI = ["#6f86ff", "#9b78f2", "#f08bbd", "#ffbd44", "#00c84e", "#ff625a"];
const PIECES = [[-62, -38, 20], [-30, -64, -35], [8, -58, 50], [44, -70, 15], [78, -44, -20], [-80, 6, 65], [96, -10, 30], [24, -86, -60]];

function ExportArt() {
  return <div className="art-card art-export">
    <div className="art-row"><span className="art-label">Format</span>
      <span className="art-seg"><span className="on">PNG</span><span>JPG</span><span>WebP</span></span></div>
    <div className="art-row"><span className="art-label">Scale</span>
      <span className="art-seg"><span>1×</span><span className="on">2×</span><span>3×</span></span></div>
    <div className="art-foot">
      <span className="art-button">Copy</span>
      <span className="art-button dark">Download PNG
        {PIECES.map(([x, y, r], i) => <i key={i} className="art-confetti" style={{ background: CONFETTI[i % CONFETTI.length], transform: `translate(${x}px, ${y}px) rotate(${r}deg)` }} />)}
      </span>
    </div>
  </div>;
}
