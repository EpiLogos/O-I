// The knowledge graph family manifest — the wiki constellation's own controls declared at the shell's neutral admission
// door (DEVICE-SEMANTICS-LOCK §8.1: the knowledge graph is its own standalone instrument, not a Technē holder's).
//
// Each face is the cradle's own control set, grouped as the panel groups them (GraphFilters.tsx): the scope face
// (scope, depth, direction, the shared field, the unresolved markers), the filter face (find, kinds, relations, the
// connected-only switch, the constellation context) and the display face (labels, relation arrows, zoom). Every face
// occupies the detail-device semantic; the bodies (knowledgeGraphFaceBodies.tsx) and the rows (agentNativeP0.ts) drive
// the surface's own handle (desktop/cradle/src/knowledge/knowledgeGraphHandle.ts), never a copy.
//
// The SDK names holders from a closed list (sdk/semantics.ts HOLDERS: the Studio sections, the Clip detail and the six
// Technē instruments). The knowledge graph is none of them, so no face names a holder. Its faces therefore fold in the
// rack until the SDK admits a holder for it; see the ticket's OPEN list.
//
// Admission: self-admitting on import, as the atlas family is (loadAgentShellFamilies.ts imports this module). Idempotent, and
// reset-safe: a door reset clears it, and the loader admits it again.
import {admitFamilyManifest, familyManifest} from './familyManifest'
import type {InhabitantManifest} from './manifest'

export const KNOWLEDGE_GRAPH_FAMILY_ID = 'knowledge-graph'

export const knowledgeGraphFamilyManifest: InhabitantManifest = {
  id: KNOWLEDGE_GRAPH_FAMILY_ID,
  detachedKinds: ['device'],
  browser: [],
  faces: [
    {
      id: 'knowledge-scope',
      dock: ['dock', 'expand', 'pop-out'],
      heldBy: ['knowledge-graph'],
      presentations: ['compact', 'expanded'],
      liveSemantic: 'detail-device',
      note: 'The graph’s scope: the available field or the selected subject’s local graph, its depth and the direction it follows, the shared field and the unresolved-link markers. The graph owner’s own reading; the controls are the panel’s.',
    },
    {
      id: 'knowledge-filters',
      dock: ['dock', 'expand', 'pop-out'],
      heldBy: ['knowledge-graph'],
      presentations: ['compact', 'expanded'],
      liveSemantic: 'detail-device',
      note: 'The graph’s filters: find in the reading, subject kinds, relation types, whether subjects with no disclosed relations are kept, and the constellation context (structure or matches only). Filters never change membership or invent edges.',
    },
    {
      id: 'knowledge-display',
      dock: ['dock', 'expand', 'pop-out'],
      heldBy: ['knowledge-graph'],
      presentations: ['compact', 'expanded'],
      liveSemantic: 'detail-device',
      note: 'The graph’s display: the label rule, relation direction arrows and the zoom. Display changes appearance, never meaning.',
    },
  ],
  params: {grammar: 'knowledge-graph/parameter-address/v1'},
  projections: [
    'wiki-constellation', // the knowledge graph canvas (GraphCanvas.tsx) over the owner's reading
  ],
  inspectors: [],
  time: {
    // The graph binds no stratum: it reads the owner's reading at the view's own query.
    consumes: [],
    contributes: [],
  },
  telemetry: null,
}

/** Admit the knowledge graph family at the neutral door, once per door state. Returns the admitted manifest. */
export function admitKnowledgeGraphFamily(): InhabitantManifest {
  if (!familyManifest(KNOWLEDGE_GRAPH_FAMILY_ID)) admitFamilyManifest(knowledgeGraphFamilyManifest);
  return knowledgeGraphFamilyManifest;
}

// Self-admission at import, as the atlas family does: the family stands wherever its module is loaded. A door reset clears
// it; loadAgentNativeP0 admits it again for the P0 batch, and the instrument side admits it at render.
admitKnowledgeGraphFamily();
