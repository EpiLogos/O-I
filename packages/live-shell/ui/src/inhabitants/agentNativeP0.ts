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
 *   the controls are real, the setters are self-armed with the atlas port's
 *   adopt-the-kit refactor named as the wiring moment. Until that wiring
 *   registers the setters, dispatch refuses naming the setter — honest.
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
  // Atlas Earth (WO-AT1) — the four real devices' address layer. The
  // setters are self-armed; the atlas port's adopt-the-kit refactor is the
  // named wiring moment (DEVICE-SDK.md honest limits).
  row({
    family: 'atlas-earth', deviceInstance: 'graph-tools', faceId: 'graph-tools', title: 'Graph Tools', icon: 'map',
    writers: ['shell.setAtlasDepth', 'shell.setAtlasSpread', 'shell.setAtlasGravity', 'shell.setAtlasTies', 'shell.setAtlasSkyAnchors'],
    writerAuthority: P0_AUTHORITY,
    rows: [
      {
        family: 'atlas-earth', deviceInstance: 'graph-tools', key: 'depth', title: 'Steps from subject', type: 'number',
        range: {min: 1, max: 3, unit: 'steps'}, writePath: 'shell.setAtlasDepth',
        disclosure: 'The atlas control is real (graph/tools.ts GraphTools.onDepth); the setter registration lands with the atlas owner\'s adopt-the-kit refactor — dispatch refuses naming the setter until then.',
      },
      {
        family: 'atlas-earth', deviceInstance: 'graph-tools', key: 'spread', title: 'Link space', type: 'number',
        range: {min: 0.7, max: 1.8, unit: '×'}, writePath: 'shell.setAtlasSpread',
        disclosure: 'The atlas range slider\'s own domain (min 0.7, max 1.8, step 0.05); same wiring moment as depth.',
      },
      {
        family: 'atlas-earth', deviceInstance: 'graph-tools', key: 'gravity', title: 'Gravity', type: 'number',
        range: {min: 0.55, max: 1.5, unit: '×'}, writePath: 'shell.setAtlasGravity',
        disclosure: 'The atlas gravity slider\'s own domain (min 0.55, max 1.5); same wiring moment.',
      },
      {
        family: 'atlas-earth', deviceInstance: 'graph-tools', key: 'ties', title: 'Tie bases', type: 'enumerated',
        values: ['jung', 'inferred', 'site'], writePath: 'shell.setAtlasTies',
        disclosure: 'The provider-declared tie bases (DEFAULT_TIE_BASES, strongest first); the atlas filters its edges by them today.',
      },
      {
        family: 'atlas-earth', deviceInstance: 'graph-tools', key: 'sky-anchors', title: 'Sky anchors', type: 'boolean',
        writePath: 'shell.setAtlasSkyAnchors',
        disclosure: 'The atlas hangs the sky\'s bodies from the graph (onSky); the sky reading itself is the QL owner\'s — anchors render its status, honestly.',
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
        disclosure: 'Earth ⇄ Graph, the atlas\'s own one-control switch; same wiring moment as the graph tools.',
      },
    ],
  }),
  row({
    family: 'atlas-earth', deviceInstance: 'time-control', faceId: 'time-control', title: 'Time Control', icon: 'metroDots',
    writers: ['shell.setAtlasOccasionWindow'],
    writerAuthority: P0_AUTHORITY,
    rows: [
      {
        family: 'atlas-earth', deviceInstance: 'time-control', key: 'occasion-window', title: 'Occasion window', type: 'duration',
        range: {min: 0, max: 86400000, unit: 'ms'}, writePath: 'shell.setAtlasOccasionWindow',
        disclosure: 'The occasion stratum\'s window (§15.5): a saved occasion keeps its snapshot and separately qualifies its admission; the atlas time model reads the window it is given.',
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
