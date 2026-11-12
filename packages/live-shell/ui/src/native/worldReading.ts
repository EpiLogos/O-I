import type {ShellConfig} from './application'

/** The world the shell can open its work on: Central's root world, with its ground and this computer's Workcell. */
export function qualifiedWorld(reading: ShellConfig | null): reading is ShellConfig & {world_scope: NonNullable<ShellConfig['world_scope']> & {workcell_ref: string}} {
  const world = reading?.world_scope
  return world?.owner === 'central' && world.world === 'control:root'
    && typeof world.personal_ground === 'string' && !!world.personal_ground
    && typeof world.workcell_ref === 'string' && !!world.workcell_ref
}

/** Setup is still under way: the world has no ground yet (the host's `onboarding`), or Setup's Ground step has made one and this computer
 * is not yet a Workcell of it (Setup's Machines step does that, manual §10.11). Either way Setup stays open on its next step and nothing
 * is drawn as a fault; a host that could not read the world (`world_error`) is a fault. */
export function setupUnfinished(reading: ShellConfig | null): boolean {
  if (!reading || reading.world_error) return false
  if (reading.onboarding) return true
  const world = reading.world_scope
  return !!world && typeof world.personal_ground === 'string' && !!world.personal_ground && !(typeof world.workcell_ref === 'string' && world.workcell_ref)
}
