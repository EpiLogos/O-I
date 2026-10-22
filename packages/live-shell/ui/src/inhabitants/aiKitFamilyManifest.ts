import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'
import type {InhabitantManifest} from './manifest.ts'

/** AIKit — what agents can do (skills, skillsets, knowledge route, agency gateway, Messages). */
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
      // Messages (DLW §19.24): an instrument born on the rail — its tile and its Full only, in every mode (agent/devices/messagesBinding.ts).
      {id: 'messages', presentations: ['full'], liveSemantic: 'device-instrument',
        invariant: {generatesAbsent: 'Born on the rail: it reads AIKit\'s population and the open agent\'s conversation (kernel inhabitation_read); a send waits for `aikit gateway send` through the kernel.'},
        note: 'Messages: your agents and groups, each with its conversation, through the Agency gateway; the gateway\'s mark in its head.'},
    ],
    params: {grammar: 'aikit/parameter-address/v1'},
    projections: ['aikit-session-track-adapter'],
    inspectors: ['skill-pool', 'methodology-loader'],
    time: {consumes: ['transport'], contributes: ['skill-admissions']},
    telemetry: 'aikit.disclosure.effective',
  }
  return admitFamilyManifest(manifest)
}
