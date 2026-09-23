/**
 * Typed inhabitation fixtures — DEV scenarios and tests ONLY, never imported
 * by a production path. They take the INSTALLED owners' shapes (aikit
 * 71a9972c, factory f0f4d7c3; captured from their real `--json` output on
 * 2026-09-24) so the model tests and the `factory-inhabitation-fixture`
 * walk's controlled owner executables exercise the standings the live World
 * does not hold yet: occupied (active / idle / presence not reported),
 * vacant, unavailable, current work one / none / ambiguous, an inherited root
 * Position, a Position with no definition, an unreadable Gateway journal, a
 * Position Factory names that the population does not, custody in progress
 * and blocked, an attempt occupant with its body and placement NOW, and an
 * attempt that names no Position.
 *
 * AIKit readings are the envelope's `data` (wrap with `aikitEnvelope` to
 * serve them as the CLI does). Refs are parameters: the walk passes the real
 * specimen run refs so the fixtures join the Desk's real Factory reads.
 */
import type {FactoryCurrentWork, FactoryInhabitationReading, InhabitationReading, PopulationReading, RefocusReading} from "../inhabitation/model";

export const POSITION = {
  root: "central:position:project:O-I:oi-root-agency",
  factory: "central:position:project:O-I:factory-guardian",
  aikit: "central:position:project:O-I:aikit-guardian",
  anima: "central:position:project:O-I:anima-4",
  central: "central:position:control:root:central-guardian",
  undefinedPosition: "central:position:project:O-I:retired-office",
  unlisted: "central:position:project:O-I:workcell-guardian",
} as const;

export interface FixtureRefs { projectWorld: string; runA: string; runB: string; sessionA: string; rootNow?: string; childNow?: string }

/** AIKit's `--json` envelope around a reading, as the installed CLI prints it. */
export function aikitEnvelope(data: unknown, warnings: unknown[] = []) {
  return {context: {context_id: null, project_root: null, session_id: null}, data, ok: true, schema: 1, warnings};
}

export function populationFixture(refs: FixtureRefs): PopulationReading {
  return {
    schema: "aikit.population-reading/v1", project_world_ref: refs.projectWorld, local_world_ref: "control:root",
    positions: [
      {position_ref: POSITION.root, handle: "@oi", label: "O:I Root Agency", role_ref: "role:root-agency", inherited: false, definition: "present",
        occupancy: {state: "occupied", generation_ref: "actuation:generation:0001", generation_ordinal: 3, kind: "fresh", agent_ref: "agent/oi-field-guardian", agency_ref: "agency:oi", agent_session_ref: refs.sessionA, workcell_ref: "workcell:local", since_unix_ms: 1_790_000_000_000, presence: "active", attention: "reviewing the Desk"},
        current_work: {outcome: "one", work_ref: "github:EpiLogos/O-I#65", run_ref: refs.runA, candidates: 1}, communiques: {undelivered: 2}},
      {position_ref: POSITION.factory, handle: "@factory-guardian", label: "Software Factory Guardian", role_ref: "role:product-guardian", inherited: false, definition: "present",
        occupancy: {state: "occupied", generation_ref: "actuation:generation:0002", generation_ordinal: 1, kind: "initial", agent_ref: "agent/factory-guardian", agency_ref: "agency:factory", workcell_ref: "workcell:local", presence: "idle", attention: null},
        current_work: {outcome: "ambiguous", work_ref: null, run_ref: null, candidates: 2}, communiques: {undelivered: 0}},
      {position_ref: POSITION.anima, handle: "@anima-4", label: "Anima 4 (M4 Nara × S4′ Anima)", role_ref: "role:anima", inherited: false, definition: "present",
        occupancy: {state: "vacant"}, current_work: {outcome: "none", work_ref: null, run_ref: null, candidates: 0}, communiques: {undelivered: null}},
      {position_ref: POSITION.aikit, handle: "@aikit-guardian", label: "AIKit Product Guardian", role_ref: "role:product-guardian", inherited: false, definition: "present",
        occupancy: {state: "unavailable"}, current_work: {outcome: "unavailable"}, communiques: {undelivered: 0}},
      {position_ref: POSITION.undefinedPosition, handle: null, label: null, role_ref: null, inherited: false, definition: "absent",
        occupancy: {state: "vacant"}, current_work: {outcome: "none", candidates: 0}, communiques: {undelivered: 0}},
      {position_ref: POSITION.central, handle: "@central-guardian", label: "Central Product Guardian", role_ref: "role:product-guardian", inherited: true, definition: "present",
        occupancy: {state: "occupied", agent_ref: "agent/central-guardian", presence: null}, current_work: {outcome: "none", candidates: 0}, communiques: {undelivered: 0}},
    ],
    absences: [
      {facet: "communiques", reason: "the Gateway journal for @anima-4 is unreachable", source: "aikit gateway"},
      {facet: `current_work:${POSITION.aikit}`, reason: "Factory refused: the developmental state is locked", source: "factory development current-work"},
    ],
  };
}

