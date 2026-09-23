import type {GlyphName} from './Glyph';

/** One identity per plane. Legacy names are accepted only at persisted-state boundaries. */
export const PLANE_REGISTRY = {
  Chat: {label: 'Chat', icon: 'chat'},
  Activity: {label: 'Activity', icon: 'history'},
  Agents: {label: 'Agents', icon: 'agent'},
  context: {label: 'Context', icon: 'file'},
  run: {label: 'Run', icon: 'factory'},
  Inspect: {label: 'Inspect', icon: 'search'},
  Composition: {label: 'Composition', icon: 'field'},
} satisfies Record<string, {label: string; icon: GlyphName}>;
export type PlaneId = keyof typeof PLANE_REGISTRY;
export function canonicalPlane(id: string): string {
  if (id === 'factory-context' || id === 'ta-onta-context' || id === 'Context') return 'context';
  return id === 'agents' ? 'Agents' : id;
}
export function planeIcon(id: string): GlyphName {
  return PLANE_REGISTRY[canonicalPlane(id) as PlaneId]?.icon ?? 'file';
}
