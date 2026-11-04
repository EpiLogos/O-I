import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'
import {statePresentations} from './sdk/views.ts'
import type {InhabitantManifest} from './manifest.ts'

/** Software Factory — what work happens (runs, custody, returns, review). */
export function softwareFactoryFamilyManifest(): FamilyManifest {
  const manifest: InhabitantManifest = {
    id: 'software-factory',
    // No browser entry (ticket 804): the Runs entry (factory-runs) and the Tasks entry listed the retired Run and Runs devices (tickets 725,
    // 772, 788). A task is a clip on its session's track and a run that track in Arrangement view, its attempts the take lanes (§19.1); the
    // Factory browser's Sessions rows reach them.
    browser: [],
    browserEntries: [],
    faces: [
      // Software Factory's half of the one Agent (DLW §19.4 "One agent, three owners": Software Factory owns what it holds and what it
      // does when it stalls). Not a device of its own: the Agent (actuation:harness-model) draws what it holds and Hand back on its Run
      // page, and the Scope draws what waits before a change lands on its Asks page (§19.12); it stands on no chain. Its macro maps the
      // write mode it shares with Scope (the declared row; its review gate is no row of the family): the Autonomy it once mapped is
      // retired (§19.4, §19.12: Scope's Tool calls took its place).
      {id: 'agent-custody', presentations: ['compact', 'expanded'], liveSemantic: 'macro', invariant: {maps: [{key: 'write-mode', range: ['propose', 'draft', 'direct']}]}, note: 'What the one Agent holds and Hand back (DLW §19.4, the Agent\'s Run page); what waits before a change lands is the Scope\'s Before it lands (§19.12). No device of its own.'},
      {id: 'context-write-mode', presentations: statePresentations('software-factory:context-write-mode'), liveSemantic: 'return', invariant: {routesTo: 'shell.setWriteArm'}, note: 'Write receipts and Return on context-world device.'},
      {id: 'ledger', presentations: statePresentations('software-factory:ledger'), liveSemantic: 'track', invariant: {stream: 'the Factory ledger (main-track receipts)'}, note: 'Main-track ledger device and dock tile.'},
      {id: 'approvals', presentations: statePresentations('software-factory:approvals'), liveSemantic: 'return', invariant: {routesTo: 'kernel:harness_agent_control'}, note: 'Default approvals and approval queue tile.'},
      // The Agent rack (DLW §19.15; O-I #842): on every session's chain, drawn on its owner by the Factory chain; its id stays
      // `agentset-rack`, which presets and manifests are keyed by. The Thread, Tasks and Run faces are retired as faces of their own (22 Oct
      // manual rewrite); their bindings stay for the devices that carry them.
      {id: 'agentset-rack', presentations: statePresentations('software-factory:agentset-rack'), liveSemantic: 'rack', invariant: {chains: ['agent-session']}, note: 'Agent rack: the agency a track may use, one chain for each agent or agent set; a session of one agent has a rack of that one chain (DLW §19.15).'},
      // The Main track's two design-package devices (DLW §16.2 "On the Main track: the Run map, the experiments, Approvals and the
      // prompt pads"), drawn on their bindings (agent/devices/runMapBinding.ts, promptPadsBinding.ts).
      {id: 'run-map', presentations: statePresentations('software-factory:run-map'), liveSemantic: 'device-instrument', invariant: {generatesAbsent: 'The Run map writes through Factory: Recognise and Close need a Run named on the Main track, and the attempt retry and development mutate for ContinueCommission have no kernel route yet (T-COVERAGE §1.2).'}, note: 'Run map (DLW §19.25).'},
      {id: 'prompt-pads', presentations: statePresentations('software-factory:prompt-pads'), liveSemantic: 'device-instrument', invariant: {generatesAbsent: 'The pad bank is Factory\'s: factory development pads, pads-write, pads-run and pads-record have no kernel route yet (T-COVERAGE §1.2).'}, note: 'Prompt pads (DLW §19.22).'},
    ],
    params: {grammar: 'software-factory/parameter-address/v1'},
    projections: ['factory-run-track-adapter'],
    // No Diff tile (ticket 804): the Diff is Files' Diff page (§23.4).
    inspectors: ['ledger-tile', 'approvals-tile', 'review-tile'],
    time: {consumes: ['civil-time', 'transport'], contributes: ['run-clips', 'return-receipts']},
    telemetry: 'software-factory.custody.hold',
  }
  return admitFamilyManifest(manifest)
}
