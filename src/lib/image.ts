// No side of an image Skeu holds or exports goes over this. It's also iOS's canvas limit (4096²),
// past which Safari returns a blank image instead of an error.
export const MAX_SIDE = 4096;

// Scales an image down so its longest side is at most MAX_SIDE, halving in steps so detail averages out
// instead of aliasing. The result is PNG, so the only change is the size.
export async function fitImage(image: HTMLImageElement): Promise<{ src: string; width: number; height: number } | null> {
  const { naturalWidth: width, naturalHeight: height } = image;
  const k = MAX_SIDE / Math.max(width, height);
  if (k >= 1) return null;
  let source: CanvasImageSource = image, w = width, h = height;
  const target = { w: Math.round(width * k), h: Math.round(height * k) };
  do {
    w = Math.max(target.w, Math.round(w / 2));
    h = Math.max(target.h, Math.round(h / 2));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, w, h);
    source = canvas;
  } while (w > target.w || h > target.h);
  return { src: (source as HTMLCanvasElement).toDataURL("image/png"), width: w, height: h };
}
