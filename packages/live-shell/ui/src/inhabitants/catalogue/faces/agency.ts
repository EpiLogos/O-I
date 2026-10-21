// The agent types (manual §19.4 Type, §19.1 Agent types in the browser, §25.6), typed over the face rig's agency ontology
// (faces/vendor/creature-agency.js: CREATURE-SPEC.md Part II as data). The ontology is the source; what this file adds is
//   - the types the device draws from it (a pattern, a family, a run state);
//   - `presetRows`: a pattern as a preset of the devices an agent already has, row by row, where each field lands and what has no
//     setting yet. The machine form's own `preset()` does this from the spec as accepted on 19 October; `presetRows` follows the
//     owner operations as they stand (checked 20 October, see the comment on Join), so it differs in two places, both marked.
import {agency} from './vendor'

export type RunState = 'queued' | 'thinking' | 'acting' | 'waiting' | 'stalled' | 'producing' | 'done' | 'failed'
export interface RunStateInfo {readonly id: RunState; readonly breath: boolean; readonly what: string}
export interface Pattern {
  readonly id: string; readonly name: string; readonly family: string; readonly does: string
  readonly start: string; readonly stay: string; readonly count: string; readonly reach: string; readonly link: string; readonly join: string; readonly change: string
  readonly animals: readonly string[]; readonly breaks: string; readonly asks: string
}
export interface Family {readonly id: string; readonly name: string; readonly patterns: readonly Pattern[]}
export interface Hazard {readonly id: string; readonly name: string; readonly animal: string; readonly breaks: string; readonly of: string | null}

// No ontology where no page loaded it (a Node test suite): the types are empty, nothing is invented.
const A = agency() ?? {RUN_STATES: [], PATTERNS: {}, FAMILIES: [], HAZARDS: []}
export const RUN_STATES: readonly RunStateInfo[] = A.RUN_STATES
export const PATTERNS: Readonly<Record<string, Pattern>> = A.PATTERNS
export const FAMILIES: readonly Family[] = A.FAMILIES.map((f: {id: string; name: string; patterns: string[]}) => ({id: f.id, name: f.name, patterns: f.patterns.map(id => A.PATTERNS[id] as Pattern)}))
export const HAZARDS: readonly Hazard[] = A.HAZARDS
export const FIELD_NAMES = ['Start', 'Stay', 'Count', 'Reach', 'Link', 'Join', 'Change', 'Failure'] as const
export type FieldName = (typeof FIELD_NAMES)[number]

const first = (v: string) => v.split(/[ ,]/)[0]!
/** One, Pair, Crew or Swarm: the first word of the pattern's Count. */
export const countOf = (p: Pattern): 'One' | 'Pair' | 'Crew' | 'Swarm' => first(p.count) as 'One' | 'Pair' | 'Crew' | 'Swarm'
/** A crew is a pattern whose Count is Pair, Crew or Swarm (the Agentset rack's face); the rest are one agent's. */
export const isCrew = (p: Pattern) => countOf(p) !== 'One'
export const hazardOf = (p: Pattern): Hazard | undefined => HAZARDS.find(h => h.of === p.id)

/** Where a value lands: a setting of a device an agent already has, in the manual's words. `key` and `to` are set only for the
 * Agent's own settings, which the Identity page writes when you choose a type; the others are written by their own devices. */
export interface Land {readonly device: string; readonly setting: string; readonly value: string; readonly key?: string; readonly to?: boolean | string | number}
export interface PresetRow {
  readonly field: FieldName
  /** The pattern's value for the field, in the spec's words. */
  readonly value: string
  /** The settings that take it; empty when the field asks nothing of a setting (a plain default) or has none. */
  readonly lands: readonly Land[]
  /** Why there is no setting for it; present when the field is shown named and dark. */
  readonly dark?: string
}

