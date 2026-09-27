/**
 * Canvas drawing for the live character preview — a faithful, cheap
 * approximation of each authored form, not the particle engine:
 *
 *   text      the glyph, or the look's ASCII / embedded image source
 *   ring/disc/square/triangle   the primitive
 *   yantra    the named chakra yantra (petal count, inner figure, bindu)
 *   cymatic   a Chladni plate pattern whose mode follows the frequency
 *
 * Only a 2D context is needed (tests pass a recording stub). Image loading
 * is injected so the module stays DOM-free.
 */
import type {CharacterLayerPreview, CharacterPreviewMaterial} from "./characterModel";
import {forceMotion, frameAt, inkColour, type CharacterLook} from "./characterAnimation";

export type Ctx = Pick<CanvasRenderingContext2D,
  "save" | "restore" | "translate" | "rotate" | "scale" | "fillText" | "drawImage" | "beginPath" | "closePath" | "arc" | "moveTo" | "lineTo"
  | "fill" | "stroke" | "fillRect" | "strokeRect"> & {globalAlpha: number; fillStyle: unknown; strokeStyle: unknown; lineWidth: number; font: string; textAlign: string; textBaseline: string};
export type ImageLookup = (url: string) => CanvasImageSource & {naturalWidth: number; naturalHeight: number} | null;

/** Petals and inner figure of each chakra yantra (traditional counts). */
const YANTRA: Record<string, {petals: number; figure: "square" | "crescent" | "down" | "hexagram" | "circle" | "up" | "none"}> = {
  muladhara: {petals: 4, figure: "square"},
  svadhisthana: {petals: 6, figure: "crescent"},
  manipura: {petals: 10, figure: "down"},
  anahata: {petals: 12, figure: "hexagram"},
  vishuddha: {petals: 16, figure: "circle"},
  ajna: {petals: 2, figure: "down"},
  sahasrara: {petals: 32, figure: "none"},
};

function polygon(ctx: Ctx, points: [number, number][]) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
}
function triangle(ctx: Ctx, r: number, down: boolean) {
  const s = down ? -1 : 1;
  polygon(ctx, [[0, -s * r], [r * .866, s * r * .5], [-r * .866, s * r * .5]]);
}

function drawYantra(ctx: Ctx, id: string | undefined, r: number) {
  const spec = YANTRA[id ?? ""] ?? {petals: 8, figure: "hexagram" as const};
  ctx.lineWidth = Math.max(1, r * .05);
  // petals: small arcs around the outer circle
  const petalR = r * Math.min(.2, Math.PI / Math.max(2, spec.petals) * .95);
  for (let i = 0; i < spec.petals; i++) {
    const a = (i / spec.petals) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r * .82, Math.sin(a) * r * .82, petalR, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 0, r * .66, 0, Math.PI * 2); ctx.stroke();
  const inner = r * .56;
  switch (spec.figure) {
    case "square": ctx.strokeRect(-inner * .7, -inner * .7, inner * 1.4, inner * 1.4); break;
    case "crescent": ctx.beginPath(); ctx.arc(0, inner * .1, inner * .6, 0, Math.PI); ctx.stroke(); break;
    case "down": triangle(ctx, inner, true); ctx.stroke(); break;
    case "up": triangle(ctx, inner, false); ctx.stroke(); break;
    case "hexagram": triangle(ctx, inner, false); ctx.stroke(); triangle(ctx, inner, true); ctx.stroke(); break;
    case "circle": ctx.beginPath(); ctx.arc(0, 0, inner * .6, 0, Math.PI * 2); ctx.stroke(); break;
    default: break;
  }
  ctx.beginPath(); ctx.arc(0, 0, Math.max(1, r * .07), 0, Math.PI * 2); ctx.fill(); // bindu
}

/** A Chladni square-plate pattern: particles gather on the nodal lines of
 * cos(nπx)cos(mπy) − cos(mπx)cos(nπy); the mode rises with frequency. */
