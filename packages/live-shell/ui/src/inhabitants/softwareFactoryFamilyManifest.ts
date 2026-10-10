import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'

/** Software Factory — what work happens (runs, custody, returns, review). */
export function softwareFactoryFamilyManifest(): FamilyManifest {
  return admitFamilyManifest({
    id: 'software-factory',
    browser: ['tasks', 'runs'],
    faces: [
      {id: 'agent-custody', presentations: ['compact', 'expanded'], note: 'Autonomy, review gate, write mode, hand-back on agent device (shared face with Actuation).'},
      {id: 'context-write-mode', presentations: ['compact', 'expanded'], note: 'Write receipts and Return on context-world device.'},
      {id: 'ledger', presentations: ['compact'], note: 'Main-track ledger device and dock tile.'},
      {id: 'approvals', presentations: ['compact', 'full'], note: 'Default approvals and approval queue tile.'},
      {id: 'run-device', presentations: ['expanded', 'full'], note: 'Factory run on timeline when projected.'},
    ],
    params: {grammar: 'software-factory/parameter-address/v1'},
    projections: ['factory-run-track-adapter'],
    inspectors: ['ledger-tile', 'approvals-tile', 'diff-tile', 'review-tile'],
    time: {consumes: ['civil-time', 'transport'], contributes: ['run-clips', 'return-receipts']},
    telemetry: 'software-factory.custody.hold',
  })
}
