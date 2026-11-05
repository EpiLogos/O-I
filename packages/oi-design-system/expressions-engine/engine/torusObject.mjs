import { computeMorphDrive, pulseTurnings } from "./morphSignal.mjs";
const TORUS_MAJOR = 16 / 9;
const TORUS_MINOR = 1;
const PLATE_SIDE = 2 * (TORUS_MAJOR + TORUS_MINOR);
const TAU = Math.PI * 2;
const TORUS_FIGURES = ["torus", "figure-eight", "spiral", "klein-bottle"];
const isTorusFigure = (value) => typeof value === "string" && TORUS_FIGURES.includes(value);
const wrap = (angle) => {
  const a = angle % TAU;
  return a < 0 ? a + TAU : a;
};
const EIGHT = { across: 2.5, along: 2.4, lift: 0.6, tube: 0.55 };
const SPIRAL = { inner: 0.55, outer: 1, rise: 0.9, tubeFrom: 0.35, tubeTo: 0.8 };
const KLEIN = { ring: TORUS_MAJOR, section: 0.62 };
function tube(c, t, radius, theta) {
  let nx = t[1], ny = -t[0], nz = 0;
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl;
  ny /= nl;
  const bx = ny * t[2] - nz * t[1], by = nz * t[0] - nx * t[2], bz = nx * t[1] - ny * t[0];
  const bl = Math.hypot(bx, by, bz) || 1;
  const c0 = Math.cos(theta) * radius, s0 = Math.sin(theta) * radius;
  return [c[0] + c0 * nx + s0 * bx / bl, c[1] + c0 * ny + s0 * by / bl, c[2] + c0 * nz + s0 * bz / bl];
}
function shapePoint(shape, phi, theta) {
  switch (shape) {
    case "torus": {
      const ring = TORUS_MAJOR + Math.cos(theta);
      return [ring * Math.cos(phi), ring * Math.sin(phi), Math.sin(theta)];
    }
    case "plate":
      return [PLATE_SIDE * (wrap(phi) / TAU - 0.5), PLATE_SIDE * (wrap(theta) / TAU - 0.5), 0];
    case "figure-eight": {
      const c = [EIGHT.across * Math.cos(phi), EIGHT.along * Math.sin(phi) * Math.cos(phi), EIGHT.lift * Math.sin(phi)];
      const d = [-EIGHT.across * Math.sin(phi), EIGHT.along * Math.cos(2 * phi), EIGHT.lift * Math.cos(phi)];
      const l = Math.hypot(d[0], d[1], d[2]) || 1;
      return tube(c, [d[0] / l, d[1] / l, d[2] / l], EIGHT.tube, theta);
    }
    case "spiral": {
      const u = wrap(phi) / TAU, rho = TORUS_MAJOR * (SPIRAL.inner + (SPIRAL.outer - SPIRAL.inner) * u);
      const c = [rho * Math.cos(phi), rho * Math.sin(phi), SPIRAL.rise * (2 * u - 1)];
      const drho = TORUS_MAJOR * (SPIRAL.outer - SPIRAL.inner) / TAU;
      const d = [drho * Math.cos(phi) - rho * Math.sin(phi), drho * Math.sin(phi) + rho * Math.cos(phi), 2 * SPIRAL.rise / TAU];
      const l = Math.hypot(d[0], d[1], d[2]) || 1;
      return tube(c, [d[0] / l, d[1] / l, d[2] / l], SPIRAL.tubeFrom + (SPIRAL.tubeTo - SPIRAL.tubeFrom) * u, theta);
    }
    case "klein-bottle": {
      const h = phi / 2, section = KLEIN.section * (Math.cos(h) * Math.sin(theta) - Math.sin(h) * Math.sin(2 * theta));
      const ring = KLEIN.ring + section;
      return [ring * Math.cos(phi), ring * Math.sin(phi), KLEIN.section * (Math.sin(h) * Math.sin(theta) + Math.cos(h) * Math.sin(2 * theta))];
    }
  }
}
function shapeNormal(shape, phi, theta) {
  if (shape === "torus") return [Math.cos(theta) * Math.cos(phi), Math.cos(theta) * Math.sin(phi), Math.sin(theta)];
  if (shape === "plate") return [0, 0, 1];
  const h = 1e-4;
  const a = shapePoint(shape, phi + h, theta), b = shapePoint(shape, phi - h, theta);
  const c = shapePoint(shape, phi, theta + h), d = shapePoint(shape, phi, theta - h);
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], v = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(n[0], n[1], n[2]);
  return l > 0 ? [n[0] / l, n[1] / l, n[2] / l] : [0, 0, 1];
}
function torusCoordinates(p, metresPerUnit) {
  const rho = Math.hypot(p[0], p[1]) - TORUS_MAJOR * metresPerUnit;
  return { phi: wrap(Math.atan2(p[1], p[0])), theta: wrap(Math.atan2(p[2], rho)), offset: Math.hypot(rho, p[2]) - TORUS_MINOR * metresPerUnit };
}
function clockAngle(clock, attachment) {
  if (attachment === 1) return (clock?.inscription?.half_degrees ?? 0) * Math.PI / 360;
  if (attachment === 2) return (clock?.lensing?.half_degrees ?? 0) * Math.PI / 360;
  return 0;
}
function receiverPlace(view, unitsPerMetre) {
  const { height, pixelsPerUnit: s, right: a, up: b, fovDegrees } = view;
  if (!(Number.isFinite(unitsPerMetre) && unitsPerMetre > 0 && Number.isFinite(height) && height > 0 && Number.isFinite(s) && s > 0 && Number.isFinite(fovDegrees))) return null;
  const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const length = Math.hypot(n[0], n[1], n[2]);
  if (!(Number.isFinite(length) && length > 0)) return null;
  const fov = Math.max(4, Math.min(120, fovDegrees)) * Math.PI / 180;
  const metres = height / Math.max(1e-4, s) * 0.5 / Math.max(1e-4, Math.tan(fov / 2)) / unitsPerMetre;
  return [n[0] / length * metres, n[1] / length * metres, n[2] / length * metres];
}
const helixIndex = (helix) => helix === "pratibimba" || helix === 1 ? 1 : 0;
function helixPlace(helix, phi) {
  return { phi: wrap(phi), theta: wrap(phi / 2 + helixIndex(helix) * Math.PI) };
}
function helixCurve(helix, count = 48) {
  return Array.from({ length: count }, (_, i) => helixPlace(helix, TAU * i / count));
}
function bodyOf(influence) {
  const voices = Array.isArray(influence?.voices) ? influence.voices : [], boundaries = Array.isArray(influence?.boundaries) ? influence.boundaries : [];
  const finite = (v) => typeof v === "number" && Number.isFinite(v);
  if (!voices.length || boundaries.length !== 4) return null;
  if (!voices.every((v) => typeof v?.mode_ref === "string" && [v.m, v.n, v.weight, v.phase_radians, v.longitude_radians, v.frequency_hz].every(finite))) return null;
  if (!boundaries.every((b) => [b?.m, b?.n, b?.ql_position].every(finite))) return null;
  const g = influence.geometry ?? {}, mpu = finite(g.metres_per_unit) && g.metres_per_unit > 0 ? g.metres_per_unit : 1;
  const strike = finite(influence.material?.strike_metres) && influence.material.strike_metres > 0 ? influence.material.strike_metres : 0.08;
  return { voices, boundaries, metresPerUnit: mpu, attachment: finite(g.attachment) ? g.attachment : 1, strikeMetres: strike };
}
function chi(voice, phi, theta) {
  const p = phi - voice.longitude_radians, a = voice.weight * Math.cos(voice.phase_radians), b = voice.weight * Math.sin(voice.phase_radians);
  return a * Math.sin(voice.m * p / 2) * Math.sin(voice.n * theta / 2) + b * Math.cos(voice.m * p / 2) * Math.cos(voice.n * theta / 2);
}
function chiGradient(voice, phi, theta) {
  const p = phi - voice.longitude_radians, a = voice.weight * Math.cos(voice.phase_radians), b = voice.weight * Math.sin(voice.phase_radians);
  const sm = Math.sin(voice.m * p / 2), cm = Math.cos(voice.m * p / 2), sn = Math.sin(voice.n * theta / 2), cn = Math.cos(voice.n * theta / 2);
  return [voice.m / 2 * (a * cm * sn - b * sm * cn), voice.n / 2 * (a * sm * cn - b * cm * sn)];
}
function boundaryOf(body, voice) {
  const h = helixIndex(voice.helix), end = voice.ql_position >= 3 ? 5 : 0;
  const index = body.boundaries.findIndex((b) => helixIndex(b.helix) === h && b.ql_position === end);
  return index >= 0 ? index : h * 2 + (end === 5 ? 1 : 0);
}
const ROLES_LAW = "M2\u2032 8+4 (M2\u2032 seed \xA73): each of the eight gives a = w\xB7cos(phase), b = w\xB7sin(phase), its amplitude |A| and temporal phase arg A from the one native body; each of the four gives the m and n of the voices of its end of its helix, and its edge (position 0 opens the helix, 5 closes it). A closed torus admits both families; no source restricts them.";
function readRoles(body, amplitudes, unread = "No instrument is open, so the torus gives the plate no voices or boundaries.") {
  if (!body) return { standing: "unread", reason: unread };
  const voices = body.voices.map((voice) => {
    const boundary = boundaryOf(body, voice), amp = amplitudes?.get(voice.mode_ref) ?? [0, 0];
    return {
      mode_ref: voice.mode_ref,
      a: voice.weight * Math.cos(voice.phase_radians),
      b: voice.weight * Math.sin(voice.phase_radians),
      amplitude_metres: Math.hypot(amp[0], amp[1]),
      phase_radians: Math.atan2(amp[1], amp[0]),
      m: voice.m,
      n: voice.n,
      boundary,
      frequency_hz: voice.frequency_hz,
      longitude_radians: voice.longitude_radians
    };
  });
  const boundaries = body.boundaries.map((b) => ({ m: b.m, n: b.n, helix: b.helix, edge: b.ql_position === 5 ? "closing" : "opening", families: ["sin\xB7sin", "cos\xB7cos"] }));
  return { standing: "read", law: ROLES_LAW, voices, boundaries };
}
function plateDisplacement(roles, x, y, side = PLATE_SIDE) {
  if (roles.standing !== "read") return 0;
  let total = 0;
  for (const r of roles.voices) {
    const xs = x - r.longitude_radians / TAU * side;
    total += r.amplitude_metres * Math.cos(r.phase_radians) * (r.a * Math.sin(r.m * Math.PI * xs / side) * Math.sin(r.n * Math.PI * y / side) + r.b * Math.cos(r.m * Math.PI * xs / side) * Math.cos(r.n * Math.PI * y / side));
  }
  return total;
}
function stepsAt(session, samples, sampleRate) {
  const steps = session?.pulse?.steps, sps = session?.steps_per_second, at = Number(session?.samples_elapsed);
  if (typeof steps !== "number" || !Number.isFinite(steps) || typeof sps !== "number" || !Number.isFinite(sps) || !Number.isFinite(at) || !(sampleRate > 0)) return null;
  return steps + Math.max(0, samples - at) / sampleRate * sps;
}
function figureAt(session, steps) {
  if (!session) return null;
  const shape = session.settings?.shape, law = session.figure_law;
  if (shape === "sequence") return null;
  if (shape !== "auto" || !law || steps === null) return isTorusFigure(session.figure) ? session.figure : isTorusFigure(shape) ? shape : null;
  const ret = law.return_steps ?? 12, klein = law.klein_for_steps ?? 1;
  const returning = steps >= ret && (steps % ret + ret) % ret < klein;
  const crossing = typeof law.klein_until_steps === "number" && steps < law.klein_until_steps;
  if (returning || crossing) return "klein-bottle";
  const byBand = law.by_band?.[session.band ?? ""];
  return isTorusFigure(byBand) ? byBand : isTorusFigure(session.figure) ? session.figure : null;
}
const PASSAGE_STEPS = 0.5;
function passageDrive(since, steps) {
  const turn = pulseTurnings(steps), sheet = turn.phi - wrap(turn.theta) / 2;
  const u = Math.min(1, Math.max(0, steps - since) / PASSAGE_STEPS);
  return computeMorphDrive({ driveShape: "sine", interference: "product", driveDepth: 1 }, -Math.PI / 2 + Math.PI * u + sheet, sheet);
}
class TorusMorph {
  from = "torus";
  to = "torus";
  since = null;
  last = 0;
  at(shape, steps) {
    if (shape !== this.to) {
      const current = this.progress(steps);
      this.from = current >= 0.5 ? this.to : this.from;
      this.to = shape;
      this.since = steps;
    }
    this.last = this.progress(steps);
    return { from: this.from, to: this.to, progress: this.last, since: this.since };
  }
  progress(steps) {
    if (this.since === null || this.from === this.to) return 1;
    if (steps - this.since >= PASSAGE_STEPS) return 1;
    return passageDrive(this.since, steps).progress;
  }
  /** A change read where the pulse is not known stands at once, with no passage. */
  snap(shape) {
    if (shape !== this.to || this.from !== this.to) {
      this.from = this.to = shape;
      this.since = null;
    }
    this.last = 1;
    return this.state();
  }
  state() {
    return { from: this.from, to: this.to, progress: this.last, since: this.since };
  }
}
const SETTLE_RADIANS = 0.3;
const VOICE_PULL = 1.4;
const VOICE_REACH_TUBES = 0.6;
const VOICE_LIFT_TUBES = 0.25;
function amplitudesOf(frame, modeRefs) {
  const a = frame?.amplitudes_metres;
  if (!Array.isArray(a) || !modeRefs || a.length !== modeRefs.length) return null;
  const map = /* @__PURE__ */ new Map();
  modeRefs.forEach((ref, i) => {
    const v = a[i];
    if (Array.isArray(v) && Number.isFinite(v[0]) && Number.isFinite(v[1])) map.set(ref, [v[0], v[1]]);
  });
  return map;
}
function blendAt(state, phi, theta, offset, mpu, out, at) {
  const { from, to, progress } = state.morph;
  const f = shapePoint(from, phi, theta), nf = shapeNormal(from, phi, theta);
  let x = f[0] * mpu + nf[0] * offset, y = f[1] * mpu + nf[1] * offset, z = f[2] * mpu + nf[2] * offset;
  if (progress < 1 && from !== to) {
    const g = shapePoint(to, phi, theta), ng = shapeNormal(to, phi, theta);
    x += (g[0] * mpu + ng[0] * offset - x) * progress;
    y += (g[1] * mpu + ng[1] * offset - y) * progress;
    z += (g[2] * mpu + ng[2] * offset - z) * progress;
  } else if (progress >= 1 && from !== to) {
    const g = shapePoint(to, phi, theta), ng = shapeNormal(to, phi, theta);
    x = g[0] * mpu + ng[0] * offset;
    y = g[1] * mpu + ng[1] * offset;
    z = g[2] * mpu + ng[2] * offset;
  }
  const flat = (from === "plate" ? 1 - progress : 0) + (to === "plate" ? progress : 0), angle = state.angle * (1 - flat);
  const c = Math.cos(angle), s = Math.sin(angle);
  out[at] = c * x - s * y;
  out[at + 1] = s * x + c * y;
  out[at + 2] = z;
}
const presentsAsIs = (state, level) => state.morph.from === "torus" && state.morph.to === "torus" && level <= 0;
function ringingLevel(body, amplitudes) {
  if (!amplitudes) return 0;
  let energy = 0;
  for (const voice of body.voices) {
    const a = amplitudes.get(voice.mode_ref);
    if (a) energy += a[0] * a[0] + a[1] * a[1];
  }
  return Math.min(1, Math.sqrt(energy) / body.strikeMetres);
}
function presentSamples(positions, body, amplitudes, state, out) {
  const count = Math.floor(positions.length / 3), result = out && out.length === count * 3 ? out : new Float32Array(count * 3);
  const mpu = body.metresPerUnit, c = Math.cos(-state.angle), s = Math.sin(-state.angle);
  const level = ringingLevel(body, amplitudes);
  const energies = body.voices.map((v) => {
    const a = amplitudes?.get(v.mode_ref);
    return a ? a[0] * a[0] + a[1] * a[1] : 0;
  });
  const total = energies.reduce((sum, e) => sum + e, 0);
  for (let i = 0; i < count; i++) {
    const px = positions[i * 3], py = positions[i * 3 + 1], pz = positions[i * 3 + 2];
    const at = torusCoordinates([c * px - s * py, s * px + c * py, pz], mpu);
    let phi = at.phi, theta = at.theta;
    if (level > 0 && total > 0) {
      let u = 0, gp = 0, gt = 0;
      for (let k = 0; k < body.voices.length; k++) {
        if (!energies[k]) continue;
        const v = body.voices[k], x = chi(v, phi, theta), [dp, dt] = chiGradient(v, phi, theta);
        u += energies[k] * x * x;
        gp += 2 * energies[k] * x * dp;
        gt += 2 * energies[k] * x * dt;
      }
      u /= total;
      gp /= total;
      gt /= total;
      const g2 = gp * gp + gt * gt;
      if (g2 > 1e-12) {
        let k = level * u / g2;
        const step = k * Math.sqrt(g2);
        if (step > SETTLE_RADIANS) k *= SETTLE_RADIANS / step;
        phi -= gp * k;
        theta -= gt * k;
      }
    }
    blendAt(state, phi, theta, at.offset, mpu, result, i * 3);
  }
  return result;
}
function voicePoints(body, amplitudes, state, unitsPerMetre) {
  const points = [], at = [0, 0, 0], lift = VOICE_LIFT_TUBES * TORUS_MINOR * body.metresPerUnit;
  for (const voice of body.voices) {
    const a = amplitudes?.get(voice.mode_ref), level = a ? Math.min(1, Math.hypot(a[0], a[1]) / body.strikeMetres) : 0;
    if (level < 1e-3) continue;
    const place = helixPlace(voice.helix, voice.longitude_radians);
    blendAt(state, place.phi, place.theta, lift, body.metresPerUnit, at, 0);
    points.push({
      id: `torus-voice:${voice.mode_ref}`,
      mode_ref: voice.mode_ref,
      position: { x: at[0] * unitsPerMetre, y: at[1] * unitsPerMetre, z: at[2] * unitsPerMetre },
      level,
      law: "radial",
      polarity: "attract",
      strength: VOICE_PULL * level,
      radius: VOICE_REACH_TUBES * TORUS_MINOR * body.metresPerUnit * unitsPerMetre,
      spin: 0,
      metric: "world3d",
      enabled: true
    });
  }
  return points;
}
function boundaryLines(body) {
  return body.boundaries.map((b, boundary) => ({
    boundary,
    m: b.m,
    n: b.n,
    ring: Array.from({ length: Math.max(1, Math.round(b.m)) }, (_, j) => TAU * j / Math.max(1, Math.round(b.m))),
    tube: Array.from({ length: Math.max(1, Math.round(b.n)) }, (_, j) => TAU * j / Math.max(1, Math.round(b.n)))
  }));
}
function shapeRayHit(origin, direction, state, metresPerUnit, tolerance = 0.12 * metresPerUnit, samples = 96) {
  const dl = Math.hypot(direction[0], direction[1], direction[2]) || 1, d = [direction[0] / dl, direction[1] / dl, direction[2] / dl];
  const point = [0, 0, 0];
  const test = (phi, theta) => {
    blendAt(state, phi, theta, 0, metresPerUnit, point, 0);
    const w = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]], t = w[0] * d[0] + w[1] * d[1] + w[2] * d[2];
    return { t, miss: Math.hypot(w[0] - d[0] * t, w[1] - d[1] * t, w[2] - d[2] * t) };
  };
  let best = null;
  const consider = (phi, theta) => {
    const r = test(phi, theta);
    if (r.t <= 0 || r.miss > tolerance) return;
    if (!best || r.t < best.t - tolerance || Math.abs(r.t - best.t) <= tolerance && r.miss < best.miss) best = { phi: wrap(phi), theta: wrap(theta), t: r.t, miss: r.miss };
  };
  for (let i = 0; i < samples; i++) for (let j = 0; j < samples / 2; j++) consider(TAU * i / samples, TAU * j / (samples / 2));
  if (!best) return null;
  const step = TAU / samples, found = best;
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) consider(found.phi + i * step / 4, found.theta + j * step / 2);
  const hit = best;
  return { phi: hit.phi, theta: hit.theta, t: hit.t };
}
function shapeNearest(at, state, metresPerUnit, samples = 48) {
  const point = [0, 0, 0];
  let best = { phi: 0, theta: 0, distance: Infinity };
  const consider = (phi, theta) => {
    blendAt(state, phi, theta, 0, metresPerUnit, point, 0);
    const distance = Math.hypot(point[0] - at[0], point[1] - at[1], point[2] - at[2]);
    if (distance < best.distance) best = { phi: wrap(phi), theta: wrap(theta), distance };
  };
  for (let i = 0; i < samples; i++) for (let j = 0; j < samples / 2; j++) consider(TAU * i / samples, TAU * j / (samples / 2));
  for (let pass = 1, ring = TAU / samples, tube2 = 2 * TAU / samples; pass <= 3; pass++) {
    ring /= 4;
    tube2 /= 4;
    const found = best;
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) consider(found.phi + i * ring, found.theta + j * tube2);
  }
  return best;
}
function torusCandidates(figure, lon = 128, lat = 64) {
  const scale = 200 / (TORUS_MAJOR + TORUS_MINOR), out = [];
  for (let j = 0; j < lat; j++) for (let i = 0; i < lon; i++) {
    const [x, y, z] = shapePoint(figure, TAU * i / lon, TAU * j / lat);
    out.push({ x: x * scale, y: y * scale, z: z * scale, density: 1 });
  }
  return out;
}
class TorusObject {
  body = null;
  modeRefs = null;
  session = null;
  sampleRate = 48e3;
  flat = false;
  morph = new TorusMorph();
  shown = null;
  amplitudes = null;
  steps = null;
  figure = null;
  out;
  /** The body from the owner's influence reading, and the order of its resident modes (the sources' m2.resonator.modes). */
  setBody(influence, modeRefs) {
    const body = bodyOf(influence), g = influence?.geometry;
    const samples = Number.isInteger(g?.longitude_samples) && Number.isInteger(g?.latitude_samples) ? g.longitude_samples * g.latitude_samples : null;
    this.body = body ? { ...body, samples } : null;
    if (modeRefs !== void 0) this.modeRefs = modeRefs ? [...modeRefs] : this.modeRefs;
  }
  setModeRefs(modeRefs) {
    this.modeRefs = modeRefs ? [...modeRefs] : null;
  }
  setSession(session) {
    this.session = session;
  }
  setSampleRate(rate) {
    if (rate > 0) this.sampleRate = rate;
  }
  /** The plate laid flat (§20.14: the same modes laid flat), while the scene's Resonance studies them. Says whether it changed. */
  layFlat(on) {
    const changed = on !== this.flat;
    this.flat = on;
    return changed;
  }
  /** The frame as the object shows it (metres, three per sample, in the frame's order), or null when it is shown as the owner gives it:
   * the torus, no passage, a quiet body, or a frame that is not this scene's body. */
  present(frame) {
    this.amplitudes = amplitudesOf(frame, this.modeRefs);
    const body = this.body;
    if (!body) {
      this.shown = null;
      return null;
    }
    this.steps = stepsAt(this.session, Number(frame?.samples_elapsed), this.sampleRate);
    this.figure = figureAt(this.session, this.steps);
    const shape = this.flat ? "plate" : this.figure ?? "torus";
    const morph = this.steps === null ? this.morph.snap(shape) : this.morph.at(shape, this.steps);
    const state = { morph, angle: clockAngle(frame?.clock, body.attachment) };
    this.shown = state;
    const targets = Array.isArray(frame?.targets) ? frame.targets : [];
    if (presentsAsIs(state, ringingLevel(body, this.amplitudes)) || body.samples === null || targets.length !== body.samples) return null;
    const positions = new Float64Array(targets.length * 3);
    for (let i = 0; i < targets.length; i++) positions.set(targets[i].position, i * 3);
    this.out = presentSamples(positions, body, this.amplitudes, state, this.out);
    return this.out;
  }
  /** The voices that sound, as force points of the engine, in presentation units. */
  voicePoints(unitsPerMetre) {
    return this.body && this.shown && unitsPerMetre > 0 ? voicePoints(this.body, this.amplitudes, this.shown, unitsPerMetre) : [];
  }
  state() {
    return this.shown;
  }
  /** What the object is now, for the frame's reading and the plate's roles. */
  reading() {
    const body = this.body, shown = this.shown;
    if (!body) return { schema: "oi.torus-object/v1", standing: "unread", reason: "The owner states no voices and boundaries for the torus yet.", amplitudes: null };
    return {
      schema: "oi.torus-object/v1",
      standing: "read",
      shape: { law: this.figure, shown: shown?.morph ?? null, steps: this.steps, flat: this.flat },
      layers: ["bimba", "pratibimba"],
      voices: body.voices.map((v) => {
        const a = this.amplitudes?.get(v.mode_ref);
        return { mode_ref: v.mode_ref, level: a ? Math.min(1, Math.hypot(a[0], a[1]) / body.strikeMetres) : 0, place: helixPlace(v.helix, v.longitude_radians) };
      }),
      boundaries: boundaryLines(body),
      amplitudes: this.amplitudes ? body.voices.map((v) => {
        const a = this.amplitudes.get(v.mode_ref) ?? [0, 0];
        return { mode_ref: v.mode_ref, re: a[0], im: a[1] };
      }) : null,
      law: "DLW \xA721.2 The Torus in the pane: shapes from QL's figure law, the passage on the pulse, the voices as force points while they sound, the particles drawn towards the four boundaries' still lines while the body rings (declared presentation: SETTLE_RADIANS, VOICE_PULL)"
    };
  }
}
export {
  PASSAGE_STEPS,
  PLATE_SIDE,
  ROLES_LAW,
  SETTLE_RADIANS,
  TORUS_FIGURES,
  TORUS_MAJOR,
  TORUS_MINOR,
  TorusMorph,
  TorusObject,
  VOICE_LIFT_TUBES,
  VOICE_PULL,
  VOICE_REACH_TUBES,
  amplitudesOf,
  bodyOf,
  boundaryLines,
  boundaryOf,
  chi,
  clockAngle,
  figureAt,
  helixCurve,
  helixIndex,
  helixPlace,
  isTorusFigure,
  passageDrive,
  plateDisplacement,
  presentSamples,
  presentsAsIs,
  readRoles,
  receiverPlace,
  ringingLevel,
  shapeNearest,
  shapeNormal,
  shapePoint,
  shapeRayHit,
  stepsAt,
  torusCandidates,
  torusCoordinates,
  voicePoints
};
