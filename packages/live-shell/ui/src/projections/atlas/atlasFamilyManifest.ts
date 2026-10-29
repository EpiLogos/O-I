// The atlas family manifest — the Earth/Graph/Aion views declared at the
// shell's neutral admission door (WORLD-SHELL-DESIGN §12, §16: one family,
// four surfaces; L5's browser-entries commission).
//
// This file is new in the port. It declares; it does not build chrome: the
// browser categories are names the browser owner renders; the faces are the
// atlas's own controls (the graph tools, the time control, the mode switch),
// admitted as declarations — no device face is claimed that is not the
// ported atlas's own control surface. Each face's body is supplied on the rack
// (inhabitants/atlasFaceBodies.tsx) and drives the same mounted atlas the Earth
// pane drives (AtlasProjectionPanel.tsx useAtlasHandle), never a copy of it.
//
// Admission: self-registering on import (the found agent-shell manifests do
// the same from their own modules); the index hunk lives in
// inhabitants/loadAgentShellFamilies.ts (one import line, additive).
// [r2 import-depth fix] the manifest door is the package's src/inhabitants/ —
// two levels up from this directory, not one (the dead hand's fault: the
// package bundle failed on this file).
import { admitFamilyManifest, familyManifest } from '../../inhabitants/familyManifest';
import {statePresentations} from '../../inhabitants/sdk/views'
import type { InhabitantManifest } from '../../inhabitants/manifest';

export const ATLAS_FAMILY_ID = 'atlas-earth';

export const atlasFamilyManifest: InhabitantManifest = {
  id: ATLAS_FAMILY_ID,
  browser: [
    // the views the family contributes to the browser's Places/Views grammar
    'earth', // the Earth projection (globe over the bound corpus)
    'graph', // the Constellation view (the atlas's d3-force graph)
    'aion', // the Aion epoch view (deep time over the same globe)
  ],
  faces: [
    { id: 'globe-engine', kind: 'instrument', dock: ['dock', 'expand'], presentations: statePresentations('atlas-earth:globe-engine'), liveSemantic: 'device-instrument', heldBy: ['techne:m0', 'techne:m4'], invariant: { generatesAbsent: 'the corpus provider seam (C2) has no owner op yet; the globe forms from the bound CorpusProvider bundle' }, note: 'the GPU globe (three.js), the projection pane body; its exposed parameters: the whole-field choice and the base texture' },
    { id: 'graph-tools', dock: ['dock', 'expand'], presentations: ['compact', 'expanded'], liveSemantic: 'detail-device', heldBy: ['techne:m0', 'techne:m1'], note: 'the constellation’s own controls (steps, kinds, relations, forces, sky anchors, reframe)' },
    { id: 'mode-switch', dock: ['dock', 'expand'], presentations: ['compact'], liveSemantic: 'view-selector', heldBy: ['techne:m4', 'techne:m0'], note: 'Earth ⇄ Graph, the atlas’s own one-control switch' },
    { id: 'time-control', dock: ['dock', 'expand'], presentations: ['compact', 'expanded'], liveSemantic: 'transport-slot', heldBy: ['techne:m2', 'techne:m0'], note: 'the atlas’s non-linear deep-time scale (data/time.ts): the Earth pane’s clock, and the Timeline’s deep-time face' },
  ],
  params: { grammar: 'atlas/parameter-address/v1' },
  projections: [
    'atlas-earth-projection', // globe + graph over a CorpusProvider bundle (mount.ts)
    'atlas-aion-timeline', // the Aion→Timeline world-track adapter (aionTimeline.ts)
  ],
  inspectors: [],
  time: {
    // The deep-time clock is bound to the shell's occasion window (T-ATLAS-TIME, sharedClock.ts) while a shared session
    // stands: a window set by any instrument moves the Earth's cursor, and the Earth's own moves are written to that window.
    // With no session standing the clock keeps its own presentation. The atlas's non-linear scale is its own view of that time.
    consumes: ['occasion'],
    contributes: ['aion-epochs'], // epoch spans, as the reading gives them
  },
  telemetry: null, // nothing observable is exposed yet — honestly null
};

/** Idempotent admission at the neutral door. Keyed on the door's own state, not a module flag: a door reset clears the
 * family, and a flag would then stop the loader from admitting it again. */
export function admitAtlasFamily(): InhabitantManifest {
  if (!familyManifest(ATLAS_FAMILY_ID)) admitFamilyManifest(atlasFamilyManifest);
  return atlasFamilyManifest;
}

admitAtlasFamily();
