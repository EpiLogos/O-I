// The Agent's Team cell (manual §19.4; actuation__harness-model.tsx `team.space`, `team.row`, `team.question`, `team.depth`; O-I ticket 684): where
// the agent the session names stands in Anima or Aletheia, read from Quaternal Logic's team space (`ql context-frame team-space`,
// `ql.vak-team-space/v1`, QL-MEF crates/ql-mef/src/team_space.rs), through the kernel's team_space (decisionHelperReads.ts, the reading the
// Agentset rack's Helper page shares). By the team space's own rows:
//   team.space     'Anima' where the agent is an Anima voice or S4′'s lead, 'Aletheia' where it is an Aletheia member or S5′'s lead,
//                  'none' where it stands in neither;
//   team.row       the frame of each row it stands in (CF1..CF7), joined where it sits in several (Moirai in three modes);
//   team.question  the question its row asks of it: an Anima voice's Day question (else the Night′ question the voice answers), an
//                  Aletheia member's Night′ question it answers (by its specialist, and its mode where it has one), each with its position;
//   team.depth     the depth domain (M0..M5) whose proving Position is the organ's, for the organ's lead.
// What the team space does not say stays absent, with why: a member's depth (the team space situates an act at a depth, and names one only
// for each organ's proving Position), a row for a lead that sits in none, a question for a seat no row asks one of. Pure, apart from the
// shared reading the hook asks.
import {useMemo} from 'react'
import type {DesignBinding, Standing, Value} from '../../frame/devices/designed'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {useOwnerReading} from '../../owners/ownerReading'
import {useSpineEpoch} from '../../owners/spine'
import {readTeamSpaceOf, teamSpaceKey} from './decisionHelperReads'

export const TEAM_SPACE_CONTRACT = 'ql.vak-team-space/v1'
export const TEAM_KEYS = ['team.space', 'team.row', 'team.question', 'team.depth'] as const

/** The team space as the window holds it: the reading, or none with the owner's words while it refuses. */
export interface TeamSpaceReading {
  readonly space: unknown
  readonly error?: string
}

export interface TeamCell {
  readonly values: Readonly<Record<string, Value>>
  /** Why each key the values lack is absent. */
  readonly standing: Readonly<Record<string, string>>
  /** The team space is not read yet: the cell waits. */
  readonly waiting: boolean
}

type Obj = Record<string, any>
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x)
const list = (x: unknown): Obj[] => (Array.isArray(x) ? x.filter(isObj) : [])
const asked = (q: Obj) => `${q.position} ${q.question}`

const NO_AGENT = 'No agent is seated on this session, so it stands nowhere in the team space.'
const UNREAD = 'Quaternal Logic has not answered its team space yet (`ql context-frame team-space`).'
const NO_TEAM = 'The agent is in no team: the team space names it in neither Anima nor Aletheia.'
const memberDepth = (agent: string) => `The depth ${agent} works at: the team space situates an act at one of six depths and names one only for each organ's `
  + 'proving Position, and no reading here names the Position this agent\'s act stands at.'

