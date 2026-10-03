import { type Asset, type Settings, cardBox, hexToRgba, PERSPECTIVE, visibleRect } from "./editor-state";

// Draws the export straight onto a canvas from the settings, matching what <Artboard> shows.
// Rendering the DOM instead (html-to-image's SVG foreignObject) fails in WebKit: the screenshot comes out
// blank and the shadow lands in the wrong place, on iPhone and in desktop Safari alike.

type Box = ReturnType<typeof cardBox>;
const DOTS = ["#ff625a", "#ffbd44", "#00c84e"];

export async function renderImage(s: Settings, asset: Asset, scale: number): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = asset.src;
  await image.decode();

  const box = cardBox(s, asset);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(box.width * scale);
  canvas.height = Math.round(box.height * scale);
  const ctx = context(canvas);
  ctx.scale(scale, scale);
  paintBackground(ctx, s, box.width, box.height);

  const cx = box.width / 2 + s.x / 100 * box.width, cy = box.height / 2 + s.y / 100 * box.height;
  if (!s.tiltX && !s.tiltY) {
    // Flat: the shadow comes from a sprite (canvas shadows ignore the transform), the card is drawn directly so it stays crisp.
    const shadow = sprite(s, box, image, asset, scale, false);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(s.rotation * Math.PI / 180);
    ctx.drawImage(shadow.canvas, -box.cardWidth / 2 - shadow.pad, -box.cardHeight / 2 - shadow.pad, box.cardWidth + shadow.pad * 2, box.cardHeight + shadow.pad * 2);
    ctx.translate(-box.cardWidth / 2, -box.cardHeight / 2);
    paintCard(ctx, s, box, image, asset);
    ctx.restore();
  } else {
    // Tilted: the card and its shadow share a plane, as in CSS, so both are drawn flat and then put into perspective.
    // The sprite becomes a texture, so it can't be larger than the GPU allows; only its sharpness depends on this.
    const side = Math.max(box.cardWidth, box.cardHeight) + shadowPad(s, box) * 2;
    const card = sprite(s, box, image, asset, Math.min(scale, maxTextureSide() / side), true);
    const transform = `perspective(${box.width * PERSPECTIVE}px) rotateX(${s.tiltX}deg) rotateY(${s.tiltY}deg) rotateZ(${s.rotation}deg)`;
    const warped = warp(card.canvas, card.pad, box, transform, cx, cy, canvas.width, canvas.height, scale);
    ctx.drawImage(warped, 0, 0, box.width, box.height);
  }
  return canvas;
}

function context(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

// CSS linear-gradient geometry: the line runs through the center at `angle` (0deg points up) and is just long
// enough for the corners to land on its ends.
function paintBackground(ctx: CanvasRenderingContext2D, s: Settings, width: number, height: number) {
  if (s.background === "solid") {
    ctx.fillStyle = s.color1;
  } else {
    const a = s.angle * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a);
    const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
    const gradient = ctx.createLinearGradient(width / 2 - dx * half, height / 2 - dy * half, width / 2 + dx * half, height / 2 + dy * half);
    gradient.addColorStop(0, s.color1);
    gradient.addColorStop(1, s.color2);
    ctx.fillStyle = gradient;
  }
  ctx.fillRect(0, 0, width, height);
}

