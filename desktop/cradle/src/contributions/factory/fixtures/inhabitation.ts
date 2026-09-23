/**
 * Typed inhabitation fixtures — DEV scenarios and tests ONLY, never imported
 * by a production path. They take the owner contracts' shapes
 * (docs/contracts/WORLD-INHABITATION-V1.md) so the model tests and the
 * `factory-inhabitation` walk's controlled owner executables exercise every
 * standing the apertures must render: occupied (active / idle / presence not
 * reported), vacant, unavailable, current work one / none / ambiguous, an
 * inherited root Position, a Position Factory names that the population does
 * not, custody in progress and blocked, root and child NOW, and a failed facet.
 *
 * Refs are parameters: the walk passes the real specimen run refs so the
 * fixtures join the Desk's real Factory reads by identity.
 */
import type {FactoryInhabitationReading, InhabitationReading, PopulationReading, RefocusReading} from "../inhabitation/model";

export const POSITION = {
  root: "central:position:project:O-I:oi-root-agency",
  factory: "central:position:project:O-I:factory-guardian",
  aikit: "central:position:project:O-I:aikit-guardian",
  anima: "central:position:project:O-I:anima-4",
  central: "central:position:control:root:central-guardian",
  unlisted: "central:position:project:O-I:workcell-guardian",
} as const;

export interface FixtureRefs { projectWorld: string; runA: string; runB: string; sessionA: string; rootNow?: string; childNow?: string }

export function populationFixture(refs: FixtureRefs): PopulationReading {
  return {
    schema: "aikit.population-reading/v1", project_world_ref: refs.projectWorld, local_world_ref: "control:root",
    positions: [
      {position_ref: POSITION.root, handle: "@oi", label: "O:I Root Agency", role_ref: "role:root-agency", inherited: false,
        occupancy: {state: "occupied", generation_ref: "actuation:generation:0001", generation_ordinal: 3, kind: "fresh", agent_ref: "agent/oi-field-guardian", agency_ref: "agency:oi", agent_session_ref: refs.sessionA, workcell_ref: "workcell:local", since_unix_ms: 1_790_000_000_000, presence: "active", attention: "reviewing the Desk"},
        current_work: {outcome: "one", work_ref: "workflow-unit:review", run_ref: refs.runA, candidates: 1}, communiques: {undelivered: 2}},
      {position_ref: POSITION.factory, handle: "@factory-guardian", label: "Software Factory Guardian", role_ref: "role:product-guardian", inherited: false,
        occupancy: {state: "occupied", generation_ref: "actuation:generation:0002", generation_ordinal: 1, kind: "initial", agent_ref: "agent/factory-guardian", agency_ref: "agency:factory", workcell_ref: "workcell:local", presence: "idle"},
        current_work: {outcome: "ambiguous", candidates: 2}, communiques: {undelivered: 0}},
      {position_ref: POSITION.anima, handle: "@anima-4", label: "Anima 4 (M4 Nara × S4′ Anima)", role_ref: "role:anima", inherited: false,
        occupancy: {state: "vacant"}, current_work: {outcome: "none"}},
      {position_ref: POSITION.aikit, handle: "@aikit-guardian", label: "AIKit Guardian", role_ref: "role:product-guardian", inherited: false,
        occupancy: {state: "unavailable", reason: "the occupancy ledger could not be read"}, current_work: {outcome: "unavailable", reason: "custody unreadable"}},
      {position_ref: POSITION.central, handle: "@central-guardian", label: "Central Guardian", role_ref: "role:product-guardian", inherited: true,
        occupancy: {state: "occupied", agent_ref: "agent/central-guardian"}, current_work: {outcome: "none"}},
    ],
    absences: [{facet: "communiques", reason: "the Gateway inbox for @anima-4 is unreachable", source: "aikit gateway inbox"}],
  };
}

