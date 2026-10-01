/**
 * The collective temporal projection of one SharedField: `oi.field-now/v1`
 * (the shared current reading) and `oi.field-day/v1` (a collective
 * aggregation interval).
 *
 * Law (docs/experience/WORKCELL-NOW-TEMPORAL-FIELD.md §9): NOW is recursively
 * localised and materially situated. Each Workcell keeps one persistent root
 * NOW; bounded undertakings occupy child NOWs. A SharedField projects SELECTED
 * local NOW/DAY relations into FieldNow/FieldDay WITHOUT acquiring local
 * source identity. These contracts therefore carry refs and native revisions
 * only: never a path, a session ref, a gateway address, a token, a transcript
 * or any other local-only material — and they have no fields that could.
 *
 * Every projected entry is attributed (`projected_by`) to the Participant
 * that projected it, so the hosted authority can hold each participant to
 * projecting and withdrawing only its own entries.
 *
 * Mutation is compare-and-swap: `advanceFieldNow`/`advanceFieldDay` require
 * the `expected_revision` the writer read and produce exactly revision + 1.
 * A stale writer is refused instead of silently winning.
 */
import { WORLD_LOCAL_LEAK_PATTERNS, WORLD_PROTECTED_KEYS } from './central-wiki-projection.mjs';

export const FIELD_NOW_SCHEMA = 'oi.field-now/v1';
export const FIELD_DAY_SCHEMA = 'oi.field-day/v1';
export const CHILD_NOW_STATES = Object.freeze(['active', 'waiting', 'blocked', 'quiescent', 'resolved', 'archived']);
export const FIELD_TIME_VISIBILITIES = Object.freeze(['public', 'restricted', 'private']);
export const FIELD_NOW_LIMITS = Object.freeze({ roots: 32, children: 64, day_refs: 64, now_refs: 64, purpose: 280, bytes: 32 * 1024 });

/** Central NOW refs (`central:now:control:root:<hash>`, `central:now:project:<Name>:<hash>`). */
export const NOW_REF_PATTERN = /^central:now:[a-z][a-z0-9-]*(?::[A-Za-z0-9._-]+)+$/;
/** Central Day refs (`central:day:control:root:2026-09-28`). */
export const DAY_REF_PATTERN = /^central:day:[a-z][a-z0-9-]*(?::[A-Za-z0-9._-]+)+$/;
export const WORKCELL_REF_PATTERN = /^workcell:[a-z0-9][a-z0-9.-]*$/;
export const WORLD_REF_PATTERN = /^(?:control:root|project:[A-Za-z0-9._-]+|world:[A-Za-z0-9._:-]+)$/;

/** Local-only material beyond refs: the shared World leak shapes plus local
 * filesystem paths and session/SessionSpace refs. */
export const FIELD_TIME_LEAK_PATTERNS = WORLD_LOCAL_LEAK_PATTERNS;

const ROOT_KEYS = new Set(['now_ref', 'workcell_ref', 'world_ref', 'revision', 'projected_by']);
const CHILD_KEYS = new Set(['now_ref', 'parent_now_ref', 'workcell_ref', 'purpose_summary', 'state', 'projected_by']);
const FIELD_NOW_KEYS = new Set([
  'schema', 'field_ref', 'revision', 'projected_root_now_refs', 'projected_child_now_refs',
  'presence_cursor', 'activity_cursor', 'contribution_cursor', 'audience', 'provenance',
]);
const FIELD_DAY_KEYS = new Set([
  'schema', 'field_ref', 'revision', 'interval', 'temporal_policy_provenance',
  'projected_source_day_refs', 'projected_now_refs', 'cursors', 'audience',
]);
const DAY_REF_KEYS = new Set(['day_ref', 'world_ref', 'workcell_ref', 'projected_by']);
const DAY_NOW_KEYS = new Set(['now_ref', 'projected_by']);
const CURSOR_KEYS = new Set(['activity_cursor', 'contribution_cursor', 'encounter_cursor']);
const FIELD_NOW_CURSORS = ['presence_cursor', 'activity_cursor', 'contribution_cursor'];

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function record(value, name) {
  if (!isRecord(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name, max = 512) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  if (value.length > max) throw new TypeError(`${name} must be at most ${max} characters`);
  return value;
}

function matching(value, pattern, name) {
  text(value, name);
  if (!pattern.test(value)) throw new TypeError(`${name} is not a well-formed ref: ${value}`);
  return value;
}

function exactKeys(value, allowed, name, schema) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${name}.${key} is not part of ${schema}`);
  }
}

function positiveRevision(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be an integer >= 1`);
  return value;
}

