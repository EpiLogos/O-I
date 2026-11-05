/**
 * The Torus as an object of the scene (DLW manual §21.2 "The Torus in the pane", §20.2 Body and Modes, §20.14; O-I 851).
 *
 * The native owner (QL) rings one body: every sample of the torus stands at its rest place on m1::torus(θ, φ) (R = 16/9, r = 1, in
 * torus units × metres_per_unit) and moves along the surface normal by Σ Re(A_k)·χ_k(φ, θ), turned about z by the native clock
 * (QL continuous_field.hpp write_targets). This module decides nothing about that motion. It presents it as the manual's object:
 *
 *   A form      the torus, with each shape QL's figure law names (torus · figure-eight · spiral · klein-bottle) a state it moves to, and
 *               the plate laid flat (the same modes, §20.14) when the scene's Resonance studies them.
 *   Layers      its two helices: θ = φ/2 + hπ (QL janko.rs helix_place/point: arc = 6h + position, θ = arc·π/6, φ = (arc mod 6)·π/3).
 *   Points      its eight voices, each at its own place on its helix, pulling the particles while it sounds (|A_k| over the strike) and
 *               letting them go as it fades.
 *   A morph     the passage from one shape to the next, timed by the pulse (morphSignal.pulseTurnings): it starts on the step the law
 *               changes on and runs for half a step, carried by the engine's one morph law on the ring's turning and the tube's (passageDrive).
 *   Boundaries  the four: the lines where the particles settle. While the body rings each sample is drawn down the body's own energy
 *               Σ|A_k|²χ_k² towards the nodal lines its voices' m and n (from the four) leave still, and it returns as the body falls quiet.
 *
 * A sample keeps its identity: its angles come from its own native place (the exact inverse below), and its displacement is the
 * native displacement, carried to the same angles of the shape shown. Nothing here integrates, samples or makes up a position.
 */
import {computeMorphDrive, pulseTurnings, type MorphDriveState} from './morphSignal';

export const TORUS_MAJOR = 16 / 9;
export const TORUS_MINOR = 1;
/** The plate laid flat is square, as wide as the torus (2(R + r) torus units), with x along the ring (φ) and y along the tube (θ). */
export const PLATE_SIDE = 2 * (TORUS_MAJOR + TORUS_MINOR);
const TAU = Math.PI * 2;

export type Vec3 = [number, number, number];
/** The shapes QL's figure law names (m1_prime.rs Figure, kebab-case as the reading spells them). */
export type TorusFigure = 'torus' | 'figure-eight' | 'spiral' | 'klein-bottle';
export const TORUS_FIGURES: readonly TorusFigure[] = ['torus', 'figure-eight', 'spiral', 'klein-bottle'];
export const isTorusFigure = (value: unknown): value is TorusFigure => typeof value === 'string' && (TORUS_FIGURES as readonly string[]).includes(value);
/** What the pane shows: one of the figures, or the plate laid flat. */
export type TorusShape = TorusFigure | 'plate';

const wrap = (angle: number) => { const a = angle % TAU; return a < 0 ? a + TAU : a; };

// ------------------------------------------------------------------------------------------------------------------- the shapes

/** The swept tubes' centre curves and radii (declared presentation geometry, in torus units: each shape fits the torus's own box). */
const EIGHT = {across: 2.5, along: 2.4, lift: 0.6, tube: 0.55};
const SPIRAL = {inner: 0.55, outer: 1, rise: 0.9, tubeFrom: 0.35, tubeTo: 0.8};
const KLEIN = {ring: TORUS_MAJOR, section: 0.62};

/** A tube of radius `tube` swept along a centre curve, with the ring frame (N outward in the plane, B upward) the torus itself has. */
function tube(c: Vec3, t: Vec3, radius: number, theta: number): Vec3 {
  // N = T × ẑ (outward for a counter-clockwise curve), B = N × T.
  let nx = t[1], ny = -t[0], nz = 0;
  const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
  const bx = ny * t[2] - nz * t[1], by = nz * t[0] - nx * t[2], bz = nx * t[1] - ny * t[0];
  const bl = Math.hypot(bx, by, bz) || 1;
  const c0 = Math.cos(theta) * radius, s0 = Math.sin(theta) * radius;
  return [c[0] + c0 * nx + s0 * bx / bl, c[1] + c0 * ny + s0 * by / bl, c[2] + c0 * nz + s0 * bz / bl];
}

