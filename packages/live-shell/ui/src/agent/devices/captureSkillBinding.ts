// Capture skill on its owners (lane W7; DLW §19.11, ai-kit:capture-skill — "Kind: instrument · Chain: on the armed Factory track"). It
// stands on the chain of the session track the transport's writers aim at (Factory's armed track is the selected session's: Voice records
// "into the armed track"), after Scope (factoryPlaces.ts chainSlots `capture`), and never on a group's, a workcell's or the Main track's.
//
// What the owners report (real shape: `aikit inbox --json`, read on workcell:mac 21 Oct, tests/fixtures/aikit-inbox-2026-10-21.json,
// read-only), through the kernel's aikit_read {inbox} (lane W3, desktop/cradle/kernel/src/owner_routes.rs AikitRead::Inbox):
//   items [{id, kind capture-candidate | …, title, state {state open | …}, created, evidence [{label candidate, value cnd_…}, {label
//   proposed-id, value <kind>/<namespace>/<name>}, {evidence file, path …/inbox/<ready|quarantine>/<cnd>/body}, …]}] — the proposals
//   that wait. The device's proposal is the newest open capture candidate whose proposed id is a Method or a Skill (the id's own kind):
//   Ready while its body is kept under the inbox's `ready` directory, Held while under `quarantine` (AIKit's own law: a candidate's state
//   names the directory it is kept in, ai-kit crates/aikit-store/src/inbox.rs CandidateState::directory). Name starts at its proposed id
//   until the hand names it.
// The write: Accept writes the proposal as a draft member through aikit_write {promote, candidate, id: the name} (`aikit promote <cnd>
// --id <name>`), after its confirm (the view's `acceptAsk`). Remove is the inbox's `aikit inbox reject <cnd>` and Release a rescan of a
// held candidate; neither has a kernel route, so each stands disabled with its command.
// What nothing reads, each absent with the operation it waits for: the transport's Capture as a recording (the shell's own flag; no owner
// records an example), the example and its window (the transport hands no window of the track's frames and your commands to anything:
// SPECIFIED, no code), the selected clip as a source, the steps and the skill's text (the track's agent drafting them from the example:
// SPECIFIED, no code), the findings that hold a proposal and the members it resembles (`aikit capture` returns them for the capture it
// makes; `aikit inbox` lists a message, its candidate and its proposed id, not them). The capture itself (`aikit capture`, aikit_write
// capture) has no control on this design: the transport's Capture is its trigger, and it records the shell's own action labels, not an
// example's text — so no capture is written from here.
// Source, Minutes, Form and Scope are the hand's settings; marks is the shell's one set (designBindings.ts SHELL_MARK_SET). Pure, apart
// from the view holds (designBindings.ts holdView).
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import {SHELL_MARK_SET, chainHolds, holdView, viewHolds, type ChainHolds} from './designBindings'
import {refusalWords} from './ownerRoutes'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)

export const CAPTURE_SKILL_DESIGN = 'ai-kit:capture-skill'
export const CAPTURE_SKILL_ID = 'factory:capture-skill'

