import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'

/** Workcell — where computation and git land (seat instrument, link fabric). */
export function workcellFamilyManifest(): FamilyManifest {
  return admitFamilyManifest({
    id: 'workcell',
    browser: ['git'],
    faces: [
      {id: 'git-seat', presentations: ['compact', 'expanded', 'full'], note: 'Branch vs main, uncommitted, commit policy, push, Land/draft PR; subagents share lead seat.'},
      {id: 'remote-carrier', presentations: ['compact'], note: 'Reach/where; composed or refused — never live in mockup.'},
      {id: 'link', presentations: ['compact'], note: 'Transport Link: shared field across Mac and Omarchy sessions.'},
      {id: 'seat', presentations: ['expanded'], note: 'Seat join/release/land over workcell-cli; no new worktrees.'},
    ],
    params: {grammar: 'workcell/parameter-address/v1'},
    projections: ['workcell-seat-track-adapter'],
    inspectors: ['terminal-tile', 'files-tile'],
    time: {consumes: ['transport'], contributes: ['seat-claims']},
    telemetry: 'workcell.seat.occupancy',
  })
}