function list(value, name, max) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  if (value.length > max) throw new TypeError(`${name} exceeds ${max} entries`);
  return value;
}

/** Every leak the value would carry outward: protected keys anywhere in the
 * tree and local-only shapes in any string. Empty means refs-only. */
export function fieldTimeLeaks(value) {
  const leaks = [];
  const visit = (node, path) => {
    if (typeof node === 'string') {
      for (const { name, pattern } of FIELD_TIME_LEAK_PATTERNS) if (pattern.test(node)) leaks.push({ path, kind: name });
      return;
    }
    if (Array.isArray(node)) { node.forEach((entry, index) => visit(entry, `${path}[${index}]`)); return; }
    if (isRecord(node)) {
      for (const [key, entry] of Object.entries(node)) {
        if (WORLD_PROTECTED_KEYS.includes(key)) leaks.push({ path: `${path}.${key}`, kind: 'protected-key' });
        visit(entry, `${path}.${key}`);
      }
    }
  };
  visit(value, '$');
  return leaks;
}

function refuseLeaks(value, schema) {
  const leaks = fieldTimeLeaks(value);
  if (leaks.length) {
    throw new TypeError(`${schema} refuses local-only material: ${leaks.map((leak) => `${leak.kind} at ${leak.path}`).join(', ')}`);
  }
}

function validateAudience(audience, name) {
  const value = record(audience, name);
  exactKeys(value, new Set(['visibility', 'refs']), name, 'audience');
  if (!FIELD_TIME_VISIBILITIES.includes(value.visibility)) throw new TypeError(`${name}.visibility must be one of: ${FIELD_TIME_VISIBILITIES.join(', ')}`);
  if (value.refs !== undefined) {
    const seen = new Set();
    list(value.refs, `${name}.refs`, 32).forEach((ref, index) => {
      text(ref, `${name}.refs[${index}]`);
      if (seen.has(ref)) throw new TypeError(`${name}.refs contains duplicate ref: ${ref}`);
      seen.add(ref);
    });
  }
  if (value.visibility === 'private' && !(value.refs ?? []).length) throw new TypeError(`${name}: a private audience must name its participant refs`);
  return clone(value);
}

function validateProvenance(provenance) {
  return list(provenance, 'FieldNow provenance', 16).map((entry, index) => {
    const name = `FieldNow provenance[${index}]`;
    const value = record(entry, name);
    exactKeys(value, new Set(['kind', 'ref', 'source_system', 'revision']), name, FIELD_NOW_SCHEMA);
    text(value.kind, `${name}.kind`, 64);
    text(value.ref, `${name}.ref`);
    text(value.source_system, `${name}.source_system`, 64);
    if (value.revision !== undefined) text(value.revision, `${name}.revision`);
    return clone(value);
  });
}

function validateRoot(entry, index) {
  const name = `projected_root_now_refs[${index}]`;
  const value = record(entry, name);
  exactKeys(value, ROOT_KEYS, name, FIELD_NOW_SCHEMA);
  matching(value.now_ref, NOW_REF_PATTERN, `${name}.now_ref`);
  matching(value.workcell_ref, WORKCELL_REF_PATTERN, `${name}.workcell_ref`);
  matching(value.world_ref, WORLD_REF_PATTERN, `${name}.world_ref`);
  text(value.revision, `${name}.revision`);
  text(value.projected_by, `${name}.projected_by`);
  return clone(value);
}