const present = (value: string, source: string) => ({state: "present", value, source});
const absent = (reason: string, source: string) => ({state: "absent", reason, source});

export function factoryInhabitationFixture(refs: FixtureRefs): FactoryInhabitationReading {
  const source = `factory.attempt-state/v1:${refs.runA}:attempt:review`;
  return {
    schema: "factory.inhabitation-reading/v1", project_ref: "project:0000000000SPECIMENWALK00", central_project_ref: {state: "present", value: "Specimen", source: "factory.developmental-local-provider/v1:centralProjectLinks"},
    filter: {run_ref: null, position_ref: null},
    runs: [
      {run_ref: refs.runA, lifecycle: "active", journey_refs: ["journey:specimen-a"],
        positions: [
          {position_ref: POSITION.factory, in_custody: true, custody: [{custody_ref: "factory:custody:0001", state: "in-progress", work_ref: "github:EpiLogos/Factory#261"}], attempt_refs: ["attempt:review"], current_attempt_refs: ["attempt:review"]},
          {position_ref: POSITION.unlisted, in_custody: true, custody: [{custody_ref: "factory:custody:0002", state: "blocked", work_ref: "github:EpiLogos/Workcell#12"}], attempt_refs: [], current_attempt_refs: []},
        ],
        custody: [],
        occupants: [
          {attempt_ref: "attempt:review", task_ref: "task:review", workflow_unit_ref: "workflow-unit:review", execution_ref: "execution:review", current_attempt: true, leg_status: "active",
            participant: {position_ref: present(POSITION.factory, source), agent_ref: present("agent/factory-guardian", source), agency_ref: present("agency:factory", source), profile_ref: present("profile/factory-guardian", source), world_binding_ref: present("world-binding:specimen", source)},
            body: {agent_session_ref: present(refs.sessionA, source), session_space_ref: present("session-space:specimen", source), workcell_ref: present("workcell:local", source), material_world_ref: absent("the attempt's body records no material world", source),
              model_ref: present("model:deepseek-v4-pro", source), provider_ref: present("provider:deepseek", source), harness_ref: present("harness:pi", source), harness_composition_ref: present("harness-composition:pi-default", source)},
            placement: {now_ref: refs.childNow ? present(refs.childNow, source) : absent("the attempt was admitted without a placement NOW", source)},
            return_address: present(refs.childNow ?? "central:now:control:root:return", source)},
          {attempt_ref: "attempt:survey", task_ref: "task:survey", workflow_unit_ref: "workflow-unit:survey", execution_ref: "execution:survey", current_attempt: false, leg_status: "returned",
            participant: {position_ref: absent("the attempt's participant names no World Position", source), agent_ref: present("agent/specimen-surveyor", source), agency_ref: present("agency:specimen/surveyor", source), profile_ref: absent("the attempt's participant was admitted without an AgentProfile", source), world_binding_ref: present("world-binding:specimen", source)},
            body: {agent_session_ref: present("agent-session/specimen-survey", source), session_space_ref: present("session-space:specimen", source), workcell_ref: absent("the attempt's body records no Workcell", source), material_world_ref: absent("none", source),
              model_ref: present("model:text-model", source), provider_ref: present("provider:specimen", source), harness_ref: present("harness:specimen", source), harness_composition_ref: present("harness-composition:specimen", source)},
            placement: {now_ref: absent("the attempt was admitted without a placement NOW", source)},
            return_address: present("central:now:control:root:return", source)},
        ]},
      {run_ref: refs.runB, lifecycle: "seeded", journey_refs: [], positions: [], custody: [], occupants: []},
    ],
    custody_outside_runs: [],
  };
}

export function currentWorkFixture(refs: FixtureRefs, position: string = POSITION.factory): FactoryCurrentWork {
  return {
    schema: "factory.current-work/v1", position_ref: position, project_ref: "project:0000000000SPECIMENWALK00", outcome: "ambiguous", current: null,
    candidates: [
      {source: "custody", source_ref: "factory:custody:0001", resolution: "resolved", node_ref: "github:EpiLogos/Factory#261", work_ref: "github:EpiLogos/Factory#261", run_ref: refs.runA, journey_ref: "journey:specimen-a", status: "in-progress"},
      {source: "custody", source_ref: "factory:custody:0003", resolution: "resolved", node_ref: "github:EpiLogos/Factory#262", work_ref: "github:EpiLogos/Factory#262", run_ref: refs.runB, journey_ref: null, status: "in-progress"},
    ],
    considered: 2, basis: "two in-progress work nodes from 2 relation(s): 2 custody, 0 running attempt(s)",
  };
}