/** A point of a shape at the angles (φ round the ring, θ round the tube) of a sample of the torus, in torus units. */
export function shapePoint(shape: TorusShape, phi: number, theta: number): Vec3 {
  switch (shape) {
    case 'torus': {
      const ring = TORUS_MAJOR + Math.cos(theta);
      return [ring * Math.cos(phi), ring * Math.sin(phi), Math.sin(theta)];
    }
    case 'plate':
      return [PLATE_SIDE * (wrap(phi) / TAU - 0.5), PLATE_SIDE * (wrap(theta) / TAU - 0.5), 0];
    case 'figure-eight': {
      // A lemniscate of Gerono, one loop for each helix, lifted apart where its loops cross.
      const c: Vec3 = [EIGHT.across * Math.cos(phi), EIGHT.along * Math.sin(phi) * Math.cos(phi), EIGHT.lift * Math.sin(phi)];
      const d: Vec3 = [-EIGHT.across * Math.sin(phi), EIGHT.along * Math.cos(2 * phi), EIGHT.lift * Math.cos(phi)];
      const l = Math.hypot(d[0], d[1], d[2]) || 1;
      return tube(c, [d[0] / l, d[1] / l, d[2] / l], EIGHT.tube, theta);
    }
    case 'spiral': {
      // An opening coil: one turn of the ring that rises and widens, so it lands past where it began.
      const u = wrap(phi) / TAU, rho = TORUS_MAJOR * (SPIRAL.inner + (SPIRAL.outer - SPIRAL.inner) * u);
      const c: Vec3 = [rho * Math.cos(phi), rho * Math.sin(phi), SPIRAL.rise * (2 * u - 1)];
      const drho = TORUS_MAJOR * (SPIRAL.outer - SPIRAL.inner) / TAU;
      const d: Vec3 = [drho * Math.cos(phi) - rho * Math.sin(phi), drho * Math.sin(phi) + rho * Math.cos(phi), 2 * SPIRAL.rise / TAU];
      const l = Math.hypot(d[0], d[1], d[2]) || 1;
      return tube(c, [d[0] / l, d[1] / l, d[2] / l], SPIRAL.tubeFrom + (SPIRAL.tubeTo - SPIRAL.tubeFrom) * u, theta);
    }
    case 'klein-bottle': {
      // The figure-8 immersion: the tube's section turns half over as it goes round, and meets itself flipped (θ → −θ) at φ = 2π.
      const h = phi / 2, section = KLEIN.section * (Math.cos(h) * Math.sin(theta) - Math.sin(h) * Math.sin(2 * theta));
      const ring = KLEIN.ring + section;
      return [ring * Math.cos(phi), ring * Math.sin(phi), KLEIN.section * (Math.sin(h) * Math.sin(theta) + Math.cos(h) * Math.sin(2 * theta))];
    }
  }
}

/** The unit normal of a shape at a sample's angles: exact for the torus and the plate, by the surface's own tangents otherwise. */
export function shapeNormal(shape: TorusShape, phi: number, theta: number): Vec3 {
  if (shape === 'torus') return [Math.cos(theta) * Math.cos(phi), Math.cos(theta) * Math.sin(phi), Math.sin(theta)];
  if (shape === 'plate') return [0, 0, 1];
  const h = 1e-4;
  const a = shapePoint(shape, phi + h, theta), b = shapePoint(shape, phi - h, theta);
  const c = shapePoint(shape, phi, theta + h), d = shapePoint(shape, phi, theta - h);
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], v = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
  const n: Vec3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(n[0], n[1], n[2]);
  return l > 0 ? [n[0] / l, n[1] / l, n[2] / l] : [0, 0, 1];
}

// --------------------------------------------------------------------------------------------------------- the body's coordinates

export interface TorusCoordinates {phi: number; theta: number; offset: number}
/** The exact inverse of the native body (metres, untuned by the clock): a sample's angles and its displacement along the normal. */
export function torusCoordinates(p: readonly number[], metresPerUnit: number): TorusCoordinates {
  const rho = Math.hypot(p[0], p[1]) - TORUS_MAJOR * metresPerUnit;
  return {phi: wrap(Math.atan2(p[1], p[0])), theta: wrap(Math.atan2(p[2], rho)), offset: Math.hypot(rho, p[2]) - TORUS_MINOR * metresPerUnit};
}

/** The angle the native clock turns a sample of this attachment by (0 fixed, 1 inscription, 2 lensing; continuous_field.hpp). */
export function clockAngle(clock: {inscription?: {half_degrees?: number}; lensing?: {half_degrees?: number}} | null | undefined, attachment: number): number {
  if (attachment === 1) return (clock?.inscription?.half_degrees ?? 0) * Math.PI / 360;
  if (attachment === 2) return (clock?.lensing?.half_degrees ?? 0) * Math.PI / 360;
  return 0;
}

// --------------------------------------------------------------------------------------------------------- where the Torus is heard

/** The view the stage hands the engine (production.ts setHostView): the stage's height in pixels, the pixels per engine unit, the camera's
 * right and up, and the engine's field of view in degrees (its depth config). */
export interface HostEye {height: number; pixelsPerUnit: number; right: readonly number[]; up: readonly number[]; fovDegrees: number}
/** Where the listener stands with Receiver On (DLW manual §21.2 View: "Receiver On makes your camera the place where the torus is heard";
 * O-I 856): the engine's own eye, in metres of the scene the owner draws its targets in. PointCloudField setHostView stands its camera on
 * the normal right × up at the distance that frames the host's pixel pitch at the workplane under its field of view (held to 4..120°), so
 * the perspective eye is that place and the flat projection frames the same workplane from it; the flat camera's own 5000 units is how far
 * back it draws, not where anyone stands. Metres are engine units over the presentation's units per metre. The owner turns the place into
 * the body's frame by its clock (QL scene_field.rs TORUS_RECEIVER_LAW). Null when the view has no size, scale, field of view or eye. Pure. */
