import Link from "next/link";
import { GithubIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { HOME_HREF } from "@/lib/returning";
import "@/styles/landing.css";

// The home page: what Skeu does, in words search engines and AI assistants can read.
// The pictures are simplified drawings of the real controls, not screenshots, so they never go stale.

const GITHUB = "https://github.com/dkrasniy/skeu";

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
      <Link href={HOME_HREF} className="landing-brand"><img src="/logo.svg" alt="" width={24} height={24} />Skeu</Link>
      <span className="landing-nav-actions">
        <a href={GITHUB} className="icon-button" aria-label="Skeu on GitHub" title="GitHub"><HugeiconsIcon icon={GithubIcon} size={20} strokeWidth={1.6} /></a>
        <Link href="/editor" className="button primary">Open editor</Link>
      </span>
    </nav>

    <main>
      <header className="landing-hero">
        <h1>Skeu is a free screenshot editor</h1>
        <p>Drop in a screenshot and give it a window frame, a shadow and a background in seconds. It runs in your browser: there’s no account, and nothing is uploaded.</p>
        <Link href="/editor" className="button primary">Open editor</Link>
      </header>

      <div className="landing-preview" aria-hidden="true"><EditorArt /></div>

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
      <span className="landing-foot-links"><a href={GITHUB}>GitHub</a><Link href="/editor">Open editor</Link></span>
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

function Slider({ label, value }: { label: string; value: number }) {
  return <div className="art-row"><span className="art-label">{label}</span>
    <span className="art-slider"><span style={{ width: `${value}%` }} /><i style={{ left: `${value}%` }} /></span></div>;
}

// The whole editor: canvas sheet on the left, the style panel on the right.
function EditorArt() {
  return <div className="art-editor">
    <div className="art-sheet art-editor-canvas">
      <div className="art-editor-bar"><img src="/logo.svg" alt="" width={20} height={20} /><b /><span className="art-editor-actions"><i /><i /><i /></span></div>
      <div className="art-canvas"><Window /></div>
    </div>
    <div className="art-sheet art-editor-panel">
      <span className="art-tray-title">Screenshot</span>
      <div className="art-tray">
        <div className="art-row"><span className="art-label">Frame</span><span className="art-seg"><span>None</span><span className="on">Light</span><span>Dark</span></span></div>
        <Slider label="Size" value={62} />
        <Slider label="Roundness" value={30} />
        <Slider label="Padding" value={0} />
        <Slider label="Shadow" value={40} />
      </div>
      <span className="art-tray-title">Position</span>
      <div className="art-tray">
        <Slider label="Rotate" value={50} />
      </div>
      <span className="art-tray-title">Background</span>
      <div className="art-tray">
        <div className="art-swatches">
          {["#b9cafa,#ebd1e6", "#e9cbff,#aba5ef", "#ffe2af,#ff9e9e", "#b2eee7,#9fbbef", "#f5f5bf,#a9e3c4", "#ffe0e6,#f8a5c1"].map((pair, i) =>
            <i key={pair} className={i === 0 ? "on" : ""} style={{ background: `linear-gradient(135deg, ${pair})` }} />)}
        </div>
      </div>
      <div className="art-foot"><span className="art-button">Copy</span><span className="art-button dark">Download PNG</span></div>
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
