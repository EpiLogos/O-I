/**
 * Activity liveness, frozen editions and replay — pure readings over what
 * the hosted field and the Factory owner actually hold.
 *
 *   activityReading   one published activity entry + the caller-visible
 *                     `activity_liveness` rows → live | stale | disconnected | static
 *   activityEdition   a frozen `oi.activity-edition/v1` of one Factory run reading,
 *                     keeping its source and revision basis
 *   replayActivity    the edition's recorded sequence as render steps only
 *
 * Law this module keeps: the live Expression agrees with owner state, so
 * `live` requires a hosted producer row with a fresh heartbeat. A
 * publication-time `meta.liveness` is a claim made when the world was
 * published; on its own it never yields `live` — it yields `static`, or
 * `disconnected` when the publication claimed live and no producer holds it.
 * Replay has no historical tool side effects: nothing here invokes a tool,
 * an Action, or a continuation; a live continuation or re-execution is a
 * separate admitted operation owned by Factory.
 */

export const ACTIVITY_READING_SCHEMA = 'oi.activity-reading/v1';
export const ACTIVITY_EDITION_SCHEMA = 'oi.activity-edition/v1';
export const ACTIVITY_REPLAY_SCHEMA = 'oi.activity-replay/v1';
export const FACTORY_RUN_READING_CONTRACT = 'factory.run-reading/v1';
/** Three producer intervals at the producer's 10 s default. */
export const DEFAULT_STALE_AFTER_MS = 30_000;

const LOCAL_PATH = /^(?:\/|~\/|[A-Za-z]:\\)|\/(?:Users|home)\//;

