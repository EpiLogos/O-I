import {actuationFamilyManifest} from './actuationFamilyManifest.ts'
import {aiKitFamilyManifest} from './aiKitFamilyManifest.ts'
import {centralFamilyManifest} from './centralFamilyManifest.ts'
import {softwareFactoryFamilyManifest} from './softwareFactoryFamilyManifest.ts'
import {workcellFamilyManifest} from './workcellFamilyManifest.ts'
// [L5 atlas port] the Earth/Graph/Aion family declares itself at the same
// neutral door; one additive import, self-admitting (atlasFamilyManifest.ts).
import '../projections/atlas/atlasFamilyManifest.ts'
// [T-KNOWLEDGE-GRAPH-DEVICE] the wiki constellation's own controls: one additive import, self-admitting like the atlas
// (knowledgeGraphFamilyManifest.ts). The five agent-shell families stay the five this loader admits.
import './knowledgeGraphFamilyManifest.ts'

/** Admit the five agent-shell families declared for slice 0. Idempotent. */
export function loadAgentShellFamilies(): void {
  actuationFamilyManifest()
  aiKitFamilyManifest()
  centralFamilyManifest()
  softwareFactoryFamilyManifest()
  workcellFamilyManifest()
}
