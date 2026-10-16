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
      {id: 'agent-custody', presentations: ['compact', 'expanded'], liveSemantic: 'macro', invariant: {maps: [{key: 'autonomy', range: ['suggest', 'review', 'auto']}]}, note: 'Autonomy, review gate, write mode, hand-back on agent device (shared face with Actuation).'},
      {id: 'context-write-mode', presentations: ['compact', 'expanded'], liveSemantic: 'return', invariant: {routesTo: 'shell.setWriteArm'}, note: 'Write receipts and Return on context-world device.'},
      {id: 'ledger', presentations: ['compact'], liveSemantic: 'track', invariant: {stream: 'the Factory ledger (main-track receipts)'}, note: 'Main-track ledger device and dock tile.'},
      {id: 'approvals', presentations: ['compact', 'full'], liveSemantic: 'return', invariant: {routesTo: 'kernel:harness_agent_control'}, note: 'Default approvals and approval queue tile.'},
      {id: 'run-device', presentations: ['expanded', 'full'], liveSemantic: 'track', invariant: {stream: 'the Factory run (one session\'s task stream)'}, note: 'Factory run on timeline when projected.'},
      // The session's conversation, its clips and its crew (DLW §19.4, §19.1, §19.15), drawn on their owners by the Factory chain
      // (agent/devices/threadBinding.ts, taskBindings.ts, sessionChainBindings.ts).
      {id: 'thread', presentations: ['compact', 'expanded', 'full'], liveSemantic: 'device-instrument', invariant: {generates: 'kernel:harness_agent_control'}, note: 'One session\'s conversation: the Agent\'s Full (DLW §19.4, §19.4). Its words go the Agent\'s way (the steer line or the next task).'},
      {id: 'tasks', presentations: ['compact', 'expanded', 'full'], liveSemantic: 'track', invariant: {stream: 'one session\'s tasks (agency_read, encounter_task_read, temporal_events_read)'}, note: 'The clips on one session\'s track (DLW §19.1).'},
      {id: 'agentset-rack', presentations: ['compact', 'expanded', 'full'], liveSemantic: 'rack', invariant: {chains: ['agent-session'], chainSelector: 'member (state light)'}, note: 'A group\'s sessions as one unit, one chain for each member (DLW §19.15).'},
    ],
    params: {grammar: 'software-factory/parameter-address/v1'},
    projections: ['factory-run-track-adapter'],
    inspectors: ['ledger-tile', 'approvals-tile', 'diff-tile', 'review-tile'],
    time: {consumes: ['civil-time', 'transport'], contributes: ['run-clips', 'return-receipts']},
    telemetry: 'software-factory.custody.hold',
  }
  return admitFamilyManifest(manifest)
}
