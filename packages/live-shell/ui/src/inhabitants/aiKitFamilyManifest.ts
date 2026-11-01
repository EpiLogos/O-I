import {admitFamilyManifest, type FamilyManifest} from './familyManifest.ts'
import {statePresentations} from './sdk/views.ts'
import type {InhabitantManifest} from './manifest.ts'

/** AIKit — what agents can do (skills, skillsets, knowledge route, agency gateway, Messages). */
export function aiKitFamilyManifest(): FamilyManifest {
  const manifest: InhabitantManifest = {
    id: 'ai-kit',
    // `skillsets` is carried by browserEntries, and `skills` with it: a skill is a member of a skillset (DLW §10.3 Devices, "racks
    // such as skillsets"), and factory-knowledge, the mockup entry it overlapped, is gone (#804: the Knowledge route is Scope's
    // Knowledge page, §19.9). `agents` stays bare: it overlaps software-factory's factory-agents and no owner has ruled whose it is — OPEN.
    browser: ['agents'],
    browserEntries: [
      {id: 'skillsets', label: 'Skillsets', group: 'Ground', mark: 'lib', modes: ['factory'], state: 'waiting',
        hint: 'Accepted skill refs on the agent roster (op agent_definition_reading). The agent shell\'s own Skillsets column reads them; this composed browser has no row source for it yet.'},
    ],
    faces: [
      {id: 'skillset-rack', presentations: statePresentations('ai-kit:skillset-rack'), liveSemantic: 'rack', invariant: {chains: ['skill-device']}, note: 'Skills as chains with admit lights; macros Thoroughness, Test depth, Reach, Risk.'},
      {id: 'skill-device', presentations: statePresentations('ai-kit:skill-device'), liveSemantic: 'device-audio-fx', invariant: {transforms: 'the agent turn passing the skillset chain (the turn passes on)'}, note: 'Single skill on a chain; disclosure law as admit light.'},
      // Sources (DLW §19.9): an effect before the Agent — what the agent reads enters its context before it acts.
      {id: 'sources', presentations: statePresentations('ai-kit:sources'), liveSemantic: 'device-audio-fx', invariant: {transforms: 'what the agent receives: the pinned sources it reads from and the routes it may search, before it acts'},
        note: 'Sources: the pinned sources at their revisions and the routes (wiki, project knowledge, code), with Search first, Link depth and Read budget (DLW §19.9).'},
      // The Decision helper (DLW §19.20): an instrument, a chain of an Agentset rack in place of an Agent (agent/devices/decisionHelperBinding.ts).
      {id: 'decision-helper', presentations: statePresentations('ai-kit:decision-helper'), liveSemantic: 'device-instrument',
        invariant: {generatesAbsent: 'A pick among the labels the owner allows, or none, for a member\'s open question: AIKit\'s decision provider (kernel decision_status) and QL\'s team space (kernel team_space) are read; no owner operation records the helper\'s answers or holds its settings yet.'},
        note: 'Decision helper: an agent of type Settle, a chain of the team\'s Agentset rack in place of an Agent; one helper answers every member.'},
      // AIKit's instrument (DLW §19.26): born in a pane and standing only there, on the run you select, as Workcell's is (§19.23).
      {id: 'ai-kit', presentations: statePresentations('ai-kit:ai-kit'), liveSemantic: 'device-instrument',
        invariant: {generatesAbsent: 'Born in a pane: it reads what the run\'s agents carried and what entered their context, and keeps AIKit\'s practice — its sources and snapshots, adopted trees, packages and procedures; it changes no device on a chain.'},
        note: 'AIKit\'s instrument: Run, Context, Sources, Adopt, Package and Procedures, on the selected run (DLW §19.26).'},
      // Messages (DLW §19.24): an instrument born on the rail — its tile and its Full only, in every mode (agent/devices/messagesBinding.ts).
      {id: 'messages', presentations: statePresentations('ai-kit:messages'), liveSemantic: 'device-instrument',
        invariant: {generatesAbsent: 'Born on the rail: it reads AIKit\'s population and the open agent\'s conversation (kernel inhabitation_read); a send waits for `aikit gateway send` through the kernel.'},
        note: 'Messages: your agents and groups, each with its conversation, through the Agency gateway; the gateway\'s mark in its head.'},
    ],
    params: {grammar: 'aikit/parameter-address/v1'},
    projections: ['aikit-session-track-adapter'],
    inspectors: ['skill-pool', 'methodology-loader'],
    time: {consumes: ['transport'], contributes: ['skill-admissions']},
    telemetry: 'aikit.disclosure.effective',
  }
  return admitFamilyManifest(manifest)
}
