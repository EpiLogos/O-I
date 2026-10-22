import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'
import type {InhabitantManifest} from './manifest.ts'

/** Software Factory — what work happens (runs, custody, returns, review). */
export function softwareFactoryFamilyManifest(): FamilyManifest {
  const manifest: InhabitantManifest = {
    id: 'software-factory',
    // `runs` fills the mockup's Runs entry (factory-runs, the same family); `tasks` is the selected run's task list.
    browser: [],
    browserEntries: [
      {id: 'factory-runs', label: 'Runs', group: 'Work', mark: 'arrangement', kindMark: 'run', modes: ['factory'], state: 'cut',
        hint: 'The Run of the selected session and its Runs (attempts and their task trees, ops factory_attempt_read and factory_attempt_task_list_read): the Factory browser\'s Runs rows show each device whole in the pool.'},
      {id: 'tasks', label: 'Tasks', group: 'Work', mark: 'form', modes: ['factory'], state: 'waiting',
        hint: 'The selected run\'s task list (op factory_attempt_task_list_read). No row source is composed in this browser yet; the same tasks show as the run\'s tree under Runs.'},
    ],
    faces: [
      {id: 'context-write-mode', presentations: ['compact', 'expanded'], liveSemantic: 'return', invariant: {routesTo: 'shell.setWriteArm'}, note: 'Write receipts and Return on context-world device.'},
      {id: 'ledger', presentations: ['compact'], liveSemantic: 'track', invariant: {stream: 'the Factory ledger (main-track receipts)'}, note: 'Main-track ledger device and dock tile.'},
      {id: 'approvals', presentations: ['compact', 'full'], liveSemantic: 'return', invariant: {routesTo: 'kernel:harness_agent_control'}, note: 'Default approvals and approval queue tile.'},
      // The session's crew (DLW §19.15), drawn on its owner by the Factory chain. The Thread, Tasks, Run and Custody faces are retired
      // as faces of their own (22 Oct manual rewrite); their bindings stay for the devices that carry them.
      {id: 'agentset-rack', presentations: ['compact', 'expanded', 'full'], liveSemantic: 'rack', invariant: {chains: ['agent-session'], chainSelector: 'member (state light)'}, note: 'A group\'s sessions as one unit, one chain for each member (DLW §19.15).'},
      // The Main track's two design-package devices (DLW §16.2 "On the Main track: the Run map, the experiments, Approvals and the
      // prompt pads"), drawn on their bindings (agent/devices/runMapBinding.ts, promptPadsBinding.ts).
      {id: 'run-map', presentations: ['compact', 'expanded', 'full'], liveSemantic: 'device-instrument', invariant: {generatesAbsent: 'The Run map writes through Factory: Recognise and Close need a Run named on the Main track, and the attempt retry and development mutate for ContinueCommission have no kernel route yet (T-COVERAGE §1.2).'}, note: 'Run map (DLW §19.25).'},
      {id: 'prompt-pads', presentations: ['compact', 'expanded', 'full'], liveSemantic: 'device-instrument', invariant: {generatesAbsent: 'The pad bank is Factory\'s: factory development pads, pads-write, pads-run and pads-record have no kernel route yet (T-COVERAGE §1.2).'}, note: 'Prompt pads (DLW §19.22).'},
    ],
    params: {grammar: 'software-factory/parameter-address/v1'},
    projections: ['factory-run-track-adapter'],
    inspectors: ['ledger-tile', 'approvals-tile', 'diff-tile', 'review-tile'],
    time: {consumes: ['civil-time', 'transport'], contributes: ['run-clips', 'return-receipts']},
    telemetry: 'software-factory.custody.hold',
  }
  return admitFamilyManifest(manifest)
}
