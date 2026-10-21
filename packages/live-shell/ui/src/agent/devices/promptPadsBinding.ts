// Prompt pads on their owner (lane W7; DLW §19.22, software-factory:prompt-pads — "Kind: instrument · Chain: Factory's Main track"). The
// bank is Factory's (factory/src/prompt_pads.rs): `factory development pads <state> <project-ref>` reads it (factory.prompt-pads-reading/v1:
// revision, scheduled_count, slots [{index, pad, next_at_unix_ms, running, last}]); `pads-write` writes one setting of one slot on the
// bank's revision (a person only), `pads-run` records a press's begin and `pads-record` its end, `pads-due` names what a schedule owes.
// No kernel op routes any of them yet (lane W3's builder routes Factory's pads next, T-COVERAGE §1.2's Software Factory row "factory
// development pads, pads-write, pads-run, pads-record, pads-due"), so every reading of the bank stands absent and every write disabled,
// each naming its command. The bank shown and the pad you read are the shell's own holds. Pure, apart from the view holds.
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {holdView, viewHolds, type ChainHolds} from './designBindings'
import {familyFaceDevice} from './mainTrackBindings'

export const PROMPT_PADS_DESIGN = 'software-factory:prompt-pads'
export const PROMPT_PADS_ID = 'factory:main:prompt-pads'

/** Prompt pads as a device of the runtime: Software Factory's `prompt-pads` face, once the family admits it (softwareFactoryFamilyManifest.ts
 * does not yet: null until it does, and the Main track draws no plate for it). */
export const promptPadsDevice = (): DeviceInstance | null => familyFaceDevice(PROMPT_PADS_ID, 'software-factory', 'prompt-pads', 'Prompt pads', 'keys')

const missing = (what: string, op: string) => `${what}: no owner operation carries it yet — missing op: ${op} through the kernel (T-COVERAGE §1.2; not routed yet) (Software Factory).`
const unread = (what: string, op: string) => `${what}: no reading reaches it yet — missing op: ${op} through the kernel (T-COVERAGE §1.2; not routed yet) (Software Factory).`

const PADS = '`factory development pads <state> <project-ref>`'
const WRITE = '`factory development pads-write` (one setting of one slot, on the bank\'s revision)'

/** The bank's readings, each absent with the read it waits for. */
export const PADS_ABSENT: Readonly<Record<string, string>> = {
  light: unread('The bank\'s light', PADS),
  revision: unread('The bank\'s revision', PADS),
  pads: unread('The sixteen pads', PADS),
  projects: unread('The banks to choose from', `${PADS} for each project (it reads one bank; nothing lists the projects with a bank)`),
  sessions: unread('The sessions a pad may start on', `${PADS}'s project sessions`),
  agents: unread('The agents a pad may open a session with', `${PADS}'s roster for the bank`),
  scopes: unread('The scopes a pad may run under', `${PADS}'s scopes for the bank`),
  seats: unread('The seats a pad may work in', `${PADS}'s seats for the bank`),
}

/** The selected pad's settings: each is the bank's reading and is written alone through pads-write. */
export const PAD_SETTINGS: readonly string[] = ['name', 'prompt', 'session', 'agent', 'scope', 'seat', 'runsAt', 'at', 'days', 'every', 'choke']
const SETTING_WORD: Readonly<Record<string, string>> = {name: 'Name', prompt: 'Prompt', session: 'Session', agent: 'Agent', scope: 'Scope', seat: 'Works in',
  runsAt: 'Runs at', at: 'The time', days: 'The days', every: 'Every', choke: 'Choke'}

/** The acts, each disabled with its command. */
export const PADS_REFUSE: Readonly<Record<string, string>> = {
  ...Object.fromEntries(PAD_SETTINGS.map(key => [key, missing(SETTING_WORD[key]!, WRITE)])),
  press: missing('Run now', '`factory development pads-run` (the press\'s begin) and `pads-record` (its end)'),
  clear: missing('Clear', `${WRITE} emptying the slot`),
}

/** The shell's own holds: the bank shown and the pad you read. */
const PADS_LOCAL = ['project', 'pad'] as const

export function promptPadsValues(holds: ChainHolds): Values {
  const values: Record<string, Value> = {}
  const view = viewHolds(holds, PROMPT_PADS_ID)
  for (const key of PADS_LOCAL) if (view[key] !== undefined) values[key] = view[key]!
  return values
}

/** The binding: the bank unread, every write refused with its command, the bank and the pad the hand's. */
export function promptPadsBinding(holds: ChainHolds): DesignBinding {
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(PADS_ABSENT)) standing[key] = {disabled: why}
  for (const [key, why] of Object.entries(PADS_REFUSE)) standing[key] = {disabled: why}
  return {
    id: PROMPT_PADS_ID,
    values: promptPadsValues(holds),
    standing,
    local: Object.fromEntries(PADS_LOCAL.map(key => [key, (value: Value | undefined) => holdView(PROMPT_PADS_ID, key, value)])),
    writes: key => key in PADS_REFUSE,
    write: async (changes: readonly ValueChange[]) => {
      for (const {key} of changes) throw Error(PADS_REFUSE[key] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
    },
  }
}
