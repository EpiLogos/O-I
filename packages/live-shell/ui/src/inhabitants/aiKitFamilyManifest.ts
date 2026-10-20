import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'
import type {InhabitantManifest} from './manifest.ts'

/** AIKit — what agents can do (skills, skillsets, knowledge route, agency gateway). */
export function aiKitFamilyManifest(): FamilyManifest {
  const manifest: InhabitantManifest = {
    id: 'ai-kit',
    // `skillsets` is carried by browserEntries. `agents` and `skills` stay bare: each overlaps a mockup Factory entry
    // owned by software-factory (factory-agents, factory-knowledge) and no owner has ruled whose they are — OPEN.
    browser: ['agents', 'skills'],
    browserEntries: [
      {id: 'skillsets', label: 'Skillsets', group: 'Ground', mark: 'lib', modes: ['factory'], state: 'waiting',
        hint: 'Accepted skill refs on the agent roster (op agent_definition_reading). The agent shell\'s own Skillsets column reads them; this composed browser has no row source for it yet.'},
    ],
    faces: [
      {id: 'skillset-rack', presentations: ['compact', 'expanded'], liveSemantic: 'rack', invariant: {chains: ['skill-device'], chainSelector: 'skill (admit light)'}, note: 'Skills as chains with admit lights; macros Thoroughness, Test depth, Reach, Risk.'},
      {id: 'skill-device', presentations: ['compact', 'expanded'], liveSemantic: 'device-audio-fx', invariant: {transforms: 'the agent turn passing the skillset chain (the turn passes on)'}, note: 'Single skill on a chain; disclosure law as admit light.'},
      {id: 'knowledge-route', presentations: ['compact', 'expanded'], liveSemantic: 'device-audio-fx', invariant: {transforms: 'the agent\'s context reach (knowledge bounds on the World device)'}, note: 'Reads and knowledge bounds on context-world device (shared face with Central).'},
      {id: 'agency-gateway', presentations: ['compact'], liveSemantic: 'return', invariant: {routesTo: 'kernel:harness_agent_control'}, note: 'AIKit harness gateway; kernel HarnessAgentRead/Control (#618).'},
      {id: 'capture-skill', presentations: ['compact'], liveSemantic: 'capture', note: 'Transport Capture → skill proposal.'},
      {id: 'decision-helper', presentations: ['compact', 'expanded'], liveSemantic: 'device-audio-fx',
        invariant: {transforms: 'a member\'s open question: one label the owner allows, or none (DLW §19.20)'},
        note: 'Decision helper: AIKit\'s decision provider (kernel decision_status) and QL\'s team space (kernel team_space); after the team\'s members on its chain.'},
    ],
    params: {grammar: 'aikit/parameter-address/v1'},
    projections: ['aikit-session-track-adapter'],
    inspectors: ['skill-pool', 'methodology-loader'],
    time: {consumes: ['transport'], contributes: ['skill-admissions']},
    telemetry: 'aikit.disclosure.effective',
  }
  return admitFamilyManifest(manifest)
}