export function receiverPlace(view: HostEye, unitsPerMetre: number): Vec3 | null {
  const {height, pixelsPerUnit: s, right: a, up: b, fovDegrees} = view;
  if (!(Number.isFinite(unitsPerMetre) && unitsPerMetre > 0 && Number.isFinite(height) && height > 0 && Number.isFinite(s) && s > 0 && Number.isFinite(fovDegrees))) return null;
  const n: Vec3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const length = Math.hypot(n[0], n[1], n[2]);
  if (!(Number.isFinite(length) && length > 0)) return null;
  const fov = Math.max(4, Math.min(120, fovDegrees)) * Math.PI / 180;
  const metres = (height / Math.max(0.0001, s) * 0.5) / Math.max(0.0001, Math.tan(fov / 2)) / unitsPerMetre;
  return [n[0] / length * metres, n[1] / length * metres, n[2] / length * metres];
}

/** A helix's place at a ring angle: the helix curve θ = φ/2 + hπ the keys and voices stand on (bimba h = 0, pratibimba h = 1). */
export const helixIndex =(helix: unknown): 0 | 1 => (helix === 'pratibimba' || helix === 1 ? 1 : 0);
export function helixPlace(helix: unknown, phi: number): {phi: number; theta: number} {
  return {phi: wrap(phi), theta: wrap(phi / 2 + helixIndex(helix) * Math.PI)};
}
/** A helix as a layer of the object: `count` places along it, one turn of the ring. */
export function helixCurve(helix: unknown, count = 48): {phi: number; theta: number}[] {
  return Array.from({length: count}, (_, i) => helixPlace(helix, (TAU * i) / count));
}

// -------------------------------------------------------------------------------------------------------- the eight and the four

/** A voice as the owner's influence reading names it (QL scene_field.rs Voice). */
export interface BodyVoice {mode_ref: string; frequency_hz: number; m: number; n: number; helix: string; ql_position: number; weight: number; phase_radians: number; longitude_radians: number}
/** A boundary of the Vimarśā reading (QL scene_field.rs: nodal_quartet entry i, at position (i mod 2)·5 of helix i div 2). */
export interface BodyBoundary {m: number; n: number; helix: string; ql_position: number}
export interface TorusBody {voices: readonly BodyVoice[]; boundaries: readonly BodyBoundary[]; metresPerUnit: number; attachment: number; strikeMetres: number}

/** The body as the influence reading gives it; null when the reading does not state the eight voices and the four boundaries. */
export function bodyOf(influence: any): TorusBody | null {
  const voices = Array.isArray(influence?.voices) ? influence.voices : [], boundaries = Array.isArray(influence?.boundaries) ? influence.boundaries : [];
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (!voices.length || boundaries.length !== 4) return null;
  if (!voices.every((v: any) => typeof v?.mode_ref === 'string' && [v.m, v.n, v.weight, v.phase_radians, v.longitude_radians, v.frequency_hz].every(finite))) return null;
  if (!boundaries.every((b: any) => [b?.m, b?.n, b?.ql_position].every(finite))) return null;
  const g = influence.geometry ?? {}, mpu = finite(g.metres_per_unit) && g.metres_per_unit > 0 ? g.metres_per_unit : 1;
  const strike = finite(influence.material?.strike_metres) && influence.material.strike_metres > 0 ? influence.material.strike_metres : 0.08;
  return {voices, boundaries, metresPerUnit: mpu, attachment: finite(g.attachment) ? g.attachment : 1, strikeMetres: strike};
}

/** A voice's surface term, exactly as the owner hands it the native body (QL scene_field.rs chi):
 * a·sin(mφ′/2)·sin(nθ/2) + b·cos(mφ′/2)·cos(nθ/2), φ′ = φ − longitude, a = w·cos(phase), b = w·sin(phase). */
export function chi(voice: BodyVoice, phi: number, theta: number): number {
  const p = phi - voice.longitude_radians, a = voice.weight * Math.cos(voice.phase_radians), b = voice.weight * Math.sin(voice.phase_radians);
  return a * Math.sin(voice.m * p / 2) * Math.sin(voice.n * theta / 2) + b * Math.cos(voice.m * p / 2) * Math.cos(voice.n * theta / 2);
}
function chiGradient(voice: BodyVoice, phi: number, theta: number): [number, number] {
  const p = phi - voice.longitude_radians, a = voice.weight * Math.cos(voice.phase_radians), b = voice.weight * Math.sin(voice.phase_radians);
  const sm = Math.sin(voice.m * p / 2), cm = Math.cos(voice.m * p / 2), sn = Math.sin(voice.n * theta / 2), cn = Math.cos(voice.n * theta / 2);
  return [(voice.m / 2) * (a * cm * sn - b * sm * cn), (voice.n / 2) * (a * sm * cn - b * cm * sn)];
}

/** The boundary a voice takes its m and n from: the nearer boundary of its own helix (QL GROUP_PLACE_STANDING). */
export function boundaryOf(body: TorusBody, voice: BodyVoice): number {
  const h = helixIndex(voice.helix), end = voice.ql_position >= 3 ? 5 : 0;
  const index = body.boundaries.findIndex(b => helixIndex(b.helix) === h && b.ql_position === end);
  return index >= 0 ? index : h * 2 + (end === 5 ? 1 : 0);
}

