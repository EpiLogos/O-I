import { hexToRgb, isLightHex } from "../engine/colorPalettes.mjs";
function paperStops(s) {
  const bg = s.field.background, mode = s.engine.backgroundMode ?? "solid", light = isLightHex(bg), rgb = hexToRgb(bg);
  const intensity = Math.max(0, Math.min(1, s.field.params.native_backgroundGlowIntensity ?? 0.45));
  const scale = (factor) => rgb.map((v) => Math.floor(v * factor));
  const glow = (color, alpha) => hexToRgb(color).map((v, i) => Math.round(rgb[i] + (v - rgb[i]) * alpha));
  if (mode === "solid") return [{ offset: 0, color: rgb }, { offset: 1, color: rgb }];
  if (mode === "vignette") return [{ offset: 0, color: rgb }, { offset: light ? 0.35 : 0.25, color: rgb }, { offset: 1, color: scale(light ? 0.88 : 0.35) }];
  if (mode === "adaptive") return [
    { offset: 0, color: glow(s.field.palette[0], intensity * (light ? 0.12 : 0.22)) },
    { offset: 0.4, color: glow(s.field.palette[Math.floor(s.field.palette.length / 2)], intensity * (light ? 0.08 : 0.15)) },
    { offset: 0.75, color: rgb },
    { offset: 1, color: scale(light ? 0.92 : 0.4) }
  ];
  return [{ offset: 0, color: glow(s.field.palette[0], intensity * (light ? 0.15 : 0.28)) }, { offset: 0.58, color: rgb }, { offset: 1, color: scale(light ? 0.9 : 0.3) }];
}
let tile = null;
function paperTile() {
  if (tile) return tile;
  tile = document.createElement("canvas");
  tile.width = tile.height = 128;
  const c = tile.getContext("2d"), im = c.createImageData(128, 128);
  let seed = 1031;
  for (let i = 0; i < im.data.length; i += 4) {
    seed = Math.imul(seed, 1664525) + 1013904223 | 0;
    const v = seed >>> 24;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
    im.data[i + 3] = 210;
  }
  c.putImageData(im, 0, 0);
  return tile;
}
function paintPaper(ctx, s, w, h) {
  const mode = s.engine.backgroundMode ?? "solid", light = isLightHex(s.field.background);
  ctx.fillStyle = s.field.background;
  ctx.fillRect(0, 0, w, h);
  if (mode !== "solid") {
    ctx.save();
    const adaptive = mode === "adaptive";
    if (adaptive) {
      ctx.translate(w / 2, h / 2);
      ctx.scale(w * 0.75, h * 0.7);
    }
    const g = adaptive ? ctx.createRadialGradient(0, 0, 0, 0, 0, 1) : ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w / 2, h / 2));
    for (const stop of paperStops(s)) g.addColorStop(stop.offset, `rgb(${stop.color.join(",")})`);
    ctx.fillStyle = g;
    if (adaptive) ctx.fillRect(-1, -1, 2, 2);
    else ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const grain = s.field.params.grain ?? 0;
  if (grain > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.2, grain);
    ctx.globalCompositeOperation = light ? "multiply" : "screen";
    ctx.fillStyle = ctx.createPattern(paperTile(), "repeat");
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
export {
  paintPaper,
  paperStops
};
