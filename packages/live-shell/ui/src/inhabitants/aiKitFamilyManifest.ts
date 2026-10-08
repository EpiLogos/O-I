import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'

/** AIKit — what agents can do (skills, skillsets, knowledge route, agency gateway). */
export function aiKitFamilyManifest(): FamilyManifest {
  return admitFamilyManifest({
    id: 'ai-kit',
    browser: ['agents', 'skillsets', 'skills'],
    faces: [
      {id: 'skillset-rack', presentations: ['compact', 'expanded'], note: 'Skills as chains with admit lights; macros Thoroughness, Test depth, Reach, Risk.'},
      {id: 'skill-device', presentations: ['compact', 'expanded'], note: 'Single skill on a chain; disclosure law as admit light.'},
      {id: 'knowledge-route', presentations: ['compact', 'expanded'], note: 'Reads and knowledge bounds on context-world device (shared face with Central).'},
      {id: 'agency-gateway', presentations: ['compact'], note: 'AIKit harness gateway; kernel HarnessAgentRead/Control (#618).'},
      {id: 'capture-skill', presentations: ['compact'], note: 'Transport Capture → skill proposal.'},
    ],
    params: {grammar: 'aikit/parameter-address/v1'},
    projections: ['aikit-session-track-adapter'],
    inspectors: ['skill-pool', 'methodology-loader'],
    time: {consumes: ['transport'], contributes: ['skill-admissions']},
    telemetry: 'aikit.disclosure.effective',
  })
}