export interface VoiceRole {
  mode_ref: string;
  /** From the eight: how the voice weights the two families of standing wave (a sin·sin, b cos·cos), how strongly it drives, and in what phase. */
  a: number; b: number; amplitude_metres: number; phase_radians: number;
  /** From the four: the mode numbers it takes, and which boundary gave them. */
  m: number; n: number; boundary: number;
  frequency_hz: number; longitude_radians: number;
}
export interface BoundaryRole {m: number; n: number; helix: string; edge: 'opening' | 'closing'; families: readonly ['sin·sin', 'cos·cos']}
export type TorusRoles =
  | {standing: 'read'; law: string; voices: VoiceRole[]; boundaries: BoundaryRole[]}
  | {standing: 'unread'; reason: string};
export const ROLES_LAW = 'M2′ 8+4 (M2′ seed §3): each of the eight gives a = w·cos(phase), b = w·sin(phase), its amplitude |A| and temporal phase arg A from the one native body; each of the four gives the m and n of the voices of its end of its helix, and its edge (position 0 opens the helix, 5 closes it). A closed torus admits both families; no source restricts them.';

/** The 8+4 roles, read from the body and the native amplitudes ([re, im] metres per voice, by mode_ref). */
export function readRoles(body: TorusBody | null, amplitudes: ReadonlyMap<string, readonly [number, number]> | null,
  unread = 'No instrument is open, so the torus gives the plate no voices or boundaries.'): TorusRoles {
  if (!body) return {standing: 'unread', reason: unread};
  const voices = body.voices.map(voice => {
    const boundary = boundaryOf(body, voice), amp = amplitudes?.get(voice.mode_ref) ?? [0, 0];
    return {mode_ref: voice.mode_ref, a: voice.weight * Math.cos(voice.phase_radians), b: voice.weight * Math.sin(voice.phase_radians),
      amplitude_metres: Math.hypot(amp[0], amp[1]), phase_radians: Math.atan2(amp[1], amp[0]), m: voice.m, n: voice.n, boundary,
      frequency_hz: voice.frequency_hz, longitude_radians: voice.longitude_radians};
  });
  const boundaries = body.boundaries.map(b => ({m: b.m, n: b.n, helix: b.helix, edge: b.ql_position === 5 ? 'closing' as const : 'opening' as const, families: ['sin·sin', 'cos·cos'] as const}));
  return {standing: 'read', law: ROLES_LAW, voices, boundaries};
}

/** The plate laid flat, from the roles alone: the displacement at plate point (x, y) ∈ [0, L)², x along the ring and y along the tube,
 * Σ_k |A_k|cos(arg A_k)·(a_k sin(m_kπx′/L) sin(n_kπy/L) + b_k cos(m_kπx′/L) cos(n_kπy/L)) — the seed's χ with the eight and the four. */
export function plateDisplacement(roles: TorusRoles, x: number, y: number, side = PLATE_SIDE): number {
  if (roles.standing !== 'read') return 0;
  let total = 0;
  for (const r of roles.voices) {
    const xs = x - (r.longitude_radians / TAU) * side;
    total += r.amplitude_metres * Math.cos(r.phase_radians) * (r.a * Math.sin(r.m * Math.PI * xs / side) * Math.sin(r.n * Math.PI * y / side)
      + r.b * Math.cos(r.m * Math.PI * xs / side) * Math.cos(r.n * Math.PI * y / side));
  }
  return total;
}

// -------------------------------------------------------------------------------------------------------------- the figure law

/** The Torus's M1′ session as the owner reads it (QL m1_prime.rs Session::reading), as much as the object needs. */
export interface TorusSessionReading {
  settings?: {shape?: string};
  steps_per_second?: number;
  band?: string;
  pulse?: {steps?: number};
  figure?: string | null;
  samples_elapsed?: string;
  figure_law?: {return_steps?: number; klein_for_steps?: number; klein_until_steps?: number | null; by_band?: Record<string, string>};
}

/** The pulse's steps at a sample of the scene's clock, from one reading: the reading's steps, run on at its rate; never back. */
export function stepsAt(session: TorusSessionReading | null, samples: number, sampleRate: number): number | null {
  const steps = session?.pulse?.steps, sps = session?.steps_per_second, at = Number(session?.samples_elapsed);
  if (typeof steps !== 'number' || !Number.isFinite(steps) || typeof sps !== 'number' || !Number.isFinite(sps) || !Number.isFinite(at) || !(sampleRate > 0)) return null;
  return steps + (Math.max(0, samples - at) / sampleRate) * sps;
}

/** The shape at a count of steps, by the law the reading carries (QL m1_prime.rs figure): a held shape holds; Auto is the band's shape,
 * and the Klein bottle at each return and until the step a tritone named. A reading without the law gives its own figure; Sequence, none. */
export function figureAt(session: TorusSessionReading | null, steps: number | null): TorusFigure | null {
  if (!session) return null;
  const shape = session.settings?.shape, law = session.figure_law;
  if (shape === 'sequence') return null;
  if (shape !== 'auto' || !law || steps === null) return isTorusFigure(session.figure) ? session.figure : isTorusFigure(shape) ? shape : null;
  const ret = law.return_steps ?? 12, klein = law.klein_for_steps ?? 1;
  const returning = steps >= ret && ((steps % ret) + ret) % ret < klein;
  const crossing = typeof law.klein_until_steps === 'number' && steps < law.klein_until_steps;
  if (returning || crossing) return 'klein-bottle';
  const byBand = law.by_band?.[session.band ?? ''];
  return isTorusFigure(byBand) ? byBand : isTorusFigure(session.figure) ? session.figure : null;
}

