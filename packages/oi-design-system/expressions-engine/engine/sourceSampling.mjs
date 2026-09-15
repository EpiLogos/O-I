/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
const SOURCE_WORK_MAX = 512;
const DEFAULT_SOURCE_THRESHOLD = 0.24;
const CROP_MARGIN = 0.02;
const CROP_INK_FLOOR = 0.12;
const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
}
function orientedInk(lum, bg, polarity) {
  if (polarity === "darkInk") return clamp01((bg - lum) / Math.max(0.08, bg));
  return clamp01((lum - bg) / Math.max(0.08, 1 - bg));
}
function computeInkField(px, w, h, options = {}) {
  const n = w * h;
  const mode = options.mode ?? "luminance";
  const ringDepth = Math.max(2, Math.round(Math.min(w, h) * 0.04));
  const ringLum = [];
  const ringAlpha = [];
  let seesTransparency = false;
  const stride = Math.max(1, Math.round(Math.sqrt(n / 65536)));
  for (let y = 0; y < h; y += stride) {
    for (let x = 0; x < w; x += stride) {
      const onRing = x < ringDepth || y < ringDepth || x >= w - ringDepth || y >= h - ringDepth;
      const idx = (y * w + x) * 4;
      const a = px[idx + 3] / 255;
      if (a < 0.85) seesTransparency = true;
      if (!onRing) continue;
      ringAlpha.push(a);
      if (a > 0.05) {
        ringLum.push((px[idx] * 0.2126 + px[idx + 1] * 0.7152 + px[idx + 2] * 0.0722) / 255);
      }
    }
  }
  const bgAlpha = median(ringAlpha);
  const backgroundIsTransparent = mode !== "alpha" && seesTransparency && bgAlpha < 0.5;
  const backgroundLuminance = clamp01(median(ringLum));
  let polarity;
  let polarityAuto;
  if (options.invert === true) {
    polarity = "darkInk";
    polarityAuto = false;
  } else if (backgroundIsTransparent || mode === "alpha") {
    polarity = backgroundLuminance >= 0.5 ? "darkInk" : "lightInk";
    polarityAuto = true;
  } else {
    polarity = backgroundLuminance >= 0.5 ? "darkInk" : "lightInk";
    polarityAuto = true;
  }
  const buildInk = (flip) => {
    const ink2 = new Float32Array(n);
    const effective = flip ? polarity === "darkInk" ? "lightInk" : "darkInk" : polarity;
    for (let i = 0; i < n; i++) {
      const a = px[i * 4 + 3] / 255;
      if (a <= 0.05) continue;
      if (backgroundIsTransparent || mode === "alpha") {
        ink2[i] = a;
      } else {
        const lum = (px[i * 4] * 0.2126 + px[i * 4 + 1] * 0.7152 + px[i * 4 + 2] * 0.0722) / 255;
        ink2[i] = orientedInk(lum, backgroundLuminance, effective) * a;
      }
    }
    return ink2;
  };
  let ink = buildInk(false);
  if (polarityAuto && !backgroundIsTransparent && mode !== "alpha") {
    let swept = 0;
    const sampleStep = Math.max(1, Math.round(Math.sqrt(n / 2e4)));
    for (let i = 0; i < n; i += sampleStep) if (ink[i] > CROP_INK_FLOOR) swept++;
    if (swept / Math.ceil(n / sampleStep) > 0.82) ink = buildInk(true);
  }
  const crop = inkBoundingBox(ink, w, h);
  return {
    width: w,
    height: h,
    ink,
    crop,
    polarity,
    polarityAuto,
    backgroundLuminance,
    backgroundIsTransparent
  };
}
function inkBoundingBox(ink, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (ink[row + x] > CROP_INK_FLOOR) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
  const margin = Math.round(Math.max(x1 - x0, y1 - y0) * CROP_MARGIN);
  return {
    x0: Math.max(0, x0 - margin),
    y0: Math.max(0, y0 - margin),
    x1: Math.min(w - 1, x1 + margin),
    y1: Math.min(h - 1, y1 + margin)
  };
}
function sobelInk(ink, w, h) {
  const out = new Float32Array(ink.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = ink[i - w - 1], t = ink[i - w], tr = ink[i - w + 1];
      const l = ink[i - 1], r = ink[i + 1];
      const bl = ink[i + w - 1], b = ink[i + w], br = ink[i + w + 1];
      const gx = tr + 2 * r + br - (tl + 2 * l + bl);
      const gy = bl + 2 * b + br - (tl + 2 * t + tr);
      out[i] = clamp01(Math.sqrt(gx * gx + gy * gy) * 0.6);
    }
  }
  return out;
}
function silhouetteInk(ink, w, h, threshold) {
  const floor = Math.max(0.08, Math.min(0.6, threshold));
  const n = w * h;
  const background = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0, tail = 0;
  const push = (i) => {
    if (!background[i] && ink[i] < floor) {
      background[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w, y = i / w | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  let cropArea = 0;
  for (let i = 0; i < n; i++) if (ink[i] > CROP_INK_FLOOR) cropArea++;
  const minPocket = Math.max(64, Math.round(cropArea * 6e-3));
  const out = new Float32Array(ink);
  const label = new Int32Array(n).fill(-1);
  const compQueue = new Int32Array(n);
  const pocketFill = [];
  for (let start = 0; start < n; start++) {
    if (background[start] || ink[start] >= floor || label[start] >= 0) continue;
    const id = pocketFill.length;
    let head2 = 0, tail2 = 0, area = 0;
    label[start] = id;
    compQueue[tail2++] = start;
    while (head2 < tail2) {
      const i = compQueue[head2++];
      area++;
      const x = i % w, y = i / w | 0;
      const visit = (j) => {
        if (!background[j] && ink[j] < floor && label[j] < 0) {
          label[j] = id;
          compQueue[tail2++] = j;
        }
      };
      if (x > 0) visit(i - 1);
      if (x < w - 1) visit(i + 1);
      if (y > 0) visit(i - w);
      if (y < h - 1) visit(i + w);
    }
    pocketFill.push(area >= minPocket);
  }
  for (let i = 0; i < n; i++) {
    if (!background[i] && ink[i] < floor && label[i] >= 0 && pocketFill[label[i]]) out[i] = 1;
  }
  return out;
}
function coverageOf(ink, w, h, crop, threshold) {
  const cw = crop.x1 - crop.x0 + 1, ch = crop.y1 - crop.y0 + 1;
  let inked = 0, total = 0;
  for (let y = crop.y0; y <= crop.y1; y += 1) {
    for (let x = crop.x0; x <= crop.x1; x += 1) {
      total++;
      if (ink[y * w + x] >= threshold) inked++;
    }
  }
  return total ? inked / total : 0;
}
function candidatesFromInkField(field, options) {
  const { width: w, height: h, ink, crop } = field;
  const mode = options.mode ?? "luminance";
  const threshold = options.threshold;
  const scale = options.scale ?? 1;
  const maxCandidates = options.maxCandidates ?? 9e4;
  let shaped = ink;
  if (mode === "edgeSobel") shaped = sobelInk(ink, w, h);
  else if (mode === "silhouette") shaped = silhouetteInk(ink, w, h, threshold);
  const cw = crop.x1 - crop.x0 + 1, ch = crop.y1 - crop.y0 + 1;
  const cx = (crop.x0 + crop.x1 + 1) / 2;
  const cy = (crop.y0 + crop.y1 + 1) / 2;
  const unit = 400 * scale / Math.max(cw, ch);
  const step = Math.max(1, Math.round(Math.max(cw, ch) / 220));
  const out = Object.assign([], { norm: "stage400" });
  const stride = Math.max(1, Math.ceil((cw / step | 0) * (ch / step | 0) / maxCandidates));
  for (let y = crop.y0, row = 0; y <= crop.y1; y += step, row++) {
    for (let x = crop.x0 + row % stride * step; x <= crop.x1; x += step * stride) {
      const v = shaped[y * w + x];
      if (v < threshold) continue;
      out.push({
        x: (x + 0.5 - cx) * unit,
        y: -(y + 0.5 - cy) * unit,
        density: mode === "silhouette" ? 1 : mode === "edgeSobel" ? clamp01(v * 1.4) : clamp01(v)
      });
    }
  }
  return out;
}
const FALLBACK_RING = 500;
function visibilityRing() {
  const ring = [];
  for (let i = 0; i < FALLBACK_RING; i++) {
    const ang = i / FALLBACK_RING * Math.PI * 2;
    ring.push({ x: Math.cos(ang) * 120, y: Math.sin(ang) * 120, density: 0.8 });
  }
  return ring;
}
function sampleImageSource(px, w, h, options = {}) {
  const mode = options.mode ?? "luminance";
  let threshold = clamp01(options.threshold ?? DEFAULT_SOURCE_THRESHOLD);
  if (mode === "edgeSobel") threshold = Math.max(0.02, threshold * 0.55);
  const field = computeInkField(px, w, h, options);
  let candidates = candidatesFromInkField(field, { ...options, threshold });
  let coverage = coverageOf(field.ink, w, h, field.crop, threshold);
  if (candidates.length < 32) {
    let t = threshold;
    while (candidates.length < 32 && t > 0.05) {
      t = Math.max(0.05, t * 0.6);
      candidates = candidatesFromInkField(field, { ...options, threshold: t });
      coverage = coverageOf(field.ink, w, h, field.crop, t);
    }
    threshold = t;
  }
  let fallback = false;
  if (candidates.length === 0) {
    candidates = visibilityRing();
    fallback = true;
  }
  return {
    candidates,
    analysis: {
      mode,
      threshold,
      polarity: field.polarity,
      polarityAuto: field.polarityAuto,
      backgroundLuminance: field.backgroundLuminance,
      backgroundIsTransparent: field.backgroundIsTransparent,
      sourcePx: { w, h },
      contentPx: { w: field.crop.x1 - field.crop.x0 + 1, h: field.crop.y1 - field.crop.y0 + 1 },
      coverage,
      candidates: candidates.length,
      fallback
    }
  };
}
function sampleAlphaSource(px, w, h, options = {}) {
  const field = computeInkField(px, w, h, { ...options, mode: "alpha" });
  const threshold = 0.3;
  const candidates = options.cell && options.cell.w >= 3 && options.cell.h >= 3 ? candidatesFromAlphaCells(field, options.cell, threshold, options.scale ?? 1) : candidatesFromInkField(field, { ...options, threshold, mode: "alpha" });
  const coverage = coverageOf(field.ink, w, h, field.crop, threshold);
  return {
    candidates,
    analysis: {
      mode: "alpha",
      threshold,
      polarity: field.polarity,
      polarityAuto: field.polarityAuto,
      backgroundLuminance: field.backgroundLuminance,
      backgroundIsTransparent: true,
      sourcePx: { w, h },
      contentPx: { w: field.crop.x1 - field.crop.x0 + 1, h: field.crop.y1 - field.crop.y0 + 1 },
      coverage,
      candidates: candidates.length,
      fallback: candidates.length === 0
    }
  };
}
function candidatesFromAlphaCells(field, cell, threshold, scale) {
  const { width: w, height: h, ink, crop } = field;
  const cw = crop.x1 - crop.x0 + 1, ch = crop.y1 - crop.y0 + 1;
  const cx = (crop.x0 + crop.x1 + 1) / 2;
  const cy = (crop.y0 + crop.y1 + 1) / 2;
  const unit = 400 * scale / Math.max(cw, ch);
  const out = Object.assign([], { norm: "stage400" });
  const cols = Math.ceil(cw / cell.w);
  for (let row = 0; row * cell.h < ch; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = crop.x0 + col * cell.w;
      const y0 = crop.y0 + row * cell.h;
      for (const [dx0, dx1] of [[0, 0.5], [0.5, 1]]) {
        for (const [dy0, dy1] of [[0, 0.5], [0.5, 1]]) {
          const qx0 = x0 + Math.floor(dx0 * cell.w);
          const qx1 = Math.min(x0 + Math.ceil(dx1 * cell.w), crop.x1 + 1);
          const qy0 = y0 + Math.floor(dy0 * cell.h);
          const qy1 = Math.min(y0 + Math.ceil(dy1 * cell.h), crop.y1 + 1);
          let sum = 0, count = 0;
          for (let y = qy0; y < qy1; y++) {
            for (let x = qx0; x < qx1; x++) {
              sum += ink[y * w + x];
              count++;
            }
          }
          if (!count) continue;
          const mean = sum / count;
          if (mean < threshold) continue;
          out.push({
            x: ((qx0 + qx1) / 2 - cx) * unit,
            y: -((qy0 + qy1) / 2 - cy) * unit,
            density: clamp01(mean * 1.6)
          });
        }
      }
    }
  }
  return out;
}
const MODE_LABEL = {
  luminance: "Ink luminance",
  edgeSobel: "Sobel edges",
  silhouette: "Silhouette cutout",
  alpha: "ASCII drawing"
};
function summarizeAnalysis(analysis, kind) {
  if (analysis.fallback) {
    return `${kind === "image" ? "Image" : "ASCII"} source active \xB7 no ink detected above the threshold \u2014 showing a placeholder ring. Lower the ink threshold or check the file.`;
  }
  const ink = kind === "ascii" ? `drawn marks ${analysis.contentPx.w}\xD7${analysis.contentPx.h}px` : analysis.backgroundIsTransparent ? `transparent cutout \xB7 content ${analysis.contentPx.w}\xD7${analysis.contentPx.h}px` : `${analysis.polarity === "darkInk" ? "light paper detected \u2192 dark ink sampled" : "dark paper detected \u2192 light ink sampled"} \xB7 content ${analysis.contentPx.w}\xD7${analysis.contentPx.h}px`;
  const pct = Math.round(analysis.coverage * 100);
  return `${kind === "image" ? "Image" : "ASCII"} source active \xB7 ${MODE_LABEL[analysis.mode]} \xB7 ${ink} \xB7 ${pct}% ink \xB7 ${analysis.candidates.toLocaleString()} points`;
}
export {
  DEFAULT_SOURCE_THRESHOLD,
  SOURCE_WORK_MAX,
  candidatesFromInkField,
  computeInkField,
  sampleAlphaSource,
  sampleImageSource,
  summarizeAnalysis
};
