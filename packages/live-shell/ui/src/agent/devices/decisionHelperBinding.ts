// The Decision helper on its owners (T-AGENCY K5; manual §19.20, ai-kit:decision-helper, "a team's chain in Factory, after its
// members"): the catalogue's design drawn on what AIKit and Quaternal Logic report, nothing else.
//   Provider, model, place, state, independence, price: AIKit's decision provider (`aikit decide status`, kernel op decision_status,
//     aikit.decision-status/v1): `mode` → Provider, `selected_model` → the model, `decision_model.base` → its base, `placement` →
//     where it runs, `install.state` → loaded or not (the light), `independent_of_acting_models`, `limits.tariff` → no price here.
//   Instruments: the team space (`ql context-frame team-space`, kernel op team_space, ql.vak-team-space/v1): each instrument's organ,
//     the rows it is asked at (`cells`), the labels of its head — or, with several heads, the heads' fields — and whether only the
//     person answers it (`answerable_by: person-only`, the collaboration gate).
// What no owner reports is absent (a key with no reading is unknown, manual §16.11): the question asked last and its answer, today's
// log and the counts (no owner records the helper's invocations yet), When and Deadline (no owner holds them), each instrument's
// measured admission. Every write stands disabled with the operation it lacks. Pure, apart from the view's own hold.
import type {DesignBinding, Standing, Value, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {holdView, viewHolds, type ChainHolds} from './designBindings'
import {familyFaceDevice} from './mainTrackBindings'

export const DECISION_HELPER_DESIGN = 'ai-kit:decision-helper'
export const DECISION_HELPER_ID = 'factory:decision-helper'

/** The helper as a device of the runtime, of AIKit's admitted face; null when the family does not admit it. */
export const decisionHelperDevice = (): DeviceInstance | null =>
  familyFaceDevice(DECISION_HELPER_ID, 'ai-kit', 'decision-helper', 'Decision helper', 'select')

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`

/** Each write the design offers, refused with the operation it lacks. */
export const DECISION_HELPER_REFUSE = {
  provider: missing('Provider', 'the decision provider election, ai-kit:local-services:decision.provider, through the kernel', 'AIKit'),
  when: missing('When', 'a team\'s Background or Before-the-act setting for its helper', 'Quaternal Logic'),
  deadline: missing('Deadline', 'a team\'s answer deadline for its helper', 'Quaternal Logic'),
  probe: missing('Probe', '`aikit decide status --probe` through the kernel (it asks the model once)', 'AIKit'),
} as const
const ALLOW = missing('The instrument\'s request', 'a team\'s per-instrument request to its helper', 'Quaternal Logic')

/** AIKit's mode, as the design's Provider. A mode the design does not name is left unknown. */
const PROVIDER_OF_MODE: Readonly<Record<string, string>> = {'managed-local': 'local', 'self-hosted': 'endpoint', endpoint: 'endpoint', hosted: 'hosted', none: 'none'}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const text = (x: unknown): string | undefined => (typeof x === 'string' && x.trim() ? x : undefined)

/** An instrument's name from its id, in the manual's words (§19.20's table): `gate-3` → "Gate 3 reading". Pure. */
export function instrumentName(id: string): string {
  if (id === 'vak-block') return 'Vāk block'
  const gate = /^gate-(\d+)$/.exec(id)
  if (gate) return `Gate ${gate[1]} reading`
  const words = id.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The team space's instruments as the design reads them (catalogue/panels/ai-kit__decision-helper.tsx `Instrument`). Pure. */
export function teamInstruments(teamSpace: unknown): Record<string, unknown>[] | undefined {
  if (!isObj(teamSpace) || !Array.isArray(teamSpace.instruments)) return undefined
  return teamSpace.instruments.flatMap((raw): Record<string, unknown>[] => {
    if (!isObj(raw) || typeof raw.id !== 'string') return []
    const heads = Array.isArray(raw.heads) ? raw.heads.filter(isObj) : []
    const labels = heads.length === 1
      ? (Array.isArray(heads[0]!.labels) ? heads[0]!.labels : []).flatMap(label => (isObj(label) && typeof label.id === 'string' ? [label.id] : []))
      : heads.flatMap(head => (typeof head.field === 'string' ? [head.field] : []))
    const cells = Array.isArray(raw.cells) ? raw.cells.filter((cell): cell is string => typeof cell === 'string') : []
    const organ = text(raw.organ)?.replace(/^S\d′\s*/, '')
    return [{id: raw.id, name: instrumentName(raw.id), ...(organ ? {organ} : {}), ...(cells.length ? {cf: cells.join(' · ')} : {}),
      labels, ...(raw.answerable_by === 'person-only' ? {person: true} : {})}]
  })
}

export interface DecisionHelperInput {
  /** AIKit's `aikit.decision-status/v1`, or null while unread or refused. */
  readonly status: unknown
  /** QL's `ql.vak-team-space/v1`, or null while unread or refused. */
  readonly teamSpace: unknown
  readonly holds: ChainHolds
}

/** The design's values from the two readings. Pure. */
export function decisionHelperValues({status, teamSpace, holds}: DecisionHelperInput): Values {
  const values: Record<string, Value> = {}
  const put = (key: string, value: Value | undefined) => { if (value !== undefined) values[key] = value }
  if (isObj(status)) {
    const install = isObj(status.install) ? status.install : {}
    const model = isObj(status.decision_model) ? status.decision_model : {}
    const limits = isObj(status.limits) ? status.limits : {}
    const state = text(install.state)
    put('light', state === undefined ? undefined : state === 'loaded' ? 'lit' : 'dark')
    put('provider', typeof status.mode === 'string' ? PROVIDER_OF_MODE[status.mode] : undefined)
    put('model', text(status.selected_model))
    put('base', text(model.base))
    put('where', text(status.placement))
    put('state', state)
    put('independent', typeof status.independent_of_acting_models === 'boolean' ? status.independent_of_acting_models : undefined)
    // The tariff says a local or self-hosted endpoint has no price source; the device shows none (§19.20 rules).
    put('price', typeof limits.tariff === 'string' && limits.tariff.startsWith('none') ? 'none' : text(limits.tariff))
  }
  const instruments = teamInstruments(teamSpace)
  if (instruments) values.instruments = JSON.stringify(instruments)
  const chosen = viewHolds(holds, DECISION_HELPER_ID).chosen
  if (chosen !== undefined) values.chosen = chosen
  return values
}

const reading = (key: string) => `${key} is a reading: its owner reports it; nothing here changes it.`

export function decisionHelperBinding(input: DecisionHelperInput): DesignBinding {
  const values = decisionHelperValues(input)
  const instruments = teamInstruments(input.teamSpace) ?? []
  const standing: Record<string, Standing> = Object.fromEntries([
    ...Object.entries(DECISION_HELPER_REFUSE).map(([key, why]) => [key, {disabled: why}] as const),
    ...instruments.map(instrument => [`allow:${String(instrument.id)}`, {disabled: ALLOW}] as const),
  ])
  const refusal = (key: string): string => (key.startsWith('allow:') ? ALLOW : DECISION_HELPER_REFUSE[key as keyof typeof DECISION_HELPER_REFUSE] ?? reading(key))
  return {
    id: DECISION_HELPER_ID,
    values,
    standing,
    local: {chosen: value => holdView(DECISION_HELPER_ID, 'chosen', typeof value === 'string' ? value : undefined)},
    writes: key => key in DECISION_HELPER_REFUSE || key.startsWith('allow:'),
    write: async changes => {
      for (const {key} of changes) throw Error(refusal(key))
    },
  }
}
