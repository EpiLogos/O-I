/** The agent-native P0 declarations — lane `zcode:agent-native-p0`, 2026-10-11.
 *
 * The coverage audit's work order (COVERAGE-WORK-ORDER.md) named the four
 * P0 ligaments and the same-day declarations: every UNDECLARED capacity
 * whose owner operation exists today gets its §14 row and its family
 * writer arming, and Rev 5's "one transport, five meanings" gets its first
 * TransportBinding declarations. This module is that batch, declared
 * through the kit's ADOPTION door (`sdk/define.ts` registerAdoptedArtifacts,
 * extended this lane to carry writers, writerAuthority and transport) —
 * the five agent-shell families' manifests stay owner-authored at the door,
 * untouched; the adoption is additive, validated by the same laws, and
 * idempotent.
 *
 * What is declared here, and the honesty of each row:
 * - Transport bindings (ligament 1): the audited slots whose §14 params
 *   exist — factory tempo→effort, metro→heartbeat, overdub→input (steer
 *   mode), quantize→interrupt-quantize, arm→write-mode, play/stop→
 *   task-control; base arm→write-mode. Each binding is data; the fire path
 *   (`src/agent/agentNativeDispatch.ts`) resolves owner operations through
 *   the bindings and refuses honestly where the op cannot carry the value.
 * - The same-day rows: steer-line and new-task (the harness control exists;
 *   the text values ride the value carrier the kernel patch introduces),
 *   task-control (the control union carries new|stop|restart|pause|resume
 *   TODAY — this row makes the transport slots addressable through it),
 *   interrupt-quantize (the shell's armed quantize value, carried by
 *   `shell.setQuantize` — self-armed with this lane's commission as the
 *   authority). The ~23 owner-op items are NOT declared here; they stay in
 *   the updated work order, owner-named.
 * - The atlas rows (WO-AT1): the four real atlas devices' address layer —
 *   every row is a parameter the atlas exposes, on the atlas's own domain
 *   (FORCE_ROWS, the graph's clamp and tiers, the clock's bounds). Their
 *   writers are registered by the shell's setter bridge
 *   (src/agent/shellSetterBridge.ts) and drive the atlas face actions the
 *   bodies call; with no atlas mounted, dispatch refuses naming the writer.
 * - The central tenders (WO-C1): declared WITHOUT device write paths — the
 *   law is the owner arms, never the device; each row's disclosure names
 *   the owner surface (ctrl Actions / the seat instrument).
 *
 * Pure registration: no view, no I/O; resets with the door. */

import type {AdoptedArtifacts, TransportBinding} from './sdk/define.ts'
import {registerAdoptedArtifacts} from './sdk/define.ts'
import {admitFamilyManifest, familyManifest, onFamilyManifestReset} from './familyManifest.ts'
// The atlas port self-admits at module import (the found pattern); its
// module-level flag never re-admits after the door's TEST-only reset. The
// loader admits the port's own exported manifest — the same bytes — when
// the door lacks it, so the batch is declarable in tests and unchanged in
// production (where import order already admits it).
import {atlasFamilyManifest} from '../projections/atlas/atlasFamilyManifest.ts'
import {FORCE_ROWS, type Forces} from '../projections/atlas/src/graph/forces.ts'
import {CLOCK_DOMAIN, DEPTH_RANGE, KIND_NAMES, TIE_BASE_IDS} from './atlasFaceActions.ts'

/** Who commissions this batch's self-armed writers (the writers law: a
 * fixture names itself; a lane names its commission). */
const P0_AUTHORITY =
  'lane zcode:agent-native-p0, dispatched by orchestrator zcode:world-shell-orchestrator, 2026-10-11 — the coverage audit P0 commission (new-shell/evidence/agent-native-coverage-20261010/COVERAGE-WORK-ORDER.md)'

const KERNEL_HARNESS_CONTROL = 'kernel:harness_agent_control'