// -------------------------------------------------------------------------------------------------------------------- the morph

/** How long a passage from one shape to the next runs, in pulse steps: half a step, 30° of the 720° cover, one tick of the M3 clock
 * (ruling D5: one tick = 30°; QL phase.rs: one pulse step is two of its ticks). The ring turns a twelfth in it, the tube a twenty-fourth. */
export const PASSAGE_STEPS = 0.5;
export interface MorphState {from: TorusShape; to: TorusShape; progress: number; since: number | null}

/** The passage's drive at a count of steps, for a passage begun at `since`: the engine's morph law on the pulse's two turnings.
 *
 * The pulse has one turning, its place on the 720° cover (QL m1_prime.rs Pulse: cover = steps·60° mod 720°). Round the ring it is the
 * cover mod 360°; round the tube it is half the cover (janko.rs point). So the tube's turning is the ring's own half plus the half-turn of
 * the sheet the pulse stands on, the helix law θ = φ/2 + hπ: h = 0 on the first 360° (bimba), 1 on the second (pratibimba), as QL's M3
 * clock counts its layer (ql-core m3_clock.rs) and QL-MEF #281 keeps the two helices as one double cover with its 720°/4π return. That
 * half-turn is the morph's φ: the tube's turning less the ring's own half. On the pratibimba the address is kept and the phase flips
 * (ql-law, DR-FLIP-1), so the drive's phase turns by the same π. Of the engine's laws only the product of the two (computeMorphDrive
 * 'product') then still carries a passage from 0 to 1 on both sheets; θ alone would run it backwards there, and sum or beat would hold
 * it half way. Across a passage the drive runs half a cycle of the sine, from the old shape to the new. */
export function passageDrive(since: number, steps: number): MorphDriveState {
  const turn = pulseTurnings(steps), sheet = turn.phi - wrap(turn.theta) / 2;
  const u = Math.min(1, Math.max(0, steps - since) / PASSAGE_STEPS);
  return computeMorphDrive({driveShape: 'sine', interference: 'product', driveDepth: 1} as any, -Math.PI / 2 + Math.PI * u + sheet, sheet);
}

/** The passage between shapes, carried by the pulse. A change of shape begins a passage on the step it is read at; a change while one
 * runs starts the next from the nearer of the two. The passage's progress is the engine's morph signal on the pulse's two turnings
 * (passageDrive). */
export class TorusMorph {
  private from: TorusShape = 'torus'; private to: TorusShape = 'torus'; private since: number | null = null; private last = 0;
  at(shape: TorusShape, steps: number): MorphState {
    if (shape !== this.to) {
      const current = this.progress(steps);
      this.from = current >= 0.5 ? this.to : this.from;
      this.to = shape; this.since = steps;
    }
    this.last = this.progress(steps);
    return {from: this.from, to: this.to, progress: this.last, since: this.since};
  }
  private progress(steps: number): number {
    if (this.since === null || this.from === this.to) return 1;
    if (steps - this.since >= PASSAGE_STEPS) return 1;
    return passageDrive(this.since, steps).progress;
  }
  /** A change read where the pulse is not known stands at once, with no passage. */
  snap(shape: TorusShape): MorphState {
    if (shape !== this.to || this.from !== this.to) { this.from = this.to = shape; this.since = null; }
    this.last = 1;
    return this.state();
  }
  state(): MorphState {return {from: this.from, to: this.to, progress: this.last, since: this.since};}
}

// ------------------------------------------------------------------------------------------------------------- the presentation

/** A ringing body draws each sample towards its nearest still line: at full ringing half the way there (one Newton step on the body's
 * energy, which falls as the square of the distance to a node), never further than SETTLE_RADIANS of its own angles (declared
 * presentation). */
export const SETTLE_RADIANS = 0.3;
/** How strongly a voice that sounds at the strike's amplitude pulls the particles (the engine's force scale), and how far it reaches. */
export const VOICE_PULL = 1.4;
export const VOICE_REACH_TUBES = 0.6;
/** How far off the surface a voice stands, in tubes, so that it draws the surface out towards it. */
export const VOICE_LIFT_TUBES = 0.25;

export interface PresentState {morph: MorphState; angle: number}

/** The native amplitudes ([re, im] metres) by mode ref, from a frame and the order of the owner's resident modes. */
export function amplitudesOf(frame: any, modeRefs: readonly string[] | null): Map<string, [number, number]> | null {
  const a = frame?.amplitudes_metres;
  if (!Array.isArray(a) || !modeRefs || a.length !== modeRefs.length) return null;
  const map = new Map<string, [number, number]>();
  modeRefs.forEach((ref, i) => { const v = a[i]; if (Array.isArray(v) && Number.isFinite(v[0]) && Number.isFinite(v[1])) map.set(ref, [v[0], v[1]]); });
  return map;
}

