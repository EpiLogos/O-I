// What a press on a satellite does (T-PROCEDURAL-BODY §6 item 1; manual §17.2 "Your system": "Open any object in orbit"). An agent at work
// is chosen in the sessions provider; a file an agent made opens through the file route. The ports are the shell's own owners, bound by
// the readings (system/SystemReadings.tsx); a satellite of a kind nothing is in orbit as now, or a port this pane does not hold, is refused
// in words, never a press that does nothing.
import type {SystemBody, SystemSatellite} from './systemModel'

export interface SatellitePorts {
  /** choose an agent session in the sessions provider (absent where the sessions are not read) */
  readonly selectSession?: (sessionRef: string) => void
  /** open the file an artefact is, through the owner's file route, in the world it is in */
  readonly openArtifact?: (artifact: SystemSatellite, body: SystemBody) => Promise<void>
}

export async function openSatellite(satellite: SystemSatellite, body: SystemBody, ports: SatellitePorts): Promise<void> {
  if (satellite.kind === 'session') {
    if (!ports.selectSession) throw Error(`${satellite.name} is an agent at work, but the agent sessions are not read in this pane, so it cannot be chosen from here.`)
    ports.selectSession(satellite.id)
    return
  }
  if (satellite.kind === 'artifact') {
    if (!ports.openArtifact) throw Error(`${satellite.name} is a file an agent made, but this pane has no way to open a file from here.`)
    await ports.openArtifact(satellite, body)
    return
  }
  throw Error(`A ${String(satellite.kind)} does not circle a body, so there is nothing to open.`)
}
