/** The world-shell families (L2, seam 4): the six product families declared
 * at the neutral door, with their §12 contents.
 *
 * Loading this module admits, in order:
 * 1. the five agent-shell families — through their own modules, UNCHANGED
 *    (the compatibility law: they load through the generalised schema as
 *    they are);
 * 2. quaternal-logic — the sixth family, declared at the same door;
 * 3. the L2 declared extensions — additive compositions onto central and
 *    software-factory, whose base manifests stay verbatim.
 *
 * Owner admission lives in the kernel op union: a face is admitted only
 * where its owner op exists today (`ground`, `git_repository_read`,
 * `receiving`, `factory_attempt_read`, `workcell_status_read`,
 * `nara_dialogue`, `harness_agent_read/control`); everything else is
 * declared waiting, honestly. */

import {loadAgentShellFamilies} from './loadAgentShellFamilies.ts'
import {statePresentations} from './sdk/views.ts'
import {admitKnowledgeGraphFamily} from './knowledgeGraphFamilyManifest.ts'
import {admitAtlasFamily} from '../projections/atlas/atlasFamilyManifest.ts'
import {allInhabitantManifests, declareFamilyExtension, type InhabitantManifest} from './manifest.ts'
import {quaternalLogicFamilyManifest, QUATERNAL_LOGIC_FAMILY_ID} from './quaternalLogicFamilyManifest.ts'
// [L9 musical family] the QL field/PCM owner's instrument face — an additive
// declared extension onto quaternal-logic; the base manifest stays verbatim.
import {declareQlMusicalExtension} from './qlMusicalExtension.ts'
// [T-CAPABILITY-HOMES-25] the homes of the suite capabilities with no product
// family scope — additive declarations (or the shell itself), idempotent.
import {declareCapabilityHomes} from './capabilityHomes.ts'

export {QUATERNAL_LOGIC_FAMILY_ID}

/** Central's L2 extension: the Day die over the existing iframe/payload-island/save-router path (the §5.2 promotion; its face
 * component, DocumentDayDieFace, lives beside this module). Ground hygiene, Impact, the Flow and the Nara conversation were declared
 * here; the 22 Oct manual rewrite folded each into another device, so they are retired as faces of their own. Their bindings stay
 * for the devices that carry them. */
const CENTRAL_EXTENSION_ID = 'central:world-shell-l2'

function declareCentralExtension(): void {
  declareFamilyExtension('central', {
    id: CENTRAL_EXTENSION_ID,
    by: 'zcode:rack-manifests-l2 (owner commission, WORLD-SHELL-DESIGN §12)',
    faces: [
      {
        id: 'day-die',
        kind: 'document',
        presentations: statePresentations('central:day-die'),
        liveSemantic: 'device-instrument',
        invariant: {generates: 'kernel:receiving'},
        dock: ['dock', 'expand', 'pop-out'],
        document: {
          kind: 'ql-daily-die',
          file: 'ql-daily-die.html',
          hosting: 'oi.document-frame/v1',
          saveRouter: ['saved', 'unchanged', 'stale', 'conflict', 'refused'],
          messages: ['oi-day-host:snapshot', 'oi-cradle-die-face:snapshot', 'oi-cradle-die-face:snapshot-error', 'oi-cradle-die-face:dirty'],
        },
        note: 'The 4+2 Day die over the existing hosting path (sandboxed iframe, payload island, bounded postMessage; DayFormSession + receiving mutate-field). Native Save is explicit; the strip discloses the save router\'s named outcomes.',
      },
    ],
    detachedKinds: ['flow', 'file', 'encounter', 'device'],
    note: 'L2 extension: the Day die over the document-hosting path. Ground hygiene, Impact, the Flow and the conversation are retired as faces of their own (22 Oct manual rewrite).',
  })
}

/** Central's page family (DLW §17.8 Document, §18.2 Workspace, §18.4–§18.8): the faces a Central document's chain and a workspace
 * track hold — the Document instrument (any page, drawn by its template) and Docs. The Workspace, Beings, Things, Text, Highlight
 * and Notes faces were retired as faces of their own in the 22 Oct manual rewrite. Each face is the catalogue's design (inhabitants/catalogue/panels/central__<face>.tsx), wired to Central's readings by
 * central/devices/pageBindings.ts and placed by central/devices/CentralDevices.tsx (§16.2: "the document effects, then the agent that
 * answers"). An instrument names what it generates through, or the owner it waits for; an effect names what it transforms. */
const CENTRAL_PAGE_FAMILY_EXTENSION_ID = 'central:page-family'