const row = (artifact: {
  family: AdoptedArtifacts['family']
  deviceInstance: string
  faceId: string
  title: string
  icon: AdoptedArtifacts['presentation']['icon']
  rows: AdoptedArtifacts['rows']
  writers?: AdoptedArtifacts['writers']
  writerAuthority?: AdoptedArtifacts['writerAuthority']
  transport?: readonly TransportBinding[]
}): AdoptedArtifacts => ({
  family: artifact.family,
  owner: familyOwner(artifact.family),
  presentation: {
    family: artifact.family,
    faceId: artifact.faceId,
    title: artifact.title,
    icon: artifact.icon,
    owner: familyOwner(artifact.family),
  },
  rows: artifact.rows,
  ...(artifact.writers ? {writers: artifact.writers} : {}),
  ...(artifact.writerAuthority ? {writerAuthority: artifact.writerAuthority} : {}),
  ...(artifact.transport ? {transport: artifact.transport} : {}),
})

function familyOwner(family: string): string {
  const OWNERS: Record<string, string> = {
    central: 'Central',
    actuation: 'Actuation',
    'ai-kit': 'AIKit',
    'software-factory': 'Software Factory',
    workcell: 'Workcell',
    'atlas-earth': 'Atlas Earth (the ported globe)',
  }
  return OWNERS[family] ?? family
}

/** One of the graph's four forces, as its own slider declares it: the label, the tip and the domain come from the atlas's
 * FORCE_ROWS, so the row cannot drift from the slider. The stored value is the slider's own; the face reads it as a
 * multiple of the arrangement as drawn. */
function atlasForceRow(key: keyof Forces, writePath: string): AdoptedArtifacts['rows'][number] {
  const spec = FORCE_ROWS.find(force => force.key === key)
  if (!spec) throw new Error(`the atlas has no force "${key}"`)
  return {
    family: 'atlas-earth', deviceInstance: 'graph-tools', key, title: spec.label, type: 'number',
    range: {min: spec.min, max: spec.max}, writePath,
    disclosure: `${spec.tip} The value is the stored force on the graph’s own slider domain (${spec.min} to ${spec.max}); the face reads it as a multiple of the arrangement as drawn, where 1.00× is rest.`,
  }
}

// ---------------------------------------------------------------------------
// the §14 rows this batch adds (the same-day declarations)

/** The new rows on the agent chain's faces. The four gateway rows
 * (transport/approvals/stall-after/connect) are ALREADY declared
 * (DECLARED-UNWIRED, the audited table) — they act when the kernel's value
 * carrier lands; this batch does not re-declare them. */