export function factoryInhabitationFixture(refs: FixtureRefs): FactoryInhabitationReading {
  return {
    schema: "factory.inhabitation-reading/v1", project_ref: "project:specimen",
    runs: [
      {run_ref: refs.runA,
        positions: [
          {position_ref: POSITION.factory, handle: "@factory-guardian", label: "Software Factory Guardian",
            custody: [{custody_ref: "factory:custody:0001", work_ref: "workflow-unit:review", run_ref: refs.runA, state: "in-progress"}],
            current_work: {outcome: "ambiguous", candidates: 2, basis: "two in-progress custodies name different work"},
            occupants: [{relation: "attempt-participant", agent_ref: "agent/factory-guardian", agent_session_ref: refs.sessionA, workcell_ref: "workcell:local", harness_ref: "harness:pi", model_ref: "model:deepseek-v4-pro"}]},
          {position_ref: POSITION.unlisted, handle: "@workcell-guardian", label: "Workcell Guardian",
            custody: [{custody_ref: "factory:custody:0002", run_ref: refs.runA, state: "blocked"}], occupants: []},
        ],
        now: {root_now_ref: refs.rootNow ?? null, child_now_ref: refs.childNow ?? null}},
      {run_ref: refs.runB, positions: []},
    ],
  };
}

export function whoamiFixture(refs: FixtureRefs, position: string = POSITION.factory): InhabitationReading {
  return {
    schema: "aikit.inhabitation-reading/v1",
    local_world: {state: "present", ref: "control:root", source: "central.world.here"},
    project_world: {state: "present", ref: refs.projectWorld, source: "central.world.here"},
    position: {state: "present", ref: position, label: "Software Factory Guardian", handle: "@factory-guardian", purpose: "Steward the Software Factory product: transformation.", profile_ref: "profile/factory-guardian", eligible_agent_refs: ["agent/factory-guardian"], source: "central.position.read"},
    occupancy: {state: "present", ref: "actuation:generation:0002", label: "generation 1 · initial", source: "actuation occupancy read"},
    agent: {state: "present", ref: "agent/factory-guardian", source: "actuation"},
    agency: {state: "present", ref: "agency:factory", source: "actuation"},
    agent_session: {state: "absent", reason: "the occupant has no live AgentSession", source: "aikit session"},
    session_space: {state: "not-attempted", reason: "no AgentSession to resolve a SessionSpace from"},
    body: {state: "absent", reason: "no launched body", source: "aikit session"},
    workcell: {state: "present", ref: "workcell:local", source: "workcell status"},
    root_now: refs.rootNow ? {state: "present", ref: refs.rootNow, source: "central.now.workcell-root"} : {state: "absent", reason: "no Workcell root NOW", source: "central.now.workcell-root"},
    child_now: refs.childNow ? {state: "present", ref: refs.childNow, source: "central.now.children"} : {state: "absent", reason: "no child NOW", source: "central.now.children"},
    current_work: {state: "ambiguous", reason: "two in-progress custodies name different work", source: "factory development current-work"},
    peers: {state: "present", label: "5 Positions", source: "aikit gateway who"},
    prepared_context: {state: "present", ref: "aikit:prepared:factory-guardian", revision: "r7", label: "prepared NOW context", source: "aikit context current"},
    authority: {state: "unavailable", reason: "the authority reading timed out", source: "aikit authority"},
    working_surface: {state: "absent", reason: "no persisted working surface", source: "aikit session-space"},
    return_destination: {state: "present", ref: refs.childNow ?? "central:now:control:root:return", label: "the run's child NOW", source: "factory development inhabitation"},
  };
}

export function refocusFixture(refs: FixtureRefs, position: string = POSITION.factory): RefocusReading {
  return {
    schema: "aikit.refocus-reading/v1", position_ref: position,
    chain: [
      {level: "operation", label: "Review the section order", ref: "attempt:review/op", state: "present"},
      {level: "workflow-unit", label: "Challenge section order under hostile inputs", ref: "workflow-unit:review", state: "present"},
      {level: "run", ref: refs.runA, label: "Survey then review the specimen", state: "present"},
      {level: "journey", state: "absent", reason: "the run names no Journey"},
      {level: "project-intent", label: "O:I vision and goals", ref: "central:source:project:O-I:ProjectCentral/user/vision.md", state: "present"},
      {level: "projectcentral-ground", ref: "project:O-I", label: "O-I ProjectCentral", state: "present"},
    ],
    now: {root_now_ref: refs.rootNow ?? null, child_now_ref: refs.childNow ?? null},
    return_target: refs.childNow ?? null,
  };
}