function validateChild(entry, index) {
  const name = `projected_child_now_refs[${index}]`;
  const value = record(entry, name);
  exactKeys(value, CHILD_KEYS, name, FIELD_NOW_SCHEMA);
  matching(value.now_ref, NOW_REF_PATTERN, `${name}.now_ref`);
  matching(value.parent_now_ref, NOW_REF_PATTERN, `${name}.parent_now_ref`);
  matching(value.workcell_ref, WORKCELL_REF_PATTERN, `${name}.workcell_ref`);
  if (value.purpose_summary !== undefined) text(value.purpose_summary, `${name}.purpose_summary`, FIELD_NOW_LIMITS.purpose);
  if (!CHILD_NOW_STATES.includes(value.state)) throw new TypeError(`${name}.state must be one of: ${CHILD_NOW_STATES.join(', ')}`);
  text(value.projected_by, `${name}.projected_by`);
  if (value.parent_now_ref === value.now_ref) throw new TypeError(`${name} cannot be its own parent`);
  return clone(value);
}

/** Validate one `oi.field-now/v1` reading. Returns a detached copy. */
export function validateFieldNow(input) {
  const value = record(input, 'FieldNow');
  exactKeys(value, FIELD_NOW_KEYS, 'FieldNow', FIELD_NOW_SCHEMA);
  if (value.schema !== FIELD_NOW_SCHEMA) throw new TypeError(`FieldNow.schema must be ${FIELD_NOW_SCHEMA}`);
  text(value.field_ref, 'FieldNow.field_ref');
  positiveRevision(value.revision, 'FieldNow.revision');
  const roots = list(value.projected_root_now_refs, 'FieldNow.projected_root_now_refs', FIELD_NOW_LIMITS.roots).map(validateRoot);
  const children = list(value.projected_child_now_refs, 'FieldNow.projected_child_now_refs', FIELD_NOW_LIMITS.children).map(validateChild);
  const seen = new Set();
  for (const entry of [...roots, ...children]) {
    if (seen.has(entry.now_ref)) throw new TypeError(`FieldNow projects ${entry.now_ref} more than once`);
    seen.add(entry.now_ref);
  }
  const rootWorkcells = new Set();
  const rootsByRef = new Map(roots.map((root) => [root.now_ref, root]));
  for (const root of roots) {
    // One persistent root NOW per Workcell.
    if (rootWorkcells.has(root.workcell_ref)) throw new TypeError(`FieldNow projects two root NOWs for ${root.workcell_ref}`);
    rootWorkcells.add(root.workcell_ref);
  }
  for (const child of children) {
    // A projected parent root fixes the child's material situation; an
    // unprojected parent stays a bare ref (projection is selective).
    const parent = rootsByRef.get(child.parent_now_ref);
    if (parent && parent.workcell_ref !== child.workcell_ref) {
      throw new TypeError(`child NOW ${child.now_ref} is situated on ${child.workcell_ref} but its projected root is on ${parent.workcell_ref}`);
    }
  }
  for (const cursor of FIELD_NOW_CURSORS) if (value[cursor] !== undefined) text(value[cursor], `FieldNow.${cursor}`);
  validateAudience(value.audience, 'FieldNow.audience');
  if (!validateProvenance(value.provenance).length) throw new TypeError('FieldNow provenance must be a non-empty array');
  refuseLeaks(value, FIELD_NOW_SCHEMA);
  if (Buffer.byteLength(JSON.stringify(value)) > FIELD_NOW_LIMITS.bytes) throw new TypeError(`FieldNow exceeds ${FIELD_NOW_LIMITS.bytes} bytes`);
  return clone(value);
}

function upsertByRef(entries, updates, key, projectedBy) {
  const identity = typeof key === 'function' ? key : (entry) => entry[key];
  const next = new Map(entries.map((entry) => [identity(entry), entry]));
  for (const update of updates ?? []) {
    record(update, 'upsert entry');
    next.set(identity(update), { ...update, projected_by: update.projected_by ?? projectedBy });
  }
  return Array.from(next.values());
}

function withdrawByRef(entries, refs, key) {
  const drop = new Set(refs ?? []);
  return entries.filter((entry) => !drop.has(entry[key]));
}

function requireExpected(prior, change, schema) {
  const expected = change.expected_revision;
  if (!Number.isSafeInteger(expected) || expected < 0) throw new TypeError(`${schema} change requires the integer expected_revision the writer read`);
  const current = prior ? prior.revision : 0;
  if (expected !== current) throw new TypeError(`${schema} moved on: it is at revision ${current}, writer expected ${expected}`);
  return current;
}

