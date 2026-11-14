/** Native relation occurrences share the formation simulator and total budget.
 * A fixed pool keeps stable binding slots when relations are added or removed;
 * its particles are shared by the slots with currently renderable endpoints.
 * Targets use world coordinates; no semantic edge is inferred from geometry. */
export const MAX_CONNECTIONS = 256;
export const MIN_CONNECTION_PARTICLES = 16;
export const CONNECTION_PARTICLE_FRACTION = 0.25;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const point = pose => pose && [pose.x, pose.y, pose.z ?? 0].every(finite)
  ? {x: pose.x, y: pose.y, z: pose.z ?? 0} : null;
const key = row => JSON.stringify([row.from_entity_ref, row.to_entity_ref].sort());

/** No subject-name matching: a binding addresses exact entity occurrences.
 * Parallel relations remain separate curves; absent/off-window endpoints are
 * named, never redirected to another occurrence of the same source. */
export function connectionPaths(bindings, poses) {
  const byId = new Map(poses.map(p => [p.entityId ?? p.id, point(p)]));
  const groups = new Map();
  for (const b of bindings) {
    const group = groups.get(key(b)) ?? [];
    group.push(b); groups.set(key(b), group);
  }
  const paths = [], unavailable = [];
  for (const group of groups.values()) {
    group.sort((a,b) => a.binding_ref.localeCompare(b.binding_ref));
    group.forEach((binding, index) => {
      const from = byId.get(binding.from_entity_ref), to = byId.get(binding.to_entity_ref);
      if (!from || !to) { unavailable.push(binding.binding_ref); return; }
      // Stable side for reverse-directed edges as well as same-direction ones.
      const sign = binding.from_entity_ref <= binding.to_entity_ref ? 1 : -1;
      const dx = (to.x-from.x)*sign, dy = (to.y-from.y)*sign;
      const length = Math.hypot(dx,dy) || 1;
      const offset = (index-(group.length-1)/2)*22;
      const self = binding.from_entity_ref === binding.to_entity_ref;
      const points = Array.from({length: 25}, (_,i) => {
        const t=i/24, bend=4*t*(1-t)*offset;
        return self ? {x:from.x+(24+index*12)*Math.sin(2*Math.PI*t), y:from.y+(24+index*12)*(1-Math.cos(2*Math.PI*t)), z:from.z}
          : {x:from.x+(to.x-from.x)*t-dy/length*bend,
             y:from.y+(to.y-from.y)*t+dx/length*bend,
             z:from.z+(to.z-from.z)*t};
      });
      paths.push({binding,points});
    });
  }
  return {paths,unavailable};
}


export class ConnectionRuntime {
  enabled = false;
  particleCount = 0;
  start = 0;
  capacity = 0;
  slots = new Map();
  ranges = new Map();
  bindings = [];
  selected = new Set();
  paths = [];
  unavailable = [];
  overflow = [];
  resize(particleCount) {
    this.particleCount = particleCount;
    const size = this.enabled ? Math.floor(particleCount * CONNECTION_PARTICLE_FRACTION) : 0;
    this.start = particleCount - size;
    this.capacity = Math.min(MAX_CONNECTIONS, Math.floor(size / MIN_CONNECTION_PARTICLES));
    for (const [ref, slot] of this.slots) if (slot >= this.capacity) this.slots.delete(ref);
    this.assign();
  }
  configure(bindings, selected, particleCount) {
    const seen = new Set();
    for (const b of bindings) {
      if (!b.binding_ref || !b.from_entity_ref || !b.to_entity_ref || seen.has(b.binding_ref)) throw Error('Invalid or duplicate native connection binding');
      seen.add(b.binding_ref);
    }
    if (bindings.length) this.enabled = true;
    this.bindings = [...bindings]; this.selected = new Set(selected);
    for (const ref of this.slots.keys()) if (!seen.has(ref)) this.slots.delete(ref);
    this.resize(particleCount);
  }
  assign() {
    const occupied = new Set(this.slots.values());
    this.overflow = [];
    for (const b of this.bindings) {
      if (this.slots.has(b.binding_ref)) continue;
      let slot = 0;
      while (occupied.has(slot) && slot < this.capacity) slot++;
      if (slot === this.capacity) { this.overflow.push(b.binding_ref); continue; }
      occupied.add(slot); this.slots.set(b.binding_ref, slot);
    }
  }
  range(slot) {
    return this.ranges.get(slot) ?? {start: this.start, end: this.start};
  }
  update(poses, dataA, dataB, metadata) {
    if (!this.enabled) return;
    const reading = connectionPaths(this.bindings, poses);
    this.paths = reading.paths.filter(p => this.slots.has(p.binding.binding_ref));
    this.unavailable = [...new Set([...reading.unavailable, ...this.overflow])];
    // Slot identity belongs to the native binding, not its current density.
    // Admission capacity is a ceiling, not a divisor: nine paths must not leave
    // 247/256 of their reserved pool invisible. Order by persistent slot so pose
    // movement and input reordering never transfer particle ranges between paths.
    const liveSlots = this.paths.map(path => this.slots.get(path.binding.binding_ref)).sort((a,b) => a-b);
    const size = this.particleCount - this.start;
    this.ranges.clear();
    liveSlots.forEach((slot, index) => this.ranges.set(slot, {
      start: this.start + Math.floor(index * size / liveSlots.length),
      end: this.start + Math.floor((index + 1) * size / liveSlots.length),
    }));
    // With no live paths the tail is invisible. Changes affect targets only;
    // live GPU position and velocity textures are never written or reseeded.
    metadata.fill(0, this.start * 4, this.particleCount * 4);
    for (const path of this.paths) {
      const {start, end} = this.range(this.slots.get(path.binding.binding_ref));
      for (let index = start; index < end; index++) {
        const at = (index - start) / Math.max(1, end - start - 1) * (path.points.length - 1);
        const lo = Math.floor(at), hi = Math.min(path.points.length - 1, lo + 1), t = at - lo;
        const a = path.points[lo], b = path.points[hi], offset = index * 4;
        dataA[offset] = dataB[offset] = a.x + (b.x - a.x) * t;
        dataA[offset + 1] = dataB[offset + 1] = a.y + (b.y - a.y) * t;
        dataA[offset + 2] = dataB[offset + 2] = a.z + (b.z - a.z) * t;
        dataA[offset + 3] = dataB[offset + 3] = 1;
        metadata[offset + 2] = 1;
        metadata[offset + 3] = this.selected.has(path.binding.binding_ref) ? 1 : 0;
      }
    }
  }
  inspect() {
    return {enabled:this.enabled, totalParticles:this.particleCount, nodeParticles:this.start,
      reservedParticles:this.particleCount-this.start, limit:this.capacity, requested:this.bindings.length,
      rendered:this.paths.map(p=>p.binding.binding_ref), unavailable:[...this.unavailable], overflow:[...this.overflow],
      occurrences:this.paths.map(p=>({...p.binding, ...this.range(this.slots.get(p.binding.binding_ref))}))};
  }
}
