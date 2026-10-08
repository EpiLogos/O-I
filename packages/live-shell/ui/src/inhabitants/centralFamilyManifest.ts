import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'

/** Central — the ground the agents stand on (identity, context world, ground subjects). */
export function centralFamilyManifest(): FamilyManifest {
  return admitFamilyManifest({
    id: 'central',
    browser: ['ground', 'agents'],
    faces: [
      {id: 'context-world', presentations: ['compact', 'expanded'], note: 'Context-world device face: reads the Central ground (teal), writes context (amber). Shared face — ai-kit owns the knowledge route, software-factory the write mode and receipts.'},
      {id: 'agent-identity', presentations: ['compact'], note: 'Agent identity read from the kernel roster (central.agent-profile-roster/v1); read-only, never a hardcoded crowd.'},
    ],
    params: {grammar: 'central/parameter-address/v1'},
    projections: ['central-roster-track-adapter'],
    inspectors: ['file-tile', 'graph-tile', 'roster-tile'],
    time: {
      consumes: ['civil-time'],
      contributes: ['roster-revisions'],
    },
    telemetry: 'central.ground.observations',
  })
}
