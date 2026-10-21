// The Skillset rack's owner readings and the configuration plane's two acts (lane BF; DLW §19.7). Read through the kernel's own
// operations, each run against the installed owners on 16 Oct and its real shape kept in the lane's scratch (`shapes/`):
//   agent_definition {skillset, name} — `aikit --json set show <name>`: projected[], withheld[{capability, reason}], child_refs[],
//                                       revision (agent_definition.rs:294-297, agency.rs:234-280 set_reading);
//   agent_definition {skillsets}      — `aikit --json set list`: sets[{name, members, projected, withheld, summary}];
//   agent_definition {skills}         — `aikit session-space -C <cwd> agent-session-skills`: rows[{ref, name, description,
//                                       revision, eligible, reason_code, source}] (agency.rs:333-380 direct_agent);
//   config_resolutions_read           — `oi config resolve --request-file - --json` (configuration.rs:516-596): one
//                                       oi.config-resolution/v1 per pair, {desired?, native{active, declared, effective}}.
// The writes: config_plan_reviewed (`oi config plan`, configuration.rs:690-727: owner plans, nothing moves) and
// config_apply_reviewed (`oi config apply`, :742-780: the admitted ChangeSet, verified by re-read, receipts back).
//
// Read only while `enabled` (a design that draws the owner's members): the plane's resolve is the heaviest read the rack has
// (14 s on this machine, 16 Oct), so nothing is asked of it for a device that does not draw it.
import {useEffect, useMemo, useState} from 'react'
import {kernelOp, kernelRead} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {ChangeSetDocumentWire, ConfigRequestWire, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {planeScope, type ComposePlan, type ComposePorts, type ComposeScope} from './designBindings'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : []

/** The project the Factory sessions are read in (AgentSessionsProvider.tsx:21 PROJECT). */
export const RACK_PROJECT = 'O-I'

export interface RackReading {
  readonly sets: Readonly<Record<string, unknown>>
  readonly setList: unknown
  readonly skills: unknown
  readonly capabilities: unknown
  readonly profiles: unknown
  /** The owners' refusals, by what was read. */
  readonly refused: Readonly<Record<string, string>>
}

const NONE: RackReading = {sets: {}, setList: null, skills: null, capabilities: null, profiles: null, refused: {}}

async function definition(transport: KernelTransportStatus, request: {action: 'skillsets' | 'skills'} | {action: 'skillset'; name: string}): Promise<{value?: unknown; error?: string}> {
  const result = await kernelRead(transport, {op: 'agent_definition', project: RACK_PROJECT, request})
  if (result.error || result.outcome?.result !== 'agent_definition_reading') return {error: result.error ?? 'AIKit did not answer the reading'}
  return {value: result.outcome.data}
}

/** The rack's readings for the seated agent's profile, at the composition's scope (Project when none is chosen yet: the
 * capability horizon AIKit resolves is the same at every scope; only the held intent differs). */
export function useRackReading(transport: KernelTransportStatus, profile: {readonly skill_set_refs?: unknown} | null, scope: ComposeScope | undefined,
  sessionRef: string | null, enabled: boolean, epoch: number): RackReading {
  const [reading, setReading] = useState<RackReading>(NONE)
  const sets = useMemo(() => strings(profile?.skill_set_refs).map(ref => ref.replace(/^sets\//, '')).join('\n'), [profile])
  const pairScope = useMemo(() => planeScope(scope ?? 'project', RACK_PROJECT, sessionRef) ?? planeScope('project', RACK_PROJECT, null)!, [scope, sessionRef])
  useEffect(() => {
    if (!enabled || transport.kind === 'unavailable') { setReading(NONE); return }
    let live = true
    void (async () => {
      const refused: Record<string, string> = {}
      const shown: Record<string, unknown> = {}
      for (const name of sets ? sets.split('\n') : []) {
        const answer = await definition(transport, {action: 'skillset', name})
        if (answer.error) refused[`set:${name}`] = answer.error; else shown[name] = answer.value
      }
      const list = await definition(transport, {action: 'skillsets'})
      const skills = await definition(transport, {action: 'skills'})
      if (list.error) refused.setList = list.error
      if (skills.error) refused.skills = skills.error
      const resolved = await kernelRead(transport, {op: 'config_resolutions_read', pairs: [
        {setting_ref: 'ai-kit:skills:skills.capabilities', scope: pairScope},
        {setting_ref: 'ai-kit:resolution:resolution.profiles', scope: pairScope},
      ]})
      const rows = !resolved.error && resolved.outcome?.result === 'config_resolutions' ? resolved.outcome.resolutions : null
      if (!rows) refused.plane = resolved.error ?? 'The configuration plane did not resolve the rack\'s settings'
      const row = (index: number) => (rows && isObj(rows[index]) && (rows[index] as Obj).schema === 'oi.config-resolution/v1' ? rows[index] : null)
      if (live) setReading({sets: shown, setList: list.value ?? null, skills: skills.value ?? null, capabilities: row(0), profiles: row(1), refused})
    })()
    return () => { live = false }
  }, [transport, sets, pairScope, enabled, epoch])
  return reading
}

/** The plane's plan and apply through the kernel, for the rack's Preview and Apply. A refusal comes back in the plane's words. */
export function composePorts(transport: KernelTransportStatus, onApplied: () => void): ComposePorts | null {
  if (transport.kind === 'unavailable') return null
  return {
    plan: async (requests: ConfigRequestWire[]): Promise<ComposePlan> => {
      const result = await kernelOp(transport, {op: 'config_plan_reviewed', requests})
      if (result.error || result.outcome?.result !== 'config_reviewed_planned') throw Error(result.error ?? 'The configuration plane did not plan the composition')
      return {changeset: result.outcome.changeset, plans: result.outcome.plans}
    },
    apply: async (plan: ComposePlan): Promise<void> => {
      // The admitted ChangeSet and its owner plans travel back verbatim (configuration.rs:742-760: reconstruction would change the review basis).
      const result = await kernelOp(transport, {op: 'config_apply_reviewed', changeset: plan.changeset as ChangeSetDocumentWire, plans: [...plan.plans]})
      if (result.error || result.outcome?.result !== 'config_applied') throw Error(result.error ?? 'The configuration plane did not apply the composition')
      onApplied()
    },
  }
}
