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

/** Central's L2 extension: the clip-view craft of the ground itself (§12).
 * Admitted faces (owner op in parentheses):
 * - ground-hygiene — worktree census, branch audit, stray-branch and seat
 *   occupancy as readings (`ground`, `git_repository_read`,
 *   `workcell_status_read`); the tenders wait for their writer.
 * - impact — the Central-web neighbourhood of a selected folder or note
 *   (`wiki_projection_read`, `graph`); the sessions-touching reading waits.
 * Document devices (the §5.2 promotion): the Day die and Flow over the
 * existing iframe/payload-island/save-router path — bodies declared, the
 * face components live beside this module (DocumentDayDieFace,
 * DocumentFlowFace). The conversation device rides the Nara binding. */
const CENTRAL_EXTENSION_ID = 'central:world-shell-l2'

function declareCentralExtension(): void {
  declareFamilyExtension('central', {
    id: CENTRAL_EXTENSION_ID,
    by: 'zcode:rack-manifests-l2 (owner commission, WORLD-SHELL-DESIGN §12)',
    faces: [
      {
        id: 'ground-hygiene',
        presentations: ['compact', 'expanded'],
        liveSemantic: 'device-audio-fx',
        invariant: {transforms: 'the ground in focus — analysed, passed unchanged'},
        note: 'The ground as readings: worktree census, branch audit, stray-branch detection, seat occupancy. Reads through the kernel ground and git repository owners (op ground, op git_repository_read) and the workcell status read (op workcell_status_read). The tenders (prune, sweep) have no writer yet — declared, waiting.',
      },
      {
        id: 'impact',
        presentations: ['compact', 'expanded'],
        liveSemantic: 'device-audio-fx',
        invariant: {transforms: 'the selected folder or note — its neighbourhood read, passed unchanged'},
        note: 'Select a folder or note: its Central-web neighbourhood, references, and the sessions touching it. Reads through the wiki projection and graph owners (op wiki_projection_read, op graph). The sessions-touching read has no owner op yet — that leg waits.',
      },
      {
        id: 'day-die',
        kind: 'document',
        presentations: ['compact', 'expanded'],
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
      {
        // DLW §18.3: the Flow is an instrument, first on a Flow document's chain before the document effects — not a clip. It
        // generates through the Flow's own revision-checked file write (an entry appended, flow/instance.ts appendEntry, then
        // central.files.write — kernel op file_operation).
        id: 'flow-document',
        kind: 'document',
        presentations: ['compact', 'expanded'],
        liveSemantic: 'device-instrument',
        invariant: {generates: 'kernel:file_operation'},
        dock: ['dock', 'expand', 'pop-out'],
        document: {
          kind: 'ql-flow',
          file: 'ql-flow.html',
          hosting: 'oi.document-frame/v1',
          saveRouter: ['saved', 'unchanged', 'stale', 'conflict', 'refused'],
          messages: ['oi:document-host-request', 'oi:document-host-response'],
        },
        note: 'The 0/1 Flow (Dialogue · Flow · Journal) over the existing hosting path: payload island read through the bounded host bridge, save as the document\'s own revision-checked CAS write (central.files.write). Conflict returns the owner\'s bytes verbatim; the strip discloses the named outcome. On the chain it is the Flow document\'s instrument (DLW §18.3): its entries, people and pages, an entry appended through the same write.',
      },
      {
        id: 'nara-conversation',
        kind: 'conversation',
        presentations: ['compact', 'expanded'],
        liveSemantic: 'device-instrument',
        invariant: {generates: 'kernel:nara_dialogue'},
        dock: ['dock', 'expand', 'pop-out'],
        conversation: {binding: 'oi.nara-dialogue-binding/v1'},
        note: 'The situated agent conversation: bound over the kernel Nara dialogue binding (op nara_dialogue → oi.nara-dialogue-binding/v1); canonical CAS stays in AIKit. The aperture opens the existing encounter surface — the shell builds no second conversation store.',
      },
    ],
    detachedKinds: ['flow', 'file', 'encounter', 'device'],
    note: 'L2 extension: central\'s clip-view craft — ground/hygiene, impact, and the document/conversation devices. Base manifest (context-world, agent-identity) untouched.',
  })
}

/** Central's page family (DLW §17.7 Document, §18.2 Workspace, §18.4–§18.8): the faces a Central document's chain and a workspace
 * track hold — the Document instrument (any page, drawn by its template), the Workspace instrument (the track of one project), the
 * page instruments for a Being and a Thing, and the document effects Text, Highlight and Notes, each after the form device (§18.6–
 * §18.8). Each face is the catalogue's design (inhabitants/catalogue/panels/central__<face>.tsx), wired to Central's readings by
 * central/devices/pageBindings.ts and placed by central/devices/CentralDevices.tsx (§16.2: "the document effects, then the agent that
 * answers"). An instrument names what it generates through, or the owner it waits for; an effect names what it transforms. */
const CENTRAL_PAGE_FAMILY_EXTENSION_ID = 'central:page-family'

function declareCentralPageFamily(): void {
  declareFamilyExtension('central', {
    id: CENTRAL_PAGE_FAMILY_EXTENSION_ID,
    by: 'claude-code:dlw lane BC2 (DLW §17.7, §18.2–§18.8)',
    faces: [
      {
        id: 'document',
        presentations: ['compact', 'expanded'],
        liveSemantic: 'device-instrument',
        invariant: {generates: 'kernel:file_operation'},
        note: 'Any Central page as its template draws it (DLW §17.7): the template, the title, the save state and what the page holds (entries, highlights, notes, packet), read from the document the hand reached (central/documents/documentDoor.ts) and the page\'s own file. Save and Re-read are the hosted face\'s own: a Flow\'s revision-checked file write (op file_operation), a Day\'s receiving write.',
      },
      {
        id: 'workspace',
        presentations: ['compact', 'expanded'],
        liveSemantic: 'device-instrument',
        invariant: {generatesAbsent: 'Launch and the remembered context belong to the workspace book (desktop/cradle/src/workspace/store.ts), the shell\'s own store; no owner operation carries a launch or a Keep setting yet.'},
        note: 'The track of one project, book or practice (DLW §18.2): the workspace book\'s pane trees, its sets, its open mode and its project, read from the book the shell holds.',
      },
      {
        id: 'beings',
        presentations: ['compact', 'expanded'],
        liveSemantic: 'device-instrument',
        invariant: {generatesAbsent: 'the oi-beings form\'s owner has landed no page read or write (desktop/cradle/src/personal/page.mjs holds the page law; no kernel op carries it)'},
        note: 'A page about a person or an agent (DLW §18.4): its ties — world, subject, offices, sources, place — read from its oi.page/v1 island when a Beings page is reached.',
      },
      {
        id: 'things',
        presentations: ['compact', 'expanded'],
        liveSemantic: 'device-instrument',
        invariant: {generatesAbsent: 'the oi-things form\'s owner has landed no page read or write (desktop/cradle/src/personal/page.mjs holds the page law; no kernel op carries it)'},
        note: 'A page about an object in your work (DLW §18.5), on the Beings page\'s keys and shapes.',
      },
      {
        id: 'text',
        presentations: ['compact', 'expanded'],
        liveSemantic: 'device-audio-fx',
        invariant: {transforms: 'the open page\'s words — the paragraph style and the emphasis the page keeps as its own tags, read; the words pass whole'},
        note: 'The style of each paragraph and the emphasis of each word, as the page keeps them in its entries\' html (ql-flow.html clean()). A style or an emphasis is set on the page itself.',
      },
      {
        id: 'highlight',
        presentations: ['compact', 'expanded'],
        liveSemantic: 'device-audio-fx',
        invariant: {transforms: 'the open page\'s passages — marked by the page\'s own <mark> spans, read; the words pass whole'},
        note: 'The passages the page marks (ql-flow.html act(\'hl\'); central/documentPayload.ts markedPassages). A highlight is made on the page itself.',
      },
      {
        id: 'notes',
        presentations: ['compact', 'expanded'],
        liveSemantic: 'device-audio-fx',
        invariant: {transforms: 'the open page\'s notes — each anchored to its entry and passage, read; the page passes whole'},
        note: 'The notes the page keeps beside its entries (ql-flow.html D.notes): the entry, the quoted passage, the timing, the words and the replies. A note is written on the page itself.',
      },
    ],
    note: 'The page family: the Document and Workspace instruments, the Beings and Things pages, and the document effects Text, Highlight and Notes (DLW §16.2, §17.7, §18.2–§18.8). Additive: the base manifest and the L2 extension stay as declared.',
  })
}

/** Central's agent chain (DLW §18.9 Packet, §18.11 Search): the two faces of the agent's devices the family did not yet declare — the
 * Packet, the effect that ends a document's chain (what the agent reads from you), and Search, Central's "@" language on a chain. Each
 * is the catalogue's design (inhabitants/catalogue/panels/central__packet.tsx, central__search.tsx), wired to its owner by
 * central/devices/packetBinding.ts and searchBinding.ts and placed by central/devices/CentralDevices.tsx. */
const CENTRAL_AGENT_CHAIN_EXTENSION_ID = 'central:agent-chain'

function declareCentralAgentChain(): void {
  declareFamilyExtension('central', {
    id: CENTRAL_AGENT_CHAIN_EXTENSION_ID,
    by: 'claude-code:dlw lane BC3 (DLW §18.9, §18.11)',
    faces: [
      {
        id: 'packet',
        presentations: ['compact', 'expanded'],
        liveSemantic: 'device-audio-fx',
        invariant: {transforms: 'what the agent reads from you — AIKit\'s prepared context, shown whole with its size; an item taken out or the packet cleared through the owner\'s own edit (op encounter context), the material passed on unchanged'},
        note: 'The packet the agent reads (DLW §18.9): AIKit\'s prepared context (aikit.prepared-context/v1, op encounter context), the read the Packet widget and the transport share. Take out and Clear now edit it; Answer this is the Agent conversation\'s own Send with exactly this packet. Capture waits: the page\'s selection does not cross the host bridge.',
      },
      {
        id: 'search',
        presentations: ['compact', 'expanded'],
        liveSemantic: 'device-instrument',
        invariant: {generatesAbsent: 'Search writes nothing: it reads AIKit\'s knowledge search (op knowledge search and resolve). A tag\'s send, the aliases and the shared fields have no owner yet (DLW §18.11).'},
        note: 'Central\'s "@" language (DLW §18.11): the search line answered by AIKit\'s knowledge search (op knowledge search and resolve, as the cradle\'s search overlay asks them), in your world or one project.',
      },
    ],
    note: 'The agent chain: the Packet and Search (DLW §18.9, §18.11). Additive: the base manifest and the earlier extensions stay as declared.',
  })
}

/** Software Factory's L2 extension: the attempt faces where the owner admits
 * (§12 "run devices, attempt review, artifact inspection, Return"). The
 * kernel's factory attempt owner exists today as reads (op
 * factory_attempt_read, factory_attempt_task_list_read,
 * factory_attempt_task_read, factory_build_snapshot); the review/steer
 * writers wait for their owner. */
const SOFTWARE_FACTORY_EXTENSION_ID = 'software-factory:world-shell-l2'

function declareSoftwareFactoryExtension(): void {
  declareFamilyExtension('software-factory', {
    id: SOFTWARE_FACTORY_EXTENSION_ID,
    by: 'zcode:rack-manifests-l2 (owner commission, WORLD-SHELL-DESIGN §12)',
    faces: [
      {
        id: 'attempt-review',
        presentations: ['expanded', 'full'],
        liveSemantic: 'capture',
        note: 'One run\'s attempts and their task trees as readings (op factory_attempt_read, factory_attempt_task_list_read, factory_attempt_task_read; build snapshot via factory_build_snapshot). Review, steer and interrupt writers wait for the Factory owner (the Buzz contract of record names the behaviours, not the writer).',
      },
    ],
    note: 'L2 extension: the attempt-review reading face over the existing factory attempt owner. Base manifest (agent-custody, context-write-mode, ledger, approvals, run-device) untouched.',
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
  declareSoftwareFactoryExtension()
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
