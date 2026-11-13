// AIKit's instrument (manual §19.26; the catalogue's ai-kit__ai-kit.tsx, `ai-kit:ai-kit`): the window onto what a run's agents worked from,
// for the run you select. It stands on no chain: it is born in a pane, and its widget is the rail's AIKit tile (agentDockTiles.ts). Its six
// pages read what the UI already reads, each in its owner's words:
//   Run         the selected track's run (its purpose), and the agent of a lone session with the sets its chain carries and each member as
//               the Skillset rack reads it (the rack's own door values: designBindings.ts rackValues `members`, `carried`), and AIKit's
//               `aikit unused`
//   Context     AIKit's continuity of the run's register and the chosen agent's session (aikitPages.ts contextPressureOf, armedOf,
//               contextTurnOf: `aikit work continuity pressure|commands|turn`)
//   Sources, Adopt, Procedures
//               the Skillset rack's upkeep binding as it stood before the manual gave these pages here (designBindings.ts rackBinding with
//               its RackUpkeep: `aikit source list`, `collate`, `adopt` without --yes, `procedure list|diff`, `bypass list`, and their
//               aikit_write acts), under this instrument's own holds; Preview reads the plan, Cancel drops it
//   Package     AIKit's set list (`aikit set list`, agent_definition skillsets), the set chosen (the agent's first until you choose), the
//               target and the directory, and Export through aikit_write set-package-export
// A key nothing reports is absent with its reason: the views draw "—" and the well names what is missing. The instrument changes no device
// on a chain. Pure: the reads are AikitRailDevice.tsx's.
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import {armedOf, contextPressureOf, contextTurnOf, rootsOf, type AikitAnswer} from './aikitPages'
import {RACK_UPKEEP_SETTINGS, RACK_UPKEEP_WRITES, rackBinding, type RackUpkeep} from './designBindings'
import {holdView, viewHolds, type ChainHolds} from './chainHolds'
import {AIKIT_ID} from './railTileIds'

export {AIKIT_ID}

/** The upkeep readings the instrument carries from the rack's binding, by the design's keys. */
const UPKEEP_READINGS = ['unused', 'sources', 'roots', 'adoption', 'procedures', 'bypasses'] as const
/** The instrument's own holds beyond the upkeep pages': the agent Context reads, the set and target Package writes, the root previewed. */
export const AIKIT_LOCAL = ['agent', 'set', 'target'] as const
/** The package targets AIKit writes (ai-kit__ai-kit.tsx TARGETS). */
const TARGETS = ['openai', 'codex', 'claude', 'pi'] as const

/** Why each of the instrument's own readings is absent. */
export const AIKIT_ABSENT = {
  run: 'No run is selected: select a session\'s or a group\'s track, and the instrument follows it.',
  agents: 'The run\'s agents and what each carried: the Skillset rack reads them on a session\'s chain in Factory, and none stands for this run (select a session\'s track there).',
  group: 'A group\'s agents: each agent\'s members are read on its own session\'s chain; select one of the group\'s sessions to read its agent here.',
  sets: 'The sets Package may write: AIKit\'s `aikit set list` (agent_definition skillsets) is not read here.',
  unsupported: 'What each target cannot carry is the package receipt\'s: Export writes it; no reading names it before the export.',
  notAsked: 'AIKit\'s instrument reads its pages while its tile is open, it is the device chosen, or a session is selected.',
} as const

/** One agent of the run as the design reads it (ai-kit__ai-kit.tsx `agents`). */
export interface InstrumentAgent {readonly id: string; readonly name: string; readonly sessionRef: string}

export interface AikitInstrumentInput {
  readonly holds: ChainHolds
  /** The run the selection names: its words (the track's purpose, else its session), and whether it is a group's. Null: nothing selected. */
  readonly run: {readonly name: string; readonly group: boolean} | null
  /** The lone session's agent; null for a group or no run. */
  readonly agent: InstrumentAgent | null
  /** The Skillset rack's door values for that agent's chain (`members`, `carried`), where its chain stands it. */
  readonly rack: Values | null
  /** Whether the pages are read now (AikitRailDevice.tsx): false stands every reading with why. */
  readonly asked: boolean
  readonly upkeep: RackUpkeep
  /** AIKit's continuity of the run's register, for the chosen agent's session. */
  readonly context?: {readonly pressure?: AikitAnswer; readonly commands?: AikitAnswer; readonly turn?: AikitAnswer}
  /** `aikit set list` (agent_definition skillsets): {sets: [{name}]}. */
  readonly setList?: AikitAnswer
  /** The register Export writes in ('' your world's root register). */
  readonly project: string
}

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const parsed = (value: Value | undefined): unknown => { try { return typeof value === 'string' ? JSON.parse(value) : undefined } catch { return undefined } }
const answerWhy = (answer: AikitAnswer | undefined, absent: string, what: string): string => (answer?.status === 'refused' ? answer.error ?? absent
  : answer?.status === 'reading' ? `AIKit has not answered yet (${what}).` : answer ? `AIKit answered something other than ${what}.` : absent)

