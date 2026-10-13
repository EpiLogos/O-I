import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'

/** AIKit — what agents can do (skills, skillsets, knowledge route, agency gateway). */
export function aiKitFamilyManifest(): FamilyManifest {
  return admitFamilyManifest({
    id: 'ai-kit',
    browser: ['agents', 'skillsets', 'skills'],
    faces: [
      {id: 'skillset-rack', presentations: ['compact', 'expanded'], liveSemantic: 'rack', invariant: {chains: ['skill-device'], chainSelector: 'skill (admit light)'}, note: 'Skills as chains with admit lights; macros Thoroughness, Test depth, Reach, Risk.'},
      {id: 'skill-device', presentations: ['compact', 'expanded'], liveSemantic: 'device-audio-fx', invariant: {transforms: 'the agent turn passing the skillset chain (the turn passes on)'}, note: 'Single skill on a chain; disclosure law as admit light.'},
      {id: 'knowledge-route', presentations: ['compact', 'expanded'], liveSemantic: 'device-audio-fx', invariant: {transforms: 'the agent\'s context reach (knowledge bounds on the World device)'}, note: 'Reads and knowledge bounds on context-world device (shared face with Central).'},
      {id: 'agency-gateway', presentations: ['compact'], liveSemantic: 'return', invariant: {routesTo: 'kernel:harness_agent_control'}, note: 'AIKit harness gateway; kernel HarnessAgentRead/Control (#618).'},
      {id: 'capture-skill', presentations: ['compact'], liveSemantic: 'capture', note: 'Transport Capture → skill proposal.'},
    ],
    params: {grammar: 'aikit/parameter-address/v1'},
    projections: ['aikit-session-track-adapter'],
    inspectors: ['skill-pool', 'methodology-loader'],
    time: {consumes: ['transport'], contributes: ['skill-admissions']},
    telemetry: 'aikit.disclosure.effective',
  })
}
