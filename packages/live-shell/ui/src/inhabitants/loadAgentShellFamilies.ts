import {actuationFamilyManifest} from './actuationFamilyManifest.ts'
import {aiKitFamilyManifest} from './aiKitFamilyManifest.ts'
import {centralFamilyManifest} from './centralFamilyManifest.ts'
import {softwareFactoryFamilyManifest} from './softwareFactoryFamilyManifest.ts'
import {workcellFamilyManifest} from './workcellFamilyManifest.ts'

/** Admit the five agent-shell families declared for slice 0. Idempotent. */
export function loadAgentShellFamilies(): void {
  actuationFamilyManifest()
  aiKitFamilyManifest()
  centralFamilyManifest()
  softwareFactoryFamilyManifest()
  workcellFamilyManifest()
}