const AGENT = 'Agent', SCOPE = 'Scope', RACK = 'Agentset rack', LAUNCH = 'Task · Launch', GATE = 'Agency gateway', PADS = 'Prompt pads'
export function presetRows(p: Pattern): PresetRow[] {
  const start = first(p.start), stay = first(p.stay), count = first(p.count), reach = /Write/.test(p.reach) ? 'Write' : /Draft/.test(p.reach) ? 'Draft' : 'Read', link = first(p.link), join = p.join
  const rows: PresetRow[] = []
  rows.push({field: 'Start', value: p.start, ...(start === 'Standing' ? {lands: [{device: AGENT, setting: 'Power', value: 'On', key: 'light', to: 'lit'}, {device: AGENT, setting: 'Heartbeat', value: 'On', key: 'heartbeat', to: true}]}
    : start === 'Spawned' ? {lands: [{device: RACK, setting: 'Members', value: 'spawned by the lead'}]}
    : start === 'Timed' ? {lands: [{device: PADS, setting: 'Time', value: 'a time of day'}]}
    : start === 'Called' ? {lands: [{device: LAUNCH, setting: 'Launch', value: 'Once'}]}
    : {lands: [], dark: 'Nothing starts an agent on an event: no trigger setting.'})})
  rows.push({field: 'Stay', value: p.stay, lands: stay === 'Task' ? [{device: LAUNCH, setting: 'Then', value: 'Next task, or Hand off'}]
    : stay === 'Budget' ? [{device: AGENT, setting: 'Budget', value: 'a number of turns'}]
    : stay === 'Condition' ? [{device: LAUNCH, setting: 'Launch', value: 'Loop, until its stop condition'}] : [{device: AGENT, setting: 'Budget', value: 'no end: Heartbeat stays on'}]})
  rows.push({field: 'Count', value: p.count, lands: count === 'One' ? [] : count === 'Swarm' ? [{device: RACK, setting: 'Fan-out', value: 'No limit'}, {device: RACK, setting: 'Hand-back', value: 'Digest'}]
    : [{device: RACK, setting: 'Fan-out', value: count === 'Pair' ? '2' : 'a number'}]})
  rows.push({field: 'Reach', value: p.reach, lands: reach === 'Read' ? [{device: SCOPE, setting: 'Writes', value: 'none'}]
    : reach === 'Draft' ? [{device: SCOPE, setting: 'Write mode', value: 'Draft'}] : [{device: SCOPE, setting: 'Write mode', value: 'Direct'}, {device: 'Transport', setting: 'Arm', value: 'On'}]})
  rows.push({field: 'Link', value: p.link, ...(link === 'Parent' ? {lands: [{device: RACK, setting: 'Hand-back', value: 'Summary'}]}
    : link === 'Peer' ? {lands: [{device: GATE, setting: 'Agent to agent', value: 'Allow'}]}
    : link === 'Place' ? {lands: [{device: 'Ledger', setting: 'the shared record', value: 'read and written'}], dark: 'The Ledger keeps no marks that fade, so a Trail has no decay.'}
    : link === 'Many' ? {lands: [], dark: 'No setting lets an agent read its nearest neighbours.'} : {lands: []})})
  // Join. The accepted spec (19 October) found no combining rule at all. The owner operations show one: Software Factory's barrier waits
  // until every leg it names has returned (orchestration.rs `barrier_reading`: Pending, Complete, Failed), and Hermes' delegate_task
  // returns every child's result to the parent. So All has a setting; First, Quorum and Weighted have none.
  rows.push({field: 'Join', value: join, ...(join === 'All' ? {lands: [{device: RACK, setting: 'Join', value: 'All'}]}
    : join === 'None' ? {lands: []} : {lands: [], dark: `No owner combines returns by ${join.toLowerCase()}: Software Factory's barrier waits for all.`})})
  rows.push({field: 'Change', value: p.change, ...(p.change === 'Same' ? {lands: []} : {lands: [], dark: 'A member keeps its role card; nothing changes it in a run.'})})
  rows.push({field: 'Failure', value: p.breaks, lands: []})
  return rows
}
/** The settings of the Agent's own that a type writes when you choose it. */
export const agentWrites = (p: Pattern): readonly Land[] => presetRows(p).flatMap(r => r.lands.filter(l => l.key !== undefined))
/** How many fields have a setting, and how many are shown dark, for a pattern. */
export const presetCounts = (p: Pattern) => { const rows = presetRows(p).filter(r => r.field !== 'Failure'); return {set: rows.filter(r => r.lands.length > 0).length, dark: rows.filter(r => r.dark !== undefined).length} }
