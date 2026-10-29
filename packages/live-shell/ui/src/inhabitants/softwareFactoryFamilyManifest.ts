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
      // Software Factory's half of the one Agent (DLW §19.4 "One agent, three owners": Software Factory owns how much it decides alone —
      // autonomy, the review gate and what it holds). Not a device of its own: the Agent (actuation:harness-model) joins it on its one face,
      // and draws it as the Agent's custody page (catalogue/panels/agent-custody.tsx); it stands on no chain.
      {id: 'agent-custody', presentations: ['compact', 'expanded'], liveSemantic: 'macro', invariant: {maps: [{key: 'autonomy', range: ['suggest', 'review', 'auto']}]}, note: 'Autonomy, review gate and hand-back: Software Factory\'s settings on the one Agent (DLW §19.4), joined on the Agent\'s face; no device of its own.'},
      {id: 'context-write-mode', presentations: statePresentations('software-factory:context-write-mode'), liveSemantic: 'return', invariant: {routesTo: 'shell.setWriteArm'}, note: 'Write receipts and Return on context-world device.'},
      {id: 'ledger', presentations: statePresentations('software-factory:ledger'), liveSemantic: 'track', invariant: {stream: 'the Factory ledger (main-track receipts)'}, note: 'Main-track ledger device and dock tile.'},
      {id: 'approvals', presentations: statePresentations('software-factory:approvals'), liveSemantic: 'return', invariant: {routesTo: 'kernel:harness_agent_control'}, note: 'Default approvals and approval queue tile.'},
      // The session's crew (DLW §19.15), drawn on its owner by the Factory chain. The Thread, Tasks and Run faces are retired as faces of
      // their own (22 Oct manual rewrite); their bindings stay for the devices that carry them.
      {id: 'agentset-rack', presentations: statePresentations('software-factory:agentset-rack'), liveSemantic: 'rack', invariant: {chains: ['agent-session'], chainSelector: 'member (state light)'}, note: 'A group\'s sessions as one unit, one chain for each member (DLW §19.15).'},
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
