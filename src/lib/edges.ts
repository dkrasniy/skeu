// Straight lines across an image (an address bar's border, a toolbar's edge), so crop edges can snap to them.
// A boundary at n means the pixels before n differ from the pixels from n on.
export type Run = [first: number, last: number];
export interface Edges { rows: Run[]; cols: Run[] }

const SAMPLES = 1024;  // each line is averaged into at most this many samples
const CONTRAST = 24;   // summed RGBA difference that counts as a change
const COVERAGE = .9;   // share of a line that has to change for it to count as an edge
const FLAT = .95;      // share of a line that has to be one even color: UI chrome is flat, text and photos aren't
const MERGE = 2;       // boundaries this close are one edge: a 1px border has two
const MAX_RUN = 12;    // longer runs are gradients or texture, not edges

export async function findEdges(src: string, width: number, height: number): Promise<Edges> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return {
    rows: runs(changes(image, Math.min(width, SAMPLES), height, "rows")),
    cols: runs(changes(image, width, Math.min(height, SAMPLES), "cols")),
  };
}

// The image is squeezed along the lines only, so boundaries keep full source precision.
function changes(image: HTMLImageElement, width: number, height: number, axis: "rows" | "cols"): boolean[] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(image, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const [lines, samples, lineStep, sampleStep] = axis === "rows" ? [height, width, width * 4, 4] : [width, height, 4, width * 4];
  const differ = (p: number, q: number) =>
    Math.abs(data[p] - data[q]) + Math.abs(data[p + 1] - data[q + 1]) + Math.abs(data[p + 2] - data[q + 2]) + Math.abs(data[p + 3] - data[q + 3]) > CONTRAST;
  const flat: boolean[] = [];
  for (let n = 0; n < lines; n++) {
    let steps = 0;
    for (let i = 1; i < samples; i++) if (differ(n * lineStep + i * sampleStep, n * lineStep + (i - 1) * sampleStep)) steps++;
    flat.push(steps <= (samples - 1) * (1 - FLAT));
  }
  // An edge changes almost all the way across and has a flat line on at least one side, like a bar's border.
  const strong: boolean[] = [false];
  for (let n = 1; n < lines; n++) {
    let changed = 0;
    for (let i = 0; i < samples; i++) if (differ(n * lineStep + i * sampleStep, (n - 1) * lineStep + i * sampleStep)) changed++;
    strong.push(changed >= samples * COVERAGE && (flat[n - 1] || flat[n]));
  }
  return strong;
}

function runs(strong: boolean[]): Run[] {
  const found: Run[] = [];
  for (let n = 0; n < strong.length; n++) {
    if (!strong[n]) continue;
    const last = found.at(-1);
    if (last && n - last[1] <= MERGE) last[1] = n;
    else found.push([n, n]);
  }
  return found.filter(([first, last]) => last - first <= MAX_RUN);
}

// The nearest edge within `tolerance`, landing on its inner side: a crop's start skips past a border, its end stops before it.
export function snapTo(value: number, edges: Run[], side: "start" | "end", tolerance: number): number | null {
  let snapped: number | null = null, best = tolerance;
  for (const [first, last] of edges) {
    const distance = value < first ? first - value : value > last ? value - last : 0;
    if (distance <= best) { snapped = side === "start" ? last : first; best = distance; }
  }
  return snapped;
}
