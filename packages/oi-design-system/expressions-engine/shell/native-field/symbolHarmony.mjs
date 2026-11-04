import { chi } from "../../engine/torusObject.mjs";
const TAU = Math.PI * 2;
const RING = 12, HALF = 6;
function classPoint(placeArc, steps) {
  let arcs = ((placeArc + steps) % RING + RING) % RING;
  if (arcs >= RING) arcs = 0;
  let sheet = arcs % HALF;
  if (sheet >= HALF) sheet = 0;
  return { phi: sheet * (Math.PI / (HALF / 2)), theta: arcs * (Math.PI / HALF) };
}
function classesAt(reading, body, steps) {
  if (!body || !Number.isFinite(steps) || steps === reading.steps) return reading.by_class;
  const voices = new Map(body.voices.map((voice) => [voice.mode_ref, voice]));
  return reading.by_class.map((cls) => {
    const { phi, theta } = classPoint(cls.place_arc, steps);
    return { ...cls, phi, theta, sounds: cls.sounds.map((sound) => {
      const voice = voices.get(sound.mode_ref);
      return voice ? { ...sound, coupling: chi(voice, phi, theta) } : sound;
    }) };
  });
}
function formMaskOf(points, size) {
  if (!points?.length) return null;
  const n = size ?? Math.max(4, Math.min(32, Math.round(Math.sqrt(points.length / 2))));
  const cells = new Uint8Array(n * n);
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const col = Math.floor((p.x + 200) / 400 * n), row = Math.floor((200 - p.y) / 400 * n);
    if (col < -1 || col > n || row < -1 || row > n) continue;
    cells[Math.min(n - 1, Math.max(0, row)) * n + Math.min(n - 1, Math.max(0, col))] = 1;
  }
  return { size: n, cells };
}
const chartPlace = (cls) => ({ x: cls.phi / TAU - 0.5, y: cls.theta / TAU - 0.5 });
function coveredClasses(classes, at, mask) {
  if (!mask || !(at.width > 0) || !(at.height > 0)) return [];
  const turn = at.rotation * Math.PI / 180, co = Math.cos(turn), si = Math.sin(turn), reach = Math.hypot(at.width, at.height) / 2;
  const under = (px, py) => {
    const dx = px - at.x, dy = py - at.y, lx = (dx * co + dy * si) / at.width, ly = (-dx * si + dy * co) / at.height;
    if (lx < -0.5 || lx > 0.5 || ly < -0.5 || ly > 0.5) return false;
    const col = Math.min(mask.size - 1, Math.floor((lx + 0.5) * mask.size)), row = Math.min(mask.size - 1, Math.floor((0.5 - ly) * mask.size));
    return mask.cells[row * mask.size + col] === 1;
  };
  return classes.filter((cls) => {
    const p = chartPlace(cls);
    for (let i = Math.ceil(at.x - reach - p.x); i <= Math.floor(at.x + reach - p.x); i++)
      for (let j = Math.ceil(at.y - reach - p.y); j <= Math.floor(at.y + reach - p.y); j++) if (under(p.x + i, p.y + j)) return true;
    return false;
  }).sort((a, b) => a.pitch_class - b.pitch_class);
}
const LOW = 20, HIGH = 2e4;
function harmonyOf(covered, sampleRate) {
  if (!covered.length) return { state: "absent", because: "Its form covers none of the twelve classes where it stands now: the pulse sounds it when a class passes under it" };
  const high = Math.min(HIGH, sampleRate / 2), byHz = /* @__PURE__ */ new Map();
  const sums = /* @__PURE__ */ new Map();
  for (const cls of covered) for (const sound of cls.sounds) {
    const entry = sums.get(sound.mode_ref) ?? { hz: sound.frequency_hz, sum: 0 };
    entry.sum += sound.coupling;
    sums.set(sound.mode_ref, entry);
  }
  for (const [ref, { hz, sum }] of sums) {
    if (!(hz >= LOW && hz < high)) continue;
    const entry = byHz.get(hz) ?? { sum: 0, modeRefs: [] };
    entry.sum += Math.abs(sum);
    entry.modeRefs.push(ref);
    byHz.set(hz, entry);
  }
  const loudest = Math.max(0, ...[...byHz.values()].map((entry) => entry.sum));
  const names = covered.map((cls) => cls.pitch_name).join(", ");
  if (!byHz.size) return { state: "absent", because: `The classes its form covers (${names}) sound no voice in the audible range` };
  if (!(loudest > 1e-12)) return { state: "absent", because: `The classes its form covers (${names}) strike no voice where they stand now: each stands on every voice's node` };
  const centres = [...byHz.keys()].sort((a, b) => a - b);
  const bands = centres.map((hz, i) => {
    const below = i > 0 ? hz - centres[i - 1] : Infinity, above = i < centres.length - 1 ? centres[i + 1] - hz : Infinity, nearest = Math.min(below, above);
    const widthHz = (Number.isFinite(nearest) ? nearest : hz) / 2, entry = byHz.get(hz);
    return { centreHz: hz, widthHz, q: hz / widthHz, gain: entry.sum / loudest, modeRefs: entry.modeRefs };
  });
  return { state: "carrying", harmony: { classes: covered.map((cls) => cls.pitch_class), bands } };
}
function symbolHarmonies(entities, plan, classes, body, steps, formOf, sampleRate) {
  const out = /* @__PURE__ */ new Map();
  const translated = plan.voices.filter((voice) => !voice.carry);
  if (!translated.length) return out;
  if (classes.absentBecause !== null) {
    for (const voice of translated) out.set(voice.entityId, { state: "absent", because: classes.absentBecause });
    return out;
  }
  const now = classesAt(classes, body, steps);
  for (const voice of translated) {
    const entity = entities.find((e) => e.id === voice.entityId);
    if (!entity) {
      out.set(voice.entityId, { state: "absent", because: "This symbol is not on the stage, so its form lies on no class" });
      continue;
    }
    const mask = formOf(entity.id);
    if (!mask) {
      out.set(voice.entityId, { state: "absent", because: "This symbol's form is not sampled yet, so it covers no class" });
      continue;
    }
    const scale = entity.scale ?? 1;
    out.set(voice.entityId, harmonyOf(coveredClasses(now, { x: entity.position.x, y: entity.position.y, width: entity.size.x * scale, height: entity.size.y * scale, rotation: entity.rotation }, mask), sampleRate));
  }
  return out;
}
export {
  chartPlace,
  classPoint,
  classesAt,
  coveredClasses,
  formMaskOf,
  harmonyOf,
  symbolHarmonies
};