/** The set names `aikit set list` answers. Null when the answer is not the list. Pure. */
export function setNamesOf(list: unknown): string[] | null {
  if (!isObj(list) || !Array.isArray(list.sets)) return null
  return list.sets.flatMap(set => (isObj(set) && typeof set.name === 'string' && set.name ? [set.name] : []))
}

/** The run's agents as the design reads them: the lone session's agent with the sets its chain carries and its members as the Skillset
 * rack reads them, and its context pressure where the agent is the one Context reads. Null when no rack reading stands. Pure. */
export function instrumentAgents(agent: InstrumentAgent | null, rack: Values | null, pressure: Obj | null): Obj[] | null {
  if (!agent || !rack) return null
  const members = parsed(rack.members), carried = parsed(rack.carried)
  if (!Array.isArray(members)) return null
  const sets = Array.isArray(carried) ? carried.flatMap(set => (isObj(set) && typeof set.name === 'string' ? [set.name] : [])) : []
  return [{id: agent.id, name: agent.name, sets, members,
    ...(pressure && typeof pressure.consumed === 'number' ? {consumed: pressure.consumed} : {}), ...(pressure && typeof pressure.pressure === 'string' ? {pressure: pressure.pressure} : {})}]
}

/** AIKit's instrument's binding (ai-kit__ai-kit.tsx): the run, its agent and context, and the upkeep pages the Skillset rack's binding
 * carries, under this instrument's holds. Every act is AIKit's own (aikit_write); a reading is never written. */
