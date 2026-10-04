import {CymaticResonator, RESONATOR_MODE_TOTAL, type ModalState, type ResonatorParams, type ResonatorTelemetry} from './cymaticResonator';
import {MAX_FORMATIONS} from './fieldModel';

export interface LocalizedResonanceDriver {
  driverRef?: string;
  entityId: string;
  position: readonly [number, number, number];
  frequencyHz: number;
  params: Readonly<ResonatorParams>;
}

export interface LocalizedResonanceFrame extends LocalizedResonanceDriver {
  re: Float32Array;
  im: Float32Array;
  modes: ModalState[];
  telemetry: ResonatorTelemetry;
  representation: 'slow-complex-envelope';
}

const PARAM_KEYS = ['plateSize', 'baseFrequency', 'dampingQ', 'driveStrength', 'modeCount', 'driveX', 'driveY', 'driveZ', 'dimension'] as const;
function exactKeys(value: unknown, keys: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    throw new Error(`${label} requires exactly its declared properties`);
  }
}
function admitted(input: LocalizedResonanceDriver): LocalizedResonanceDriver {
  exactKeys(input, input.driverRef === undefined
    ? ['entityId', 'position', 'frequencyHz', 'params']
    : ['driverRef', 'entityId', 'position', 'frequencyHz', 'params'], 'Localized driver');
  if (input.driverRef !== undefined && (typeof input.driverRef !== 'string' || !input.driverRef.trim())) throw new Error('Localized driver reference must be a nonempty string');
  if (typeof input.entityId !== 'string' || !input.entityId.trim()) throw new Error('Localized target entity is required');
  if (!Array.isArray(input.position) || input.position.length !== 3 || [0, 1, 2].some(i => !Number.isFinite(input.position[i]))) throw new Error('Localized driver position must contain three finite coordinates');
  if (!Number.isFinite(input.frequencyHz) || input.frequencyHz <= 0) throw new Error('Localized drive frequency must be positive and finite');
  const p = input.params;
  exactKeys(p, PARAM_KEYS, 'Resonator parameters');
  for (const key of PARAM_KEYS) if (key !== 'dimension' && !Number.isFinite(p[key])) throw new Error(`Resonator ${key} must be finite`);
  if (p.plateSize <= 0 || p.baseFrequency <= 0 || p.dampingQ <= 0 || p.driveStrength < 0
    || !Number.isInteger(p.modeCount) || p.modeCount < 1 || p.modeCount > RESONATOR_MODE_TOTAL
    || (p.dimension !== '2D' && p.dimension !== '3D')) throw new Error('Invalid explicit resonator parameters');
  return {...(input.driverRef === undefined ? {} : {driverRef: input.driverRef}), entityId: input.entityId,
    position: [...input.position] as [number, number, number], frequencyHz: input.frequencyHz, params: {...p}};
}
const driverIdentity = (driver: LocalizedResonanceDriver): string => driver.driverRef ?? driver.entityId;
function sameParams(a: Readonly<ResonatorParams>, b: Readonly<ResonatorParams>): boolean {
  return PARAM_KEYS.every(key => a[key] === b[key]);
}
interface Resident {driver: LocalizedResonanceDriver; resonator: CymaticResonator}

/** Retained generic modal envelopes at explicit local origins. Numerical laws,
 * mode ranking and frame-time clamps remain CymaticResonator's. These envelopes
 * are not audio-rate carrier phase, semantic centres or inter-driver coupling.
 * The host steps this bank once and shares its readings across views. */
export class LocalizedResonanceBank {
  private residents = new Map<string, Resident>();

  /** Complete desired driver set. Refusal leaves the previous set untouched.
   * Omitted identities release their state; adding them later starts fresh. */
  configure(drivers: readonly LocalizedResonanceDriver[]): void {
    if (!Array.isArray(drivers) || drivers.length > MAX_FORMATIONS) throw new Error(`Localized driver count exceeds the existing formation budget ${MAX_FORMATIONS}`);
    const next = drivers.map(admitted);
    if (new Set(next.map(driverIdentity)).size !== next.length) throw new Error('Duplicate localized driver identity');
    const prepared = new Map<string, CymaticResonator>();
    for (const d of next) {
      const identity = driverIdentity(d), old = this.residents.get(identity);
      if (old && old.driver.params.dimension !== d.params.dimension) throw new Error('Changing a resident modal basis requires explicit removal before readdition');
      if (!old || !sameParams(old.driver.params, d.params) || old.driver.frequencyHz !== d.frequencyHz) {
        const probe = new CymaticResonator(d.params);
        if (probe.getModalState().some(m => !Number.isFinite(m.frequencyHz) || !Number.isFinite(m.coupling))) throw new Error('Resonator parameters exceed the native modal representation');
        // Qualify the requested drive through the actual owner's largest
        // frame step (its own clamp applies). This temporary probe never
        // advances a resident or supplies a numerical law of its own.
        probe.step(1, d.frequencyHz);
        if (probe.getModalState().some(m => !Number.isFinite(m.re) || !Number.isFinite(m.im) || !Number.isFinite(m.energy))) throw new Error('Drive exceeds the native modal representation');
        probe.re.fill(0); probe.im.fill(0);
        prepared.set(identity, probe);
      }
    }
    const committed = new Map<string, Resident>();
    for (const d of next) {
      const identity = driverIdentity(d), old = this.residents.get(identity);
      const resonator = old?.resonator ?? prepared.get(identity)!;
      if (old && !sameParams(old.driver.params, d.params)) resonator.configure(d.params);
      committed.set(identity, {driver: d, resonator});
    }
    this.residents = committed;
  }

  /** Returned buffers are snapshots, so a renderer cannot mutate resident state. */
  step(dt: number): LocalizedResonanceFrame[] {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Localized resonance elapsed time must be finite and nonnegative');
    return Array.from(this.residents.values(), ({driver, resonator}) => {
      const telemetry = resonator.step(dt, driver.frequencyHz);
      return {...driver, position: [...driver.position] as [number, number, number], params: {...driver.params},
        re: resonator.re.slice(), im: resonator.im.slice(), modes: resonator.getModalState(), telemetry: {...telemetry}, representation: 'slow-complex-envelope'};
    });
  }
}