/**
 * The pure compare-and-swap step. `prior` is the current reading (or null for
 * a field's first FieldNow); `change` carries `expected_revision`,
 * `projected_by` (the acting Participant, stamped onto every upserted entry
 * that does not name one), and any of `upsert_root_now_refs`,
 * `withdraw_root_now_refs` (now_ref strings), `upsert_child_now_refs`,
 * `withdraw_child_now_refs`, the three cursors (null clears), and — first
 * revision or owner change — `field_ref`, `audience`, `provenance`.
 */
export function advanceFieldNow(prior, change) {
  record(change, 'FieldNow change');
  const current = prior ? validateFieldNow(prior) : null;
  const revision = requireExpected(current, change, FIELD_NOW_SCHEMA);
  if (!current && (change.field_ref === undefined || change.audience === undefined || change.provenance === undefined)) {
    throw new TypeError('the first FieldNow revision requires field_ref, audience and provenance');
  }
  if (current && change.field_ref !== undefined && change.field_ref !== current.field_ref) throw new TypeError('FieldNow cannot move between SharedFields');
  const base = current ?? { schema: FIELD_NOW_SCHEMA, field_ref: change.field_ref, revision: 0, projected_root_now_refs: [], projected_child_now_refs: [] };
  const next = {
    schema: FIELD_NOW_SCHEMA,
    field_ref: base.field_ref,
    revision: revision + 1,
    projected_root_now_refs: upsertByRef(withdrawByRef(base.projected_root_now_refs, change.withdraw_root_now_refs, 'now_ref'), change.upsert_root_now_refs, 'now_ref', change.projected_by),
    projected_child_now_refs: upsertByRef(withdrawByRef(base.projected_child_now_refs, change.withdraw_child_now_refs, 'now_ref'), change.upsert_child_now_refs, 'now_ref', change.projected_by),
    audience: change.audience ?? base.audience,
    provenance: change.provenance ?? base.provenance,
  };
  for (const cursor of FIELD_NOW_CURSORS) {
    const value = change[cursor] === undefined ? base[cursor] : change[cursor];
    if (value !== null && value !== undefined) next[cursor] = value;
  }
  return validateFieldNow(next);
}

function entryDelta(priorEntries, nextEntries, key) {
  const identity = typeof key === 'function' ? key : (entry) => entry[key];
  const prior = new Map(priorEntries.map((entry) => [identity(entry), entry]));
  const next = new Map(nextEntries.map((entry) => [identity(entry), entry]));
  const changed = [];
  for (const ref of new Set([...prior.keys(), ...next.keys()])) {
    const before = prior.get(ref);
    const after = next.get(ref);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    const attributed = new Set([before?.projected_by, after?.projected_by].filter(Boolean));
    const source = after ?? before;
    const qualification = typeof key === 'function' && source.world_ref
      ? { world_ref: source.world_ref, ...(source.workcell_ref ? { workcell_ref: source.workcell_ref } : {}) } : {};
    changed.push({ ref: typeof key === 'function' ? source.day_ref : ref, ...qualification, change: !before ? 'added' : !after ? 'withdrawn' : 'changed', projected_by: Array.from(attributed) });
  }
  return changed;
}

/** What one FieldNow step touched, in the terms hosted authority judges:
 * root entries, child entries (with every Participant they are attributed to
 * before and after), and the envelope (field, audience, provenance). */
export function fieldNowDelta(prior, next) {
  const before = prior ?? { projected_root_now_refs: [], projected_child_now_refs: [] };
  return {
    roots: entryDelta(before.projected_root_now_refs, next.projected_root_now_refs, 'now_ref'),
    children: entryDelta(before.projected_child_now_refs, next.projected_child_now_refs, 'now_ref'),
    envelope_changed: !prior
      || JSON.stringify(prior.audience) !== JSON.stringify(next.audience)
      || JSON.stringify(prior.provenance) !== JSON.stringify(next.provenance),
  };
}

// ---------------------------------------------------------------------------
// FieldDay
// ---------------------------------------------------------------------------

function isoInstant(value, name) {
  text(value, name, 64);
  if (Number.isNaN(Date.parse(value))) throw new TypeError(`${name} must be an ISO-8601 instant`);
  return value;
}