const P0_ROWS: AdoptedArtifacts[] = [
  // Actuation — the agent face (harness-model) carries the agent rows.
  row({
    family: 'actuation', deviceInstance: 'agent', faceId: 'harness-model', title: 'Harness Model', icon: 'metro',
    writers: ['shell.setQuantize'], writerAuthority: P0_AUTHORITY,
    rows: [
      {
        family: 'actuation', deviceInstance: 'agent', key: 'steer-line', title: 'Steer line', type: 'string',
        writePath: KERNEL_HARNESS_CONTROL,
        disclosure: 'Mid-turn steer text rides the value-carrying harness control (configure {steer}); the kernel patch carrying it is the P0 ligament — until it lands the kernel refuses and the refusal names the carrier. Behaviour of record: the Buzz contract (steer-first, withheld-event ledger).',
      },
      {
        family: 'actuation', deviceInstance: 'agent', key: 'interrupt-quantize', title: 'Interrupt timing', type: 'enumerated',
        values: ['now', 'next tool', 'next turn'], writePath: 'shell.setQuantize',
        disclosure: 'The shell arms the quantize value; its CONSUMPTION (stop/steer reading the armed timing) is WO-A5 — the dispatch carries the value to the harness, the harness owner applies it at the carrier.',
      },
    ],
  }),
  // Software-factory — the agent-custody face carries the custody/task rows.
  row({
    family: 'software-factory', deviceInstance: 'agent', faceId: 'agent-custody', title: 'Agent Custody', icon: 'arm',
    rows: [
      {
        family: 'software-factory', deviceInstance: 'agent', key: 'task-control', title: 'Task control', type: 'enumerated',
        values: ['new', 'stop', 'restart', 'pause', 'resume'], writePath: KERNEL_HARNESS_CONTROL,
        disclosure: 'The control union carries all five today (desktop/cradle/src/kernel/types.ts) — the transport play/stop slots dispatch resume/stop through it with the harness outcome as receipt.',
      },
      {
        family: 'software-factory', deviceInstance: 'agent', key: 'new-task', title: 'New task', type: 'string',
        writePath: KERNEL_HARNESS_CONTROL,
        disclosure: 'The bare \'new\' control fires today; the task TEXT rides the value carrier (configure {prompt}) — the act-clip grammar that composes it is WO-A4\'s remaining half.',
      },
    ],
  }),
  // Atlas Earth (WO-AT1, wired) — the four real devices' address layer. Every row is a parameter the atlas exposes, on
  // the atlas's own domain: FORCE_ROWS for the four forces, the GraphView's clamp for the steps, its tiers and its tie
  // bases, the TimeModel's bounds for the cursor. Each writer is registered by the shell's setter bridge and drives the
  // same atlas face action its face body calls, on the one mounted atlas.
  row({
    family: 'atlas-earth', deviceInstance: 'graph-tools', faceId: 'graph-tools', title: 'Graph Tools', icon: 'map',
    writers: [
      'shell.setAtlasDepth', 'shell.setAtlasCentre', 'shell.setAtlasRepel', 'shell.setAtlasLink', 'shell.setAtlasDistance',
      'shell.setAtlasTies', 'shell.setAtlasKinds', 'shell.setAtlasOccurrences', 'shell.setAtlasSkyAnchors',
    ],
    writerAuthority: P0_AUTHORITY,
    rows: [
      {
        family: 'atlas-earth', deviceInstance: 'graph-tools', key: 'depth', title: 'Steps from subject', type: 'number',
        range: {min: DEPTH_RANGE.min, max: DEPTH_RANGE.max, unit: 'steps'}, writePath: 'shell.setAtlasDepth',
        disclosure: 'The graph’s own steps from its subject, one to three (the graph clamps to that range). Shown in a local graph. The writer steps the same control the face’s + and − use, and refuses a value outside the range by name.',
      },
      atlasForceRow('centre', 'shell.setAtlasCentre'),
      atlasForceRow('repel', 'shell.setAtlasRepel'),
      atlasForceRow('link', 'shell.setAtlasLink'),
      atlasForceRow('distance', 'shell.setAtlasDistance'),
      {
        family: 'atlas-earth', deviceInstance: 'graph-tools', key: 'ties', title: 'Relations', type: 'enumerated',
        values: [...TIE_BASE_IDS], writePath: 'shell.setAtlasTies',
        disclosure: 'Which relations are drawn between families and archetypes, by basis, strongest first (Jung, Inferred, Site, as the graph declares them). Write the full set you want on; the graph toggles only the bases that differ. A basis the live graph does not declare is refused by name.',
      },
      {
        family: 'atlas-earth', deviceInstance: 'graph-tools', key: 'kinds', title: 'Kinds drawn', type: 'enumerated',
        values: [...KIND_NAMES], writePath: 'shell.setAtlasKinds',
        disclosure: 'Which node tiers are drawn: archetypes, theoretics, families. Write the full set you want on; a tier switched off leaves the drawing with its ties. Occurrences are a row of their own.',
      },
      {
        family: 'atlas-earth', deviceInstance: 'graph-tools', key: 'occurrences', title: 'Occurrences', type: 'boolean',
        writePath: 'shell.setAtlasOccurrences',
        disclosure: 'Whether occurrences (the dust) are drawn: the graph’s own Occurrences toggle, set to the value written. The graph re-lays the picture when it changes.',
      },
      {
        family: 'atlas-earth', deviceInstance: 'graph-tools', key: 'sky-anchors', title: 'Sky anchors', type: 'boolean',
        writePath: 'shell.setAtlasSkyAnchors',
        disclosure: 'Hangs the sky’s bodies from the graph. The atlas loads the sky the first time it is asked and reports loading, on, or unavailable, as the face does. The sky reading itself belongs to the QL owner; the anchors render its status.',
      },
    ],
  }),
  row({
    family: 'atlas-earth', deviceInstance: 'mode-switch', faceId: 'mode-switch', title: 'Mode Switch', icon: 'direct',
    writers: ['shell.setAtlasView'],
    writerAuthority: P0_AUTHORITY,
    rows: [
      {
        family: 'atlas-earth', deviceInstance: 'mode-switch', key: 'view', title: 'View', type: 'enumerated',
        values: ['earth', 'graph'], writePath: 'shell.setAtlasView',
        disclosure: 'Earth or Graph, the atlas’s own one-control switch: the view the lens bar presents, which the Earth follows. The choice stands whether or not the Earth has mounted yet, as the face body’s does.',
      },
    ],
  }),
  row({
    family: 'atlas-earth', deviceInstance: 'globe-engine', faceId: 'globe-engine', title: 'Globe', icon: 'map',
    writers: ['shell.setAtlasWholeField'],
    writerAuthority: P0_AUTHORITY,
    rows: [
      {
        family: 'atlas-earth', deviceInstance: 'globe-engine', key: 'whole-field', title: 'Whole field', type: 'boolean',
        writePath: 'shell.setAtlasWholeField',
        disclosure: 'The globe’s one exposed parameter: while a mode’s own set stands aside on the globe, show the whole field instead. With no set aside there is no choice to make, and the writer says so. The base texture is a reading, not a parameter.',
      },
    ],
  }),
  row({
    family: 'atlas-earth', deviceInstance: 'time-control', faceId: 'time-control', title: 'Time Control', icon: 'metroDots',
    writers: ['shell.setAtlasCursor', 'shell.setAtlasAllTime', 'shell.setAtlasPlay', 'shell.setAtlasCumulative'],
    writerAuthority: P0_AUTHORITY,
    rows: [
      {
        family: 'atlas-earth', deviceInstance: 'time-control', key: 'cursor', title: 'Deep time', type: 'number',
        range: {min: CLOCK_DOMAIN.min, max: CLOCK_DOMAIN.max}, writePath: 'shell.setAtlasCursor',
        disclosure: 'The deep-time cursor on the atlas’s own clock, over the clock’s bounds (zero to one, the scale’s own units). Writing it scrubs the clock the Earth pane reads and leaves all time. A value outside the clock’s current bounds is refused by name.',
      },
      {
        family: 'atlas-earth', deviceInstance: 'time-control', key: 'all-time', title: 'All time', type: 'boolean',
        writePath: 'shell.setAtlasAllTime',
        disclosure: 'All time, the clock’s resting state: true sets it. The cursor leaves all time by being scrubbed, so false is refused by name.',
      },
      {
        family: 'atlas-earth', deviceInstance: 'time-control', key: 'play', title: 'Play', type: 'boolean',
        writePath: 'shell.setAtlasPlay',
        disclosure: 'Plays the cursor forward on the atlas’s own clock from where it stands, or pauses it: true plays, false pauses.',
      },
      {
        family: 'atlas-earth', deviceInstance: 'time-control', key: 'cumulative', title: 'Cumulative', type: 'boolean',
        writePath: 'shell.setAtlasCumulative',
        disclosure: 'Whether the clock’s trail accumulates behind the cursor: the clock’s own cumulative flag, set to the value written.',
      },
    ],
  }),
  // Central tenders (WO-C1) — declared WITHOUT device write paths: the law
  // is the owner arms, never the device. Each disclosure names the surface.
  row({
    family: 'central', deviceInstance: 'ground-hygiene', faceId: 'ground-hygiene', title: 'Ground Hygiene', icon: 'detail',
    rows: [
      {
        family: 'central', deviceInstance: 'ground-hygiene', key: 'sweep-branch', title: 'Sweep stray branch', type: 'receipts',
        disclosure: 'Tender, not a device write: the owner arms it through its own surfaces (ctrl Actions); the device holds the reading and the receipt, never the fire. WO-C1 reserves the ctrl: path for the owner\'s decision.',
      },
      {
        family: 'central', deviceInstance: 'ground-hygiene', key: 'prune-worktree', title: 'Prune erroneous worktree', type: 'receipts',
        disclosure: 'Same law: the owner\'s ctrl Actions arm the prune; the device discloses the receipt.',
      },
      {
        family: 'central', deviceInstance: 'ground-hygiene', key: 'release-seat', title: 'Release seat', type: 'receipts',
        disclosure: 'The seat instrument (workcell-cli) owns release; a device-side dispatch waits on the owner\'s explicit arm. WO-C1.',
      },
    ],
  }),
]

