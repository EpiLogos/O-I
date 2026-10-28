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
    // Central's half of the one Agent (DLW §19.4 "One agent, three owners": Central owns who it is — the agent comes from your roster).
    // Not a device of its own: the Agent (actuation:harness-model) joins it on its one face and draws it as the Agent's Identity page
    // (catalogue/panels/agent-identity.tsx); it stands on no chain.
    faces: [
      {id: 'agent-identity', presentations: ['compact'], liveSemantic: 'info', note: 'Who the agent is, read from the kernel roster (central.agent-profile-roster/v1): Central\'s reading on the one Agent (DLW §19.4), joined on the Agent\'s face; read-only, never a hardcoded crowd.'},
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
