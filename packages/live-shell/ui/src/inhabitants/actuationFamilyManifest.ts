import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'
import type {InhabitantManifest} from './manifest.ts'

/** Actuation — how agents run (harness, effort, heartbeat, gateway transport). */
export function actuationFamilyManifest(): FamilyManifest {
  const manifest: InhabitantManifest = {
    id: 'actuation',
    detachedKinds: ['device'],
    browser: ['gateways'],
    faces: [
      {id: 'gateway', dock: ['dock', 'pop-out'], presentations: ['compact', 'expanded', 'full'], liveSemantic: 'return', invariant: {routesTo: 'kernel:harness_agent_control'}, note: 'Hermes tui_gateway session surface; distinct from AIKit agency gateway and Actuation on frank.'},
      {id: 'gateways-rack', dock: ['dock', 'pop-out'], presentations: ['compact'], liveSemantic: 'rack', invariant: {chains: ['hermes', 'aikit-agency-gateway', 'actuation-frank', 'remote-carrier'], chainSelector: 'gateway'}, note: 'Main-track global rack: Hermes, AIKit agency gateway, Actuation on frank, remote carrier (composed/refused).'},
      {id: 'harness-model', dock: ['dock', 'pop-out'], presentations: ['compact', 'expanded'], liveSemantic: 'device-instrument', invariant: {generates: 'kernel:harness_agent_control'}, note: 'Model and reasoning effort on the agent device face.'},
      {id: 'experiment', dock: ['dock', 'pop-out'], presentations: ['expanded', 'full'], liveSemantic: 'capture', note: 'Declarative run with telemetry capture.'},
      {id: 'frames-monitor', dock: ['dock', 'pop-out'], presentations: ['full'], liveSemantic: 'status', note: 'Frame monitor inspector; also exposed as dock tile.'},
    ],
    params: {grammar: 'actuation/parameter-address/v1'},
    projections: ['actuation-temporal-needle'],
    inspectors: ['frames-tile', 'telemetry-tile', 'spend-meter'],
    time: {
      consumes: ['transport', 'cron'],
      contributes: ['telemetry-events', 'heartbeat-ticks'],
    },
    telemetry: 'actuation.session.telemetry',
  }
  return admitFamilyManifest(manifest)
}
