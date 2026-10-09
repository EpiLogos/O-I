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
import {declareFamilyExtension, inhabitantManifest, type InhabitantManifest} from './manifest.ts'
import {quaternalLogicFamilyManifest, QUATERNAL_LOGIC_FAMILY_ID} from './quaternalLogicFamilyManifest.ts'
// [L9 musical family] the QL field/PCM owner's instrument face — an additive
// declared extension onto quaternal-logic; the base manifest stays verbatim.
import {declareQlMusicalExtension} from './qlMusicalExtension.ts'

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
        note: 'The ground as readings: worktree census, branch audit, stray-branch detection, seat occupancy. Reads through the kernel ground and git repository owners (op ground, op git_repository_read) and the workcell status read (op workcell_status_read). The tenders (prune, sweep) have no writer yet — declared, waiting.',
      },
      {
        id: 'impact',
        presentations: ['compact', 'expanded'],
        note: 'Select a folder or note: its Central-web neighbourhood, references, and the sessions touching it. Reads through the wiki projection and graph owners (op wiki_projection_read, op graph). The sessions-touching read has no owner op yet — that leg waits.',
      },
      {
        id: 'day-die',
        kind: 'document',
        presentations: ['compact', 'expanded'],
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
        id: 'flow-document',
        kind: 'document',
        presentations: ['compact', 'expanded'],
        dock: ['dock', 'expand', 'pop-out'],
        document: {
          kind: 'ql-flow',
          file: 'ql-flow.html',
          hosting: 'oi.document-frame/v1',
          saveRouter: ['saved', 'unchanged', 'stale', 'conflict', 'refused'],
          messages: ['oi:document-host-request', 'oi:document-host-response'],
        },
        note: 'The 0/1 Flow (Dialogue · Flow · Journal) over the existing hosting path: payload island read through the bounded host bridge, save as the document\'s own revision-checked CAS write (central.files.write). Conflict returns the owner\'s bytes verbatim; the strip discloses the named outcome.',
      },
      {
        id: 'nara-conversation',
        kind: 'conversation',
        presentations: ['compact', 'expanded'],
        dock: ['dock', 'expand', 'pop-out'],
        conversation: {binding: 'oi.nara-dialogue-binding/v1'},
        note: 'The situated agent conversation: bound over the kernel Nara dialogue binding (op nara_dialogue → oi.nara-dialogue-binding/v1); canonical CAS stays in AIKit. The aperture opens the existing encounter surface — the shell builds no second conversation store.',
      },
    ],
    detachedKinds: ['flow', 'file', 'encounter'],
    note: 'L2 extension: central\'s clip-view craft — ground/hygiene, impact, and the document/conversation devices. Base manifest (context-world, agent-identity) untouched.',
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
  quaternalLogicFamilyManifest()
  declareCentralExtension()
  declareSoftwareFactoryExtension()
  // [L9 musical family] the QL instrument face — additive, idempotent.
  declareQlMusicalExtension()
}

/** The six world-shell product families, composed (base + extensions). */
export const WORLD_SHELL_FAMILY_IDS = [
  'central',
  'actuation',
  'ai-kit',
  'software-factory',
  'workcell',
  QUATERNAL_LOGIC_FAMILY_ID,
] as const

/** The six families' composed manifests, in the §12 order. Loading is the
 * caller's concern (`loadWorldShellFamilies`); this reads the door. */
export function worldShellFamilyManifests(): readonly InhabitantManifest[] {
  return WORLD_SHELL_FAMILY_IDS
    .map(id => inhabitantManifest(id))
    .filter((manifest): manifest is InhabitantManifest => manifest !== undefined)
}
