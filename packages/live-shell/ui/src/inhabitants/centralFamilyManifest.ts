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
    faces: [
      {id: 'context-world', presentations: ['compact', 'expanded'], liveSemantic: 'device-audio-fx', invariant: {transforms: 'the agent\'s context: Central ground reads and context writes'}, note: 'Context-world device face: reads the Central ground (teal), writes context (amber). Shared face — ai-kit owns the knowledge route, software-factory the write mode and receipts.'},
      {id: 'agent-identity', presentations: ['compact'], liveSemantic: 'info', note: 'Agent identity read from the kernel roster (central.agent-profile-roster/v1); read-only, never a hardcoded crowd.'},
    ],
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
