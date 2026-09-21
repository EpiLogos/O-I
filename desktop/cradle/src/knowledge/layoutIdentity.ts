import type {GraphReading} from './graph';
import type {Point} from './layout';
/** Display labels, filters, provider timing, camera and source prose do not
 * alter topology and therefore must not restart the spatial solver. */
export function topologyKey(reading: GraphReading): string {
  return JSON.stringify([
    (reading.formations??[]).map(formation=>[formation.ref,formation.shape_ref,formation.members.map(member=>[member.ref,member.role,member.address])]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),
    reading.nodes.map(node => [node.ref,node.kind]).sort((a,b)=>a[0].localeCompare(b[0])),
    reading.edges.map(edge => [edge.from_ref,edge.to_ref,edge.relation]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
  ]);
}
export function initialPoint(ref: string): Point {
  let hash = 2166136261;
  for (const char of ref) hash = Math.imul(hash ^ char.charCodeAt(0),16777619);
  const phase = (hash >>> 0) / 4294967296 * Math.PI * 2;
  return {x:400+Math.cos(phase)*180,y:260+Math.sin(phase)*140,scale:1};
}
export function pointsForReading(reading: GraphReading | undefined, positions: ReadonlyMap<string,Point>): Point[] {
  return reading?.nodes.map(node=>positions.get(node.ref)??initialPoint(node.ref))??[];
}
