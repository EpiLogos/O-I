import type {GraphReading} from './graph';
import type {Point} from './layout';

/** Native role layouts constrain the interior of an atomic formation. Packing
 * moves whole formations, never their member-role coordinates. Source nodes
 * remain independent; only native contextual occurrences are placed here. */
export function preserveFormations(reading: GraphReading, generic: Point[]): Point[] {
  const result = generic.map(point => ({...point}));
  const indices = new Map(reading.nodes.map((node, index) => [node.ref, index]));
  const used = new Set<string>(), placed: {x: number; y: number; radius: number}[] = [];
  for (const formation of [...(reading.formations ?? [])].sort((a, b) => a.ref.localeCompare(b.ref))) {
    const members = formation.members.flatMap(member => {
      const layout = member.address?.layout, index = indices.get(member.ref);
      if (index === undefined || used.has(member.ref) || !layout || ![layout.x, layout.y, layout.z].every(value => Number.isFinite(value) && Math.abs(value) <= 100)) return [];
      return [{member, layout, index}];
    });
    if (!members.length) continue;
    const radius = Math.max(80, ...members.map(({layout}) => Math.hypot(layout.x, layout.y) * 95 + 35));
    const anchor = indices.get(formation.ref), centre = anchor === undefined ? generic[members[0].index] : generic[anchor];
    let x = centre.x, y = centre.y;
    for (let step = 0; step < 128 && placed.some(other => Math.hypot(x - other.x, y - other.y) < radius + other.radius); step++) {
      const angle = step * 2.399963, reach = Math.sqrt(step + 1) * radius;
      x = centre.x + Math.cos(angle) * reach; y = centre.y + Math.sin(angle) * reach;
    }
    placed.push({x, y, radius});
    if (anchor !== undefined) result[anchor] = {x, y, z: 0, scale: 1};
    for (const {member, layout, index} of members) {
      result[index] = {x: x + layout.x * 95, y: y + layout.y * 95, z: layout.z * 95, scale: 1};
      used.add(member.ref);
    }
  }
  return result;
}
