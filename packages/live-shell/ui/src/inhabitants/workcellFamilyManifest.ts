import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'
import {statePresentations} from './sdk/views.ts'
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
      {id: 'git-seat', presentations: statePresentations('workcell:git-seat'), liveSemantic: 'return', invariant: {routesTo: 'act:workcell.lane.land'}, note: 'Branch vs main, uncommitted, commit policy, push, Land/draft PR; subagents share lead seat.'},
      {id: 'remote-carrier', presentations: statePresentations('workcell:remote-carrier'), liveSemantic: 'link', note: 'Reach/where; composed or refused — never live in mockup.'},
      {id: 'link', presentations: statePresentations('workcell:link'), liveSemantic: 'link', note: 'Transport Link: shared field across Mac and Omarchy sessions.'},
      // Workcell's instrument (DLW §19.23): born in a pane and standing only there and on the rail, on the run you select, in every
      // mode — its tile the Workcells widget, its Full eight pages (agent/devices/workcellRackBinding.ts). It stands on no chain.
      {id: 'workcell', presentations: statePresentations('workcell:workcell'), liveSemantic: 'device-instrument',
        invariant: {generatesAbsent: 'Born in a pane: it reads the run\'s road, its world, its seats and its machine from Workcell and Central, and changes none of its connections\' settings — each is set on its device.'},
        note: 'Workcell\'s instrument: Chain, World, Services, Exposure, Release, Left behind, Seats and Machine, on the selected run (DLW §19.23).'},
    ],
    params: {grammar: 'workcell/parameter-address/v1'},
    projections: ['workcell-seat-track-adapter'],
    inspectors: ['terminal-tile', 'files-tile'],
    time: {consumes: ['transport'], contributes: ['seat-claims']},
    telemetry: 'workcell.seat.occupancy',
  }
  return admitFamilyManifest(manifest)
}
