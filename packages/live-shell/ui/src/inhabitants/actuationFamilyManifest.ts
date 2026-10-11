import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'

/** Actuation — how agents run (harness, effort, heartbeat, gateway transport). */
export function actuationFamilyManifest(): FamilyManifest {
  return admitFamilyManifest({
    id: 'actuation',
    browser: ['gateways'],
    faces: [
      {id: 'gateway', presentations: ['compact', 'expanded', 'full'], note: 'Hermes tui_gateway session surface; distinct from AIKit agency gateway and Actuation on frank.'},
      {id: 'gateways-rack', presentations: ['compact'], note: 'Main-track global rack: Hermes, AIKit agency gateway, Actuation on frank, remote carrier (composed/refused).'},
      {id: 'harness-model', presentations: ['compact', 'expanded'], note: 'Model and reasoning effort on the agent device face.'},
      {id: 'experiment', presentations: ['expanded', 'full'], note: 'Declarative run with telemetry capture.'},
      {id: 'frames-monitor', presentations: ['full'], note: 'Frame monitor inspector; also exposed as dock tile.'},
    ],
    params: {grammar: 'actuation/parameter-address/v1'},
    projections: ['actuation-temporal-needle'],
    inspectors: ['frames-tile', 'telemetry-tile', 'spend-meter'],
    time: {
      consumes: ['transport', 'cron'],
      contributes: ['telemetry-events', 'heartbeat-ticks'],
    },
    telemetry: 'actuation.session.telemetry',
  })
}