function record(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function micros(value) {
  if (value === undefined || value === null || value === '') return null;
  try { return BigInt(value); } catch { return null; }
}

function isoFromMicros(value) {
  const at = micros(value);
  return at === null ? null : new Date(Number(at / 1000n)).toISOString();
}

/** A ref safe to carry into a shared edition: a string that is not a local filesystem path. */
function portableRef(value) {
  return typeof value === 'string' && value !== '' && !LOCAL_PATH.test(value) ? value : null;
}

/**
 * The liveness of one activity entry as the caller can honestly read it.
 *
 * @param {object} input
 * @param {object} input.entry            the published activity entry (`kind: 'activity'`)
 * @param {object[]} [input.liveness_rows] caller-visible `activity_liveness` rows (snapshot shape)
 * @param {number} input.now_ms           the reader's clock
 * @param {number} [input.stale_after_ms] heartbeat age beyond which the producer is stale
 * @param {string} [input.field_ref]      the entry's hosting field, when known
 */
export function activityReading({ entry, liveness_rows = [], now_ms, stale_after_ms = DEFAULT_STALE_AFTER_MS, field_ref } = {}) {
  record(entry, 'activity entry');
  if (entry.kind !== 'activity') throw new TypeError(`activityReading needs an activity entry, not ${entry.kind}`);
  if (!Number.isFinite(now_ms)) throw new TypeError('activityReading needs a finite now_ms');
  if (!Number.isFinite(stale_after_ms) || stale_after_ms <= 0) throw new TypeError('stale_after_ms must be a positive number');
  const meta = entry.meta ?? {};
  const row = (Array.isArray(liveness_rows) ? liveness_rows : []).find((candidate) =>
    candidate && candidate.activity_ref === entry.ref && (field_ref === undefined || candidate.field_ref === field_ref));
  const base = { schema: ACTIVITY_READING_SCHEMA, activity_ref: entry.ref, run_ref: meta.run_ref ?? null, publication_claim: meta.liveness ?? null };
  if (row) {
    const heartbeat = micros(row.heartbeat_at_micros);
    const age = heartbeat === null ? Infinity : now_ms - Number(heartbeat / 1000n);
    return {
      ...base,
      liveness: age <= stale_after_ms ? 'live' : 'stale',
      owner_state: row.owner_state,
      owner_revision: Number(row.owner_revision),
      observed_at: isoFromMicros(row.observed_at_micros),
      heartbeat_at: isoFromMicros(row.heartbeat_at_micros),
      heartbeat_age_ms: Number.isFinite(age) ? age : null,
      producer_participant_ref: row.producer_participant_ref ?? null,
      basis: 'hosted-producer',
    };
  }
  const revision = Number(entry.revision);
  return {
    ...base,
    liveness: meta.liveness === 'live' ? 'disconnected' : 'static',
    owner_state: typeof meta.state === 'string' ? meta.state : null,
    owner_revision: Number.isSafeInteger(revision) ? revision : null,
    observed_at: null,
    heartbeat_at: null,
    heartbeat_age_ms: null,
    producer_participant_ref: null,
    basis: 'publication',
  };
}

/**
 * Freeze one Factory run reading as a replayable edition.
 *
 * `factory.run-reading/v1` carries no event list and no timestamps. The
 * edition records what the reading does carry — the lifecycle, the RunMap's
 * node states and edges, and the executions' statuses — in reading order,
 * and says plainly that this is not a temporal event sequence. The reading's
 * `actions` are effect affordances and are never recorded.
 */
export function activityEdition({ entry, liveness_row = null, run_reading, recorded_at } = {}) {
  record(entry, 'activity entry');
  const run = record(run_reading, 'factory run reading');
  if (run.contract !== FACTORY_RUN_READING_CONTRACT) throw new TypeError(`Unsupported factory run contract: ${run.contract}`);
  if (typeof run.runRef !== 'string' || !Number.isSafeInteger(run.revision) || run.revision < 1) throw new TypeError('factory run reading needs runRef and an integer revision >= 1');
  const runRef = entry.meta?.run_ref;
  if (typeof runRef === 'string' && runRef !== run.runRef) throw new TypeError(`activity ${entry.ref} publishes run ${runRef}, not ${run.runRef}`);
  if (typeof recorded_at !== 'string' || Number.isNaN(Date.parse(recorded_at))) throw new TypeError('recorded_at must be an ISO timestamp');

  const map = run.runMap && typeof run.runMap === 'object' ? run.runMap : null;
  const nodes = map?.nodes && typeof map.nodes === 'object'
    ? Object.values(map.nodes).map((node) => ({ id: String(node.id), kind: node.kind ?? null, label: typeof node.label === 'string' && !LOCAL_PATH.test(node.label) ? node.label : null, state: node.state ?? null }))
    : [];
  const edges = Array.isArray(map?.edges) ? map.edges.map((edge) => ({ from: String(edge.from), to: String(edge.to), relation: edge.relation ?? null })) : [];
  const executions = (Array.isArray(run.executions) ? run.executions : []).map((execution) => ({
    execution_ref: portableRef(execution.executionRef),
    status: typeof execution.status === 'string' ? execution.status : null,
    agency_ref: portableRef(execution.agencyRef),
    agent_ref: portableRef(execution.agentRef),
  }));
  const events = Array.isArray(run.events) ? run.events : null;
  return {
    schema: ACTIVITY_EDITION_SCHEMA,
    activity_ref: entry.ref,
    run_ref: run.runRef,
    recorded_at,
    owner_state: typeof run.lifecycle === 'string' ? run.lifecycle : null,
    owner_revision: run.revision,
    liveness_at_record: liveness_row ? {
      owner_state: liveness_row.owner_state,
      owner_revision: Number(liveness_row.owner_revision),
      heartbeat_at_micros: String(liveness_row.heartbeat_at_micros),
      producer_participant_ref: liveness_row.producer_participant_ref ?? null,
      agrees_with_reading: liveness_row.owner_state === run.lifecycle && Number(liveness_row.owner_revision) === run.revision,
    } : null,
    scene: { topology_revision: map?.topologyRevision ?? null, nodes, edges },
    executions,
    events,
    events_note: events === null
      ? 'factory.run-reading/v1 exposes no event list and no timestamps; this edition records lifecycle, RunMap node states and execution statuses as read at recorded_at, in reading order — not a temporal sequence'
      : 'events as recorded by factory.run-reading/v1',
    actions_recorded: false,
    basis: {
      source: FACTORY_RUN_READING_CONTRACT,
      revision: run.revision,
      factory_state_revision: run.provenance?.factoryStateRevision ?? null,
      owner: run.provenance?.owner ?? 'factory',
    },
  };
}

/**
 * Replay a frozen edition as render steps. It returns data only; any
 * `effects` runner a caller passes is deliberately never touched — replay
 * cannot re-execute a historical tool call, Action or continuation.
 */
export function replayActivity(edition, _options = {}) {
  record(edition, 'activity edition');
  if (edition.schema !== ACTIVITY_EDITION_SCHEMA) throw new TypeError(`Unsupported activity edition: ${edition.schema}`);
  const steps = [];
  const push = (step) => steps.push(Object.freeze({ index: steps.length, effect: 'none', ...step }));
  push({ kind: 'lifecycle', owner_state: edition.owner_state, owner_revision: edition.owner_revision });
  for (const node of edition.scene?.nodes ?? []) push({ kind: 'scene-node', node_id: node.id, node_kind: node.kind, label: node.label, state: node.state });
  for (const edge of edition.scene?.edges ?? []) push({ kind: 'scene-edge', from: edge.from, to: edge.to, relation: edge.relation });
  for (const execution of edition.executions ?? []) push({ kind: 'execution', execution_ref: execution.execution_ref, status: execution.status, agency_ref: execution.agency_ref, agent_ref: execution.agent_ref });
  for (const event of edition.events ?? []) push({ kind: 'event', event: structuredClone(event) });
  return Object.freeze({
    schema: ACTIVITY_REPLAY_SCHEMA,
    mode: 'replay',
    live: false,
    activity_ref: edition.activity_ref,
    recorded_at: edition.recorded_at,
    basis: edition.basis,
    ordering: edition.events === null ? 'reading-order' : 'recorded-events',
    steps: Object.freeze(steps),
  });
}