/** The stable identity of one FieldDay: its field and interval. */
export function fieldDayKey(fieldDay) {
  return `${fieldDay.field_ref}|${fieldDay.interval.start}|${fieldDay.interval.end}`;
}

// Personal refs are local to their World, even when their spellings match.
// Old unqualified readings remain readable; a colliding withdrawal cannot
// guess which source the participant meant.
function sourceDayKey(entry) {
  return entry.world_ref || entry.workcell_ref
    ? JSON.stringify([entry.world_ref ?? '', entry.workcell_ref ?? '', entry.day_ref])
    : entry.day_ref;
}

function withdrawSourceDays(entries, refs = []) {
  const drop = new Set();
  for (const ref of refs) {
    if (typeof ref === 'string') {
      const matches = entries.filter((entry) => entry.day_ref === ref);
      if (matches.length > 1) throw new TypeError('ambiguous personal Day withdrawal: provide world_ref, workcell_ref and day_ref');
      for (const entry of matches) drop.add(sourceDayKey(entry));
    } else {
      record(ref, 'qualified personal Day withdrawal');
      drop.add(sourceDayKey(ref));
    }
  }
  return entries.filter((entry) => !drop.has(sourceDayKey(entry)));
}

/** Validate one `oi.field-day/v1` aggregation interval. Its own policy and
 * the source Day refs it composes remain distinct relations: a participant's
 * local civil Day is referenced, never rewritten into the field interval. */
export function validateFieldDay(input) {
  const value = record(input, 'FieldDay');
  exactKeys(value, FIELD_DAY_KEYS, 'FieldDay', FIELD_DAY_SCHEMA);
  if (value.schema !== FIELD_DAY_SCHEMA) throw new TypeError(`FieldDay.schema must be ${FIELD_DAY_SCHEMA}`);
  text(value.field_ref, 'FieldDay.field_ref');
  positiveRevision(value.revision, 'FieldDay.revision');
  const interval = record(value.interval, 'FieldDay.interval');
  exactKeys(interval, new Set(['start', 'end', 'policy']), 'FieldDay.interval', FIELD_DAY_SCHEMA);
  isoInstant(interval.start, 'FieldDay.interval.start');
  isoInstant(interval.end, 'FieldDay.interval.end');
  if (Date.parse(interval.end) <= Date.parse(interval.start)) throw new TypeError('FieldDay.interval.end must follow its start');
  text(interval.policy, 'FieldDay.interval.policy', 128);
  const policy = record(value.temporal_policy_provenance, 'FieldDay.temporal_policy_provenance');
  exactKeys(policy, new Set(['source_system', 'ref', 'revision']), 'FieldDay.temporal_policy_provenance', FIELD_DAY_SCHEMA);
  text(policy.source_system, 'FieldDay.temporal_policy_provenance.source_system', 64);
  text(policy.ref, 'FieldDay.temporal_policy_provenance.ref');
  text(policy.revision, 'FieldDay.temporal_policy_provenance.revision');
  const seen = new Set();
  list(value.projected_source_day_refs, 'FieldDay.projected_source_day_refs', FIELD_NOW_LIMITS.day_refs).forEach((entry, index) => {
    const name = `FieldDay.projected_source_day_refs[${index}]`;
    record(entry, name);
    exactKeys(entry, DAY_REF_KEYS, name, FIELD_DAY_SCHEMA);
    matching(entry.day_ref, DAY_REF_PATTERN, `${name}.day_ref`);
    if (entry.world_ref !== undefined) text(entry.world_ref, `${name}.world_ref`);
    if (entry.workcell_ref !== undefined) matching(entry.workcell_ref, WORKCELL_REF_PATTERN, `${name}.workcell_ref`);
    text(entry.projected_by, `${name}.projected_by`);
    const identity = sourceDayKey(entry);
    if (seen.has(identity)) throw new TypeError(`FieldDay projects ${identity} more than once`);
    seen.add(identity);
  });
  list(value.projected_now_refs, 'FieldDay.projected_now_refs', FIELD_NOW_LIMITS.now_refs).forEach((entry, index) => {
    const name = `FieldDay.projected_now_refs[${index}]`;
    record(entry, name);
    exactKeys(entry, DAY_NOW_KEYS, name, FIELD_DAY_SCHEMA);
    matching(entry.now_ref, NOW_REF_PATTERN, `${name}.now_ref`);
    text(entry.projected_by, `${name}.projected_by`);
    if (seen.has(entry.now_ref)) throw new TypeError(`FieldDay projects ${entry.now_ref} more than once`);
    seen.add(entry.now_ref);
  });
  const cursors = record(value.cursors, 'FieldDay.cursors');
  exactKeys(cursors, CURSOR_KEYS, 'FieldDay.cursors', FIELD_DAY_SCHEMA);
  for (const [key, cursor] of Object.entries(cursors)) text(cursor, `FieldDay.cursors.${key}`);
  validateAudience(value.audience, 'FieldDay.audience');
  refuseLeaks(value, FIELD_DAY_SCHEMA);
  if (Buffer.byteLength(JSON.stringify(value)) > FIELD_NOW_LIMITS.bytes) throw new TypeError(`FieldDay exceeds ${FIELD_NOW_LIMITS.bytes} bytes`);
  return clone(value);
}