function blendAt(state: PresentState, phi: number, theta: number, offset: number, mpu: number, out: Float32Array | number[], at: number) {
  const {from, to, progress} = state.morph;
  const f = shapePoint(from, phi, theta), nf = shapeNormal(from, phi, theta);
  let x = f[0] * mpu + nf[0] * offset, y = f[1] * mpu + nf[1] * offset, z = f[2] * mpu + nf[2] * offset;
  if (progress < 1 && from !== to) {
    const g = shapePoint(to, phi, theta), ng = shapeNormal(to, phi, theta);
    x += (g[0] * mpu + ng[0] * offset - x) * progress; y += (g[1] * mpu + ng[1] * offset - y) * progress; z += (g[2] * mpu + ng[2] * offset - z) * progress;
  } else if (progress >= 1 && from !== to) {
    const g = shapePoint(to, phi, theta), ng = shapeNormal(to, phi, theta);
    x = g[0] * mpu + ng[0] * offset; y = g[1] * mpu + ng[1] * offset; z = g[2] * mpu + ng[2] * offset;
  }
  // The plate lies still under the clock; every closed shape turns with the body.
  const flat = (from === 'plate' ? 1 - progress : 0) + (to === 'plate' ? progress : 0), angle = state.angle * (1 - flat);
  const c = Math.cos(angle), s = Math.sin(angle);
  out[at] = c * x - s * y; out[at + 1] = s * x + c * y; out[at + 2] = z;
}

/** Whether a state shows the native body exactly as it stands: the torus, no passage running, and no ringing to settle. */
export const presentsAsIs = (state: PresentState, level: number) => state.morph.from === 'torus' && state.morph.to === 'torus' && level <= 0;

/** The ringing level of the body: the root of its voices' summed squared amplitudes, over the strike, at most 1. */
export function ringingLevel(body: TorusBody, amplitudes: ReadonlyMap<string, readonly [number, number]> | null): number {
  if (!amplitudes) return 0;
  let energy = 0;
  for (const voice of body.voices) { const a = amplitudes.get(voice.mode_ref); if (a) energy += a[0] * a[0] + a[1] * a[1]; }
  return Math.min(1, Math.sqrt(energy) / body.strikeMetres);
}

/**
 * The native samples presented as the object: per sample (in the frame's own order) the shape's point at the sample's own angles, drawn
 * towards the still lines while the body rings, carried out along the shape's normal by the sample's own native displacement, and
 * turned by the native clock. `positions` are the frame's target positions in metres; the result is in metres, three per sample.
 */
export function presentSamples(positions: ArrayLike<number>, body: TorusBody, amplitudes: ReadonlyMap<string, readonly [number, number]> | null, state: PresentState, out?: Float32Array): Float32Array {
  const count = Math.floor(positions.length / 3), result = out && out.length === count * 3 ? out : new Float32Array(count * 3);
  const mpu = body.metresPerUnit, c = Math.cos(-state.angle), s = Math.sin(-state.angle);
  const level = ringingLevel(body, amplitudes);
  const energies = body.voices.map(v => { const a = amplitudes?.get(v.mode_ref); return a ? a[0] * a[0] + a[1] * a[1] : 0; });
  const total = energies.reduce((sum, e) => sum + e, 0);
  for (let i = 0; i < count; i++) {
    const px = positions[i * 3], py = positions[i * 3 + 1], pz = positions[i * 3 + 2];
    const at = torusCoordinates([c * px - s * py, s * px + c * py, pz], mpu);
    let phi = at.phi, theta = at.theta;
    if (level > 0 && total > 0) {
      // Down the body's own energy U = Σ E_k χ_k² (normalised by Σ E_k), so the samples gather where the voices leave the surface
      // still: one Newton step towards U = 0, scaled by how strongly the body rings, and held to SETTLE_RADIANS.
      let u = 0, gp = 0, gt = 0;
      for (let k = 0; k < body.voices.length; k++) {
        if (!energies[k]) continue;
        const v = body.voices[k], x = chi(v, phi, theta), [dp, dt] = chiGradient(v, phi, theta);
        u += energies[k] * x * x; gp += 2 * energies[k] * x * dp; gt += 2 * energies[k] * x * dt;
      }
      u /= total; gp /= total; gt /= total;
      const g2 = gp * gp + gt * gt;
      if (g2 > 1e-12) {
        let k = level * u / g2;
        const step = k * Math.sqrt(g2);
        if (step > SETTLE_RADIANS) k *= SETTLE_RADIANS / step;
        phi -= gp * k; theta -= gt * k;
      }
    }
    blendAt(state, phi, theta, at.offset, mpu, result, i * 3);
  }
  return result;
}

/** A force point of the engine (forceRuntime.ts ForceEmitterState), for a voice that sounds. */
export interface VoicePoint {id: string; mode_ref: string; position: {x: number; y: number; z: number}; level: number; law: 'radial'; polarity: 'attract'; strength: number; radius: number; spin: number; metric: 'world3d'; enabled: boolean}

/** The eight voices as points of the object, in presentation units: each at its own place on its helix on the shape shown, standing a
 * little off the surface, pulling while it sounds (|A| over the strike) and gone when it is silent. */
