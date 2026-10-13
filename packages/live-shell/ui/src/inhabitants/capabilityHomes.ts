/** The homes of the suite capabilities that have no product family scope
 * (DEVICE-SEMANTICS-LOCK §4.2; T-CAPABILITY-HOMES-25).
 *
 * A capability in the capability matrix joins a family through its product
 * (`devices:gaps`). Twenty-five refs carry a product the door does not map
 * (O-I, Suite), so they had no home. Each now lands in one of two places:
 *
 * - a family, as a declared extension that lists the ref in `capabilities`
 *   and names its device semantic in `note` (the family's base stays
 *   verbatim; no face is added);
 * - the shell itself, in `SHELL_CAPABILITIES`: the surface the capability
 *   lives on, with no device behind it (the lock names these: the frame
 *   grammar, kernel, verification, embodiment and surface host).
 *
 * Declarations only. Owners write and faces read; nothing here writes, and
 * no store is added. */

import {declareFamilyExtension, type FamilyExtension} from './manifest.ts'
import {QUATERNAL_LOGIC_FAMILY_ID} from './quaternalLogicFamilyManifest.ts'

export interface CapabilityHome {
  /** The capability ref, as the suite capability matrix spells it. */
  readonly ref: string
  /** The owning family the capability homes in. */
  readonly family: string
  /** The device semantic it lands in (the lock §4.2 reading). */
  readonly semantic: string
}

const CENTRAL = 'central'
const SOFTWARE_FACTORY = 'software-factory'
const AI_KIT = 'ai-kit'
const WORKCELL = 'workcell'
const ACTUATION = 'actuation'

/** Family homes, in the T-CAPABILITY-HOMES table order. */
export const CAPABILITY_HOMES: readonly CapabilityHome[] = [
  {ref: 'cap.o-i.session-observatory', family: SOFTWARE_FACTORY, semantic: 'Factory arrangement — the run viewer (run-device)'},
  {ref: 'cap.o-i.flow-loop', family: CENTRAL, semantic: 'the Flow track + document devices (flow-document)'},
  {ref: 'cap.suite.agent-creation-chain', family: AI_KIT, semantic: 'Factory browser New — create a track (an agent profile)'},
  {ref: 'cap.o-i.cas-source-editing', family: CENTRAL, semantic: 'the Text document device'},
  {ref: 'cap.o-i.living-wiki-desktop', family: CENTRAL, semantic: "Technē M0′ + Central's Wiki category"},
  {ref: 'cap.suite.local-wiki-world', family: CENTRAL, semantic: "Central's Wiki category (ProjectCentral wiki)"},
  {ref: 'cap.suite.wiki-publish-projection', family: CENTRAL, semantic: 'the Wiki projected into the shared field (Link)'},
  {ref: 'cap.suite.semantic-identity-precedence', family: CENTRAL, semantic: 'agent identity and the source-ref grammar'},
  {ref: 'cap.suite.participant-addressing', family: CENTRAL, semantic: 'the Flow Participants device'},
  {ref: 'cap.suite.recursive-worlds', family: QUATERNAL_LOGIC_FAMILY_ID, semantic: 'Technē M4′ bodies + Graph'},
  {ref: 'cap.suite.world-relative-agent-knowledge', family: QUATERNAL_LOGIC_FAMILY_ID, semantic: 'Technē M4′ bodies + Graph'},
  {ref: 'cap.suite.agentset-primitive', family: AI_KIT, semantic: 'the Factory Agentset rack'},
  {ref: 'cap.suite.activity-and-attention', family: SOFTWARE_FACTORY, semantic: 'the Factory Activity tile'},
  {ref: 'cap.software-factory.agent-agency-contract', family: SOFTWARE_FACTORY, semantic: "the Agent device's custody (agent-custody)"},
  {ref: 'cap.suite.workcell-placement-intent', family: WORKCELL, semantic: "the Factory World device's placement (seat)"},
  {ref: 'cap.suite.explicit-co-internality', family: ACTUATION, semantic: 'the agency ontology (gateway → agent chain)'},
]

/** Shell-homed capabilities: ref → the shell surface it is. No device. */
export const SHELL_CAPABILITIES: Readonly<Record<string, string>> = {
  'cap.o-i.search-aperture': 'Browser search, every mode',
  'cap.o-i.rooted-world-navigator': 'Browser places',
  'cap.o-i.currentworld-reading': 'the status bar run context',
  'cap.suite.versioned-world-faculty': 'the Arrangement (every mode) and its re-enable',
  'cap.o-i.desktop-agency-encounter': 'the companion dock',
  'cap.o-i.cradle-frame-grammar': 'the shell frame itself',
  'cap.o-i.cradle-kernel': "the shell's kernel host",
  'cap.o-i.cradle-verification': "the shell's verification harness",
  'cap.o-i.desktop-embodiment': 'the native window (embodiment)',
  'cap.o-i.desktop-surface-host': 'the shell surface host',
}

/** Declare each family's homes as one additive extension per family:
 * `<family>:capability-homes`, no faces, the refs in `capabilities`, and a
 * note naming each home's semantic. Idempotent (the door refuses only
 * differing contents). Families must already be admitted. */
export function declareCapabilityHomes(): void {
  const families = [...new Set(CAPABILITY_HOMES.map(home => home.family))]
  for (const family of families) {
    const homes = CAPABILITY_HOMES.filter(home => home.family === family)
    const extension: FamilyExtension = {
      id: `${family}:capability-homes`,
      by: 'wayfinder:T-CAPABILITY-HOMES-25 (DLW lead, 13 Oct 2026)',
      capabilities: homes.map(home => home.ref),
      note: homes.map(home => `${home.ref}: ${home.semantic}`).join('; '),
    }
    declareFamilyExtension(family, extension)
  }
}