// The card in its own coordinates, (0, 0) at its top-left corner.
function paintCard(ctx: CanvasRenderingContext2D, s: Settings, box: Box, image: HTMLImageElement, asset: Asset) {
  const { unit, chrome, bar, inset, cardWidth, cardHeight } = box;
  const radius = s.radius * unit;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, cardWidth, cardHeight, radius);
  ctx.clip();
  ctx.fillStyle = s.frame === "dark" ? "#292a30" : "#ffffff";
  ctx.fillRect(0, 0, cardWidth, cardHeight);

  if (s.frame !== "none") {
    ctx.fillStyle = s.frame === "dark" ? "#303137" : "#f6f6f6";
    ctx.fillRect(0, 0, cardWidth, bar);
    const r = 4.5 * chrome;
    DOTS.forEach((color, i) => {
      ctx.beginPath();
      ctx.arc(14 * chrome + r + i * (9 + 7) * chrome, bar / 2, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  const crop = visibleRect(asset);
  const width = cardWidth - inset * 2, height = crop.height * width / crop.width;
  ctx.beginPath();
  ctx.roundRect(inset, bar + inset, width, height, inset ? Math.max(0, radius - inset) : 0);
  ctx.clip();
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, inset, bar + inset, width, height);
  ctx.restore();
}

// Room around the card for its shadow: offset, spread, and the blur out to 3σ.
function shadowPad(s: Settings, { unit }: Box) {
  if (s.shadow <= 0) return 2;
  return Math.ceil(Math.max(Math.abs(s.shadowX), Math.abs(s.shadowY)) * unit + Math.max(s.shadowSpread, 0) * unit + s.shadowBlur * unit * 1.5 + 2);
}

// The shadow (and, for a tilted card, the card itself) drawn flat with room around it for the blur.
// `pad` is that room in canvas pixels.
function sprite(s: Settings, box: Box, image: HTMLImageElement, asset: Asset, scale: number, withCard: boolean) {
  const { unit, cardWidth, cardHeight } = box;
  const x = s.shadowX * unit, y = s.shadowY * unit, blur = s.shadowBlur * unit, spread = s.shadowSpread * unit;
  const pad = shadowPad(s, box);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((cardWidth + pad * 2) * scale);
  canvas.height = Math.ceil((cardHeight + pad * 2) * scale);
  const ctx = context(canvas);

  if (s.shadow > 0) {
    // Canvas shadows have no spread and ignore the transform, so the shape is grown by hand, drawn off-canvas,
    // and only its shadow is thrown back on. Canvas shadowBlur and CSS blur radius both mean 2σ.
    const radius = s.radius * unit, far = canvas.width + canvas.height;
    const grown = spread >= 0 ? (radius > 0 ? radius + spread : 0) : Math.max(0, radius + spread);
    ctx.shadowColor = hexToRgba(s.shadowColor, s.shadow / 100);
    ctx.shadowBlur = blur * scale;
    ctx.shadowOffsetX = far + x * scale;
    ctx.shadowOffsetY = y * scale;
    ctx.beginPath();
    ctx.roundRect((pad - spread) * scale - far, (pad - spread) * scale, (cardWidth + spread * 2) * scale, (cardHeight + spread * 2) * scale, grown * scale);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.shadowColor = "transparent";
  }
  if (withCard) {
    ctx.scale(scale, scale);
    ctx.translate(pad, pad);
    paintCard(ctx, s, box, image, asset);
  }
  return { canvas, pad };
}

// Puts a flat sprite into CSS perspective with WebGL, which interpolates the texture perspective-correctly.
// Each corner goes through the same matrix CSS builds, around the card's center (its transform-origin).
function warp(source: HTMLCanvasElement, pad: number, box: Box, transform: string, cx: number, cy: number, width: number, height: number, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error("WebGL is unavailable");

  const program = gl.createProgram()!;
  for (const [type, code] of [
    [gl.VERTEX_SHADER, "attribute vec4 p; attribute vec2 t; varying vec2 v; void main() { v = t; gl_Position = p; }"],
    [gl.FRAGMENT_SHADER, "precision mediump float; uniform sampler2D s; varying vec2 v; void main() { gl_FragColor = texture2D(s, v); }"],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  gl.useProgram(program);

  const matrix = new DOMMatrix(transform);
  const halfW = box.cardWidth / 2 + pad, halfH = box.cardHeight / 2 + pad;
  const corners = [[-halfW, -halfH, 0, 0], [halfW, -halfH, 1, 0], [-halfW, halfH, 0, 1], [halfW, halfH, 1, 1]];
  const vertices: number[] = [];
  for (const [x, y, u, v] of corners) {
    const p = matrix.transformPoint(new DOMPoint(x, y, 0, 1));
    // Clip space, multiplied back by w so the GPU does the perspective divide and interpolates correctly.
    const sx = (cx + p.x / p.w) * scale, sy = (cy + p.y / p.w) * scale;
    vertices.push((sx / width * 2 - 1) * p.w, (1 - sy / height * 2) * p.w, 0, p.w, u, v);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "p"), texture = gl.getAttribLocation(program, "t");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 4, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(texture);
  gl.vertexAttribPointer(texture, 2, gl.FLOAT, false, 24, 16);

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return canvas;
}

function maxTextureSide() {
  const gl = document.createElement("canvas").getContext("webgl");
  return gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) as number : 4096;
}