export function voicePoints(body: TorusBody, amplitudes: ReadonlyMap<string, readonly [number, number]> | null, state: PresentState, unitsPerMetre: number): VoicePoint[] {
  const points: VoicePoint[] = [], at = [0, 0, 0], lift = VOICE_LIFT_TUBES * TORUS_MINOR * body.metresPerUnit;
  for (const voice of body.voices) {
    const a = amplitudes?.get(voice.mode_ref), level = a ? Math.min(1, Math.hypot(a[0], a[1]) / body.strikeMetres) : 0;
    if (level < 1e-3) continue;
    const place = helixPlace(voice.helix, voice.longitude_radians);
    blendAt(state, place.phi, place.theta, lift, body.metresPerUnit, at, 0);
    points.push({id: `torus-voice:${voice.mode_ref}`, mode_ref: voice.mode_ref, position: {x: at[0] * unitsPerMetre, y: at[1] * unitsPerMetre, z: at[2] * unitsPerMetre},
      level, law: 'radial', polarity: 'attract', strength: VOICE_PULL * level, radius: VOICE_REACH_TUBES * TORUS_MINOR * body.metresPerUnit * unitsPerMetre,
      spin: 0, metric: 'world3d', enabled: true});
  }
  return points;
}

/** The four boundaries as the object's still lines: for each, the nodal circles of its mode (sin(mφ/2) = 0: φ = 2πj/m round the ring;
 * sin(nθ/2) = 0: θ = 2πj/n round the tube), as angles of the body. */
export function boundaryLines(body: TorusBody): {boundary: number; m: number; n: number; ring: number[]; tube: number[]}[] {
  return body.boundaries.map((b, boundary) => ({boundary, m: b.m, n: b.n,
    ring: Array.from({length: Math.max(1, Math.round(b.m))}, (_, j) => (TAU * j) / Math.max(1, Math.round(b.m))),
    tube: Array.from({length: Math.max(1, Math.round(b.n))}, (_, j) => (TAU * j) / Math.max(1, Math.round(b.n)))}));
}

/** The shape a press on the pane finds on the object: the point of the shape shown nearest the ray, sampled on the body's own angles
 * (`samples` round the ring and round the tube) and refined once; null when the ray passes the object by more than `tolerance`. */
export function shapeRayHit(origin: Vec3, direction: Vec3, state: PresentState, metresPerUnit: number, tolerance = 0.12 * metresPerUnit, samples = 96): {phi: number; theta: number; t: number} | null {
  const dl = Math.hypot(direction[0], direction[1], direction[2]) || 1, d = [direction[0] / dl, direction[1] / dl, direction[2] / dl];
  const point = [0, 0, 0];
  const test = (phi: number, theta: number) => {
    blendAt(state, phi, theta, 0, metresPerUnit, point, 0);
    const w = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]], t = w[0] * d[0] + w[1] * d[1] + w[2] * d[2];
    return {t, miss: Math.hypot(w[0] - d[0] * t, w[1] - d[1] * t, w[2] - d[2] * t)};
  };
  let best: {phi: number; theta: number; t: number; miss: number} | null = null;
  const consider = (phi: number, theta: number) => {
    const r = test(phi, theta);
    if (r.t <= 0 || r.miss > tolerance) return;
    if (!best || r.t < best.t - tolerance || (Math.abs(r.t - best.t) <= tolerance && r.miss < best.miss)) best = {phi: wrap(phi), theta: wrap(theta), t: r.t, miss: r.miss};
  };
  for (let i = 0; i < samples; i++) for (let j = 0; j < samples / 2; j++) consider((TAU * i) / samples, (TAU * j) / (samples / 2));
  if (!best) return null;
  const step = TAU / samples, found: {phi: number; theta: number} = best;
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) consider(found.phi + (i * step) / 4, found.theta + (j * step) / 2);
  const hit = best as {phi: number; theta: number; t: number};
  return {phi: hit.phi, theta: hit.theta, t: hit.t};
}

/** The point of the shape shown nearest a point in space (a collision in the field, O-I 856), sampled on the body's own angles
 * (`samples` round the ring, half as many round the tube) and refined three times, each a quarter of the last spacing about the nearest so
 * far (a press's shapeRayHit refines once); with how far it stands from it. */
export function shapeNearest(at: Vec3, state: PresentState, metresPerUnit: number, samples = 48): {phi: number; theta: number; distance: number} {
  const point = [0, 0, 0];
  let best = {phi: 0, theta: 0, distance: Infinity};
  const consider = (phi: number, theta: number) => {
    blendAt(state, phi, theta, 0, metresPerUnit, point, 0);
    const distance = Math.hypot(point[0] - at[0], point[1] - at[1], point[2] - at[2]);
    if (distance < best.distance) best = {phi: wrap(phi), theta: wrap(theta), distance};
  };
  for (let i = 0; i < samples; i++) for (let j = 0; j < samples / 2; j++) consider((TAU * i) / samples, (TAU * j) / (samples / 2));
  for (let pass = 1, ring = TAU / samples, tube = (2 * TAU) / samples; pass <= 3; pass++) {
    ring /= 4; tube /= 4;
    const found = best;
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) consider(found.phi + i * ring, found.theta + j * tube);
  }
  return best;
}

// ----------------------------------------------------------------------------------------------------------- the Expression's object

/** The torus as an object of an Expression: the shape it names sampled on the body's own angles (`lon` round the ring, `lat` round the
 * tube), the outer radius at the stage's primitive half-extent (200 stage units), so it is selected, given forces and sequenced through
 * its shapes as any symbol is. The same figures the pane's object passes through. */