/** The cell for one agent, by the team space's own rows and depths. */
export function teamCellOf(reading: TeamSpaceReading, agentRef: string | null): TeamCell {
  const every = (why: string): Record<string, string> => Object.fromEntries(TEAM_KEYS.map(key => [key, why]))
  if (!agentRef) return {values: {}, standing: every(NO_AGENT), waiting: false}
  if (reading.space == null) return {values: {}, standing: every(reading.error ?? UNREAD), waiting: reading.error === undefined}
  const space = reading.space
  if (!isObj(space) || space.contract !== TEAM_SPACE_CONTRACT) return {values: {}, standing: every(`Quaternal Logic answered something that is not its team space (${TEAM_SPACE_CONTRACT}).`), waiting: false}
  const rows = list(space.rows), organs = list(space.organs), depths = list(space.depth)
  const lead = organs.find(organ => organ.lead === agentRef)
  const voiced = rows.filter(row => isObj(row.anima) && row.anima.agent_ref === agentRef)
  const seated = rows.flatMap(row => list(row.aletheia).filter(seat => seat.agent_ref === agentRef).map(seat => ({row, seat})))
  const organ = lead ? String(lead.organ) : voiced.length ? 'Anima' : seated.length ? 'Aletheia' : undefined
  if (!organ) return {values: {'team.space': 'none'}, standing: {'team.row': NO_TEAM, 'team.question': NO_TEAM, 'team.depth': NO_TEAM}, waiting: false}
  const name = organ.includes('Aletheia') ? 'Aletheia' : 'Anima'
  const values: Record<string, Value> = {'team.space': name}
  const standing: Record<string, string> = {}
  const frames = name === 'Anima' ? voiced.map(row => String(row.frame)) : seated.map(({row}) => String(row.frame))
  if (frames.length) values['team.row'] = frames.join(', ')
  else standing['team.row'] = `The lead of ${organ} stands in no frame row of the team space.`
  // The question each row asks of it: Anima's by day (else the Night′ question the voice answers), Aletheia's by night.
  const questions = name === 'Anima'
    ? voiced.flatMap(row => (isObj(row.day) ? [asked(row.day)] : list(row.night).filter(q => q.answered_by === row.anima.voice).map(asked)))
    : seated.flatMap(({row, seat}) => list(row.night).filter(q => q.answered_by === (seat.mode ? `${seat.specialist} as ${seat.mode}` : seat.specialist)).map(asked))
  if (questions.length) values['team.question'] = questions.join(' · ')
  else standing['team.question'] = frames.length ? `The team space asks no question of ${agentRef} at ${frames.join(', ')}.` : `The team space asks no row's question of ${organ}'s lead.`
  // The depth: the domain whose proving Position is the organ's, for its lead.
  const proving = lead?.proving_position
  const depth = typeof proving === 'string' ? depths.find(domain => domain.proving_position === proving) : undefined
  if (depth && Number.isInteger(depth.m)) values['team.depth'] = `M${depth.m} ${depth.faculty}`
  else standing['team.depth'] = memberDepth(agentRef)
  return {values, standing, waiting: false}
}

/** The Agent's binding with its Team cell joined: the cell's keys read (never written), everything else the Agent's own. */
export function withTeamCell(agent: DesignBinding | null, reading: TeamSpaceReading, agentRef: string | null): DesignBinding | null {
  if (!agent) return null
  const cell = teamCellOf(reading, agentRef)
  const standing: Record<string, Standing> = {...agent.standing}
  for (const key of TEAM_KEYS) {
    const why = cell.standing[key]
    standing[key] = {disabled: key in cell.values ? 'A reading: where the agent stands in Quaternal Logic\'s team space.' : why ?? UNREAD}
  }
  const waiting = agent.waiting === true ? true : [...(Array.isArray(agent.waiting) ? agent.waiting : []), ...(cell.waiting ? TEAM_KEYS : [])]
  return {...agent, values: {...agent.values, ...cell.values}, standing, ...(waiting === true || waiting.length ? {waiting} : {}),
    writes: key => !(TEAM_KEYS as readonly string[]).includes(key) && (agent.writes ? agent.writes(key) : !!agent.write)}
}

/** Quaternal Logic's team space through the kernel, the one reading the Helper page shares; `enabled` false reads nothing. */
export function useTeamSpace(transport: KernelTransportStatus, enabled: boolean): TeamSpaceReading {
  const epoch = useSpineEpoch()
  const team = useOwnerReading(enabled ? teamSpaceKey(transport) : null, readTeamSpaceOf(transport), epoch)
  const answered = team.reading.status === 'answered', value = answered ? team.reading.value : null, error = team.reading.error
  // One object per answer: the Agent's binding is composed again only when the team space's answer changes.
  return useMemo(() => (answered ? {space: value} : error ? {space: null, error} : {space: null}), [answered, value, error])
}
