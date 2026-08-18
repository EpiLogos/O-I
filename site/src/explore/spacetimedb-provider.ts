import { DbConnection } from './spacetimedb-bindings/index';
// @ts-ignore -- transport-neutral hosted adapter is intentionally plain JS.
import { createLiveExploreApplication, createSpacetimeExploreSource, projectionStorageKey } from '../../../shared-field/spacetimedb.mjs';
// @ts-ignore -- Surface composition remains transport-neutral plain JS.
import { exploreSurfaceSeedFromHostedSnapshot } from '../../../shared-field/spacetimedb-explore-surface.mjs';

type ExploreSeed = Record<string, any>;

type Config = {
  uri: string;
  database: string;
};

type Status = {
  state: 'connecting' | 'live' | 'degraded';
  uri: string;
  database: string;
  detail?: string;
};

type Callbacks = {
  onSeed(seed: ExploreSeed): void;
  onAuthorityChange?(): void;
  onStatus?(status: Status): void;
  onError?(error: Error): void;
};

type AuthoringAuthority = {
  publisher_participant_ref: string;
  provenance: Array<{ kind: 'human-refinement'; ref: string; source_system: string; revision: string }>;
  transport: { provider: 'spacetimedb'; database: string; field_ref: string };
};

const QUERIES = [
  'SELECT * FROM shared_field',
  'SELECT * FROM participant',
  'SELECT * FROM projection',
  'SELECT * FROM explore_entry',
  'SELECT * FROM explore_relation',
  'SELECT * FROM my_field_authority',
];

function rows(handle: any): any[] {
  return handle && typeof handle.iter === 'function' ? [...handle.iter()] : [];
}

function tokenKey(config: Config) {
  return `oi.spacetimedb:${config.uri}/${config.database}:auth-token`;
}

