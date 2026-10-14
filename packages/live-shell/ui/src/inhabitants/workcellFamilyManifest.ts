import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'
import type {InhabitantManifest} from './manifest.ts'

/** Workcell — where computation and git land (seat instrument, link fabric). */
export function workcellFamilyManifest(): FamilyManifest {
  const manifest: InhabitantManifest = {
    id: 'workcell',
    detachedKinds: ['device'],
    browser: ['git'],
    faces: [
      {id: 'git-seat', dock: ['dock', 'pop-out'], presentations: ['compact', 'expanded', 'full'], liveSemantic: 'return', invariant: {routesTo: 'workcell-cli:git commit'}, note: 'Branch vs main, uncommitted, commit policy, push, Land/draft PR; subagents share lead seat.'},
      {id: 'remote-carrier', dock: ['dock', 'pop-out'], presentations: ['compact'], liveSemantic: 'link', note: 'Reach/where; composed or refused — never live in mockup.'},
      {id: 'link', dock: ['dock', 'pop-out'], presentations: ['compact'], liveSemantic: 'link', note: 'Transport Link: shared field across Mac and Omarchy sessions.'},
      {id: 'seat', dock: ['dock', 'pop-out'], presentations: ['expanded'], liveSemantic: 'return', invariant: {routesTo: 'workcell-cli:seat land'}, note: 'Seat join/release/land over workcell-cli; no new worktrees.'},
    ],
    params: {grammar: 'workcell/parameter-address/v1'},
    projections: ['workcell-seat-track-adapter'],
    inspectors: ['terminal-tile', 'files-tile'],
    time: {consumes: ['transport'], contributes: ['seat-claims']},
    telemetry: 'workcell.seat.occupancy',
  }
  return admitFamilyManifest(manifest)
}