export function aikitInstrumentBinding(input: AikitInstrumentInput): DesignBinding {
  const view = viewHolds(input.holds, AIKIT_ID)
  // The Adopt page's plan is read only once Preview names the root it is for; Cancel, or a new root or namespace, drops it.
  const previewed = typeof view.adoptPreviewed === 'string' && view.adoptPreviewed === view.adoptRoot
  const upkeep: RackUpkeep = input.asked ? {...input.upkeep, ...(previewed ? {} : {adoption: undefined})} : {...(input.upkeep.write ? {write: input.upkeep.write} : {})}
  const rack = rackBinding(AIKIT_ID, {profile: null, sets: {}, setList: null, skills: null, capabilities: null, profiles: null, holds: input.holds}, null,
    {project: input.project, sessionRef: null}, upkeep)
  const values: Record<string, Value> = {}
  const standing: Record<string, Standing> = {}
  for (const key of [...UPKEEP_READINGS, ...RACK_UPKEEP_SETTINGS]) if (rack.values[key] !== undefined) values[key] = rack.values[key]!
  for (const key of [...UPKEEP_READINGS, ...Object.keys(RACK_UPKEEP_WRITES)]) {
    const held = rack.standing?.[key]
    if (held) standing[key] = !input.asked && (UPKEEP_READINGS as readonly string[]).includes(key) ? {disabled: AIKIT_ABSENT.notAsked} : held
  }
  if (!previewed) delete values.adoption
  for (const key of AIKIT_LOCAL) if (view[key] !== undefined) values[key] = view[key]!

  // The run and its agent.
  if (input.run) values.run = input.run.name; else standing.run = {disabled: AIKIT_ABSENT.run}
  const pressure = input.context?.pressure?.status === 'answered' ? contextPressureOf(input.context.pressure.value) : null
  const agents = instrumentAgents(input.agent, input.rack, pressure)
  if (agents) {
    values.agents = JSON.stringify(agents)
    values.light = 'lit'
  } else standing.agents = {disabled: input.run?.group ? AIKIT_ABSENT.group : input.run ? AIKIT_ABSENT.agents : AIKIT_ABSENT.run}

  // Context: AIKit's continuity for the chosen agent.
  const armed = input.context?.commands?.status === 'answered' ? armedOf(input.context.commands.value) : null
  const turn = input.context?.turn?.status === 'answered' ? contextTurnOf(input.context.turn.value) : null
  if (pressure) values['ctx.pressure'] = JSON.stringify(pressure)
  else standing['ctx.pressure'] = {disabled: !input.agent ? AIKIT_ABSENT.agents : answerWhy(input.context?.pressure, AIKIT_ABSENT.notAsked, '`aikit work continuity pressure`')}
  if (armed) values['ctx.armed'] = JSON.stringify(armed)
  else standing['ctx.armed'] = {disabled: !input.agent ? AIKIT_ABSENT.agents : answerWhy(input.context?.commands, AIKIT_ABSENT.notAsked, '`aikit work continuity commands`')}
  if (turn?.kept) values['ctx.turn'] = JSON.stringify(turn.turn)
  else standing['ctx.turn'] = {disabled: turn && !turn.kept ? `The last turn's bounded blocks: AIKit kept no turn for ${turn.scope ?? 'this session'} (\`aikit work continuity turn\` answered turn: null).`
    : !input.agent ? AIKIT_ABSENT.agents : answerWhy(input.context?.turn, AIKIT_ABSENT.notAsked, '`aikit work continuity turn`')}

  // Package: AIKit's sets, the set chosen (the agent's first until you choose), the target and the directory.
  const sets = input.setList?.status === 'answered' ? setNamesOf(input.setList.value) : null
  if (sets) values.sets = JSON.stringify(sets); else standing.sets = {disabled: input.asked ? answerWhy(input.setList, AIKIT_ABSENT.sets, '`aikit set list`') : AIKIT_ABSENT.notAsked}
  standing.unsupported = {disabled: AIKIT_ABSENT.unsupported}
  const agentSet = agents && Array.isArray(agents[0]?.sets) ? (agents[0]!.sets as string[])[0] : undefined
  const set = typeof view.set === 'string' && view.set ? view.set : agentSet
  const outDir = typeof values.outDir === 'string' ? values.outDir : ''
  const exportWhy = !input.upkeep.write ? 'The kernel carrier is unavailable here, so AIKit cannot be asked (aikit_write).'
    : !set ? 'Export: choose the set to package.' : !outDir.startsWith('/') ? 'Export: name the absolute directory the package is written into (Into).' : null
  if (exportWhy) standing.exported = {disabled: exportWhy}

  const local: Record<string, (value: Value | undefined) => void> = {
    ...Object.fromEntries(Object.entries(rack.local ?? {}).filter(([key]) => (RACK_UPKEEP_SETTINGS as readonly string[]).includes(key))),
    ...Object.fromEntries(AIKIT_LOCAL.map(key => [key, (value: Value | undefined) => holdView(AIKIT_ID, key, value)])),
    // Cancel on the Adopt page: the plan is dropped; the root stays chosen.
    adoption: () => holdView(AIKIT_ID, 'adoptPreviewed', undefined),
  }
  // A root is held by its path (`aikit adopt` takes the path; the design names it by AIKit's label).
  const roots = input.upkeep.collate?.status === 'answered' ? rootsOf(input.upkeep.collate.value) : null
  const rootPath = (value: Value | undefined) => (typeof value === 'string' ? (roots?.find(row => row.root === value && typeof row.path === 'string')?.path as string | undefined) ?? value : undefined)
  const writes = (key: string) => key in RACK_UPKEEP_WRITES || key === 'adoptPreview' || key === 'exported'
  return {
    id: AIKIT_ID,
    values,
    standing,
    local,
    writes,
    write: async (changes: readonly ValueChange[]) => {
      for (const change of changes) {
        if (change.key === 'adoptPreview') {
          // Preview: the plan of the root chosen (a reading, without --yes; nothing moves).
          const path = rootPath(change.value)
          if (!path) throw Error('Preview: choose a root first.')
          holdView(AIKIT_ID, 'adoptRoot', path)
          holdView(AIKIT_ID, 'adoptPreviewed', path)
          continue
        }
        if (change.key === 'exported') {
          if (exportWhy) throw Error(exportWhy)
          const target = String(change.value ?? '')
          if (!(TARGETS as readonly string[]).includes(target)) throw Error('Export: choose the harness to package the set for.')
          await input.upkeep.write!({kind: 'set-package-export', ...(input.project ? {project: input.project} : {}), set: set!, target, out: outDir})
          continue
        }
        if (change.key in RACK_UPKEEP_WRITES) { await rack.write!([change]); continue }
        throw Error(`${change.key} is a reading: AIKit reports it; nothing here changes it.`)
      }
    },
  }
}
