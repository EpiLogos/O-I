import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'
import type {InhabitantManifest} from './manifest.ts'

/** Central — the ground the agents stand on (identity, context world, ground subjects). */
export function centralFamilyManifest(): FamilyManifest {
  const manifest: InhabitantManifest = {
    id: 'central',
    // The bare ids are carried by browserEntries: `agents` fills the mockup's Beings (agent-kind beings, the same
    // family), `ground` is the hygiene readings (worktrees, seats, branches) — distinct from the shell's Files listing.
    browser: [],
    browserEntries: [
      {id: 'central-beings', label: 'Beings', group: 'Central', mark: 'bind', kindMark: 'agent', modes: ['base'], state: 'cut',
        hint: 'The Being pages of your world, placed by their island through the page owner (kernel page op): each by its title, its kind of being and its world.'},
      {id: 'central-ground', label: 'Ground', group: 'Project', mark: 'pane', modes: ['base'], state: 'waiting',
        hint: 'Worktrees, seats and branches as readings — ops ground and git_repository_read, and workcell_status_read for seats. No row source is composed in this browser yet; tenders (prune, sweep) wait for their writer.'},
    ],
    faces: [],
    params: {grammar: 'central/parameter-address/v1'},
    projections: ['central-roster-track-adapter'],
    inspectors: ['file-tile', 'graph-tile', 'roster-tile'],
    time: {
      consumes: ['civil-time'],
      contributes: ['roster-revisions'],
    },
    telemetry: 'central.ground.observations',
  }
  return admitFamilyManifest(manifest)
}