// ---------------------------------------------------------------------------
// the transport bindings (ligament 1) — the audited slots, addressed

/** Factory tempo → effort: where Live has tempo, the armed session thinks
 * at the chosen effort. Bound on the agent face (the harness-model). */
const BINDINGS: readonly TransportBinding[] = [
  {mode: 'factory', row: 'tempo', face: 'harness-model', key: 'effort'},
  {mode: 'factory', row: 'metro', face: 'harness-model', key: 'heartbeat'},
  {mode: 'factory', row: 'overdub', face: 'harness-model', key: 'input'},
  {mode: 'factory', row: 'quantize', face: 'harness-model', key: 'interrupt-quantize'},
  {mode: 'factory', row: 'arm', face: 'context-write-mode', key: 'write-mode'},
  {mode: 'factory', row: 'play', face: 'agent-custody', key: 'task-control'},
  {mode: 'factory', row: 'stop', face: 'agent-custody', key: 'task-control'},
  // Base·Central's arm is the same write arm (the audit: base arm COVERED —
  // write-mode on the chain).
  {mode: 'base', row: 'arm', face: 'context-write-mode', key: 'write-mode'},
]

// The bindings address two families; they ride each family's adoption
// artifact so the writers/binding laws validate per family.
const BINDINGS_BY_FAMILY: Record<string, readonly TransportBinding[]> = {
  actuation: BINDINGS.filter(binding => binding.face === 'harness-model'),
  'software-factory': BINDINGS.filter(binding => binding.face !== 'harness-model'),
}

