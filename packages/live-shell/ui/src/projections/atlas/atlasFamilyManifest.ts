// The atlas family manifest — the Earth/Graph/Aion views declared at the
// shell's neutral admission door (WORLD-SHELL-DESIGN §12, §16: one family,
// four surfaces; L5's browser-entries commission).
//
// This file is new in the port. It declares; it does not build chrome: the
// browser categories are names the browser owner renders; the faces are the
// atlas's own controls (the graph tools, the time control, the mode switch),
// admitted as declarations — no device face is claimed that is not the
// ported atlas's own control surface.
//
// Admission: self-registering on import (the found agent-shell manifests do
// the same from their own modules); the index hunk lives in
// inhabitants/loadAgentShellFamilies.ts (one import line, additive).
// [r2 import-depth fix] the manifest door is the package's src/inhabitants/ —
// two levels up from this directory, not one (the dead hand's fault: the
// package bundle failed on this file).
import { admitFamilyManifest, type FamilyManifest } from '../../inhabitants/familyManifest';

export const ATLAS_FAMILY_ID = 'atlas-earth';

export const atlasFamilyManifest: FamilyManifest = {
  id: ATLAS_FAMILY_ID,
  browser: [
    // the views the family contributes to the browser's Places/Views grammar
    'earth', // the Earth projection (globe over the bound corpus)
    'graph', // the Constellation view (the atlas's d3-force graph)
    'aion', // the Aion epoch view (deep time over the same globe)
  ],
  faces: [
    { id: 'globe-engine', presentations: ['full'], note: 'the GPU globe (three.js), the projection pane body' },
    { id: 'graph-tools', presentations: ['compact', 'expanded'], note: 'the constellation’s own controls (depth, ties, spread, gravity, sky anchors)' },
    { id: 'mode-switch', presentations: ['compact'], note: 'Earth ⇄ Graph, the atlas’s own one-control switch' },
    { id: 'time-control', presentations: ['compact', 'expanded'], note: 'the atlas’s non-linear deep-time scale (data/time.ts), the Occasion control’s deep-time face' },
  ],
  params: { grammar: 'atlas/parameter-address/v1' },
  projections: [
    'atlas-earth-projection', // globe + graph over a CorpusProvider bundle (mount.ts)
    'atlas-aion-timeline', // the Aion→Timeline world-track adapter (aionTimeline.ts)
  ],
  inspectors: [],
  time: {
    consumes: ['occasion'], // the atlas reads its Occasion window; chronos arrives via the QL sky binding
    contributes: ['aion-epochs'], // epoch spans, as the reading gives them
  },
  telemetry: null, // nothing observable is exposed yet — honestly null
};

let admitted = false;
/** Idempotent admission at the neutral door. */
export function admitAtlasFamily(): FamilyManifest {
  if (!admitted) {
    admitFamilyManifest(atlasFamilyManifest);
    admitted = true;
  }
  return atlasFamilyManifest;
}

admitAtlasFamily();