export function whoamiFixture(refs: FixtureRefs, position: string = POSITION.factory): InhabitationReading {
  const rootNow = refs.rootNow ?? "central:now:control:root:workcell-root";
  return {
    schema: "aikit.inhabitation-reading/v1", position_ref: position, resolved_by: "flag", depth: "full",
    facets: {
      local_world: {state: "present", source: "central.world.here", summary: "control:root (/Users/admin/Central)", value: {ref: "control:root", root: "/Users/admin/Central"}},
      project_world: {state: "present", source: "central.world.here", summary: `${refs.projectWorld} (Work/Specimen, via cwd)`, value: {ref: refs.projectWorld, name: "Specimen", via: "cwd"}},
      position: {state: "present", source: "central.position.read", summary: `${position} "Software Factory Guardian" (@factory-guardian) @r1`,
        value: {record: {ref: position, label: "Software Factory Guardian", handle: "@factory-guardian", purpose: "Steward the Software Factory product: transformation.", profile_ref: "profile/factory-guardian", eligible_agent_refs: ["agent/factory-guardian"], revision: "r1"}}},
      occupancy: {state: "present", source: "actuation occupancy read", summary: "occupied by agent/factory-guardian (generation 1, initial)",
        value: {schema: "actuation.position-occupancy/v1", position_ref: position, state: "occupied", current: {generation_ref: "actuation:generation:0002", generation_ordinal: 1, kind: "initial", agent_ref: "agent/factory-guardian", agency_ref: "agency:factory"}, presence: {generation_ref: "actuation:generation:0002", presence: "idle"}, generations: []}},
      agent: {state: "present", source: "actuation occupancy read (open tenure)", summary: "agent/factory-guardian"},
      agency: {state: "present", source: "actuation occupancy read (open tenure)", summary: "agency:factory"},
      agent_session: {state: "absent", reason: "the open tenure names no AgentSession", source: "actuation occupancy read (open tenure)"},
      session_space: {state: "not-attempted", reason: "needs an AgentSession named by the open tenure", source: "actuation occupancy read (open tenure)"},
      body: {state: "absent", reason: "no body is named by the open tenure", source: "actuation occupancy read (open tenure)", next: "aikit compose --json (ActorBootstrap composition)"},
      workcell: {state: "present", source: "central.world.here", summary: "workcell:local (declared by Control/machines/current.json)", value: {ref: "workcell:local", role: "current"}},
      root_now: {state: "present", source: "central.world.here (workcell root_now) + central.now.read", summary: `${rootNow} [active]`, value: {horizon: "root", lifecycle: "active", now_ref: rootNow}},
      child_now: refs.childNow ? {state: "present", source: "child NOW", summary: refs.childNow, value: {horizon: "child", lifecycle: "active", now_ref: refs.childNow}} : {state: "absent", reason: `no child of ${rootNow} names ${position}`, source: "child NOW"},
      current_work: {state: "ambiguous", reason: "two in-progress work nodes", source: "factory development current-work", summary: "ambiguous", value: currentWorkFixture(refs, position)},
      peers: {state: "present", source: "central.position.list + actuation occupancy list", summary: "5 peer Position(s) in project:O-I: 2 occupied"},
      prepared_context: {state: "not-attempted", reason: "no Redis NOW material configured (--redis-config or AIKIT_WORLD_REDIS_CONFIG)", source: "Redis prepared NOW context"},
      authority: {state: "unavailable", reason: "the authority reading timed out", source: "central.files.read (Control/user/native-action-authority.json)"},
      working_surface: {state: "not-attempted", reason: "needs a SessionSpace and an AgentSession named by the open tenure", source: "AIKit SessionSpace working-surface binding"},
      return_destination: {state: "present", reason: "no work Return address or child NOW; the Workcell root NOW receives it", source: "root NOW", summary: rootNow, value: {now_ref: rootNow}},
    },
  };
}

export function refocusFixture(refs: FixtureRefs, position: string = POSITION.factory): RefocusReading {
  return {
    schema: "aikit.refocus-reading/v1", trigger: "explicit", why: "on request",
    chain: [
      {hop: "operation", ref: "attempt:review", revision: "blake3:op", detail: "review the section order [active]", source: "factory development current-work"},
      {hop: "workflow-unit", ref: "workflow-unit:review", revision: "r3", detail: "Challenge section order under hostile inputs", source: "factory development workflow-unit"},
      {hop: "run", ref: refs.runA, detail: "Survey then review the specimen", source: "factory development run"},
      {hop: "journey", gap: "no Journey or Commission is named by the current work or its Run", source: "factory development run"},
      {hop: "intent", ref: "central:source:project:O-I:ProjectCentral/user/telos", revision: "blake3:telos", detail: "1 telos source(s)", source: "ProjectCentral/user/telos"},
      {hop: "ground", ref: "central:source:project:O-I:ProjectCentral/project.json", revision: "blake3:ground", source: "ProjectCentral/project.json"},
    ],
    position: `${position} "Software Factory Guardian" (@factory-guardian) @r1`,
    root_now: refs.rootNow ?? null, return_target: refs.childNow ?? refs.rootNow ?? null, nearby: [],
  };
}
