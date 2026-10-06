// Study a screen recording frame by frame without ffmpeg: decodes the video in headless Chrome.
//
//   node frames.mjs scan  <video>                                  motion segments (when something moves, how long)
//   node frames.mjs sheet <video> <out.jpg> <times> [cols] [width] [crop]
//        times: "1.2,1.25,1.3" or a range "1.2-1.6@0.0167" (60fps); crop: "x,y,w,h" in video pixels
//
// Needs playwright-core (npm i playwright-core) and a Chrome; set CHROME to its binary if the default isn't found.
// .mov files Chrome can't decode: convert first with `avconvert -p PresetHighestQuality -s in.mov -o out.mp4` (macOS).
import { chromium } from "playwright-core";
import fs from "fs"; import os from "os"; import path from "path";

const [, , cmd, video, ...rest] = process.argv;
if (!cmd || !video) { console.error("usage: frames.mjs scan|sheet <video> ..."); process.exit(1); }

const defaultChrome = () => {
  const base = path.join(os.homedir(), "Library/Caches/ms-playwright");
  const dir = fs.existsSync(base) && fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
  return dir && path.join(base, dir, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
};
const browser = await chromium.launch({ args: ["--allow-file-access-from-files"], executablePath: process.env.CHROME || defaultChrome() });
const page = await browser.newPage();
const html = path.join(os.tmpdir(), "frames-" + process.pid + ".html");
fs.writeFileSync(html, `<video id=v muted src="file://${path.resolve(video)}"></video><canvas id=c></canvas>`);
await page.goto("file://" + html);
await page.evaluate(() => new Promise((res, rej) => { const v = document.getElementById("v"); if (v.readyState >= 2) res(); v.onloadeddata = res; v.onerror = () => rej(new Error("cannot decode video, code " + v.error?.code)); }));

const parseTimes = s => s.split(",").flatMap(part => {
  const m = part.match(/^([\d.]+)-([\d.]+)@([\d.]+)$/);
  if (!m) return [+part];
  const [a, b, step] = [+m[1], +m[2], +m[3]]; const out = [];
  for (let t = a; t <= b + 1e-6; t += step) out.push(+t.toFixed(4));
  return out;
});

if (cmd === "scan") {
  // Per-frame pixel difference at 30fps on a small copy; consecutive moving frames are grouped into segments.
  const diffs = await page.evaluate(async () => {
    const v = document.getElementById("v"); const W = 160, H = Math.round(160 * v.videoHeight / v.videoWidth);
    const c = document.getElementById("c"); c.width = W; c.height = H; const g = c.getContext("2d", { willReadFrequently: true });
    const out = []; let prev = null;
    for (let t = 0; t < v.duration; t += 1 / 30) {
      v.currentTime = t; await new Promise(r => v.onseeked = r);
      g.drawImage(v, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
      if (prev) { let s = 0; for (let i = 0; i < d.length; i += 4) s += Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]); out.push([+t.toFixed(3), Math.round(s / 1000)]); }
      prev = d;
    }
    return out;
  });
  const segs = [];
  for (const [t, s] of diffs.filter(([, s]) => s > 15)) {
    const last = segs.at(-1);
    if (last && t - last.end < 0.12) { last.end = t; last.peak = Math.max(last.peak, s); } else segs.push({ start: t, end: t, peak: s });
  }
  for (const s of segs) console.log(`${s.start.toFixed(2)}–${s.end.toFixed(2)}s  ${Math.round((s.end - s.start) * 1000 + 33)}ms  peak ${s.peak}`);
} else if (cmd === "sheet") {
  // Contact sheet: one tile per time, labelled, for reading motion frame by frame.
  const [out, times, cols = "8", width = "200", crop = ""] = rest;
  const data = await page.evaluate(async ([ts, cols, W, cr]) => {
    const v = document.getElementById("v");
    const [sx, sy, sw, sh] = cr || [0, 0, v.videoWidth, v.videoHeight]; const H = Math.round(W * sh / sw);
    const c = document.createElement("canvas"); c.width = cols * W; c.height = Math.ceil(ts.length / cols) * H; const g = c.getContext("2d");
    for (let i = 0; i < ts.length; i++) {
      v.currentTime = ts[i]; await new Promise(r => v.onseeked = r);
      const x = (i % cols) * W, y = Math.floor(i / cols) * H;
      g.drawImage(v, sx, sy, sw, sh, x, y, W, H); g.strokeStyle = "#f0f"; g.strokeRect(x + .5, y + .5, W - 1, H - 1);
      g.fillStyle = "rgba(0,0,0,.7)"; g.fillRect(x, y, 56, 18); g.fillStyle = "#fff"; g.font = "12px sans-serif"; g.fillText(ts[i].toFixed(3) + "s", x + 3, y + 13);
    }
    return c.toDataURL("image/jpeg", .85);
  }, [parseTimes(times), +cols, +width, crop ? crop.split(",").map(Number) : null]);
  fs.writeFileSync(out, Buffer.from(data.split(",")[1], "base64"));
  console.log("wrote", out);
}
fs.rmSync(html, { force: true });
await browser.close();