export function cymaticMode(frequency: number | undefined): [number, number] {
  const f = Math.max(20, Math.min(20_000, frequency ?? 220));
  const k = Math.round(2 + Math.log2(f / 55) * 1.3);
  const n = Math.max(2, Math.min(9, k)), m = Math.max(1, Math.min(n - 1, Math.round(n / 2)));
  return [n, m];
}
function drawCymatic(ctx: Ctx, frequency: number | undefined, r: number) {
  const [n, m] = cymaticMode(frequency);
  const steps = 28, dot = Math.max(.6, r / steps * .55);
  for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps; j++) {
    const x = i / steps * 2 - 1, y = j / steps * 2 - 1;
    if (x * x + y * y > 1) continue;
    const u = (x + 1) / 2, v = (y + 1) / 2;
    const value = Math.cos(n * Math.PI * u) * Math.cos(m * Math.PI * v) - Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v);
    if (Math.abs(value) < .18) ctx.fillRect(x * r - dot / 2, y * r - dot / 2, dot, dot);
  }
}

/** Draw one form centred at the origin within a `size` box. */
export function drawForm(ctx: Ctx, look: Pick<CharacterLook, "text" | "shape" | "yantraId" | "frequency" | "ascii" | "imageDataUrl">, size: number, image?: ImageLookup) {
  const r = size * .34;
  switch (look.shape) {
    case "ring": ctx.lineWidth = Math.max(1, r * .12); ctx.beginPath(); ctx.arc(0, 0, r * .8, 0, Math.PI * 2); ctx.stroke(); return;
    case "disc": ctx.beginPath(); ctx.arc(0, 0, r * .8, 0, Math.PI * 2); ctx.fill(); return;
    case "square": ctx.fillRect(-r * .7, -r * .7, r * 1.4, r * 1.4); return;
    case "triangle": triangle(ctx, r * .9, false); ctx.fill(); return;
    case "yantra": drawYantra(ctx, look.yantraId, r); return;
    case "cymatic": drawCymatic(ctx, look.frequency, r); return;
    default: break;
  }
  if (look.imageDataUrl && image) {
    const img = image(look.imageDataUrl);
    if (img) { const box = size * .7, k = Math.min(box / img.naturalWidth, box / img.naturalHeight); ctx.drawImage(img, -img.naturalWidth * k / 2, -img.naturalHeight * k / 2, img.naturalWidth * k, img.naturalHeight * k); return; }
  }
  if (look.ascii) {
    const lines = look.ascii.split("\n"), widest = Math.max(1, ...lines.map(line => line.length));
    const font = Math.max(4, Math.min(size * .8 / (lines.length * 1.05), size * .8 / (widest * .6)));
    ctx.font = `${font}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * font * 1.05));
    return;
  }
  if (!look.text) return;
  ctx.font = `600 ${size * .5}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(look.text, 0, 0);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Draw a material's frame at `time` seconds into its state. */
export function drawMaterial(ctx: Ctx, material: CharacterPreviewMaterial, time: number, size: number, alpha: number, ink: [number, number, number], still: boolean, image?: ImageLookup) {
  if (alpha <= 0) return;
  const frame = frameAt(material, time), motion = still ? {dx: 0, dy: 0, spin: 0, breathe: 1} : forceMotion(material, time);
  const place = (look: CharacterLook, other: CharacterLook, mix: number, a: number) => {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha * a;
    ctx.translate(size / 2 + motion.dx * size, size / 2 + motion.dy * size);
    ctx.rotate(((lerp(look.rotation, other.rotation, mix) + motion.spin) * Math.PI) / 180);
    const scale = lerp(look.scale, other.scale, mix) * motion.breathe;
    const colour = inkColour(mix < .5 ? look.tint : other.tint, lerp(look.tintWeight, other.tintWeight, mix), ink);
    ctx.fillStyle = colour; ctx.strokeStyle = colour;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const layer = (l: CharacterLayerPreview) => { ctx.save(); ctx.globalAlpha *= .75; ctx.scale(scale * l.scale, scale * l.scale); drawForm(ctx, {...l, shape: "text"}, size, image); ctx.restore(); };
    material.layers.filter(l => l.z < 0).forEach(layer);
    ctx.save(); ctx.scale(scale, scale); drawForm(ctx, look, size, image); ctx.restore();
    material.layers.filter(l => l.z >= 0).forEach(layer);
    ctx.restore();
  };
  // Cross-fade the leaving and arriving sequence looks (the engine morphs particles; the preview blends).
  place(frame.from, frame.to, frame.mix, 1 - frame.mix);
  if (frame.mix > 0) place(frame.to, frame.from, 0, frame.mix);
}