// Capture skill has no device of its own (tickets 725 and 772): it is the Skillset rack's Capture page (§19.11; oneAgentBinding.ts CAPTURE_PAGE,
// `capture.`). This module is the page's binding.

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`
const unread = (what: string, op: string, owner: string) => `${what}: no reading reaches it yet — missing op: ${op} (${owner}).`
const reading = (key: string) => `${key} is a reading: its owner reports it; nothing here changes it.`

/** The keys no owner reports, each with the reading it waits for. */
export const CAPTURE_ABSENT = {
  recording: unread('Whether Capture records', 'a record of the example kept by an owner (the transport\'s Capture is the shell\'s own flag)', 'AIKit'),
  example: unread('The example', 'a window of the track\'s frames and your commands handed to the capture (SPECIFIED: the transport hands none over)', 'AIKit'),
  clip: unread('The selected clip as the source', 'a clip\'s material handed to the capture (SPECIFIED: no code)', 'AIKit'),
  steps: unread('The steps found', 'the track\'s agent drafting the steps from the example (AIKit\'s authoring Method directs it; SPECIFIED, no code)', 'AIKit'),
  says: unread('The skill\'s text', 'the track\'s agent drafting the text from the example (SPECIFIED, no code)', 'AIKit'),
  findings: unread('What holds the proposal', 'the candidate\'s findings for a waiting proposal (`aikit capture` returns them for the capture it makes; `aikit inbox` lists a message, its candidate and proposed id, not them)', 'AIKit'),
  similar: unread('What it resembles', 'the candidate\'s nearest members for a waiting proposal (`aikit capture` returns them for the capture it makes; `aikit inbox` lists none)', 'AIKit'),
} as const

/** The acts no kernel route carries, each with its command. */
export const CAPTURE_REFUSE = {
  remove: missing('Remove', '`aikit inbox reject <candidate>` through the kernel (aikit_write carries capture, promote, trust and Methods, not the inbox\'s reject)', 'AIKit'),
  release: missing('Release', 'a rescan of a held candidate through the kernel (AIKit\'s inbox frees a quarantined candidate only on a rescan with no secret left; no route asks it)', 'AIKit'),
} as const

/** The shell's own settings and the manual's starting value of each (§19.11: The last minutes, 10, Method, This project). */
export const CAPTURE_VIEW: Readonly<Record<string, Value>> = {source: 'minutes', minutes: 10, form: 'method', scope: 'project'}
const CAPTURE_LOCAL = [...Object.keys(CAPTURE_VIEW), 'name', 'acceptAsk'] as const

/** A proposal that waits in AIKit's inbox: its candidate, its proposed id and the state its kept body names. */
export interface WaitingProposal {
  readonly candidate: string
  readonly proposedId?: string
  readonly state?: 'ready' | 'held'
  readonly title?: string
}

/** The kinds of member Capture skill proposes (§19.11 Form: Method · Skill), as a proposed id names its kind. */
const FORMS = new Set(['method', 'skill'])
const evidenceOf = (item: Obj, label: string): string | undefined =>
  (Array.isArray(item.evidence) ? item.evidence : []).flatMap(row => (isObj(row) && row.label === label && str(row.value) ? [String(row.value)] : []))[0]

/** The newest open capture candidate of AIKit's inbox whose proposed id is a Method or a Skill, with the state its kept body names (the
 * `ready` or `quarantine` directory, CandidateState::directory). Null when none waits; undefined when the reading is not the inbox. Pure. */
export function waitingProposal(inbox: unknown): WaitingProposal | null | undefined {
  if (!isObj(inbox) || !Array.isArray(inbox.items)) return undefined
  const open = inbox.items.filter((item): item is Obj => isObj(item) && item.kind === 'capture-candidate' && isObj(item.state) && item.state.state === 'open')
    .filter(item => FORMS.has((evidenceOf(item, 'proposed-id') ?? '').split('/')[0]!))
    .sort((a, b) => String(b.created ?? '').localeCompare(String(a.created ?? '')))
  const item = open[0]
  const candidate = item ? evidenceOf(item, 'candidate') : undefined
  if (!item || !candidate) return null
  const body = (Array.isArray(item.evidence) ? item.evidence : []).flatMap(row => (isObj(row) && row.evidence === 'file' && str(row.path) ? [String(row.path)] : []))[0] ?? ''
  const state = /\/inbox\/ready\//.test(body) ? 'ready' : /\/inbox\/quarantine\//.test(body) ? 'held' : undefined
  const proposedId = evidenceOf(item, 'proposed-id')
  return {candidate, ...(proposedId ? {proposedId} : {}), ...(state ? {state} : {}), ...(str(item.title) ? {title: String(item.title)} : {})}
}

export interface CaptureSkillInput {
  /** AIKit's inbox (aikit_read {inbox}) as the window holds it. */
  readonly inbox: {readonly status: 'reading' | 'answered' | 'refused'; readonly value: unknown; readonly error: string | null}
  readonly holds: ChainHolds
}

/** The writes through AIKit (ownerRoutes.ts aikit_write). Absent: no carrier stands. */
export interface CaptureSkillPorts {
  readonly promote?: (candidate: string, id: string | undefined) => Promise<unknown>
}

export function captureSkillValues(input: CaptureSkillInput): Values {
  const values: Record<string, Value> = {marks: SHELL_MARK_SET}
  const view = viewHolds(input.holds, CAPTURE_SKILL_ID)
  for (const key of CAPTURE_LOCAL) { const held = view[key] ?? CAPTURE_VIEW[key]; if (held !== undefined) values[key] = held }
  if (input.inbox.status === 'refused') values.light = 'dark'
  if (input.inbox.status !== 'answered') return values
  const waiting = waitingProposal(input.inbox.value)
  if (waiting === undefined) return values
  values.light = 'lit'
  if (!waiting) return values
  if (waiting.state) values.proposal = waiting.state
  if (values.name === undefined && waiting.proposedId) values.name = waiting.proposedId
  return values
}

export function captureSkillBinding(input: CaptureSkillInput, ports: CaptureSkillPorts = {}): DesignBinding {
  const values = captureSkillValues(input)
  const waiting = input.inbox.status === 'answered' ? waitingProposal(input.inbox.value) : undefined
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(CAPTURE_ABSENT)) standing[key] = {disabled: why}
  for (const [key, why] of Object.entries(CAPTURE_REFUSE)) standing[key] = {disabled: why}
  const inboxWhy = input.inbox.status === 'refused' ? refusalWords(input.inbox.error ?? 'AIKit refused its inbox.')
    : input.inbox.status === 'reading' ? 'AIKit\'s inbox has not answered yet (`aikit inbox`).'
      : waiting === undefined ? '`aikit inbox` answered something other than its inbox.'
        : !waiting ? 'No Method or Skill waits in AIKit\'s inbox (`aikit inbox` lists no open capture candidate of either kind).'
          : 'AIKit keeps the waiting candidate\'s body in neither its ready nor its quarantine directory, so its state is not read.'
  if (!('proposal' in values)) standing.proposal = {disabled: inboxWhy}
  if (!('light' in values)) standing.light = {disabled: inboxWhy}
  const acceptWhy = !ports.promote ? 'Accept: the kernel carrier is unavailable here, so AIKit cannot be asked (`aikit promote` through the kernel\'s aikit_write).'
    : !waiting ? inboxWhy : waiting.state === 'held' ? 'Accept: AIKit holds this proposal for a possible secret, and a held proposal is never promoted.' : null
  if (acceptWhy) standing.accept = {disabled: acceptWhy}
  const accept = async () => {
    if (acceptWhy || !waiting || !ports.promote) throw Error(acceptWhy ?? inboxWhy)
    const name = viewHolds(chainHolds(), CAPTURE_SKILL_ID).name ?? waiting.proposedId
    await ports.promote(waiting.candidate, typeof name === 'string' && name.trim() ? name.trim() : undefined)
  }
  return {
    id: CAPTURE_SKILL_ID,
    values,
    standing,
    local: Object.fromEntries(CAPTURE_LOCAL.map(key => [key, (value: Value | undefined) => holdView(CAPTURE_SKILL_ID, key, value)])),
    writes: key => key === 'accept' || key in CAPTURE_REFUSE || key.startsWith('step:'),
    write: async (changes: readonly ValueChange[]) => {
      for (const {key} of changes) {
        if (key === 'accept') { await accept(); continue }
        if (key.startsWith('step:')) throw Error(CAPTURE_ABSENT.steps)
        throw Error(CAPTURE_REFUSE[key as keyof typeof CAPTURE_REFUSE] ?? reading(key))
      }
    },
  }
}