export function torusCandidates(figure: TorusShape, lon = 128, lat = 64): {x: number; y: number; z: number; density: number}[] {
  const scale = 200 / (TORUS_MAJOR + TORUS_MINOR), out: {x: number; y: number; z: number; density: number}[] = [];
  for (let j = 0; j < lat; j++) for (let i = 0; i < lon; i++) {
    const [x, y, z] = shapePoint(figure, (TAU * i) / lon, (TAU * j) / lat);
    out.push({x: x * scale, y: y * scale, z: z * scale, density: 1});
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------- the object

/** The torus object as the pane holds it: the body the owner's influence states, the session that names its shape, and the native frame
 * it presents. One per open instrument; it keeps only what the next frame needs (the passage in progress). */
export class TorusObject {
  private body: (TorusBody & {samples: number | null}) | null = null;
  private modeRefs: string[] | null = null;
  private session: TorusSessionReading | null = null;
  private sampleRate = 48000;
  private flat = false;
  private morph = new TorusMorph();
  private shown: PresentState | null = null;
  private amplitudes: Map<string, [number, number]> | null = null;
  private steps: number | null = null;
  private figure: TorusFigure | null = null;
  private out: Float32Array | undefined;

  /** The body from the owner's influence reading, and the order of its resident modes (the sources' m2.resonator.modes). */
  setBody(influence: any, modeRefs?: readonly string[] | null) {
    const body = bodyOf(influence), g = influence?.geometry;
    const samples = Number.isInteger(g?.longitude_samples) && Number.isInteger(g?.latitude_samples) ? g.longitude_samples * g.latitude_samples : null;
    this.body = body ? {...body, samples} : null;
    if (modeRefs !== undefined) this.modeRefs = modeRefs ? [...modeRefs] : this.modeRefs;
  }
  setModeRefs(modeRefs: readonly string[] | null) { this.modeRefs = modeRefs ? [...modeRefs] : null; }
  setSession(session: TorusSessionReading | null) { this.session = session; }
  setSampleRate(rate: number) { if (rate > 0) this.sampleRate = rate; }
  /** The plate laid flat (§20.14: the same modes laid flat), while the scene's Resonance studies them. Says whether it changed. */
  layFlat(on: boolean): boolean { const changed = on !== this.flat; this.flat = on; return changed; }

  /** The frame as the object shows it (metres, three per sample, in the frame's order), or null when it is shown as the owner gives it:
   * the torus, no passage, a quiet body, or a frame that is not this scene's body. */
  present(frame: any): Float32Array | null {
    this.amplitudes = amplitudesOf(frame, this.modeRefs);
    const body = this.body;
    if (!body) { this.shown = null; return null; }
    this.steps = stepsAt(this.session, Number(frame?.samples_elapsed), this.sampleRate);
    this.figure = figureAt(this.session, this.steps);
    const shape: TorusShape = this.flat ? 'plate' : this.figure ?? 'torus';
    const morph = this.steps === null ? this.morph.snap(shape) : this.morph.at(shape, this.steps);
    const state: PresentState = {morph, angle: clockAngle(frame?.clock, body.attachment)};
    this.shown = state;
    const targets = Array.isArray(frame?.targets) ? frame.targets : [];
    if (presentsAsIs(state, ringingLevel(body, this.amplitudes)) || body.samples === null || targets.length !== body.samples) return null;
    const positions = new Float64Array(targets.length * 3);
    for (let i = 0; i < targets.length; i++) positions.set(targets[i].position, i * 3);
    this.out = presentSamples(positions, body, this.amplitudes, state, this.out);
    return this.out;
  }

  /** The voices that sound, as force points of the engine, in presentation units. */
  voicePoints(unitsPerMetre: number): VoicePoint[] {
    return this.body && this.shown && unitsPerMetre > 0 ? voicePoints(this.body, this.amplitudes, this.shown, unitsPerMetre) : [];
  }
  state(): PresentState | null { return this.shown; }

  /** What the object is now, for the frame's reading and the plate's roles. */
  reading() {
    const body = this.body, shown = this.shown;
    if (!body) return {schema: 'oi.torus-object/v1', standing: 'unread' as const, reason: 'The owner states no voices and boundaries for the torus yet.', amplitudes: null};
    return {schema: 'oi.torus-object/v1', standing: 'read' as const,
      shape: {law: this.figure, shown: shown?.morph ?? null, steps: this.steps, flat: this.flat},
      layers: ['bimba', 'pratibimba'],
      voices: body.voices.map(v => { const a = this.amplitudes?.get(v.mode_ref); return {mode_ref: v.mode_ref, level: a ? Math.min(1, Math.hypot(a[0], a[1]) / body.strikeMetres) : 0, place: helixPlace(v.helix, v.longitude_radians)}; }),
      boundaries: boundaryLines(body),
      amplitudes: this.amplitudes ? body.voices.map(v => { const a = this.amplitudes!.get(v.mode_ref) ?? [0, 0]; return {mode_ref: v.mode_ref, re: a[0], im: a[1]}; }) : null,
      law: 'DLW §21.2 The Torus in the pane: shapes from QL\'s figure law, the passage on the pulse, the voices as force points while they sound, the particles drawn towards the four boundaries\' still lines while the body rings (declared presentation: SETTLE_RADIANS, VOICE_PULL)'};
  }
}
