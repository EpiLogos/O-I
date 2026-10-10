// The Timeline's neutral adapter door — one registry, no family logic in
// the Timeline engine. This is L5's proposed registration hunk
// (new-shell/evidence/atlas-port-l5-20261009/r2-AION-TIMELINE-REGISTRATION.patch),
// adapted at landing; the evaluation lives beside the lane evidence:
//
//   KEPT: the file's place (src/timeline/, beside the contract), the lazy
//   import law (a family's adapter module loads only when projected), the
//   declaration-id keying, and the manifest verification idea.
//   CHANGED: the patch's duck-typed resolution
//   (`mod.aionTrackAdapter ?? mod.default`) named a family's export inside
//   the neutral door — each registration line now binds its own load
//   closure that returns the adapter directly, so family names live only
//   in the registrations (where a registry must name them) and never in
//   the door's logic. The manifest check is real: the family door
//   (projectWorldTracks) refuses a declaration no admitted manifest makes.
//
// Two doors, honestly distinct:
// - `projectWorldTracks(declarationId, reading)` — the FAMILY door. The id
//   must be declared by an admitted family manifest (`projections[]`) and
//   registered here. The atlas epoch jump lands through this door.
// - `projectLaneWorldTracks(id, reading)` — the Timeline's own World-cut
//   door for adapters this lane landed (the day/run/conversation tracks).
//   Registered here; manifest declarations are the families' own move and
//   are named in the lane's honesty list where absent.
//
// Families never import this file; the Timeline knows no family.

import type {WorldTrackAdapter, WorldTrackSet} from './worldTrackAdapter';
import {allFamilyManifests} from '../inhabitants/familyManifest';

type AdapterLoad = () => Promise<WorldTrackAdapter<unknown>>;

const registry = new Map<string, AdapterLoad>();

// ── registrations (each line names its family; the door does not) ──────────

// [atlas L5 r2] the Earth/Aion family's epoch projection. The family
// declares 'atlas-aion-timeline' in its manifest (atlasFamilyManifest.ts);
// aionTrackAdapter() is the atlas lane's factory in the atlas's zone.
registry.set('atlas-aion-timeline', async () =>
  (await import('../projections/atlas/aionTimeline')).aionTrackAdapter() as WorldTrackAdapter<unknown>);

// The Expressions family's track adapter — found in this directory (the
// native composition parent's in-flight work). Composed, never edited.
registry.set('expressions-tracks', async () =>
  (await import('./expressionsTrackAdapter')).expressionsTrackAdapter as WorldTrackAdapter<unknown>);

// Central's civil-day material (timeline-spine-l4). The central family
// manifest declares 'central-roster-track-adapter' (roster revisions) —
// the day-track declaration is Central's owner's move; registered
// lane-side until then (named in the lane's honesty list).
registry.set('central-day-track', async () =>
  (await import('./dayTrackAdapter')).dayTrackAdapter as WorldTrackAdapter<unknown>);

// Factory run material (timeline-spine-l4), under the software-factory
// manifest's declared projection id.
registry.set('factory-run-track-adapter', async () =>
  (await import('./runTrackAdapter')).runTrackAdapter as WorldTrackAdapter<unknown>);

// Conversation receipts as temporal material (timeline-spine-l4).
registry.set('conversation-clips', async () =>
  (await import('./conversationTrackAdapter')).conversationTrackAdapter as WorldTrackAdapter<unknown>);

// [L9 musical family] the QL field/PCM owner's audio and visual/physics
// material, role-classified in the type (QL-MEF #281 §1.3). Lane-door
// registrations like the day/run/conversation tracks above: the manifest
// projection declarations are the QL family owner's move and are named in
// lane L9's honesty list — the family door refuses them until declared.
registry.set('ql-audio-track-adapter', async () =>
  (await import('./qlAudioTrackAdapter')).qlAudioTrackAdapter as WorldTrackAdapter<unknown>);

registry.set('ql-physics-track-adapter', async () =>
  (await import('./qlPhysicsTrackAdapter')).qlPhysicsTrackAdapter as WorldTrackAdapter<unknown>);

// ── the doors ────────────────────────────────────────────────────────────────

export function registeredWorldTrackAdapterIds(): string[] {
  return [...registry.keys()].sort((a, b) => a.localeCompare(b));
}

/** Projection ids declared by admitted family manifests. */
export function manifestDeclaredProjections(): string[] {
  return [...new Set(allFamilyManifests().flatMap((manifest) => [...manifest.projections]))].sort((a, b) => a.localeCompare(b));
}

export function isManifestDeclared(declarationId: string): boolean {
  return allFamilyManifests().some((manifest) => manifest.projections.includes(declarationId));
}

async function adapterFor(id: string): Promise<WorldTrackAdapter<unknown>> {
  const load = registry.get(id);
  if (!load) throw new Error(`no World track adapter registered for "${id}"`);
  return load();
}

/** The FAMILY door: project one family reading through its declared
 * adapter (the atlas epoch jump's path). Refuses undeclared families —
 * the shell admits material through owners' manifests, never by presence. */
export async function projectWorldTracks(declarationId: string, reading: unknown): Promise<WorldTrackSet> {
  if (!isManifestDeclared(declarationId)) {
    throw new Error(`"${declarationId}" is not declared by any admitted family manifest`);
  }
  return (await adapterFor(declarationId)).project(reading);
}

/** The Timeline's own World-cut door: project through a lane-registered
 * adapter without a manifest declaration (the day/run/conversation tracks).
 * The registration is the disclosure; the family door stays strict. */
export async function projectLaneWorldTracks(id: string, reading: unknown): Promise<WorldTrackSet> {
  return (await adapterFor(id)).project(reading);
}