let loaded = false

/** Declare the P0 batch. Requires the families loaded
 * (`loadAgentShellFamilies()` / `loadWorldShellFamilies()` — atlas-earth
 * self-admits on import) and the verified table adopted
 * (`adoptVerifiedRows()`), so the bindings resolve the same face plates the
 * chain renders. Idempotent; the door reset clears it. */
export function loadAgentNativeP0(): void {
  if (loaded) return
  if (!familyManifest('atlas-earth')) admitFamilyManifest(atlasFamilyManifest)
  const missing = ['actuation', 'software-factory', 'atlas-earth', 'central'].filter(family => !familyManifest(family as never))
  if (missing.length) {
    throw new Error(`loadAgentNativeP0 refuses — families not yet admitted: ${missing.join(', ')} (load the families first; the door is theirs)`)
  }
  registerAdoptedArtifacts(P0_ROWS.map(artifact => ({
    ...artifact,
    ...(BINDINGS_BY_FAMILY[artifact.family] ? {transport: BINDINGS_BY_FAMILY[artifact.family]} : {}),
  })))
  loaded = true
}

/** Whether the P0 batch is standing (post-reset it is not). */
export function agentNativeP0Loaded(): boolean {
  return loaded
}

onFamilyManifestReset(() => {
  loaded = false
})
