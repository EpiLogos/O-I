import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'
import {statePresentations} from './sdk/views.ts'
import type {InhabitantManifest} from './manifest.ts'

/** Actuation — how agents run (harness, effort, heartbeat, gateway transport). */
export function actuationFamilyManifest(): FamilyManifest {
  const manifest: InhabitantManifest = {
    id: 'actuation',
    browser: [],
    browserEntries: [
      {id: 'gateways', label: 'Gateways', group: 'Work', mark: 'linkChain', modes: ['factory'], state: 'waiting',
        hint: 'Every gateway this work can reach, as chains: Hermes\' tui_gateway, AIKit\'s agency gateway, Actuation on frank. Reads through op harness_agent_read; no row source is composed in this browser yet.'},
    ],
    faces: [
      {id: 'gateway', presentations: statePresentations('actuation:gateway'), liveSemantic: 'return', invariant: {routesTo: 'kernel:harness_agent_control'}, note: 'Hermes tui_gateway session surface; distinct from AIKit agency gateway and Actuation on frank.'},
      {id: 'harness-model', presentations: statePresentations('actuation:harness-model'), liveSemantic: 'device-instrument', invariant: {generates: 'kernel:harness_agent_control'}, note: 'Model and reasoning effort on the agent device face.'},
      // Voice (DLW §19.21): an effect after the Agent, on the chain of an agent that speaks (agent/devices/voiceBinding.ts).
      {id: 'voice', presentations: statePresentations('actuation:voice'), liveSemantic: 'device-audio-fx', invariant: {transforms: 'the agent\'s answer into speech through its body (the kernel op nara_voice: the local cascade)'},
        note: 'How an agent speaks, after the Agent on the chain of an agent that speaks (DLW §19.21); the Answer\'s voice is its owner (central/devices/answerVoice.ts).'},
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
