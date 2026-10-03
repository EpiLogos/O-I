/** Atomic publication ordering for an existing native Expression Act.
 * Called by the hosted entry reducer before any table effects. This owns no
 * Act or Expression state: both revisions still come from the native owner. */
type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;

function nativeAct(entry: JsonObject): boolean {
  const meta = object(entry.meta);
  return meta?.native_owner === 'o-i' && (meta.activity_kind === 'expression-act'
    || typeof meta.native_activity_ref === 'string' && meta.native_activity_ref.startsWith('act:'));
}

function revision(entry: JsonObject): bigint | null {
  return typeof entry.revision === 'string' && /^[1-9][0-9]*$/.test(entry.revision) ? BigInt(entry.revision) : null;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const held = object(value);
  if (held) return `{${Object.keys(held).sort().map(key => `${JSON.stringify(key)}:${canonical(held[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

/** Non-native entries keep their own owner contracts. A known native Act
 * cannot evade its ordering rule by dropping its native identity metadata. */
export function nativeActEntryUpdateFailure(previous: JsonObject | null, incoming: JsonObject): string | null {
  if (!nativeAct(incoming) && (!previous || !nativeAct(previous))) return null;
  const meta = object(incoming.meta), next = revision(incoming);
  if (incoming.kind !== 'activity' || !nativeAct(incoming) || !meta || meta.activity_kind !== 'expression-act'
    || typeof meta.native_activity_ref !== 'string' || !meta.native_activity_ref.startsWith('act:')
    || typeof incoming.world_ref !== 'string' || incoming.ref !== `${incoming.world_ref}/${meta.native_activity_ref}`
    || meta.source_world_ref !== incoming.world_ref || meta.source_ref !== meta.native_activity_ref
    || typeof meta.expression_ref !== 'string' || !meta.expression_ref.startsWith('expression:')) {
    return 'Native Act publication must retain its qualified owner identity';
  }
  if (next === null || typeof meta.owner_revision !== 'number' || !Number.isSafeInteger(meta.owner_revision)
    || meta.owner_revision < 1 || BigInt(meta.owner_revision) !== next || meta.source_revision !== incoming.revision) {
    return 'Native Act publication must carry its independent owner revision';
  }
  if (!['running', 'held', 'completed', 'cancelled'].includes(String(meta.owner_state)) || meta.state !== meta.owner_state) {
    return 'Native Act publication must carry its owner phase';
  }
  if (!previous) return null;
  const prior = revision(previous), held = object(previous.meta);
  if (previous.ref !== incoming.ref || previous.world_ref !== incoming.world_ref
    || held?.native_activity_ref !== meta.native_activity_ref || !nativeAct(previous)) {
    return 'Native Act publication cannot replace another native identity';
  }
  if (prior === null) return 'The stored native Act revision is unavailable';
  if (next < prior) return 'Native Act publication revision cannot go backwards';
  if (next === prior && canonical(previous) !== canonical(incoming)) return 'Native Act publication conflicts at the same owner revision';
  return null;
}