function declareCentralPageFamily(): void {
  declareFamilyExtension('central', {
    id: CENTRAL_PAGE_FAMILY_EXTENSION_ID,
    by: 'claude-code:dlw lane BC2 (DLW §17.8, §18.1–§18.1)',
    faces: [
      {
        id: 'document',
        presentations: statePresentations('central:document'),
        liveSemantic: 'device-instrument',
        invariant: {generates: 'kernel:file_operation'},
        note: 'Any Central page as its template draws it (DLW §17.8): the template, the title, the save state and what the page holds (entries, highlights, notes, packet), read from the document the hand reached (central/documents/documentDoor.ts) and the page\'s own file. Save and Re-read are the hosted face\'s own: a Flow\'s revision-checked file write (op file_operation), a Day\'s receiving write.',
      },
      {
        id: 'docs',
        presentations: statePresentations('central:docs'),
        liveSemantic: 'device-audio-fx',
        invariant: {transforms: 'the world\'s account of itself on six tiers — each source\'s binding, recognition, meaning and what moved since, read; the sources pass whole until Relate or Recognise, each a person\'s held act with its receipt'},
        note: 'A project\'s own account of itself (DLW §18.5): the six tiers, each source bound to them with its kind, whether it is recognised, whether the code holds its meaning and what moved since; the root\'s and the world\'s parts to make; the intended experiences and the returns against them. Read from Central (projectcentral.self.inspect, projectcentral.ground.inspect, central.doctor, central.world.reproject.plan) and AIKit (aikit knowledge frame).',
      },
    ],
    note: 'The page family: the Document instrument and Docs (DLW §17.8, §18.5); the Workspace, the Beings and Things pages and the document effects Text, Highlight and Notes are retired as faces of their own (22 Oct manual rewrite). Additive: the base manifest and the L2 extension stay as declared.',
  })
}

/** Central's agent chain (DLW §18.3 Packet, §18.11 Search): the two faces of the agent's devices the family did not yet declare — the
 * Packet, the effect that ends a document's chain (what the agent reads from you), and Search, Central's "@" language on a chain. Each
 * is the catalogue's design (inhabitants/catalogue/panels/central__packet.tsx, central__search.tsx), wired to its owner by
 * central/devices/packetBinding.ts and searchBinding.ts and placed by central/devices/CentralDevices.tsx. */
const CENTRAL_AGENT_CHAIN_EXTENSION_ID = 'central:agent-chain'

function declareCentralAgentChain(): void {
  declareFamilyExtension('central', {
    id: CENTRAL_AGENT_CHAIN_EXTENSION_ID,
    by: 'claude-code:dlw lane BC3 (DLW §18.3, §18.4)',
    faces: [
      {
        id: 'packet',
        presentations: statePresentations('central:packet'),
        liveSemantic: 'device-audio-fx',
        invariant: {transforms: 'what the agent reads from you — AIKit\'s prepared context, shown whole with its size; an item taken out or the packet cleared through the owner\'s own edit (op encounter context), the material passed on unchanged'},
        note: 'The packet the agent reads (DLW §18.3): AIKit\'s prepared context (aikit.prepared-context/v1, op encounter context), the read the Packet widget and the transport share. Take out and Clear now edit it; Answer this is the Agent conversation\'s own Send with exactly this packet. Capture waits: the page\'s selection does not cross the host bridge.',
      },
      {
        id: 'search',
        presentations: statePresentations('central:search'),
        liveSemantic: 'device-instrument',
        invariant: {generatesAbsent: 'Search writes nothing: it reads AIKit\'s knowledge search (op knowledge search and resolve). A tag\'s send, the aliases and the shared fields have no owner yet (DLW §18.4).'},
        note: 'Central\'s "@" language (DLW §18.4): the search line answered by AIKit\'s knowledge search (op knowledge search and resolve, as the cradle\'s search overlay asks them), in your world or one project.',
      },
    ],
    note: 'The agent chain: the Packet and Search (DLW §18.3, §18.4). Additive: the base manifest and the earlier extensions stay as declared.',
  })
}

/** Load the whole world-shell family declaration. Idempotent: the door
 * refuses only differing contents, so a second load composes the same
 * extensions onto the same bases and changes nothing. */
export function loadWorldShellFamilies(): void {
  loadAgentShellFamilies()
  // The two self-admitting families (atlas, knowledge graph) admit through their own idempotent admits as well: their
  // module imports admit them once, but a door reset clears them and an import does not run again.
  admitAtlasFamily()
  admitKnowledgeGraphFamily()
  quaternalLogicFamilyManifest()
  declareCentralExtension()
  declareCentralPageFamily()
  declareCentralAgentChain()
  // [L9 musical family] the QL instrument face — additive, idempotent.
  declareQlMusicalExtension()
  // [T-CAPABILITY-HOMES-25] capability homes — after the families are admitted.
  declareCapabilityHomes()
}

/** The world shell's composed family manifests, read from the door (door order). The door is the one admission store, so
 * the shell carries no list of product ids: a seventh family admitted at the door appears here with no edit in this
 * module. Loading is the caller's concern (`loadWorldShellFamilies`). */
export function worldShellFamilyManifests(): readonly InhabitantManifest[] {
  return allInhabitantManifests()
}