/** The FieldDay compare-and-swap step: `change` carries `expected_revision`,
 * `projected_by`, `upsert_source_day_refs`/`withdraw_source_day_refs`,
 * `upsert_now_refs`/`withdraw_now_refs`, `cursors` (merged; null clears a
 * cursor), and — first revision or owner change — `field_ref`, `interval`,
 * `temporal_policy_provenance`, `audience`. The interval is the FieldDay's
 * identity and cannot move once written. */
export function advanceFieldDay(prior, change) {
  record(change, 'FieldDay change');
  const current = prior ? validateFieldDay(prior) : null;
  const revision = requireExpected(current, change, FIELD_DAY_SCHEMA);
  if (!current && ['field_ref', 'interval', 'temporal_policy_provenance', 'audience'].some((key) => change[key] === undefined)) {
    throw new TypeError('the first FieldDay revision requires field_ref, interval, temporal_policy_provenance and audience');
  }
  if (current && change.field_ref !== undefined && change.field_ref !== current.field_ref) throw new TypeError('FieldDay cannot move between SharedFields');
  if (current && change.interval !== undefined && JSON.stringify(change.interval) !== JSON.stringify(current.interval)) {
    throw new TypeError('FieldDay interval is its identity; open a new FieldDay instead');
  }
  const base = current ?? { field_ref: change.field_ref, interval: change.interval, projected_source_day_refs: [], projected_now_refs: [], cursors: {} };
  const cursors = { ...base.cursors };
  for (const [key, cursor] of Object.entries(change.cursors ?? {})) {
    if (cursor === null) delete cursors[key];
    else cursors[key] = cursor;
  }
  return validateFieldDay({
    schema: FIELD_DAY_SCHEMA,
    field_ref: base.field_ref,
    revision: revision + 1,
    interval: base.interval,
    temporal_policy_provenance: change.temporal_policy_provenance ?? base.temporal_policy_provenance,
    projected_source_day_refs: upsertByRef(withdrawSourceDays(base.projected_source_day_refs, change.withdraw_source_day_refs), change.upsert_source_day_refs, sourceDayKey, change.projected_by),
    projected_now_refs: upsertByRef(withdrawByRef(base.projected_now_refs, change.withdraw_now_refs, 'now_ref'), change.upsert_now_refs, 'now_ref', change.projected_by),
    cursors,
    audience: change.audience ?? base.audience,
  });
}

/** What one FieldDay step touched: attributed entries and the owner-held
 * envelope (interval policy provenance and audience). */
export function fieldDayDelta(prior, next) {
  const before = prior ?? { projected_source_day_refs: [], projected_now_refs: [] };
  return {
    entries: [
      ...entryDelta(before.projected_source_day_refs, next.projected_source_day_refs, sourceDayKey),
      ...entryDelta(before.projected_now_refs, next.projected_now_refs, 'now_ref'),
    ],
    envelope_changed: !prior
      || JSON.stringify(prior.temporal_policy_provenance) !== JSON.stringify(next.temporal_policy_provenance)
      || JSON.stringify(prior.audience) !== JSON.stringify(next.audience),
  };
}
