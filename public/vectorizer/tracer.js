/* Vectorizer tracing engine.
 *
 * Pipeline:
 *   resample -> sort pixels into flat / stroke centre / ramp -> palette from
 *   the flat pixels (plus colours seen only in thin strokes) -> labels, where
 *   a ramp pixel may only take the colour at one end of its ramp -> halo,
 *   blend-blob and speck cleanup -> boundary graph of shared edges -> sub-pixel
 *   edge positions (thin strokes by their total ink) -> corner detection,
 *   smoothing and cubic Bezier fitting per edge -> closed paths per colour.
 *
 * Every boundary between two regions is fitted exactly once and reused by
 * both neighbours, so shapes meet without gaps or overlaps.
 *
 * Plain script on purpose: it runs unchanged on the main thread, inside a
 * Worker built from this file's own text, and under Node for tests.
 */
(function (root) {
  'use strict';

  var TR = 255; // label for transparent / outside the image
  var DX = [1, 0, -1, 0];
  var DY = [0, 1, 0, -1];

  function now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  /* ------------------------------------------------------------ colour */

  var LIN = new Float32Array(256);
  for (var li = 0; li < 256; li++) {
    var lc = li / 255;
    LIN[li] = lc <= 0.04045 ? lc / 12.92 : Math.pow((lc + 0.055) / 1.055, 2.4);
  }
  function labF(t) {
    return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 0.137931;
  }
  function labFInv(t) {
    var t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 0.137931) / 7.787;
  }
  // CIELAB scaled so L is 0..1. It has a linear toe near black, which keeps
  // noise in dark areas from being split into several palette entries.
  function rgbToLab(r, g, b, out, o) {
    var R = LIN[r], G = LIN[g], B = LIN[b];
    var fx = labF((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047);
    var fy = labF(0.2126729 * R + 0.7151522 * G + 0.072175 * B);
    var fz = labF((0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883);
    out[o] = 1.16 * fy - 0.16;
    out[o + 1] = 5 * (fx - fy);
    out[o + 2] = 2 * (fy - fz);
  }
  function gammaEnc(v) {
    v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(v * 255)));
  }
  function labToRgb(L, a, b) {
    var fy = (L + 0.16) / 1.16, fx = a / 5 + fy, fz = fy - b / 2;
    var X = 0.95047 * labFInv(fx), Y = labFInv(fy), Z = 1.08883 * labFInv(fz);
    return [
      gammaEnc(3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z),
      gammaEnc(-0.969266 * X + 1.8760108 * Y + 0.041556 * Z),
      gammaEnc(0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z)
    ];
  }

  /* ---------------------------------------------------------- resample */

  function mitchell(x) {
    x = Math.abs(x);
    if (x < 1) return (7 * x * x * x - 12 * x * x + 16 / 3) / 6;
    if (x < 2) return ((-7 / 3) * x * x * x + 12 * x * x - 20 * x + 32 / 3) / 6;
    return 0;
  }
  function catmullRom(x) {
    x = Math.abs(x);
    if (x < 1) return 1.5 * x * x * x - 2.5 * x * x + 1;
    if (x < 2) return -0.5 * x * x * x + 2.5 * x * x - 4 * x + 2;
    return 0;
  }
  function kernelTable(srcN, dstN) {
    var scale = dstN / srcN, f = Math.max(1, 1 / scale), sup = 2 * f;
    var kernel = scale > 1 ? catmullRom : mitchell; // interpolate when enlarging, soften when reducing
    var taps = Math.ceil(sup * 2) + 2;
    var idx = new Int32Array(dstN * taps), wt = new Float32Array(dstN * taps), near = new Int32Array(dstN * 2);
    for (var i = 0; i < dstN; i++) {
      var c = (i + 0.5) / scale, lo = Math.floor(c - sup), sum = 0, t;
      for (t = 0; t < taps; t++) {
        var j = lo + t, wv = kernel((j + 0.5 - c) / f);
        idx[i * taps + t] = j < 0 ? 0 : j >= srcN ? srcN - 1 : j;
        wt[i * taps + t] = wv;
        sum += wv;
      }
      for (t = 0; t < taps; t++) wt[i * taps + t] /= sum;
      var n0 = Math.floor(c - 0.5);
      near[i * 2] = n0 < 0 ? 0 : n0 >= srcN ? srcN - 1 : n0;
      near[i * 2 + 1] = n0 + 1 < 0 ? 0 : n0 + 1 >= srcN ? srcN - 1 : n0 + 1;
    }
    return { idx: idx, wt: wt, taps: taps, near: near, clamp: scale > 1 };
  }
  function clampTo(v, a, b) {
    return a < b ? (v < a ? a : v > b ? b : v) : v < b ? b : v > a ? a : v;
  }
  // Separable resize on premultiplied alpha, so colour never bleeds in from
  // fully transparent pixels. When enlarging, each result is clamped between
  // its two nearest source samples: the kernel stays sharp but cannot
  // overshoot into colours that were never in the image.
  function resample(src, sw, sh, dw, dh) {
    var kx = kernelTable(sw, dw), ky = kernelTable(sh, dh);
    var tmp = new Float32Array(dw * sh * 4);
    var x, y, t, o, p, wv, a, c;
    for (y = 0; y < sh; y++) {
      for (x = 0; x < dw; x++) {
        var r = 0, g = 0, b = 0, al = 0;
        for (t = 0; t < kx.taps; t++) {
          wv = kx.wt[x * kx.taps + t];
          if (wv === 0) continue;
          p = (y * sw + kx.idx[x * kx.taps + t]) * 4;
          a = src[p + 3] * wv;
          r += src[p] * a; g += src[p + 1] * a; b += src[p + 2] * a; al += a;
        }
        o = (y * dw + x) * 4;
        if (kx.clamp) {
          var p0 = (y * sw + kx.near[x * 2]) * 4, p1 = (y * sw + kx.near[x * 2 + 1]) * 4, a0 = src[p0 + 3], a1 = src[p1 + 3];
          r = clampTo(r, src[p0] * a0, src[p1] * a1); g = clampTo(g, src[p0 + 1] * a0, src[p1 + 1] * a1);
          b = clampTo(b, src[p0 + 2] * a0, src[p1 + 2] * a1); al = clampTo(al, a0, a1);
        }
        tmp[o] = r; tmp[o + 1] = g; tmp[o + 2] = b; tmp[o + 3] = al;
      }
    }
    var out = new Uint8ClampedArray(dw * dh * 4), acc = [0, 0, 0, 0];
    for (y = 0; y < dh; y++) {
      for (x = 0; x < dw; x++) {
        acc[0] = acc[1] = acc[2] = acc[3] = 0;
        for (t = 0; t < ky.taps; t++) {
          wv = ky.wt[y * ky.taps + t];
          if (wv === 0) continue;
          p = (ky.idx[y * ky.taps + t] * dw + x) * 4;
          acc[0] += tmp[p] * wv; acc[1] += tmp[p + 1] * wv; acc[2] += tmp[p + 2] * wv; acc[3] += tmp[p + 3] * wv;
        }
        if (ky.clamp) {
          var q0 = (ky.near[y * 2] * dw + x) * 4, q1 = (ky.near[y * 2 + 1] * dw + x) * 4;
          for (c = 0; c < 4; c++) acc[c] = clampTo(acc[c], tmp[q0 + c], tmp[q1 + c]);
        }
        o = (y * dw + x) * 4;
        if (acc[3] > 0.5) {
          out[o] = acc[0] / acc[3]; out[o + 1] = acc[1] / acc[3]; out[o + 2] = acc[2] / acc[3]; out[o + 3] = acc[3];
        }
      }
    }
    return out;
  }

  /* ----------------------------------------------------------- denoise */

  // Share of pixels carrying fine-grained noise. The 3x3 pattern used here
  // (the difference of two Laplacians) cancels flat areas, straight edges and
  // smooth blur alike, so only pixel-to-pixel grain is counted: clean and
  // merely blurry graphics score near 0, JPEGs and photos score higher.
  function noiseLevel(src, w, h) {
    var step = Math.max(1, Math.floor(Math.sqrt((w * h) / 40000))), hit = 0, total = 0, W4 = w * 4;
    for (var y = 1; y < h - 1; y += step) for (var x = 1; x < w - 1; x += step) {
      var p = (y * w + x) * 4, d = 0;
      for (var c = 0; c < 3; c++) {
        d += Math.abs(4 * src[p + c] - 2 * (src[p - 4 + c] + src[p + 4 + c] + src[p - W4 + c] + src[p + W4 + c])
          + src[p - W4 - 4 + c] + src[p - W4 + 4 + c] + src[p + W4 - 4 + c] + src[p + W4 + 4 + c]);
      }
      d /= 4;
      if (d >= 2 && d <= 36) hit++;
      total++;
    }
    return total ? hit / total : 0;
  }

  // Each pixel becomes the mean of the nearby pixels that already look like
  // it. Flat areas lose their compression noise; edges are left alone because
  // pixels across an edge are too different to be averaged in.
  function denoise(src, w, h, radius, thr) {
    var out = new Uint8ClampedArray(src.length), t2 = thr * thr;
    for (var y = 0; y < h; y++) {
      var y0 = Math.max(0, y - radius), y1 = Math.min(h - 1, y + radius);
      for (var x = 0; x < w; x++) {
        var p = (y * w + x) * 4, r = src[p], g = src[p + 1], b = src[p + 2], a = src[p + 3];
        var sr = 0, sg = 0, sb = 0, n = 0, x0 = Math.max(0, x - radius), x1 = Math.min(w - 1, x + radius);
        for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) {
          var q = (yy * w + xx) * 4, dr = src[q] - r, dg = src[q + 1] - g, db = src[q + 2] - b;
          if (dr * dr + dg * dg + db * db <= t2 && Math.abs(src[q + 3] - a) < 24) { sr += src[q]; sg += src[q + 1]; sb += src[q + 2]; n++; }
        }
        out[p] = sr / n; out[p + 1] = sg / n; out[p + 2] = sb / n; out[p + 3] = a;
      }
    }
    return out;
  }

  /* ----------------------------------------------------------- palette */

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Palette samples. Pixels inside the ramp between two colours (anti-aliasing,
  // blur) are left out entirely, so the palette lands on colours that are
  // really there: flat areas, plus the centre lines of thin strokes.
  function samplePixels(lab, alpha, w, h, kind) {
    var n = w * h, step = Math.max(1, Math.floor(Math.sqrt(n / 70000)));
    var pts = [], wts = [], flat = [], x, y, i;
    if (kind) {
      var extremes = 0;
      for (i = 0; i < n; i++) if (kind[i] === 1) extremes++;
      var every = Math.max(1, Math.ceil(extremes / 40000)), seen = 0, we = (0.3 * every) / (step * step);
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = y * w + x;
        if (alpha[i] < 128 || kind[i] > 1) continue;
        if (kind[i] === 0) { if (x % step || y % step) continue; } else if (seen++ % every) continue;
        pts.push(lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]);
        wts.push(kind[i] === 0 ? 1 : we); flat.push(kind[i] === 0 ? 1 : 0);
      }
    }
    if (!wts.length) {
      for (y = 0; y < h; y += step) for (x = 0; x < w; x += step) {
        i = y * w + x;
        if (alpha[i] < 128) continue;
        var xl = x > 0 ? i - 1 : i, xr = x < w - 1 ? i + 1 : i, yu = y > 0 ? i - w : i, yd = y < h - 1 ? i + w : i, g = 0;
        for (var c = 0; c < 3; c++) g += Math.abs(lab[xr * 3 + c] - lab[xl * 3 + c]) + Math.abs(lab[yd * 3 + c] - lab[yu * 3 + c]);
        var q = g / 0.05, q2 = q * q, wt = Math.max(0.02, 1 / (1 + q2 * q2));
        pts.push(lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]);
        wts.push(wt); flat.push(wt > 0.3 ? 1 : 0);
      }
    }
    return { pts: new Float32Array(pts), wts: new Float32Array(wts), flat: new Uint8Array(flat), n: wts.length };
  }

  function kmeans(S, K, iters, init) {
    var n = S.n, pts = S.pts, wts = S.wts, rand = rng(12345);
    var cent = new Float32Array(K * 3), i, k, c, d, best, bd;
    var d2 = new Float32Array(n).fill(Infinity), have = 0;
    function addCenter(x, y, z) {
      cent[have * 3] = x; cent[have * 3 + 1] = y; cent[have * 3 + 2] = z;
      for (var j = 0; j < n; j++) {
        var dx = pts[j * 3] - x, dy = pts[j * 3 + 1] - y, dz = pts[j * 3 + 2] - z;
        var dd = dx * dx + dy * dy + dz * dz;
        if (dd < d2[j]) d2[j] = dd;
      }
      have++;
    }
    if (init) for (i = 0; i < init.length / 3 && have < K; i++) addCenter(init[i * 3], init[i * 3 + 1], init[i * 3 + 2]);
    while (have < K) { // k-means++ seeding
      var total = 0;
      for (i = 0; i < n; i++) total += have ? d2[i] * wts[i] : wts[i];
      if (total <= 1e-12) break;
      var pick = rand() * total, acc = 0, at = n - 1;
      for (i = 0; i < n; i++) {
        acc += have ? d2[i] * wts[i] : wts[i];
        if (acc >= pick) { at = i; break; }
      }
      addCenter(pts[at * 3], pts[at * 3 + 1], pts[at * 3 + 2]);
    }
    K = have;
    var assign = new Int32Array(n), sum = new Float64Array(K * 4);
    for (var it = 0; it < iters; it++) {
      sum.fill(0);
      for (i = 0; i < n; i++) {
        best = 0; bd = Infinity;
        for (k = 0; k < K; k++) {
          var a0 = pts[i * 3] - cent[k * 3], a1 = pts[i * 3 + 1] - cent[k * 3 + 1], a2 = pts[i * 3 + 2] - cent[k * 3 + 2];
          d = a0 * a0 + a1 * a1 + a2 * a2;
          if (d < bd) { bd = d; best = k; }
        }
        assign[i] = best;
        var ww = wts[i];
        sum[best * 4] += pts[i * 3] * ww; sum[best * 4 + 1] += pts[i * 3 + 1] * ww;
        sum[best * 4 + 2] += pts[i * 3 + 2] * ww; sum[best * 4 + 3] += ww;
      }
      for (k = 0; k < K; k++) {
        if (sum[k * 4 + 3] > 0) for (c = 0; c < 3; c++) cent[k * 3 + c] = sum[k * 4 + c] / sum[k * 4 + 3];
      }
    }
    var weight = new Float64Array(K), flatW = new Float64Array(K);
    for (i = 0; i < n; i++) { weight[assign[i]] += wts[i]; if (S.flat[i]) flatW[assign[i]] += wts[i]; }
    return { cent: cent.subarray(0, K * 3), K: K, weight: weight, flatW: flatW };
  }

  function dist3(c, i, j) {
    var a = c[i * 3] - c[j * 3], b = c[i * 3 + 1] - c[j * 3 + 1], d = c[i * 3 + 2] - c[j * 3 + 2];
    return Math.sqrt(a * a + b * b + d * d);
  }

  // How far colour c sits from the segment a-b, as a fraction of |ab|, and
  // where along it. Used to spot blends of two neighbouring colours.
  function betweenness(cent, c, a, b) {
    var ab = 0, ac = 0, k, len2 = 0;
    for (k = 0; k < 3; k++) {
      var u = cent[b * 3 + k] - cent[a * 3 + k], v = cent[c * 3 + k] - cent[a * 3 + k];
      ab += u * v; len2 += u * u; ac += v * v;
    }
    if (len2 < 1e-9) return null;
    var t = ab / len2, perp2 = Math.max(0, ac - t * t * len2);
    return { t: t, off: Math.sqrt(perp2 / len2) };
  }

  function subset(S, flat) {
    var pts = [], wts = [], fl = [];
    for (var i = 0; i < S.n; i++) {
      if (S.flat[i] !== flat) continue;
      pts.push(S.pts[i * 3], S.pts[i * 3 + 1], S.pts[i * 3 + 2]); wts.push(S.wts[i]); fl.push(flat);
    }
    return { pts: new Float32Array(pts), wts: new Float32Array(wts), flat: new Uint8Array(fl), n: wts.length };
  }
  // Merge clusters closer than `lim`, weighted; arrays are edited in place.
  function mergeNear(cent, wgt, lim) {
    for (;;) {
      var K = wgt.length, bi = -1, bj = -1, bd = lim, i, j;
      for (i = 0; i < K; i++) for (j = i + 1; j < K; j++) {
        var d = dist3(cent, i, j);
        if (d < bd) { bd = d; bi = i; bj = j; }
      }
      if (bi < 0 || K <= 1) return;
      var wi = wgt[bi] + 1e-9, wj = wgt[bj] + 1e-9;
      for (var c = 0; c < 3; c++) cent[bi * 3 + c] = (cent[bi * 3 + c] * wi + cent[bj * 3 + c] * wj) / (wi + wj);
      wgt[bi] += wgt[bj];
      cent.splice(bj * 3, 3); wgt.splice(bj, 1);
    }
  }
  // Distance from point (x,y,z) to the line of blends between palette colours i and j.
  function segDist(cent, i, j, x, y, z) {
    var ax = cent[i * 3], ay = cent[i * 3 + 1], az = cent[i * 3 + 2];
    var dx = cent[j * 3] - ax, dy = cent[j * 3 + 1] - ay, dz = cent[j * 3 + 2] - az, l2 = dx * dx + dy * dy + dz * dz;
    var t = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / l2 : 0;
    // a little past either end still counts: resizing and sharpening overshoot
    t = t < -0.35 ? -0.35 : t > 1.35 ? 1.35 : t;
    var ex = x - ax - t * dx, ey = y - ay - t * dy, ez = z - az - t * dz;
    return Math.sqrt(ex * ex + ey * ey + ez * ez);
  }

  function buildPalette(lab, alpha, w, h, wanted, kind, noisy) {
    var S = samplePixels(lab, alpha, w, h, kind);
    if (S.n === 0) return new Float32Array(0);
    var S0 = subset(S, 1), S1 = subset(S, 0), i, j, k;
    if (!S0.n) { S0 = S; S1 = subset(S, 2); }
    if (wanted > 0) {
      // a chosen count cannot invent colours the image does not have:
      // clusters that come out as copies of one another are folded together
      var kw = kmeans(S0, wanted, 12, null), cw = Array.prototype.slice.call(kw.cent), ww = Array.prototype.slice.call(kw.weight);
      mergeNear(cw, ww, 0.025);
      return new Float32Array(cw);
    }

    // 1. Colours that fill areas: over-segment the flat pixels, then merge
    // near-duplicates and refine until it settles.
    var km = kmeans(S0, 24, 10, null), cent, wgt;
    for (var round = 0; round < 4; round++) {
      cent = Array.prototype.slice.call(km.cent); wgt = Array.prototype.slice.call(km.weight);
      var before = wgt.length;
      mergeNear(cent, wgt, 0.06);
      if (wgt.length === before && round > 0) break;
      km = kmeans(S0, wgt.length, 4, new Float32Array(cent));
    }
    cent = Array.prototype.slice.call(km.cent);
    var K0 = km.K;

    // 2. Colours that only ever appear as thin strokes. A stroke centre is a
    // blend of its own colour and the background, so most of them sit on the
    // line between two area colours and add nothing. The ones that do not
    // are a colour of their own; of those, only the strongest blend along
    // each line away from an area colour is kept.
    var pts = [], x, y, z;
    for (i = 0; i < S1.n; i++) {
      x = S1.pts[i * 3]; y = S1.pts[i * 3 + 1]; z = S1.pts[i * 3 + 2];
      var explained = false;
      for (j = 0; j < K0 && !explained; j++) {
        var dx = x - cent[j * 3], dy = y - cent[j * 3 + 1], dz = z - cent[j * 3 + 2];
        explained = dx * dx + dy * dy + dz * dz < 0.01;
        for (k = j + 1; k < K0 && !explained; k++) explained = segDist(cent, j, k, x, y, z) < 0.06;
      }
      if (!explained) pts.push(x, y, z);
    }
    var n1 = pts.length / 3;
    if (n1 >= 8) {
      var T1 = { pts: new Float32Array(pts), wts: new Float32Array(n1).fill(1), flat: new Uint8Array(n1), n: n1 };
      var k1 = kmeans(T1, Math.min(8, n1), 8, null), c1 = Array.prototype.slice.call(k1.cent), w1 = Array.prototype.slice.call(k1.weight);
      mergeNear(c1, w1, 0.06);
      var all = cent.concat(c1), K1 = w1.length, order = [], gap = new Float32Array(K1), kept = [], support = [];
      for (i = 0; i < K1; i++) {
        gap[i] = Infinity;
        for (j = 0; j < K0; j++) gap[i] = Math.min(gap[i], dist3(all, j, K0 + i));
        order.push(i);
      }
      // Strongest first. A cluster part-way between an area colour and a
      // stronger cluster is the same stroke at lower strength: it lends that
      // cluster its support and is dropped.
      order.sort(function (u, v) { return gap[v] - gap[u]; });
      for (var oi = 0; oi < K1; oi++) {
        i = order[oi];
        var heir = -1;
        for (j = 0; j < K0 && heir < 0; j++) for (k = 0; k < kept.length && heir < 0; k++) {
          var bt = betweenness(all, K0 + i, j, K0 + kept[k]);
          if (bt && bt.t > 0.1 && bt.t < 0.95 && bt.off * dist3(all, j, K0 + kept[k]) < (noisy ? 0.12 : 0.07)) heir = k;
        }
        if (heir < 0) { kept.push(i); support.push(w1[i]); } else support[heir] += w1[i];
      }
      var need = Math.max(6, (noisy ? 0.01 : 0.004) * S1.n);
      for (k = 0; k < kept.length; k++) if (support[k] >= need) cent.push(c1[kept[k] * 3], c1[kept[k] * 3 + 1], c1[kept[k] * 3 + 2]);
    }
    return new Float32Array(cent);
  }

  /* ------------------------------------------------------------- edges */

  var AXES = [1, 0, 0, 1, 1, 1, 1, -1]; // scan axes: across, down, and the two diagonals

  // Sorts every pixel into flat (0), a local extreme such as the centre line
  // of a thin stroke (1), or part of the ramp between two colours (2 + axis).
  // Through a ramp pixel the colour keeps changing the same way; at an
  // extreme it turns back. A level step part-way up a ramp (enlarged images
  // are full of them) is still ramp, so the test looks past short level runs.
  function edgeKinds(lab, alpha, w, h, d, theta) {
    var n = w * h, kind = new Uint8Array(n), th2 = theta * theta, lo2 = th2 / 4, x, y, k, c;
    function beyond(p, x0, y0, ox, oy) {
      for (var j = 1; j <= 3; j++) {
        var qx = x0 + ox * j, qy = y0 + oy * j;
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) return -1;
        var q = qy * w + qx, e = 0;
        if (alpha[q] < 128) return -1;
        for (var cc = 0; cc < 3; cc++) { var dv = lab[q * 3 + cc] - lab[p * 3 + cc]; e += dv * dv; }
        if (e >= lo2) return q;
      }
      return -1;
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var p = y * w + x;
      if (alpha[p] < 128) continue;
      var bestG = 0, bestK = 0, big = 0;
      for (k = 0; k < 4; k++) {
        var ox = AXES[k * 2] * d, oy = AXES[k * 2 + 1] * d;
        var ax = x - ox, ay = y - oy, bx = x + ox, by = y + oy;
        var a = ax < 0 || ay < 0 || ax >= w || ay >= h ? p : ay * w + ax;
        var b = bx < 0 || by < 0 || bx >= w || by >= h ? p : by * w + bx;
        if (alpha[a] < 128) a = p;
        if (alpha[b] < 128) b = p;
        var lu = 0, lv = 0, g = 0;
        for (c = 0; c < 3; c++) {
          var u = lab[a * 3 + c] - lab[p * 3 + c], v = lab[b * 3 + c] - lab[p * 3 + c];
          lu += u * u; lv += v * v; g += (u - v) * (u - v);
        }
        if (lu > big) big = lu;
        if (lv > big) big = lv;
        if (g > bestG) { bestG = g; bestK = k; }
      }
      if (big < th2) continue;
      kind[p] = 1;
      if (bestG < th2) continue;
      var sx = AXES[bestK * 2] * d, sy = AXES[bestK * 2 + 1] * d;
      var ia = beyond(p, x, y, -sx, -sy), ib = ia < 0 ? -1 : beyond(p, x, y, sx, sy);
      if (ib < 0) continue;
      var dot = 0;
      for (c = 0; c < 3; c++) dot += (lab[ia * 3 + c] - lab[p * 3 + c]) * (lab[ib * 3 + c] - lab[p * 3 + c]);
      if (dot < 0) kind[p] = 2 + bestK;
    }
    return kind;
  }

  /* ------------------------------------------------------------ labels */

  function assignLabels(lab, alpha, n, cent, K) {
    var out = new Uint8Array(n);
    for (var i = 0; i < n; i++) {
      if (alpha[i] < 128) { out[i] = TR; continue; }
      var L = lab[i * 3], a = lab[i * 3 + 1], b = lab[i * 3 + 2], best = 0, bd = Infinity;
      for (var k = 0; k < K; k++) {
        var d0 = L - cent[k * 3], d1 = a - cent[k * 3 + 1], d2 = b - cent[k * 3 + 2];
        var d = d0 * d0 + d1 * d1 + d2 * d2;
        if (d < bd) { bd = d; best = k; }
      }
      out[i] = best;
    }
    return out;
  }

  // Edge-aware labelling. Flat pixels and local extremes take their nearest
  // palette colour. A ramp pixel belongs to an edge, so it may only take the
  // colour found at one end of its ramp or the other: a blend that happens to
  // match a third palette colour can no longer leave an outline of it.
  function labelEdges(lab, alpha, w, h, cent, K, kind, o) {
    var n = w * h, lbl0 = assignLabels(lab, alpha, n, cent, K), lbl = lbl0.slice(), x, y, p, k, f, c;
    var near2 = new Float32Array(K).fill(Infinity);
    for (k = 0; k < K; k++) for (f = 0; f < K; f++) if (f !== k) { var dd = dist3(cent, k, f); if (dd * dd < near2[k]) near2[k] = dd * dd; }

    // 1. Local extremes: the centre lines of thin strokes and thin gaps.
    // Anti-aliasing can leave a stroke narrower than a pixel at well under
    // half strength, so "nearest colour" would hand it to the background or
    // to some unrelated in-between colour. Instead each extreme is read as a
    // blend of the flat colour around it (A) and one other palette colour (F).
    var tau = o.tau, tau2 = tau * tau, radii = [o.r, o.r * 2], votes = new Int32Array(K);
    function around(x0, y0) {
      var best = -1, bv = 0, k2, c2;
      votes.fill(0);
      for (k2 = 0; k2 < 4; k2++) for (c2 = 0; c2 < 2; c2++) for (var sg = -1; sg <= 1; sg += 2) {
        var qx = x0 + sg * AXES[k2 * 2] * radii[c2], qy = y0 + sg * AXES[k2 * 2 + 1] * radii[c2];
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
        var q = qy * w + qx;
        if (kind[q] !== 0 || lbl0[q] === TR) continue;
        if (++votes[lbl0[q]] > bv) { bv = votes[lbl0[q]]; best = lbl0[q]; }
      }
      return best;
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      p = y * w + x;
      if (kind[p] !== 1 || lbl0[p] === TR) continue;
      var a = around(x, y);
      if (a < 0) continue;
      var e0 = lab[p * 3] - cent[a * 3], e1 = lab[p * 3 + 1] - cent[a * 3 + 1], e2 = lab[p * 3 + 2] - cent[a * 3 + 2];
      var dev2 = e0 * e0 + e1 * e1 + e2 * e2;
      if (dev2 < tau2 * near2[a]) { lbl[p] = a; continue; }
      var bf = -1, bt = 0, berr = Infinity, d0 = 0, d1 = 0, d2 = 0, bl2 = 1;
      for (f = 0; f < K; f++) {
        if (f === a) continue;
        var f0 = cent[f * 3] - cent[a * 3], f1 = cent[f * 3 + 1] - cent[a * 3 + 1], f2 = cent[f * 3 + 2] - cent[a * 3 + 2];
        var l2 = f0 * f0 + f1 * f1 + f2 * f2, t = (e0 * f0 + e1 * f1 + e2 * f2) / l2;
        if (t < tau || t > 1.3) continue;
        var err = Math.sqrt(Math.max(0, dev2 - t * t * l2));
        if (err > Math.max(0.03, Math.min(0.08, 0.3 * Math.min(t, 1) * Math.sqrt(l2)))) continue;
        // take the colour that explains the pixel best; between two that do
        // equally well, the one the pixel is closer to
        if (err < berr - 0.02 || (err <= berr + 0.02 && t > bt)) { bf = f; bt = t; berr = Math.min(berr, err); d0 = f0; d1 = f1; d2 = f2; bl2 = l2; }
      }
      if (bf < 0) continue;
      if (bt >= 0.5) { lbl[p] = bf; continue; }
      // A ridge falls away on both sides along some axis and rises on both
      // sides along none: the dip where two blurred shapes nearly touch does
      // the second, and is a gap, not a stroke.
      var drop = Math.max(0.1, 0.4 * bt), ridge = false, saddle = false, body = 0;
      for (k = 0; k < 4 && !saddle; k++) for (c = 0; c < 2 && !saddle; c++) {
        var ox = AXES[k * 2] * radii[c], oy = AXES[k * 2 + 1] * radii[c], side = [0, 0];
        for (var sg2 = 0; sg2 < 2; sg2++) {
          var qx = x + (sg2 ? ox : -ox), qy = y + (sg2 ? oy : -oy);
          if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
          var q = qy * w + qx;
          if (alpha[q] < 128) continue;
          side[sg2] = ((lab[q * 3] - cent[a * 3]) * d0 + (lab[q * 3 + 1] - cent[a * 3 + 1]) * d1 + (lab[q * 3 + 2] - cent[a * 3 + 2]) * d2) / bl2;
        }
        var lo = Math.min(side[0], side[1]), hi = Math.max(side[0], side[1]);
        if (hi <= bt - drop) ridge = true;
        if (lo >= bt + 0.12) saddle = true;
        // stronger one way and fading out the other: just past a stroke's end
        if (hi >= bt + 0.12 && lo <= 0.6 * bt && hi > body) body = hi;
      }
      // past the end of a stroke the ink fades out: stop at half its strength
      lbl[p] = ridge && !saddle && bt >= 0.5 * Math.min(1, body) ? bf : a;
    }

    // 2. Ramp pixels: walk along the ramp to the settled pixel at each end
    // and take whichever of those two colours is closer.
    var reach = o.reach;
    function walk(x0, y0, ox, oy) {
      for (var j = 1; j <= reach; j++) {
        var qx = x0 + ox * j, qy = y0 + oy * j;
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) return -2;
        var q = qy * w + qx;
        if (alpha[q] < 128) return -2;
        if (kind[q] < 2) return lbl[q];
      }
      return -1;
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      p = y * w + x;
      if (kind[p] < 2 || lbl0[p] === TR) continue;
      k = kind[p] - 2;
      var la = walk(x, y, -AXES[k * 2], -AXES[k * 2 + 1]), lb = walk(x, y, AXES[k * 2], AXES[k * 2 + 1]);
      if (la === -1 || lb === -1 || (la < 0 && lb < 0)) continue; // a long gradient, not an edge
      if (la < 0) la = lb;
      if (lb < 0) lb = la;
      if (la === lb) { lbl[p] = la; continue; }
      var da = 0, db = 0;
      for (c = 0; c < 3; c++) {
        var ua = lab[p * 3 + c] - cent[la * 3 + c], ub = lab[p * 3 + c] - cent[lb * 3 + c];
        da += ua * ua; db += ub * ub;
      }
      lbl[p] = da <= db ? la : lb;
    }
    return lbl;
  }

  // An anti-aliased edge between colours A and B passes through blends that
  // can match a third palette colour, leaving a thin outline of it. Any short
  // run of a colour that sits between its two different neighbours is handed
  // back to whichever neighbour each pixel is closer to.
  function removeHalos(lbl, lab, w, h, cent, K, maxRun) {
    var tbl = new Uint8Array(K * K * K), a, b, c;
    for (c = 0; c < K; c++) for (a = 0; a < K; a++) for (b = 0; b < K; b++) {
      if (a === b || a === c || b === c) continue;
      var bt = betweenness(cent, c, a, b), ab = dist3(cent, a, b);
      // a blend of its two neighbours, or a near-copy of one of them (the
      // overshoot rim that resizing and sharpening leave inside an edge)
      if ((bt && bt.t > 0.06 && bt.t < 0.94 && bt.off < 0.5 && bt.off * ab < 0.1) || Math.min(dist3(cent, c, a), dist3(cent, c, b)) < 0.3 * ab) tbl[(c * K + a) * K + b] = 1;
    }
    function closer(p, la, lb) {
      var da = 0, db = 0;
      for (var k = 0; k < 3; k++) {
        var u = lab[p * 3 + k] - cent[la * 3 + k], v = lab[p * 3 + k] - cent[lb * 3 + k];
        da += u * u; db += v * v;
      }
      return da <= db ? la : lb;
    }
    // A run of colour c inside colour a is a real thin stroke only if the
    // pixels turn back toward a on both sides. If they are lighter on one
    // side and darker on the other, the run is one step of a blurred edge.
    function stepOnRamp(before, first, last, after, a, c) {
      var l2 = 0, tb = 0, tf = 0, tl = 0, ta = 0;
      for (var k = 0; k < 3; k++) {
        var dv = cent[c * 3 + k] - cent[a * 3 + k];
        l2 += dv * dv;
        tb += (lab[before * 3 + k] - cent[a * 3 + k]) * dv; tf += (lab[first * 3 + k] - cent[a * 3 + k]) * dv;
        tl += (lab[last * 3 + k] - cent[a * 3 + k]) * dv; ta += (lab[after * 3 + k] - cent[a * 3 + k]) * dv;
      }
      return l2 > 0 && (tb - tf) * (ta - tl) < 0 && Math.abs(ta - tb) >= 0.1 * l2;
    }
    function pass(count, len, stride, cross) {
      for (var line = 0; line < count; line++) {
        var base = line * cross, i = 1;
        while (i < len - 1) {
          var p = base + i * stride, cl = lbl[p], j = i + 1;
          while (j < len && lbl[base + j * stride] === cl) j++;
          if (j < len && j - i <= maxRun && cl !== TR) {
            var la = lbl[p - stride], lb = lbl[base + j * stride];
            if (la !== TR && lb !== TR && la !== lb && la !== cl && tbl[(cl * K + la) * K + lb]) {
              for (var q = i; q < j; q++) lbl[base + q * stride] = closer(base + q * stride, la, lb);
            } else if (la === lb && la !== TR && stepOnRamp(p - stride, p, base + (j - 1) * stride, base + j * stride, la, cl)) {
              for (q = i; q < j; q++) lbl[base + q * stride] = la;
            }
          }
          i = j;
        }
      }
    }
    for (var round = 0; round < 2; round++) {
      pass(h, w, 1, w); // along rows
      pass(w, h, w, 1); // along columns
    }
  }

  function components(lbl, w, h, eight) {
    var n = w * h, par = new Int32Array(n), i, x, y;
    for (i = 0; i < n; i++) par[i] = i;
    function find(a) {
      while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; }
      return a;
    }
    function join(a, b) {
      a = find(a); b = find(b);
      if (a !== b) { if (a < b) par[b] = a; else par[a] = b; }
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      var l = lbl[i];
      if (x > 0 && lbl[i - 1] === l) join(i, i - 1);
      if (y > 0) {
        if (lbl[i - w] === l) join(i, i - w);
        if (eight) {
          if (x > 0 && lbl[i - w - 1] === l) join(i, i - w - 1);
          if (x < w - 1 && lbl[i - w + 1] === l) join(i, i - w + 1);
        }
      }
    }
    var comp = new Int32Array(n), count = 0;
    for (i = 0; i < n; i++) {
      var r = find(i);
      if (r === i) comp[i] = count++; else comp[i] = comp[r];
    }
    var area = new Int32Array(count);
    for (i = 0; i < n; i++) area[comp[i]]++;
    return { comp: comp, count: count, area: area };
  }

  // Where two blurred edges meet (an inside corner, the gap between two
  // letters) the blend can settle on a third palette colour and leave a small
  // blob of it. Such a blob touches both of the colours it sits between and
  // has no flat interior of its own; a real patch of that colour does.
  function dissolveBlends(lbl, lab, kind, w, h, cent, K, maxArea) {
    var cc = components(lbl, w, h, false), comp = cc.comp, area = cc.area, n = w * h, i, d;
    var flatN = new Int32Array(cc.count), edges = new Map();
    for (i = 0; i < n; i++) {
      var c = comp[i];
      if (area[c] > maxArea || lbl[i] === TR) continue;
      if (kind[i] === 0) flatN[c]++;
      var x = i % w, y = (i / w) | 0;
      for (d = 0; d < 4; d++) {
        var nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        var q = ny * w + nx;
        if (comp[q] === c || lbl[q] === TR) continue;
        var key = c * 256 + lbl[q];
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
    var top = new Map(); // component -> [label a, count a, label b, count b]
    edges.forEach(function (count, key) {
      var c2 = Math.floor(key / 256), l = key % 256, t = top.get(c2);
      if (!t) top.set(c2, (t = [-1, 0, -1, 0]));
      if (count > t[1]) { t[2] = t[0]; t[3] = t[1]; t[0] = l; t[1] = count; } else if (count > t[3]) { t[2] = l; t[3] = count; }
    });
    var target = new Map();
    top.forEach(function (t, c2) {
      if (t[2] < 0 || t[3] < 0.15 * (t[1] + t[3]) || flatN[c2] > 0.15 * area[c2]) return;
      target.set(c2, t);
    });
    if (!target.size) return;
    for (i = 0; i < n; i++) {
      var tg = target.get(comp[i]);
      if (!tg) continue;
      var own = lbl[i], a = tg[0], b = tg[2];
      var bt = betweenness(cent, own, a, b), ab = dist3(cent, a, b);
      if (!((bt && bt.t > 0.06 && bt.t < 0.94 && bt.off < 0.5 && bt.off * ab < 0.1) || Math.min(dist3(cent, own, a), dist3(cent, own, b)) < Math.min(0.12, 0.3 * ab))) { target.delete(comp[i]); continue; }
      var da = 0, db = 0;
      for (var k = 0; k < 3; k++) {
        var ua = lab[i * 3 + k] - cent[a * 3 + k], ub = lab[i * 3 + k] - cent[b * 3 + k];
        da += ua * ua; db += ub * ub;
      }
      lbl[i] = da <= db ? a : b;
    }
  }

  // Merge regions smaller than minArea into the neighbour they share the most
  // border with, preferring neighbours that are themselves large enough.
  function despeckle(lbl, w, h, minArea, K, cent, keepArea) {
    if (minArea <= 1) return;
    var n = w * h, hist = new Float64Array(256);
    for (var iter = 0; iter < 4; iter++) {
      var cc = components(lbl, w, h, true), comp = cc.comp, area = cc.area, i, c;
      var start = new Int32Array(cc.count + 1), small = 0;
      for (c = 0; c < cc.count; c++) {
        if (area[c] < minArea) { start[c + 1] = area[c]; small++; }
      }
      if (!small) return;
      for (c = 0; c < cc.count; c++) start[c + 1] += start[c];
      var fill = start.slice(0, cc.count), order = new Int32Array(start[cc.count]);
      for (i = 0; i < n; i++) if (area[comp[i]] < minArea) order[fill[comp[i]]++] = i;
      var target = new Int16Array(cc.count).fill(-1), any = false;
      for (c = 0; c < cc.count; c++) {
        if (area[c] >= minArea) continue;
        var own = lbl[order[start[c]]], seen = [];
        for (var s = start[c]; s < start[c + 1]; s++) {
          var p = order[s], x = p % w, y = (p / w) | 0;
          for (var d = 0; d < 4; d++) {
            var nx = x + DX[d], ny = y + DY[d];
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            var q = ny * w + nx;
            if (comp[q] === c) continue;
            var lq = lbl[q];
            if (hist[lq] === 0) seen.push(lq);
            hist[lq] += area[comp[q]] >= minArea ? 64 : 1;
          }
        }
        var best = -1, bv = 0;
        for (var t = 0; t < seen.length; t++) {
          var lv = seen[t];
          // opaque specks never dissolve into transparency
          if (!(lv === TR && own !== TR) && hist[lv] > bv) { bv = hist[lv]; best = lv; }
          hist[lv] = 0;
        }
        // a small but high-contrast mark (the dot of an i, a full stop) stays
        if (best >= 0 && keepArea && area[c] >= keepArea && own !== TR && best !== TR && dist3(cent, own, best) >= 0.3) best = -1;
        if (best >= 0) { target[c] = best; any = true; }
      }
      if (!any) return;
      for (i = 0; i < n; i++) if (target[comp[i]] >= 0) lbl[i] = target[comp[i]];
    }
  }

  /* ---------------------------------------------------- boundary graph */

  // Vertex kinds: 2 = boundary passes through, 3 = junction, 5/6 = saddle
  // (two regions touching diagonally) resolved to one of its two pairings.
  var PAIR5 = [1, 0, 3, 2]; // W-N and E-S paired: the NE/SW label stays connected
  var PAIR6 = [3, 2, 1, 0]; // N-E and S-W paired: the NW/SE label stays connected

  function buildGraph(lbl, w, h, area) {
    var W1 = w + 1, hN = (h + 1) * w, vN = h * W1, x, y, d;
    var ex = new Uint8Array(hN + vN);
    for (y = 0; y <= h; y++) for (x = 0; x < w; x++) {
      var up = y > 0 ? lbl[(y - 1) * w + x] : TR, dn = y < h ? lbl[y * w + x] : TR;
      if (up !== dn) ex[y * w + x] = 1;
    }
    for (y = 0; y < h; y++) for (x = 0; x <= w; x++) {
      var lf = x > 0 ? lbl[y * w + x - 1] : TR, rt = x < w ? lbl[y * w + x] : TR;
      if (lf !== rt) ex[hN + y * W1 + x] = 1;
    }
    function key(px, py, dd) {
      return dd === 0 ? py * w + px : dd === 2 ? py * w + px - 1 : dd === 1 ? hN + py * W1 + px : hN + (py - 1) * W1 + px;
    }
    function has(px, py, dd) {
      if (dd === 0) return px < w && ex[py * w + px] === 1;
      if (dd === 2) return px > 0 && ex[py * w + px - 1] === 1;
      if (dd === 1) return py < h && ex[hN + py * W1 + px] === 1;
      return py > 0 && ex[hN + (py - 1) * W1 + px] === 1;
    }
    var vt = new Uint8Array((h + 1) * W1);
    for (y = 0; y <= h; y++) for (x = 0; x <= w; x++) {
      var dg = (has(x, y, 0) ? 1 : 0) + (has(x, y, 1) ? 1 : 0) + (has(x, y, 2) ? 1 : 0) + (has(x, y, 3) ? 1 : 0);
      if (dg === 4) {
        var nw = lbl[(y - 1) * w + x - 1], ne = lbl[(y - 1) * w + x], sw = lbl[y * w + x - 1], se = lbl[y * w + x];
        if (nw === se && ne === sw) {
          // Keep the locally rarer colour connected, so a thin diagonal line
          // stays one shape instead of a string of touching squares.
          var ca = 0, cb = 0;
          for (var yy = Math.max(0, y - 2); yy < Math.min(h, y + 2); yy++) {
            for (var xx = Math.max(0, x - 2); xx < Math.min(w, x + 2); xx++) {
              var lv = lbl[yy * w + xx];
              if (lv === nw) ca++; else if (lv === ne) cb++;
            }
          }
          if (ca === cb) { ca = area[nw]; cb = area[ne]; }
          dg = ca < cb ? 6 : 5;
        }
      }
      vt[y * W1 + x] = dg === 4 ? 3 : dg;
    }
    function pix(px, py) {
      return px < 0 || py < 0 || px >= w || py >= h ? -1 : py * w + px;
    }
    var chainOf = new Int32Array(hN + vN).fill(-1), chains = [];
    function walk(x0, y0, d0) {
      var id = chains.length, pts = [x0, y0], cx = x0, cy = y0, dd = d0, closed = false;
      var first = key(cx, cy, dd), last = first;
      for (;;) {
        last = key(cx, cy, dd);
        chainOf[last] = id;
        cx += DX[dd]; cy += DY[dd];
        pts.push(cx, cy);
        var t = vt[cy * W1 + cx];
        if (t === 3) break;
        var back = (dd + 2) & 3, nd = -1;
        if (t === 5) nd = PAIR5[back];
        else if (t === 6) nd = PAIR6[back];
        else for (var q = 0; q < 4; q++) if (q !== back && has(cx, cy, q)) { nd = q; break; }
        if (nd < 0) break;
        if (key(cx, cy, nd) === first) { closed = true; break; }
        dd = nd;
      }
      var pl, pr;
      if (d0 === 0) { pl = pix(x0, y0 - 1); pr = pix(x0, y0); }
      else if (d0 === 1) { pl = pix(x0, y0); pr = pix(x0 - 1, y0); }
      else if (d0 === 2) { pl = pix(x0 - 1, y0); pr = pix(x0 - 1, y0 - 1); }
      else { pl = pix(x0 - 1, y0 - 1); pr = pix(x0, y0 - 1); }
      chains.push({
        pts: pts, d0: d0, dEnd: dd, first: first, last: last, closed: closed,
        sx: x0, sy: y0, ex: cx, ey: cy,
        lL: pl < 0 ? TR : lbl[pl], lR: pr < 0 ? TR : lbl[pr],
        len: (pts.length >> 1) - 1
      });
    }
    for (var pass = 0; pass < 2; pass++) {
      for (y = 0; y <= h; y++) for (x = 0; x <= w; x++) {
        var kind = vt[y * W1 + x];
        if (kind < 2 || (pass === 0) !== (kind === 3)) continue;
        for (d = 0; d < 4; d++) if (has(x, y, d) && chainOf[key(x, y, d)] < 0) walk(x, y, d);
      }
    }
    return { chains: chains, chainOf: chainOf, key: key, has: has, W1: W1 };
  }

  /* ------------------------------------------------------ curve fitting */

  // Corner detection. Resampling and anti-aliasing blur every corner over a
  // small zone, so a corner is judged by the directions of the edge either
  // side of that zone, and rebuilt by extending those two edges until they
  // meet. Evenly spread turning (an arc) is left alone.
  function detectCorners(q, pin, N, closed, C) {
    var a = C.a, h = C.h, ks = C.ks, i;
    if (N < 2 * (a + ks) + 2) return;
    var qs = q.slice();
    smooth(qs, pin, N, closed, 1);
    function ix(j) { return closed ? ((j % N) + N) % N : j; }
    function ok(j) { return closed || (j >= 0 && j < N); }
    function ang(i0, i1, j0, j1) {
      var bx = qs[i1 * 2] - qs[i0 * 2], by = qs[i1 * 2 + 1] - qs[i0 * 2 + 1];
      var fx = qs[j1 * 2] - qs[j0 * 2], fy = qs[j1 * 2 + 1] - qs[j0 * 2 + 1];
      return Math.atan2(bx * fy - by * fx, bx * fx + by * fy);
    }
    var tau = new Float32Array(N), cand = [], minTau = C.minAngle * 0.35;
    for (i = 0; i < N; i++) {
      if (!ok(i - h) || !ok(i + h)) continue;
      tau[i] = ang(ix(i - h), i, i, ix(i + h));
      if (Math.abs(tau[i]) >= minTau) cand.push(i);
    }
    cand.sort(function (u, v) { return Math.abs(tau[v]) - Math.abs(tau[u]) || u - v; });
    var taken = [], gap = Math.max(3, 2 * a), t;
    for (var ci = 0; ci < cand.length; ci++) {
      i = cand[ci];
      if (!ok(i - a - ks) || !ok(i + a + ks)) continue;
      var clear = true;
      for (t = 0; t < taken.length && clear; t++) {
        var dd = Math.abs(taken[t] - i);
        if (closed) dd = Math.min(dd, N - dd);
        if (dd < gap) clear = false;
      }
      for (t = -a; t <= a && clear; t++) if (ok(i + t) && pin[ix(i + t)]) clear = false;
      if (!clear) continue;
      var sgn = tau[i] < 0 ? -1 : 1;
      var far = ang(ix(i - a - ks), ix(i - a), ix(i + a), ix(i + a + ks));
      if (far * sgn < C.minAngle) continue;
      if (far * sgn > 2.6) continue; // a U-turn: the end of a thin stroke, which rounds off instead
      var tl = ok(i - a - h) ? tau[ix(i - a - h)] * sgn : 0, tr = ok(i + a + h) ? tau[ix(i + a + h)] * sgn : 0;
      if (Math.max(tl, tr) > 0.55 * Math.abs(tau[i])) continue; // turning continues: an arc
      taken.push(i);
      pin[i] = 1;
      rebuildCorner(q, qs, N, closed, i, C);
    }
  }

  // Total-least-squares line through one arm of a corner, pointing at it.
  function armLine(qs, N, closed, i, dir, a, len) {
    var sx = 0, sy = 0, m = 0, j, idx, list = [];
    for (j = 0; j <= len; j++) {
      idx = i + dir * (a + j);
      if (closed) idx = ((idx % N) + N) % N; else if (idx < 0 || idx >= N) return null;
      list.push(idx); sx += qs[idx * 2]; sy += qs[idx * 2 + 1]; m++;
    }
    sx /= m; sy /= m;
    var xx = 0, xy = 0, yy = 0, ux, uy;
    for (j = 0; j < m; j++) {
      ux = qs[list[j] * 2] - sx; uy = qs[list[j] * 2 + 1] - sy;
      xx += ux * ux; xy += ux * uy; yy += uy * uy;
    }
    var th = 0.5 * Math.atan2(2 * xy, xx - yy), dx = Math.cos(th), dy = Math.sin(th), dev = 0;
    for (j = 0; j < m; j++) {
      ux = qs[list[j] * 2] - sx; uy = qs[list[j] * 2 + 1] - sy;
      dev = Math.max(dev, Math.abs(ux * dy - uy * dx));
    }
    var nx = qs[list[0] * 2] - sx, ny = qs[list[0] * 2 + 1] - sy, proj = nx * dx + ny * dy;
    var fx = qs[list[m - 1] * 2] - sx, fy = qs[list[m - 1] * 2 + 1] - sy;
    if (proj < fx * dx + fy * dy) { dx = -dx; dy = -dy; proj = -proj; }
    return { px: sx + dx * proj, py: sy + dy * proj, dx: dx, dy: dy, dev: dev };
  }

  function rebuildCorner(q, qs, N, closed, i, C) {
    function arm(dir) {
      var L = armLine(qs, N, closed, i, dir, C.a, C.k);
      if (!L || L.dev > 0.3) L = armLine(qs, N, closed, i, dir, C.a, C.ks);
      return L;
    }
    var A = arm(-1), B = arm(1);
    if (!A || !B) return;
    var den = A.dx * B.dy - A.dy * B.dx;
    if (Math.abs(den) < 0.3) return;
    var wx = B.px - A.px, wy = B.py - A.py;
    var t = (wx * B.dy - wy * B.dx) / den, u = (wx * A.dy - wy * A.dx) / den, lim = 3 * C.a + 3;
    if (t < -0.5 || u < -0.5 || t > lim || u > lim) return;
    var cx = A.px + A.dx * t, cy = A.py + A.dy * t, j, f, idx;
    q[i * 2] = cx; q[i * 2 + 1] = cy;
    for (j = 1; j <= C.a; j++) {
      f = j / C.a;
      idx = closed ? (((i - j) % N) + N) % N : i - j;
      q[idx * 2] = cx + (A.px - cx) * f; q[idx * 2 + 1] = cy + (A.py - cy) * f;
      idx = closed ? (i + j) % N : i + j;
      q[idx * 2] = cx + (B.px - cx) * f; q[idx * 2 + 1] = cy + (B.py - cy) * f;
    }
  }

  function smooth(q, pin, N, closed, passes) {
    if (N < 3) return;
    var tmp = new Float32Array(N * 2);
    for (var p = 0; p < passes; p++) {
      for (var i = 0; i < N; i++) {
        if (pin[i] || (!closed && (i === 0 || i === N - 1))) {
          tmp[i * 2] = q[i * 2]; tmp[i * 2 + 1] = q[i * 2 + 1];
          continue;
        }
        var a = i === 0 ? N - 1 : i - 1, b = i === N - 1 ? 0 : i + 1;
        tmp[i * 2] = (q[a * 2] + 2 * q[i * 2] + q[b * 2]) / 4;
        tmp[i * 2 + 1] = (q[a * 2 + 1] + 2 * q[i * 2 + 1] + q[b * 2 + 1]) / 4;
      }
      q.set(tmp);
    }
  }

  function polyArea(q, N) {
    var a = 0;
    for (var i = 0, j = N - 1; i < N; j = i++) a += q[j * 2] * q[i * 2 + 1] - q[i * 2] * q[j * 2 + 1];
    return a / 2;
  }

  /* Schneider's least-squares cubic fit ("An algorithm for automatically
     fitting digitized curves", Graphics Gems, 1990). */
  function bezAt(x0, y0, c, x3, y3, t, out) {
    var m = 1 - t, b0 = m * m * m, b1 = 3 * t * m * m, b2 = 3 * t * t * m, b3 = t * t * t;
    out[0] = b0 * x0 + b1 * c[0] + b2 * c[2] + b3 * x3;
    out[1] = b0 * y0 + b1 * c[1] + b2 * c[3] + b3 * y3;
  }
  function genBezier(P, first, last, u, t1x, t1y, t2x, t2y) {
    var x0 = P[first * 2], y0 = P[first * 2 + 1], x3 = P[last * 2], y3 = P[last * 2 + 1];
    var c00 = 0, c01 = 0, c11 = 0, X0 = 0, X1 = 0;
    for (var i = first; i <= last; i++) {
      var t = u[i - first], m = 1 - t;
      var b0 = m * m * m, b1 = 3 * t * m * m, b2 = 3 * t * t * m, b3 = t * t * t;
      var a1x = t1x * b1, a1y = t1y * b1, a2x = t2x * b2, a2y = t2y * b2;
      c00 += a1x * a1x + a1y * a1y; c01 += a1x * a2x + a1y * a2y; c11 += a2x * a2x + a2y * a2y;
      var tx = P[i * 2] - (x0 * (b0 + b1) + x3 * (b2 + b3));
      var ty = P[i * 2 + 1] - (y0 * (b0 + b1) + y3 * (b2 + b3));
      X0 += a1x * tx + a1y * ty; X1 += a2x * tx + a2y * ty;
    }
    var det = c00 * c11 - c01 * c01, seg = Math.hypot(x3 - x0, y3 - y0);
    var al = Math.abs(det) < 1e-12 ? 0 : (X0 * c11 - X1 * c01) / det;
    var ar = Math.abs(det) < 1e-12 ? 0 : (c00 * X1 - c01 * X0) / det;
    if (al < seg * 1e-6 || ar < seg * 1e-6 || al > seg * 3 || ar > seg * 3) al = ar = seg / 3;
    return [x0 + t1x * al, y0 + t1y * al, x3 + t2x * ar, y3 + t2y * ar];
  }
  var bezTmp = [0, 0];
  function maxError(P, first, last, c, u) {
    var x0 = P[first * 2], y0 = P[first * 2 + 1], x3 = P[last * 2], y3 = P[last * 2 + 1];
    var worst = 0, at = (first + last) >> 1;
    for (var i = first + 1; i < last; i++) {
      bezAt(x0, y0, c, x3, y3, u[i - first], bezTmp);
      var dx = bezTmp[0] - P[i * 2], dy = bezTmp[1] - P[i * 2 + 1], d = dx * dx + dy * dy;
      if (d > worst) { worst = d; at = i; }
    }
    return { err: worst, at: at };
  }
  function reparam(P, first, last, c, u) {
    var x0 = P[first * 2], y0 = P[first * 2 + 1], x3 = P[last * 2], y3 = P[last * 2 + 1];
    var out = new Float64Array(u.length);
    for (var i = first; i <= last; i++) {
      var t = u[i - first], m = 1 - t;
      bezAt(x0, y0, c, x3, y3, t, bezTmp);
      var d1x = 3 * (m * m * (c[0] - x0) + 2 * m * t * (c[2] - c[0]) + t * t * (x3 - c[2]));
      var d1y = 3 * (m * m * (c[1] - y0) + 2 * m * t * (c[3] - c[1]) + t * t * (y3 - c[3]));
      var d2x = 6 * (m * (c[2] - 2 * c[0] + x0) + t * (x3 - 2 * c[2] + c[0]));
      var d2y = 6 * (m * (c[3] - 2 * c[1] + y0) + t * (y3 - 2 * c[3] + c[1]));
      var ex = bezTmp[0] - P[i * 2], ey = bezTmp[1] - P[i * 2 + 1];
      var num = ex * d1x + ey * d1y, den = d1x * d1x + d1y * d1y + ex * d2x + ey * d2y;
      var nt = Math.abs(den) < 1e-12 ? t : t - num / den;
      out[i - first] = nt < 0 ? 0 : nt > 1 ? 1 : nt;
    }
    return out;
  }
  function fitCubic(P, first, last, t1x, t1y, t2x, t2y, err2, lo, hi, out, depth) {
    var x0 = P[first * 2], y0 = P[first * 2 + 1], x3 = P[last * 2], y3 = P[last * 2 + 1];
    if (last - first === 1) {
      var dist = Math.hypot(x3 - x0, y3 - y0) / 3;
      out.push(x0 + t1x * dist, y0 + t1y * dist, x3 + t2x * dist, y3 + t2y * dist, x3, y3);
      return;
    }
    var u = new Float64Array(last - first + 1), i;
    for (i = first + 1; i <= last; i++) {
      u[i - first] = u[i - first - 1] + Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]);
    }
    var total = u[last - first] || 1;
    for (i = 1; i <= last - first; i++) u[i] /= total;
    var c = genBezier(P, first, last, u, t1x, t1y, t2x, t2y);
    var me = maxError(P, first, last, c, u);
    if (me.err < err2) { out.push(c[0], c[1], c[2], c[3], x3, y3); return; }
    if (me.err < err2 * 9) {
      for (var it = 0; it < 4; it++) {
        u = reparam(P, first, last, c, u);
        c = genBezier(P, first, last, u, t1x, t1y, t2x, t2y);
        me = maxError(P, first, last, c, u);
        if (me.err < err2) { out.push(c[0], c[1], c[2], c[3], x3, y3); return; }
      }
    }
    if (depth > 48) {
      for (i = first + 1; i <= last; i++) out.push(NaN, NaN, NaN, NaN, P[i * 2], P[i * 2 + 1]);
      return;
    }
    var split = Math.max(first + 1, Math.min(last - 1, me.at));
    var a = Math.max(lo, split - 2), b = Math.min(hi, split + 2);
    var cx = P[a * 2] - P[b * 2], cy = P[a * 2 + 1] - P[b * 2 + 1], cl = Math.hypot(cx, cy);
    if (cl < 1e-9) { cx = P[(split - 1) * 2] - P[(split + 1) * 2]; cy = P[(split - 1) * 2 + 1] - P[(split + 1) * 2 + 1]; cl = Math.hypot(cx, cy) || 1; }
    cx /= cl; cy /= cl;
    fitCubic(P, first, split, t1x, t1y, cx, cy, err2, lo, hi, out, depth + 1);
    fitCubic(P, split, last, -cx, -cy, t2x, t2y, err2, lo, hi, out, depth + 1);
  }

  // Best-fit line through points i0..i1: the largest residual, and how much
  // the middle of the run bows away from its ends (an arc bows, a noisy
  // straight edge does not).
  function lineStats(P, i0, i1) {
    var n = i1 - i0 + 1, sx = 0, sy = 0, i, ux, uy;
    for (i = i0; i <= i1; i++) { sx += P[i * 2]; sy += P[i * 2 + 1]; }
    sx /= n; sy /= n;
    var xx = 0, xy = 0, yy = 0;
    for (i = i0; i <= i1; i++) {
      ux = P[i * 2] - sx; uy = P[i * 2 + 1] - sy;
      xx += ux * ux; xy += ux * uy; yy += uy * uy;
    }
    var th = 0.5 * Math.atan2(2 * xy, xx - yy), dx = Math.cos(th), dy = Math.sin(th);
    var worst = 0, mid = 0, mc = 0, out = 0, oc = 0, q1 = i0 + n / 4, q3 = i1 - n / 4;
    for (i = i0; i <= i1; i++) {
      var r = (P[i * 2] - sx) * dy - (P[i * 2 + 1] - sy) * dx;
      if (Math.abs(r) > worst) worst = Math.abs(r);
      if (i >= q1 && i <= q3) { mid += r; mc++; } else { out += r; oc++; }
    }
    return { max: worst, bow: mc && oc ? Math.abs(mid / mc - out / oc) : 0, x: sx, y: sy, dx: dx, dy: dy };
  }

  // Straight runs inside a smooth section, found by recursive splitting.
  // An accepted run is trimmed back to where the points actually leave the
  // line, so the neighbouring curve starts at the true tangent point.
  function findRuns(P, a, b, F, runs) {
    var minLen = F.minRun, T = F.lineTol;
    if (b - a < 2 || b - a < minLen * 0.9) return;
    var x0 = P[a * 2], y0 = P[a * 2 + 1], dx = P[b * 2] - x0, dy = P[b * 2 + 1] - y0, len = Math.hypot(dx, dy), i;
    if (len >= minLen) {
      var st = lineStats(P, a, b);
      if (st.max <= T && st.bow <= 0.1 * T) {
        var n = b - a, core = lineStats(P, a + Math.round(n * 0.2), b - Math.round(n * 0.2)), lo = a, hi = b;
        function off(k) { return Math.abs((P[k * 2] - core.x) * core.dy - (P[k * 2 + 1] - core.y) * core.dx); }
        for (i = a + Math.round(n * 0.2); i >= a; i--) { if (off(i) > F.trim) break; lo = i; }
        for (i = b - Math.round(n * 0.2); i <= b; i++) { if (off(i) > F.trim) break; hi = i; }
        if (lo > a + Math.round(n * 0.2)) lo = a + Math.round(n * 0.2);
        if (hi < b - Math.round(n * 0.2)) hi = b - Math.round(n * 0.2);
        if (Math.hypot(P[hi * 2] - P[lo * 2], P[hi * 2 + 1] - P[lo * 2 + 1]) >= minLen * 0.6) runs.push([lo, hi]);
        return;
      }
    }
    if (b - a < 4) return;
    var worst = -1, at = (a + b) >> 1;
    for (i = a + 1; i < b; i++) {
      var d = len > 1e-6 ? Math.abs((P[i * 2] - x0) * dy - (P[i * 2 + 1] - y0) * dx) / len : Math.hypot(P[i * 2] - x0, P[i * 2 + 1] - y0);
      if (d > worst) { worst = d; at = i; }
    }
    findRuns(P, a, at, F, runs);
    findRuns(P, at, b, F, runs);
  }

  // One run of points between two fixed ends (corner, junction or seam):
  // straight stretches become lines, everything between them fitted curves
  // that leave each line along its direction.
  function fitSection(P, a, b, tS, tE, F, out) {
    var x3 = P[b * 2], y3 = P[b * 2 + 1], i, l;
    if (b - a < 2) { out.push(NaN, NaN, NaN, NaN, x3, y3); return; }
    var dx = x3 - P[a * 2], dy = y3 - P[a * 2 + 1], len = Math.hypot(dx, dy);
    if (len > 1e-9) {
      var worst = 0;
      for (i = a + 1; i < b; i++) {
        var d = Math.abs((P[i * 2] - P[a * 2]) * dy - (P[i * 2 + 1] - P[a * 2 + 1]) * dx) / len;
        if (d > worst) worst = d;
      }
      if (worst <= F.tol * 0.75) { out.push(NaN, NaN, NaN, NaN, x3, y3); return; }
    }
    var runs = [], r;
    findRuns(P, a, b, F, runs);
    // Neighbouring "lines" that meet at a slight angle are really chords of
    // a gentle arc: hand them back to the curve fitter.
    var drop = [];
    for (r = 0; r + 1 < runs.length; r++) {
      var A = runs[r], B = runs[r + 1];
      if (B[0] - A[1] > F.minRun * 4) continue;
      var bend = Math.abs(Math.atan2(
        (P[A[1] * 2] - P[A[0] * 2]) * (P[B[1] * 2 + 1] - P[B[0] * 2 + 1]) - (P[A[1] * 2 + 1] - P[A[0] * 2 + 1]) * (P[B[1] * 2] - P[B[0] * 2]),
        (P[A[1] * 2] - P[A[0] * 2]) * (P[B[1] * 2] - P[B[0] * 2]) + (P[A[1] * 2 + 1] - P[A[0] * 2 + 1]) * (P[B[1] * 2 + 1] - P[B[0] * 2 + 1])));
      if (bend > 0.035 && bend < 0.6) drop[r] = drop[r + 1] = true;
    }
    runs = runs.filter(function (_, k) { return !drop[k]; });
    function dirOf(run, sign) {
      var ux = (P[run[1] * 2] - P[run[0] * 2]) * sign, uy = (P[run[1] * 2 + 1] - P[run[0] * 2 + 1]) * sign, ul = Math.hypot(ux, uy) || 1;
      return [ux / ul, uy / ul];
    }
    function curve(i0, i1, t0, t1) {
      if (i1 <= i0) return;
      if (i1 - i0 === 1 && !t0 && !t1) { out.push(NaN, NaN, NaN, NaN, P[i1 * 2], P[i1 * 2 + 1]); return; }
      var span = Math.min(i1 - i0, 3);
      if (!t0) {
        t0 = [P[(i0 + span) * 2] - P[i0 * 2], P[(i0 + span) * 2 + 1] - P[i0 * 2 + 1]];
        l = Math.hypot(t0[0], t0[1]) || 1; t0 = [t0[0] / l, t0[1] / l];
      }
      if (!t1) {
        t1 = [P[(i1 - span) * 2] - P[i1 * 2], P[(i1 - span) * 2 + 1] - P[i1 * 2 + 1]];
        l = Math.hypot(t1[0], t1[1]) || 1; t1 = [t1[0] / l, t1[1] / l];
      }
      fitCubic(P, i0, i1, t0[0], t0[1], t1[0], t1[1], F.tol * F.tol, i0, i1, out, 0);
    }
    var pos = a;
    for (r = 0; r < runs.length; r++) {
      curve(pos, runs[r][0], pos === a ? tS : dirOf(runs[r - 1], 1), dirOf(runs[r], -1));
      out.push(NaN, NaN, NaN, NaN, P[runs[r][1] * 2], P[runs[r][1] * 2 + 1]);
      pos = runs[r][1];
    }
    curve(pos, b, pos === a ? tS : dirOf(runs[runs.length - 1], 1), tE);
  }

  function fitChains(G, w, h, P) {
    var chains = G.chains, W1 = G.W1, ci, ch, i;

    // 1. points, corners, smoothing
    var img = P.img, lbl = P.lbl, rgb = P.rgb;
    // A removed background is still an opaque colour in the pixels.
    function labelAt(i) {
      var l = lbl[i];
      return l === TR && P.bg >= 0 && img[i * 4 + 3] >= 128 ? P.bg : l;
    }
    // How far pixel i has blended from palette colour A toward colour F, 0..1.
    function blend(i, A, F) {
      var ax = rgb[A * 3], ay = rgb[A * 3 + 1], az = rgb[A * 3 + 2];
      var bx = rgb[F * 3] - ax, by = rgb[F * 3 + 1] - ay, bz = rgb[F * 3 + 2] - az, l2 = bx * bx + by * by + bz * bz;
      if (l2 < 1) return 0;
      // Brightness alone when the two colours differ enough in it: JPEG keeps
      // colour at half resolution, so brightness places an edge more finely.
      var dl = 0.299 * bx + 0.587 * by + 0.114 * bz, t;
      if (dl > 48 || dl < -48) t = (0.299 * (img[i * 4] - ax) + 0.587 * (img[i * 4 + 1] - ay) + 0.114 * (img[i * 4 + 2] - az)) / dl;
      else t = ((img[i * 4] - ax) * bx + (img[i * 4 + 1] - ay) * by + (img[i * 4 + 2] - az) * bz) / l2;
      return t < 0 ? 0 : t > 1 ? 1 : t;
    }
    // Thin strokes. Crossing a stroke of colour F on colour A along one row
    // or column, blur and anti-aliasing spread its ink but keep the total:
    // the sum of the blend values is its true width and their centroid its
    // centre, however faint it is. `axis` 0 scans along x, 1 along y; `a` is
    // the position along the scan and `b` the line being scanned.
    var TH = P.thin, TAIL = P.tail, NEAR = P.near, prof = { S: 0, c: 0, s: 0, e: 0 };
    function at(axis, a, b) { return axis ? a * w + b : b * w + a; }
    function profile(axis, a0, b, F, A) {
      var len = axis ? h : w, s0 = a0, e0 = a0, j, t, prev, i;
      while (s0 > 0 && e0 - s0 < TH && labelAt(at(axis, s0 - 1, b)) === F) s0--;
      while (e0 < len - 1 && e0 - s0 < TH && labelAt(at(axis, e0 + 1, b)) === F) e0++;
      if (e0 - s0 >= TH || s0 === 0 || e0 === len - 1) return false;
      if (labelAt(at(axis, s0 - 1, b)) !== A || labelAt(at(axis, e0 + 1, b)) !== A) return false;
      // The tails run out while the ink keeps falling. Where a tail levels
      // off above zero, something else nearby (a crossing stroke) is adding
      // ink of its own; that level is taken off as a baseline.
      var first = s0, last = e0, baseLo = 0, baseHi = 0;
      prev = blend(at(axis, s0, b), A, F);
      for (j = s0 - 1; j >= 0 && s0 - j <= TAIL; j--) {
        i = at(axis, j, b);
        if (labelAt(i) !== A) { baseLo = prev; break; }
        t = blend(i, A, F);
        if (t < 0.02) break;
        if (t > prev - 0.01) { baseLo = Math.min(t, prev); break; }
        first = j; prev = t;
        if (s0 - j === TAIL) baseLo = t;
      }
      prev = blend(at(axis, e0, b), A, F);
      for (j = e0 + 1; j < len && j - e0 <= TAIL; j++) {
        i = at(axis, j, b);
        if (labelAt(i) !== A) { baseHi = prev; break; }
        t = blend(i, A, F);
        if (t < 0.02) break;
        if (t > prev - 0.01) { baseHi = Math.min(t, prev); break; }
        last = j; prev = t;
        if (j - e0 === TAIL) baseHi = t;
      }
      var base = Math.min(baseLo, baseHi), S = 0, M = 0;
      if (base > 0.6) return false;
      for (j = first; j <= last; j++) {
        t = (blend(at(axis, j, b), A, F) - base) / (1 - base);
        if (t > 0) { S += t; M += t * (j + 0.5); }
      }
      if (S < 0.3) return false;
      prof.S = S; prof.c = M / S; prof.s = s0; prof.e = e0;
      return true;
    }
    // One edge of the thin stroke through (a0, b): side -1 is its lower edge,
    // +1 its upper. Near the end of a stroke the ink fades because the stroke
    // stops, not because it narrows, so the width is taken from the lines
    // next door where the stroke is at full strength, giving a square end.
    function strokeEdge(axis, a0, b, F, A, side) {
      if (!profile(axis, a0, b, F, A)) return NaN;
      var S = prof.S, c = prof.c, s0 = prof.s, e0 = prof.e, len = axis ? h : w, lines = axis ? w : h;
      var count = [0, 0], body = [0, 0], prev = [0, 0];
      for (var d = 0; d < 2; d++) {
        var lo = s0, hi = e0;
        for (var k = 1; k <= NEAR; k++) {
          var bb = b + (d ? k : -k), found = -1;
          if (bb < 0 || bb >= lines) break;
          for (var a = Math.max(0, lo - 1); a <= hi + 1 && a < len; a++) if (labelAt(at(axis, a, bb)) === F) { found = a; break; }
          if (found < 0 || !profile(axis, found, bb, F, A)) break;
          count[d] = k; prev[d] = body[d]; body[d] = prof.S;
          lo = prof.s; hi = prof.e;
        }
      }
      // An end: the stroke stops on one side and, on the other, runs on at a
      // steady, greater width. (A point that keeps widening is a wedge, such
      // as the tip of a star, and is left as it is.)
      var W = S, on = count[0] <= 1 && count[1] === NEAR ? 1 : count[1] <= 1 && count[0] === NEAR ? 0 : -1;
      if (on >= 0 && body[on] >= 1.25 * S && Math.abs(body[on] - prev[on]) <= 0.1 * body[on]) {
        var r = S / body[on];
        W = r >= 0.55 ? body[on] : body[on] * (r / 0.55) * (r / 0.55);
      }
      return c + side * W / 2;
    }
    // Where the boundary really crosses between two neighbouring pixels: the
    // crack between positions a - 1 and a on line b, as an offset from a.
    function offset(axis, a, b) {
      var p = at(axis, a - 1, b), q = at(axis, a, b), lp = labelAt(p), lq = labelAt(q), tp, tq;
      if (lp === lq) return 0;
      if (lp === TR || lq === TR) {
        tp = img[p * 4 + 3] / 255; tq = img[q * 4 + 3] / 255;
        if (lq === TR) { tp = 1 - tp; tq = 1 - tq; }
      } else {
        if (TH) {
          var Lq = profile(axis, a, b, lq, lp) ? prof.e - prof.s + 1 : 0;
          var Lp = profile(axis, a - 1, b, lp, lq) ? prof.e - prof.s + 1 : 0;
          if (Lq || Lp) {
            var pos = Lq && (!Lp || Lq <= Lp) ? strokeEdge(axis, a, b, lq, lp, -1) : strokeEdge(axis, a - 1, b, lp, lq, 1);
            if (pos === pos) { pos -= a; return pos < -TAIL ? -TAIL : pos > TAIL ? TAIL : pos; }
          }
        }
        tp = blend(p, lp, lq); tq = blend(q, lp, lq);
      }
      if (tq - tp < 0.15) return 0;
      // one side saturated: a one-pixel coverage ramp; otherwise a wider ramp
      var e = tp <= 0.03 || tq >= 0.97 ? 1 - tp - tq : -0.5 + (0.5 - tp) / (tq - tp);
      return e < -0.5 ? -0.5 : e > 0.5 ? 0.5 : e;
    }
    for (ci = 0; ci < chains.length; ci++) {
      ch = chains[ci];
      var v = ch.pts, n = ch.len, pts = [], pins = [];
      if (!ch.closed) { pts.push(v[0], v[1]); pins.push(3); }
      for (i = 0; i < n; i++) {
        var x1 = v[i * 2], y1 = v[i * 2 + 1], x2 = v[i * 2 + 2], y2 = v[i * 2 + 3];
        if (i > 0 || ch.closed) {
          if ((x1 === 0 || x1 === w) && (y1 === 0 || y1 === h)) { pts.push(x1, y1); pins.push(2); }
        }
        var mx0 = (x1 + x2) / 2, my0 = (y1 + y2) / 2;
        if (y1 === y2) {
          var xm = Math.min(x1, x2);
          if (y1 > 0 && y1 < h) my0 += offset(1, y1, xm);
        } else {
          var ym = Math.min(y1, y2);
          if (x1 > 0 && x1 < w) mx0 += offset(0, x1, ym);
        }
        pts.push(mx0, my0);
        pins.push(0);
      }
      if (!ch.closed) { pts.push(v[n * 2], v[n * 2 + 1]); pins.push(3); }
      var N = pins.length, q = new Float32Array(pts), pin = new Uint8Array(pins);
      detectCorners(q, pin, N, ch.closed, P.corner);
      var free = true;
      for (i = 0; i < N; i++) if (pin[i]) { free = false; break; }
      smooth(q, pin, N, ch.closed, P.passes);
      if (ch.closed && free && N >= 4) {
        // smoothing a closed curve shrinks it; restore the pixel area
        var a0 = Math.abs(polyArea(v, n)), a1 = Math.abs(polyArea(q, N));
        if (a1 > 1e-6) {
          var sc = Math.min(1.4, Math.max(1, Math.sqrt(a0 / a1))), mx = 0, my = 0;
          for (i = 0; i < N; i++) { mx += q[i * 2]; my += q[i * 2 + 1]; }
          mx /= N; my /= N;
          for (i = 0; i < N; i++) { q[i * 2] = mx + (q[i * 2] - mx) * sc; q[i * 2 + 1] = my + (q[i * 2 + 1] - my) * sc; }
        }
      }
      ch.q = q; ch.pin = pin; ch.N = N; ch.tS = null; ch.tE = null;
    }

    // 2. junctions: where two of the edges meeting at a junction continue each
    // other, let that boundary pass straight through with one shared tangent.
    var jmap = new Map();
    function addArm(x, y, c, end) {
      var kx = y * W1 + x, list = jmap.get(kx);
      if (!list) jmap.set(kx, (list = []));
      list.push(c, end);
    }
    for (ci = 0; ci < chains.length; ci++) {
      ch = chains[ci];
      if (ch.closed) continue;
      addArm(ch.sx, ch.sy, ci, 0); addArm(ch.ex, ch.ey, ci, 1);
    }
    function armPoint(c, end, m) {
      var cq = chains[c].q, cn = chains[c].N, idx = end === 0 ? Math.min(m, cn - 1) : Math.max(0, cn - 1 - m);
      return [cq[idx * 2], cq[idx * 2 + 1]];
    }
    jmap.forEach(function (list, kx) {
      var m = list.length >> 1;
      if (m < 3) return;
      var jx = kx % W1, jy = (kx / W1) | 0, dirs = [], a, b;
      for (a = 0; a < m; a++) {
        if (chains[list[a * 2]].N < 6) { dirs.push(null); continue; }
        var p = armPoint(list[a * 2], list[a * 2 + 1], 4), ux = p[0] - jx, uy = p[1] - jy, ul = Math.hypot(ux, uy);
        dirs.push(ul < 1e-6 ? null : [ux / ul, uy / ul]);
      }
      var used = new Array(m).fill(false), moved = false, nx = jx, ny = jy;
      for (var round = 0; round < 2; round++) {
        var best = -0.78, ba = -1, bb = -1;
        for (a = 0; a < m; a++) for (b = a + 1; b < m; b++) {
          if (used[a] || used[b] || !dirs[a] || !dirs[b]) continue;
          var dot = dirs[a][0] * dirs[b][0] + dirs[a][1] * dirs[b][1];
          if (dot < best) { best = dot; ba = a; bb = b; }
        }
        if (ba < 0) break;
        used[ba] = used[bb] = true;
        var ca = list[ba * 2], ea = list[ba * 2 + 1], cb = list[bb * 2], eb = list[bb * 2 + 1];
        if (!moved) {
          var a1 = armPoint(ca, ea, 1), a2 = armPoint(ca, ea, 2), b1 = armPoint(cb, eb, 1), b2 = armPoint(cb, eb, 2);
          nx = (a2[0] + 4 * a1[0] + 6 * jx + 4 * b1[0] + b2[0]) / 16;
          ny = (a2[1] + 4 * a1[1] + 6 * jy + 4 * b1[1] + b2[1]) / 16;
          moved = true;
        }
        var pa = armPoint(ca, ea, 3), pb = armPoint(cb, eb, 3);
        var tx = pb[0] - pa[0], ty = pb[1] - pa[1], tl = Math.hypot(tx, ty);
        if (tl < 1e-6) continue;
        tx /= tl; ty /= tl;
        if (ea === 0) chains[ca].tS = [-tx, -ty]; else chains[ca].tE = [-tx, -ty];
        if (eb === 0) chains[cb].tS = [tx, ty]; else chains[cb].tE = [tx, ty];
      }
      if (moved) {
        for (a = 0; a < m; a++) {
          var cc = chains[list[a * 2]], idx = list[a * 2 + 1] === 0 ? 0 : cc.N - 1;
          cc.q[idx * 2] = nx; cc.q[idx * 2 + 1] = ny; cc.moved = true;
        }
      }
    });

    // 3. fit each chain, storing rounded output coordinates once so both
    // neighbours emit identical numbers
    var sx = P.sx, sy = P.sy, round = function (val) { return Math.round(val * 100) / 100; };
    var nodes = 0;
    for (ci = 0; ci < chains.length; ci++) {
      ch = chains[ci];
      var Q = ch.q, pn = ch.pin, M = ch.N, segs = [];
      if (ch.moved) smooth(Q, pn, M, false, 1);
      if (!ch.closed) {
        if (M <= 3) {
          segs.push(NaN, NaN, NaN, NaN, Q[(M - 1) * 2], Q[(M - 1) * 2 + 1]);
        } else {
          var prev = 0;
          for (i = 1; i < M; i++) {
            if (!pn[i]) continue;
            fitSection(Q, prev, i, prev === 0 ? ch.tS : null, i === M - 1 ? ch.tE : null, P.fit, segs);
            prev = i;
          }
        }
        ch.x0 = round(Q[0] * sx); ch.y0 = round(Q[1] * sy);
      } else {
        var firstPin = -1;
        for (i = 0; i < M; i++) if (pn[i]) { firstPin = i; break; }
        var R = new Float32Array((M + 1) * 2), rp = new Uint8Array(M + 1), off = firstPin < 0 ? 0 : firstPin;
        for (i = 0; i <= M; i++) {
          var src = (i + off) % M;
          R[i * 2] = Q[src * 2]; R[i * 2 + 1] = Q[src * 2 + 1]; rp[i] = pn[src];
        }
        if (firstPin < 0) {
          var j = Math.min(2, M - 1), tx2 = R[j * 2] - R[(M - j) * 2], ty2 = R[j * 2 + 1] - R[(M - j) * 2 + 1];
          var tl2 = Math.hypot(tx2, ty2) || 1;
          tx2 /= tl2; ty2 /= tl2;
          if (M < 4) for (i = 1; i <= M; i++) segs.push(NaN, NaN, NaN, NaN, R[i * 2], R[i * 2 + 1]);
          else fitSection(R, 0, M, [tx2, ty2], [-tx2, -ty2], P.fit, segs);
        } else {
          var pv = 0;
          for (i = 1; i <= M; i++) {
            if (!rp[i] && i !== M) continue;
            fitSection(R, pv, i, null, null, P.fit, segs);
            pv = i;
          }
        }
        ch.x0 = round(R[0] * sx); ch.y0 = round(R[1] * sy);
      }
      for (i = 0; i < segs.length; i += 6) {
        if (segs[i] === segs[i]) {
          segs[i] = round(segs[i] * sx); segs[i + 1] = round(segs[i + 1] * sy);
          segs[i + 2] = round(segs[i + 2] * sx); segs[i + 3] = round(segs[i + 3] * sy);
        }
        segs[i + 4] = round(segs[i + 4] * sx); segs[i + 5] = round(segs[i + 5] * sy);
      }
      ch.segs = segs;
      nodes += segs.length / 6;
      ch.q = ch.pin = ch.pts = null;
    }
    return nodes;
  }

  /* ---------------------------------------------------------- assembly */

  function nextHalfEdge(G, c, dir, accept) {
    var ch = G.chains[c], x, y, d;
    if (dir === 0) { x = ch.ex; y = ch.ey; d = ch.dEnd; } else { x = ch.sx; y = ch.sy; d = (ch.d0 + 2) & 3; }
    var turns = [3, 0, 1]; // keep the region on the left: left, straight, right
    for (var t = 0; t < 3; t++) {
      var nd = (d + turns[t]) & 3;
      if (!G.has(x, y, nd)) continue;
      var k = G.key(x, y, nd), nc = G.chainOf[k], n2 = G.chains[nc];
      var ndir = n2.first === k && n2.sx === x && n2.sy === y && n2.d0 === nd ? 0 : 1;
      if (accept && !accept(nc, ndir)) continue;
      return [nc, ndir];
    }
    return null;
  }

  function loopToPath(G, loop, st) {
    var chains = G.chains, parts = [], px = 0, py = 0, cx = 0, cy = 0, lastLine = -1, i, s;
    function num(vv) { return '' + vv; }
    function line(x, y) {
      if (x === cx && y === cy) return;
      if (lastLine >= 0 && (cx - px) * (y - py) - (cy - py) * (x - px) === 0 && (cx - px) * (x - cx) + (cy - py) * (y - cy) > 0) {
        parts[lastLine] = 'L' + num(x) + ' ' + num(y); // extend a collinear line
      } else {
        px = cx; py = cy; lastLine = parts.length;
        parts.push('L' + num(x) + ' ' + num(y));
        st.nodes++;
      }
      cx = x; cy = y;
    }
    function cubic(a, b, c, d, x, y) {
      parts.push('C' + num(a) + ' ' + num(b) + ' ' + num(c) + ' ' + num(d) + ' ' + num(x) + ' ' + num(y));
      st.nodes++; lastLine = -1; cx = x; cy = y;
    }
    for (i = 0; i < loop.length; i += 2) {
      var ch = chains[loop[i]], S = ch.segs, m = S.length;
      if (loop[i + 1] === 0) {
        if (i === 0) { cx = ch.x0; cy = ch.y0; parts.push('M' + num(cx) + ' ' + num(cy)); }
        for (s = 0; s < m; s += 6) {
          if (S[s] !== S[s]) line(S[s + 4], S[s + 5]); else cubic(S[s], S[s + 1], S[s + 2], S[s + 3], S[s + 4], S[s + 5]);
        }
      } else {
        if (i === 0) { cx = S[m - 2]; cy = S[m - 1]; parts.push('M' + num(cx) + ' ' + num(cy)); }
        for (s = m - 6; s >= 0; s -= 6) {
          var ex = s === 0 ? ch.x0 : S[s - 2], ey = s === 0 ? ch.y0 : S[s - 1];
          if (S[s] !== S[s]) line(ex, ey); else cubic(S[s + 2], S[s + 3], S[s], S[s + 1], ex, ey);
        }
      }
    }
    parts.push('Z');
    return parts.join('');
  }

  // Cut-outs: each colour is one compound path and neighbours share edges
  // exactly. Loops run with their region on the left, so holes wind the
  // other way and the default nonzero fill leaves them open.
  function assembleCutouts(G, order) {
    var chains = G.chains, visited = new Uint8Array(chains.length * 2), st = { nodes: 0 }, data = {};
    for (var c = 0; c < chains.length; c++) for (var dir = 0; dir < 2; dir++) {
      if (visited[c * 2 + dir]) continue;
      var ch = chains[c], lab = dir === 0 ? ch.lL : ch.lR;
      if (lab === TR) { visited[c * 2 + dir] = 1; continue; }
      var loop = [], cur = [c, dir], guard = 0;
      do {
        visited[cur[0] * 2 + cur[1]] = 1;
        loop.push(cur[0], cur[1]);
        if (chains[cur[0]].closed) break;
        cur = nextHalfEdge(G, cur[0], cur[1], null);
      } while (cur && !(cur[0] === c && cur[1] === dir) && ++guard < 1e7);
      (data[lab] || (data[lab] = [])).push(loopToPath(G, loop, st));
    }
    var layers = [];
    for (var o = 0; o < order.length; o++) if (data[order[o]]) layers.push({ color: order[o], paths: [data[order[o]].join('')] });
    return { layers: layers, nodes: st.nodes };
  }

  // Stacked: layer i is the union of every colour drawn at or above it, so
  // each layer fully underlies the ones on top and nothing can show through.
  function assembleStacked(G, K, order) {
    var chains = G.chains, pos = new Int32Array(256).fill(-1), layers = [], st = { nodes: 0 }, i;
    for (i = 0; i < order.length; i++) pos[order[i]] = i;
    var stamp = new Int32Array(chains.length);
    for (i = 0; i < order.length; i++) {
      var d = '';
      var accept = function (nc, ndir) {
        var n2 = chains[nc], l = ndir === 0 ? n2.lL : n2.lR, r = ndir === 0 ? n2.lR : n2.lL;
        return pos[l] >= i && pos[r] < i;
      };
      for (var c = 0; c < chains.length; c++) {
        if (stamp[c] === i + 1) continue;
        var ch = chains[c], inL = pos[ch.lL] >= i, inR = pos[ch.lR] >= i;
        if (inL === inR) continue;
        var dir = inL ? 0 : 1, loop = [], cur = [c, dir], guard = 0;
        do {
          stamp[cur[0]] = i + 1;
          loop.push(cur[0], cur[1]);
          if (chains[cur[0]].closed) break;
          cur = nextHalfEdge(G, cur[0], cur[1], accept);
        } while (cur && !(cur[0] === c && cur[1] === dir) && ++guard < 1e7);
        d += loopToPath(G, loop, st);
      }
      if (d) layers.push({ color: order[i], paths: [d] });
    }
    return { layers: layers, nodes: st.nodes };
  }

  // Order colours so the largest sits at the bottom and colours that share
  // long boundaries are adjacent, which keeps repeated edges to a minimum.
  function stackOrder(G, K, area) {
    var ord = [], i, j;
    for (i = 0; i < K; i++) if (area[i] > 0) ord.push(i);
    ord.sort(function (a, b) { return area[b] - area[a]; });
    var n = ord.length;
    if (n < 3) return ord;
    var W = new Float64Array(K * K), WT = new Float64Array(K);
    for (i = 0; i < G.chains.length; i++) {
      var ch = G.chains[i], a = ch.lL, b = ch.lR;
      if (a === TR && b === TR) continue;
      if (a === TR) WT[b] += ch.len; else if (b === TR) WT[a] += ch.len;
      else { W[a * K + b] += ch.len; W[b * K + a] += ch.len; }
    }
    function cost(o) {
      var s = 0;
      for (var p = 0; p < n; p++) {
        s += WT[o[p]] * (p + 1);
        for (var q2 = p + 1; q2 < n; q2++) s += W[o[p] * K + o[q2]] * (q2 - p);
      }
      return s;
    }
    var best = cost(ord);
    for (var sweep = 0; sweep < 6; sweep++) {
      var improved = false;
      for (i = 1; i < n; i++) for (j = 1; j < n; j++) {
        if (i === j) continue;
        var trial = ord.slice(), item = trial.splice(i, 1)[0];
        trial.splice(j, 0, item);
        var cst = cost(trial);
        if (cst < best - 1e-9) { best = cst; ord = trial; improved = true; }
      }
      if (!improved) break;
    }
    return ord;
  }

  /* -------------------------------------------------------------- main */

  // [smoothing radius, fit tolerance] in source pixels, per smoothing level
  var SMOOTH = [[0.2, 0.1], [0.3, 0.2], [0.5, 0.28], [0.8, 0.4], [1.2, 0.6], [1.8, 0.9]];

  // An image with only a handful of distinct colours has hard, stair-stepped
  // edges and no anti-aliasing to read sub-pixel positions from. Returns its
  // opaque colours (they become the palette as they are), or null otherwise.
  function flatColors(src, n) {
    var seen = new Set(), list = [], rgbSeen = new Set();
    for (var i = 0; i < n; i++) {
      var p = i * 4, key = (src[p] << 24) | (src[p + 1] << 16) | (src[p + 2] << 8) | src[p + 3];
      if (seen.has(key)) continue;
      seen.add(key);
      if (seen.size > 32) return null;
      var rgb = key >>> 8;
      if (src[p + 3] >= 128 && !rgbSeen.has(rgb)) { rgbSeen.add(rgb); list.push([src[p], src[p + 1], src[p + 2]]); }
    }
    return list;
  }

  function* traceSteps(src, sw, sh, o) {
    var t0 = now();
    o = o || {};
    var budget = o.pixels || 800000;
    var s = Math.min(Math.sqrt(budget / (sw * sh)), o.maxUpscale || 2);
    if (s > 0.9 && s < 1.12) s = 1;
    var w = Math.max(2, Math.round(sw * s)), h = Math.max(2, Math.round(sh * s)), n = w * h, i, k;
    var outW = o.outW || sw, outH = o.outH || sh;
    var flat = flatColors(src, sw * sh), aliased = !!flat, noise = aliased ? 0 : noiseLevel(src, sw, sh);
    var level = o.smoothing == null || o.smoothing < 0 ? (aliased ? 4 : noise >= 0.15 ? 2 : 1) : Math.min(SMOOTH.length - 1, o.smoothing | 0);
    function empty() {
      return { width: outW, height: outH, mode: o.mode === 'cutout' ? 'cutout' : 'stacked', gap: false, palette: [], layers: [],
        stats: { paths: 0, nodes: 0, ms: now() - t0, work: [w, h], colors: 0, smoothing: level, aliased: aliased } };
    }

    yield 'Resampling';
    function clean(px, pw, ph) {
      if (noise < 0.15) return px;
      px = denoise(px, pw, ph, 2, noise >= 0.5 ? 34 : 28);
      return noise >= 0.5 ? denoise(px, pw, ph, 2, 26) : px;
    }
    // denoise at whichever resolution is smaller
    // Colours are decided on the cleaned pixels. Edge positions are read from
    // the untouched ones, because cleaning also flattens the soft edges that
    // say where a boundary really runs.
    var exact = noise >= 0.15 ? (w === sw && h === sh ? src : resample(src, sw, sh, w, h)) : null;
    if (s >= 1) src = clean(src, sw, sh);
    var img = w === sw && h === sh ? src : resample(src, sw, sh, w, h);
    if (s < 1) img = clean(img, w, h);

    yield 'Finding colors';
    var lab = new Float32Array(n * 3), alpha = new Uint8Array(n), opaque = 0;
    for (i = 0; i < n; i++) {
      alpha[i] = img[i * 4 + 3];
      if (alpha[i] >= 128) opaque++;
      rgbToLab(img[i * 4], img[i * 4 + 1], img[i * 4 + 2], lab, i * 3);
    }
    var cent, kind = null;
    if (flat && flat.length && !(o.colors | 0)) {
      cent = new Float32Array(flat.length * 3);
      for (i = 0; i < flat.length; i++) rgbToLab(flat[i][0], flat[i][1], flat[i][2], cent, i * 3);
    } else {
      kind = aliased ? null : edgeKinds(lab, alpha, w, h, Math.max(2, Math.round(1.5 * s)), 0.04);
      cent = buildPalette(lab, alpha, w, h, o.colors | 0, kind, noise >= 0.15);
    }
    var K = cent.length / 3;
    if (!K) return empty();

    yield 'Separating regions';
    var up = Math.max(1, s), lbl;
    if (kind) {
      lbl = labelEdges(lab, alpha, w, h, cent, K, kind, {
        tau: noise >= 0.15 ? 0.3 : 0.22, r: Math.max(2, Math.round(1.5 * s)), reach: Math.max(5, Math.round(5 * s))
      });
      removeHalos(lbl, lab, w, h, cent, K, Math.ceil(Math.max(2, 1.5 * s) * 1.5));
      var blob = 2 * Math.max(5, Math.round(5 * s));
      dissolveBlends(lbl, lab, kind, w, h, cent, K, blob * blob);
    } else {
      // hard-edged image: enlarging it made blends along every edge
      lbl = assignLabels(lab, alpha, n, cent, K);
      removeHalos(lbl, lab, w, h, cent, K, Math.ceil(Math.max(2, 1.5 * s) * 1.5));
    }
    lab = kind = null;
    var speck = o.speck == null ? 4 : o.speck;
    despeckle(lbl, w, h, Math.round(speck * up * up), K, cent, Math.max(2, Math.round((noise < 0.15 ? 0.6 : 1) * up * up)));

    var bg = -1;
    if (o.removeBackground) {
      var edge = new Float64Array(256), x, y;
      for (x = 0; x < w; x++) { edge[lbl[x]]++; edge[lbl[(h - 1) * w + x]]++; }
      for (y = 0; y < h; y++) { edge[lbl[y * w]]++; edge[lbl[y * w + w - 1]]++; }
      var bv = 0;
      for (k = 0; k < K; k++) if (edge[k] > bv) { bv = edge[k]; bg = k; }
      if (bg >= 0 && bv > (w + h) * 0.5) { for (i = 0; i < n; i++) if (lbl[i] === bg) lbl[i] = TR; } else bg = -1;
    }
    var area = new Float64Array(256), rgb = new Float32Array(K * 3), palette = [];
    for (i = 0; i < n; i++) area[lbl[i]]++;
    for (k = 0; k < K; k++) {
      var c3 = labToRgb(cent[k * 3], cent[k * 3 + 1], cent[k * 3 + 2]);
      rgb[k * 3] = c3[0]; rgb[k * 3 + 1] = c3[1]; rgb[k * 3 + 2] = c3[2];
      palette.push({ rgb: c3, share: area[k] / Math.max(1, opaque), used: area[k] > 0 });
    }

    yield 'Tracing edges';
    var G = buildGraph(lbl, w, h, area);
    if (!G.chains.length) return empty();

    yield 'Fitting curves';
    var sigma = Math.max(1, SMOOTH[level][0] * s), tol = Math.max(0.2, SMOOTH[level][1] * s);
    fitChains(G, w, h, {
      img: exact || img, lbl: lbl, rgb: rgb, bg: bg, thin: aliased ? 0 : Math.max(4, Math.round(4 * s)), tail: Math.max(3, Math.round(4 * s)), near: Math.max(2, Math.round(1.5 * s)),
      corner: {
        a: Math.max(2, Math.round(0.9 * s)), h: Math.max(2, Math.round(0.75 * s)),
        ks: Math.max(3, Math.round(s)), k: Math.max(5, Math.round(2 * s)),
        minAngle: ((o.cornerAngle == null ? 60 : o.cornerAngle) * Math.PI) / 180
      },
      passes: Math.round(2 * sigma * sigma),
      fit: { tol: tol, lineTol: Math.max(0.3, tol * 1.3), trim: Math.max(0.12, tol * 0.5), minRun: Math.max(10, 6 * s) },
      sx: outW / w, sy: outH / h
    });
    img = exact = null;

    yield 'Building shapes';
    var mode = o.mode === 'cutout' ? 'cutout' : 'stacked', built;
    if (mode === 'cutout') {
      var ord = [];
      for (k = 0; k < K; k++) if (area[k] > 0) ord.push(k);
      ord.sort(function (p1, p2) { return area[p2] - area[p1]; });
      built = assembleCutouts(G, ord);
    } else {
      built = assembleStacked(G, K, stackOrder(G, K, area));
    }
    return {
      width: outW, height: outH, mode: mode, gap: mode === 'cutout' && o.gapFill !== false,
      palette: palette, layers: built.layers,
      stats: { paths: built.layers.length, nodes: built.nodes, ms: now() - t0, work: [w, h], colors: built.layers.length, smoothing: level, aliased: aliased, noise: noise }
    };
  }

  function trace(src, sw, sh, o, onStage) {
    var it = traceSteps(src, sw, sh, o), r = it.next();
    while (!r.done) { if (onStage) onStage(r.value); r = it.next(); }
    return r.value;
  }

  function hex(rgb) {
    return '#' + ((1 << 24) | (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]).toString(16).slice(1);
  }

  // Turn a trace result into SVG text. `colors` optionally overrides palette
  // entries by index; `outline` draws the paths as hairlines instead of fills.
  function compose(res, colors, opt) {
    opt = opt || {};
    var W = res.width, H = res.height, out = [], i, j;
    var head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"';
    if (!opt.bare) head += ' width="' + W + '" height="' + H + '"';
    if (opt.outline) {
      out.push(head + ' fill="none" stroke="currentColor" stroke-width="1">');
      for (i = 0; i < res.layers.length; i++) for (j = 0; j < res.layers[i].paths.length; j++) {
        out.push('<path vector-effect="non-scaling-stroke" d="' + res.layers[i].paths[j] + '"/>');
      }
    } else {
      var gapW = Math.max(0.3, Math.round(Math.max(W, H) * 0.06) / 100);
      out.push(head + (res.gap ? ' stroke-width="' + gapW + '" stroke-linejoin="round"' : '') + '>');
      for (i = 0; i < res.layers.length; i++) {
        var L = res.layers[i], col = (colors && colors[L.color]) || hex(res.palette[L.color].rgb);
        if (L.paths.length === 1 && !res.gap) {
          out.push('<path fill="' + col + '" d="' + L.paths[0] + '"/>');
        } else {
          out.push('<g fill="' + col + '"' + (res.gap ? ' stroke="' + col + '"' : '') + '>');
          for (j = 0; j < L.paths.length; j++) out.push('<path d="' + L.paths[j] + '"/>');
          out.push('</g>');
        }
      }
    }
    out.push('</svg>');
    return out.join('\n');
  }

  var api = { trace: trace, traceSteps: traceSteps, compose: compose, hex: hex };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VTrace = api;
})(typeof self !== 'undefined' ? self : globalThis);