function queryParam(name: string) {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

export function readSpacetimeExploreConfig(): Config | null {
  const uri = queryParam('spacetimedb_uri') ?? import.meta.env.VITE_OI_SPACETIMEDB_URI;
  const database = queryParam('spacetimedb_database') ?? import.meta.env.VITE_OI_SPACETIMEDB_DATABASE;
  if (!uri || !database) return null;
  return { uri: String(uri), database: String(database) };
}

function humanParticipantForGrant(db: any, participantRef: string) {
  const participant = rows(db.participant).find((row) => row.participantRef === participantRef);
  if (!participant) return undefined;
  try {
    const contract = JSON.parse(participant.contractJson);
    return contract?.identity?.kind === 'human' ? contract : undefined;
  } catch {
    return undefined;
  }
}

function fieldRefForResource(db: any, ref: string): string | undefined {
  const entry = rows(db.exploreEntry).find((row) => row.semanticRef === ref);
  if (entry?.fieldRef) return entry.fieldRef;
  const projection = rows(db.projection).find((row) => row.projectionRef === ref);
  return projection?.fieldRef;
}

function fieldRefForProjection(db: any, projection: Record<string, any>, anchorRef?: string): string | undefined {
  const current = rows(db.projection).find((row) => row.projectionRef === projection.projection_ref);
  if (current?.fieldRef) return current.fieldRef;
  const subject = projection?.subject?.ref;
  if (typeof subject === 'string') {
    const subjectEntry = rows(db.exploreEntry).find((row) => row.semanticRef === subject);
    if (subjectEntry?.fieldRef) return subjectEntry.fieldRef;
  }
  return anchorRef ? fieldRefForResource(db, anchorRef) : undefined;
}

export function connectSpacetimeExplore(config: Config, callbacks: Callbacks) {
  let disposed = false;
  let reconnectTimer: number | undefined;
  let reconnectAttempt = 0;
  let connection: any;
  let liveApplication: any;
  let subscriptionHandle: any;
  let removeAuthorityListeners: (() => void) | undefined;

  const status = (state: Status['state'], detail?: string) => callbacks.onStatus?.({ state, ...config, ...(detail ? { detail } : {}) });

  function scheduleReconnect(error?: Error) {
    if (disposed || reconnectTimer !== undefined) return;
    status('degraded', error?.message ?? 'SpaceTimeDB connection ended.');
    if (error) callbacks.onError?.(error);
    const delay = Math.min(15_000, 500 * 2 ** Math.min(reconnectAttempt, 5));
    reconnectAttempt += 1;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, delay);
  }

  function attachAuthorityListeners(db: any) {
    const handle = db.myFieldAuthority;
    if (!handle) return () => undefined;
    const removers: Array<() => void> = [];
    const notify = () => callbacks.onAuthorityChange?.();
    if (typeof handle.onInsert === 'function') {
      handle.onInsert(notify);
      if (typeof handle.removeOnInsert === 'function') removers.push(() => handle.removeOnInsert(notify));
    }
    if (typeof handle.onUpdate === 'function') {
      handle.onUpdate(notify);
      if (typeof handle.removeOnUpdate === 'function') removers.push(() => handle.removeOnUpdate(notify));
    }
    if (typeof handle.onDelete === 'function') {
      handle.onDelete(notify);
      if (typeof handle.removeOnDelete === 'function') removers.push(() => handle.removeOnDelete(notify));
    }
    return () => removers.reverse().forEach((remove) => remove());
  }

  function installLiveConnection(conn: any) {
    let applied = false;
    const nextLive = createLiveExploreApplication(createSpacetimeExploreSource(conn.db));
    const removeLiveListener = nextLive.subscribe((event: any) => {
      if (!applied || event?.type !== 'rebuild') return;
      callbacks.onSeed(exploreSurfaceSeedFromHostedSnapshot(nextLive.snapshot()));
    });

    const handle = conn.subscriptionBuilder()
      .onApplied(() => {
        if (disposed) return;
        applied = true;
        reconnectAttempt = 0;
        liveApplication?.dispose?.();
        removeAuthorityListeners?.();
        subscriptionHandle = handle;
        liveApplication = nextLive;
        connection = conn;
        removeAuthorityListeners = attachAuthorityListeners(conn.db);
        callbacks.onSeed(exploreSurfaceSeedFromHostedSnapshot(nextLive.snapshot()));
        callbacks.onAuthorityChange?.();
        status('live');
      })
      .onError((_ctx: unknown, error: Error) => {
        removeLiveListener();
        nextLive.dispose?.();
        scheduleReconnect(error);
      })
      .subscribe(QUERIES);
  }

  function connect() {
    if (disposed) return;
    status('connecting');
    let builder = DbConnection.builder()
      .withUri(config.uri)
      .withDatabaseName(config.database)
      .onConnect((conn: any, _identity: unknown, token: string) => {
        if (disposed) {
          try { conn.disconnect(); } catch { /* already disconnected */ }
          return;
        }
        if (token) localStorage.setItem(tokenKey(config), token);
        installLiveConnection(conn);
      })
      .onConnectError((_ctx: unknown, error: Error) => scheduleReconnect(error))
      .onDisconnect((_ctx: unknown, error: Error | null) => {
        if (!disposed) scheduleReconnect(error ?? new Error('SpaceTimeDB disconnected.'));
      });

    const token = localStorage.getItem(tokenKey(config));
    if (token) builder = builder.withToken(token);
    builder.build();
  }

  function authoringAuthorityFor(ref: string): AuthoringAuthority | null {
    const db = connection?.db;
    if (!db) return null;
    const fieldRef = fieldRefForResource(db, ref);
    if (!fieldRef) return null;
    const grant = rows(db.myFieldAuthority).find((row) =>
      row.fieldRef === fieldRef && row.role === 'contributor' && humanParticipantForGrant(db, row.participantRef)
    );
    if (!grant) return null;
    return {
      publisher_participant_ref: grant.participantRef,
      provenance: [{
        kind: 'human-refinement',
        ref: grant.participantRef,
        source_system: 'o-i',
        revision: `spacetimedb-authority@${String(grant.grantedAtMicros)}`,
      }],
      transport: { provider: 'spacetimedb', database: config.database, field_ref: fieldRef },
    };
  }

  async function publishProjection(projection: Record<string, any>, anchorRef?: string) {
    const conn = connection;
    if (!conn) throw new Error('SpaceTimeDB Explore provider is not connected.');
    const fieldRef = fieldRefForProjection(conn.db, projection, anchorRef);
    if (!fieldRef) throw new Error(`Cannot resolve SharedField for Projection ${String(projection.projection_ref)}.`);
    await conn.reducers.putProjection({
      projectionKey: projectionStorageKey(projection.projection_ref, projection.projection_revision),
      fieldRef,
      projectionRef: projection.projection_ref,
      projectionRevision: projection.projection_revision,
      sourceRevision: projection.source.revision,
      publisherParticipantRef: projection.publisher_participant_ref,
      state: projection.state,
      contractJson: JSON.stringify(projection),
    });
    return { field_ref: fieldRef, projection_ref: projection.projection_ref, projection_revision: projection.projection_revision };
  }

  function dispose() {
    disposed = true;
    if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    removeAuthorityListeners?.();
    liveApplication?.dispose?.();
    try { subscriptionHandle?.unsubscribe?.(); } catch { /* connection teardown is sufficient */ }
    try { connection?.disconnect?.(); } catch { /* already disconnected */ }
  }

  connect();

  return Object.freeze({
    kind: 'spacetimedb' as const,
    config,
    authoringAuthorityFor,
    publishProjection,
    dispose,
  });
}

export type SpacetimeExploreProvider = ReturnType<typeof connectSpacetimeExplore>;
