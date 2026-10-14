import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'
import type {InhabitantManifest} from './manifest.ts'

/** Software Factory — what work happens (runs, custody, returns, review). */
export function softwareFactoryFamilyManifest(): FamilyManifest {
  const manifest: InhabitantManifest = {
    id: 'software-factory',
    // `runs` fills the mockup's Runs entry (factory-runs, the same family); `tasks` is the selected run's task list.
    browser: [],
    browserEntries: [
      {id: 'factory-runs', label: 'Runs', group: 'Work', mark: 'arrangement', kindMark: 'run', modes: ['factory'], state: 'waiting',
        hint: 'Attempts and their task trees (ops factory_attempt_read and factory_attempt_task_list_read). The run viewer reads them in the agency column; this composed browser has no row source for it yet.'},
      {id: 'tasks', label: 'Tasks', group: 'Work', mark: 'form', modes: ['factory'], state: 'waiting',
        hint: 'The selected run\'s task list (op factory_attempt_task_list_read). No row source is composed in this browser yet; the same tasks show as the run\'s tree under Runs.'},
    ],
    faces: [
      {id: 'agent-custody', presentations: ['compact', 'expanded'], liveSemantic: 'macro', invariant: {maps: [{key: 'autonomy', range: ['suggest', 'review', 'auto']}]}, note: 'Autonomy, review gate, write mode, hand-back on agent device (shared face with Actuation).'},
      {id: 'context-write-mode', presentations: ['compact', 'expanded'], liveSemantic: 'return', invariant: {routesTo: 'shell.setWriteArm'}, note: 'Write receipts and Return on context-world device.'},
      {id: 'ledger', presentations: ['compact'], liveSemantic: 'track', invariant: {stream: 'the Factory ledger (main-track receipts)'}, note: 'Main-track ledger device and dock tile.'},
      {id: 'approvals', presentations: ['compact', 'full'], liveSemantic: 'return', invariant: {routesTo: 'kernel:harness_agent_control'}, note: 'Default approvals and approval queue tile.'},
      {id: 'run-device', presentations: ['expanded', 'full'], liveSemantic: 'track', invariant: {stream: 'the Factory run (one session\'s task stream)'}, note: 'Factory run on timeline when projected.'},
    ],
    params: {grammar: 'software-factory/parameter-address/v1'},
    projections: ['factory-run-track-adapter'],
    inspectors: ['ledger-tile', 'approvals-tile', 'diff-tile', 'review-tile'],
    time: {consumes: ['civil-time', 'transport'], contributes: ['run-clips', 'return-receipts']},
    telemetry: 'software-factory.custody.hold',
  }
  return admitFamilyManifest(manifest)
}
