import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'
import type {InhabitantManifest} from './manifest.ts'

/** Workcell — where computation and git land (seat instrument, link fabric). */
export function workcellFamilyManifest(): FamilyManifest {
  const manifest: InhabitantManifest = {
    id: 'workcell',
    browser: [],
    browserEntries: [
      {id: 'git', label: 'Git', group: 'Ground', mark: 'chain', modes: ['factory'], state: 'waiting',
        hint: 'The git seat: branch against main, uncommitted work, push, land. Reads through op workcell_status_read and op git_repository_read; the agent shell\'s Git column reads it, and no row source is composed here yet.'},
    ],
    faces: [
      {id: 'git-seat', presentations: ['compact', 'expanded', 'full'], liveSemantic: 'return', invariant: {routesTo: 'workcell-cli:git commit'}, note: 'Branch vs main, uncommitted, commit policy, push, Land/draft PR; subagents share lead seat.'},
      {id: 'remote-carrier', presentations: ['compact'], liveSemantic: 'link', note: 'Reach/where; composed or refused — never live in mockup.'},
      {id: 'link', presentations: ['compact'], liveSemantic: 'link', note: 'Transport Link: shared field across Mac and Omarchy sessions.'},
      {id: 'seat', presentations: ['expanded'], liveSemantic: 'return', invariant: {routesTo: 'workcell-cli:seat land'}, note: 'Seat join/release/land over workcell-cli; no new worktrees.'},
    ],
    params: {grammar: 'workcell/parameter-address/v1'},
    projections: ['workcell-seat-track-adapter'],
    inspectors: ['terminal-tile', 'files-tile'],
    time: {consumes: ['transport'], contributes: ['seat-claims']},
    telemetry: 'workcell.seat.occupancy',
  }
  return admitFamilyManifest(manifest)
}
