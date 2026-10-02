import { CymaticResonator, RESONATOR_MODE_TOTAL } from "./cymaticResonator.mjs";
import { MAX_FORMATIONS } from "./fieldModel.mjs";
const PARAM_KEYS = ["plateSize", "baseFrequency", "dampingQ", "driveStrength", "modeCount", "driveX", "driveY", "driveZ", "dimension"];
function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new Error(`${label} requires exactly its declared properties`);
  }
}
function admitted(input) {
  exactKeys(input, ["entityId", "position", "frequencyHz", "params"], "Localized driver");
  if (typeof input.entityId !== "string" || !input.entityId.trim()) throw new Error("Localized driver identity is required");
  if (!Array.isArray(input.position) || input.position.length !== 3 || [0, 1, 2].some((i) => !Number.isFinite(input.position[i]))) throw new Error("Localized driver position must contain three finite coordinates");
  if (!Number.isFinite(input.frequencyHz) || input.frequencyHz <= 0) throw new Error("Localized drive frequency must be positive and finite");
  const p = input.params;
  exactKeys(p, PARAM_KEYS, "Resonator parameters");
  for (const key of PARAM_KEYS) if (key !== "dimension" && !Number.isFinite(p[key])) throw new Error(`Resonator ${key} must be finite`);
  if (p.plateSize <= 0 || p.baseFrequency <= 0 || p.dampingQ <= 0 || p.driveStrength < 0 || !Number.isInteger(p.modeCount) || p.modeCount < 1 || p.modeCount > RESONATOR_MODE_TOTAL || p.dimension !== "2D" && p.dimension !== "3D") throw new Error("Invalid explicit resonator parameters");
  return { entityId: input.entityId, position: [...input.position], frequencyHz: input.frequencyHz, params: { ...p } };
}
function sameParams(a, b) {
  return PARAM_KEYS.every((key) => a[key] === b[key]);
}
class LocalizedResonanceBank {
  residents = /* @__PURE__ */ new Map();
  /** Complete desired driver set. Refusal leaves the previous set untouched.
   * Omitted identities release their state; adding them later starts fresh. */
  configure(drivers) {
    if (!Array.isArray(drivers) || drivers.length > MAX_FORMATIONS) throw new Error(`Localized driver count exceeds the existing formation budget ${MAX_FORMATIONS}`);
    const next = drivers.map(admitted);
    if (new Set(next.map((d) => d.entityId)).size !== next.length) throw new Error("Duplicate localized driver identity");
    const prepared = /* @__PURE__ */ new Map();
    for (const d of next) {
      const old = this.residents.get(d.entityId);
      if (old && old.driver.params.dimension !== d.params.dimension) throw new Error("Changing a resident modal basis requires explicit removal before readdition");
      if (!old || !sameParams(old.driver.params, d.params) || old.driver.frequencyHz !== d.frequencyHz) {
        const probe = new CymaticResonator(d.params);
        if (probe.getModalState().some((m) => !Number.isFinite(m.frequencyHz) || !Number.isFinite(m.coupling))) throw new Error("Resonator parameters exceed the native modal representation");
        probe.step(1, d.frequencyHz);
        if (probe.getModalState().some((m) => !Number.isFinite(m.re) || !Number.isFinite(m.im) || !Number.isFinite(m.energy))) throw new Error("Drive exceeds the native modal representation");
        probe.re.fill(0);
        probe.im.fill(0);
        prepared.set(d.entityId, probe);
      }
    }
    const committed = /* @__PURE__ */ new Map();
    for (const d of next) {
      const old = this.residents.get(d.entityId);
      const resonator = old?.resonator ?? prepared.get(d.entityId);
      if (old && !sameParams(old.driver.params, d.params)) resonator.configure(d.params);
      committed.set(d.entityId, { driver: d, resonator });
    }
    this.residents = committed;
  }
  /** Returned buffers are snapshots, so a renderer cannot mutate resident state. */
  step(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new Error("Localized resonance elapsed time must be finite and nonnegative");
    return Array.from(this.residents.values(), ({ driver, resonator }) => {
      const telemetry = resonator.step(dt, driver.frequencyHz);
      return {
        ...driver,
        position: [...driver.position],
        params: { ...driver.params },
        re: resonator.re.slice(),
        im: resonator.im.slice(),
        modes: resonator.getModalState(),
        telemetry: { ...telemetry },
        representation: "slow-complex-envelope"
      };
    });
  }
}
export {
  LocalizedResonanceBank
};
