/** The Expressions frame's storage, carried once from the shell's origin to the frame's own (O-I #747 round 896, item 0.3).
 *
 * The frame has an origin of its own, so no script in it can reach the shell's realm, and the host's IPC with it (native_shell.rs
 * `expressions_entry`). Its browser storage moved with it: until this round the frame was served at the shell's origin, and what the
 * person kept there (the Library, drafts, the recovery records, the workspace and the frame's other settings in localStorage, and the
 * recovery database in IndexedDB) stands at the shell's origin. That is the one thing the isolation took away from the frame, so it is
 * carried through the boundary: before the frame's application boots, the frame asks its host once (`STORAGE_CARRY_REQUEST`, to the
 * host's exact origin), the host reads its own origin's storage and posts it back (`STORAGE_CARRY`, to the frame's exact origin, only
 * before the frame has given its first state), and the frame writes it into its own storage, then marks the carry done
 * (`STORAGE_CARRIED_KEY`), so it is asked once. A carried key never overwrites one the frame holds already: what the frame wrote at
 * its own origin stands, and the carry only adds what it lacks (round 896, 1R-surface.2). A carry not answered, or written only in part
 * (a key or the recovery records not written), is not done: the frame records that it ran uncarried (`STORAGE_UNCARRIED_KEY`) and asks
 * again at its next start (1R-surface.1). Only the frame's own keys are carried (`FRAME_STORAGE_PREFIXES`), never the shell's own
 * state, and each answer names the request it answers. A host that serves the frame at its own origin answers that there is nothing to
 * carry. The shell's storage is read, never moved. */
import {knownHostOrigin} from './hostOrigin.ts';

export const STORAGE_CARRY_REQUEST = 'oi-storage-carry-request';
export const STORAGE_CARRY = 'oi-storage-carry';
export const STORAGE_CARRY_SCHEMA = 'oi.expressions-storage-carry/v1';
/** The frame's record that its storage was carried (and from where, and what was not). */
export const STORAGE_CARRIED_KEY = 'oi.expressions.storage-carried.v1';
/** The frame's record that it ran here before its storage was carried: what it wrote since then stands over the carry. */
export const STORAGE_UNCARRIED_KEY = 'oi.expressions.storage-uncarried.v1';
const OWN_KEYS: ReadonlySet<string> = new Set([STORAGE_CARRIED_KEY, STORAGE_UNCARRIED_KEY]);
/** The frame's own localStorage keys, by their prefixes (O-I #747 round 896, 1R-surface.2): the Library and its last work, the session,
 * the tab and the journey library (`oi.field-studies.`), the recovery records' localStorage fallback (`oi.expression-recovery.`), the
 * recovery session, the recent works, the workspace (the toolbelt), the panels' sizes, the legacy studio's snapshots, themes and
 * materials, and where the person stands in each journey (the journey instrument's presence, journeyPresence.ts; the shell's Techne
 * journey keeps the same record). The host carries these alone; the shell's own state (its chat and flow drafts, its layout) stays
 * at its origin. Every key the frame's pages name is one of these (pinned against their sources in storage-carry-896.test.mjs). */
export const FRAME_STORAGE_PREFIXES: readonly string[] = Object.freeze(['oi.field-studies.', 'oi.expression-recovery.',
  'oi.expression-session.v1', 'oi.recent-work.v1', 'oi.workspace.v1', 'oi.panel-sizes.v1', 'typographic_pointcloud_saved_states',
  'pointcloud_saved_', 'oi-cradle.techne-journey.presence.v1']);
/** Whether a key is the frame's own, to be carried (the carry's own records never are). */
export const frameStorageKey = (key: string): boolean => !OWN_KEYS.has(key) && FRAME_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix));
/** The frame's recovery database (field-studies-journeys/src/recovery.ts `db`): its name, version and stores, each keyed by `id`. */
export const RECOVERY_DATABASE = {name: 'oi.expression-recovery', version: 3, stores: ['drafts', 'nativeWorking', 'quarantine']} as const;
/** How long the frame waits for its host's carry before it boots without it (and asks again at its next start). */
export const STORAGE_CARRY_TIMEOUT_MS = 10_000;

export interface StorageCarry {
  schema: typeof STORAGE_CARRY_SCHEMA;
  /** The shell's origin, read from. */
  from: string;
  /** The frame's own localStorage entries the shell's origin holds (`frameStorageKey`). */
  local: [string, string][];
  /** The recovery database's rows, per store; null where the shell's origin holds no recovery database. */
  recovery: Record<string, unknown[]> | null;
  /** Why the recovery database was not read, where it was not. */
  recovery_error?: string;
}

export interface CarryOutcome {
  state: 'top' | 'kept' | 'carried' | 'carried-in-part' | 'same-origin' | 'unanswered' | 'no-storage' | 'no-host-origin';
  keys?: number;
  failed?: string[];
  recovery?: Record<string, number>;
  recovery_error?: string;
  /** What the frame says of it, where the person should know: a carry left undone, or not asked. */
  said?: string;
}

/** The words for a carry the frame could not ask: no browser record names the window that hosts it. */
export const NO_HOST_ORIGIN = "The field could not tell which window hosts it (the browser names no ancestor and no referrer), so what you kept while it was served at the shell's origin was not carried this time. It is asked again at the next start.";
/** The words for a carry written in part; the rest is asked again at the next start. */
export const CARRIED_IN_PART = "Part of what you kept while the field was served at the shell's origin was not written here, so it is carried again at the next start; nothing at the shell's origin was moved.";

interface StorageScope {location: {origin: string}; localStorage: Storage; indexedDB?: IDBFactory}
const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => {r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);});

/** The host's side: what the shell's origin holds of the frame's storage, for a frame served at `frameOrigin`. Null when that is the
 * shell's own origin: the frame reads that storage itself. The recovery database is opened only where it stands, never made. */
export async function gatherStorageCarry(frameOrigin: string, scope: StorageScope = window): Promise<StorageCarry | null> {
  if (frameOrigin === scope.location.origin) return null;
  const local: [string, string][] = [];
  for (let i = 0; i < scope.localStorage.length; i++) {
    const key = scope.localStorage.key(i);
    if (key === null || !frameStorageKey(key)) continue;
    const value = scope.localStorage.getItem(key);
    if (value !== null) local.push([key, value]);
  }
  const carry: StorageCarry = {schema: STORAGE_CARRY_SCHEMA, from: scope.location.origin, local, recovery: null};
  if (!scope.indexedDB) return {...carry, recovery_error: 'This window has no IndexedDB to read the recovery records from.'};
  try {
    const database = await new Promise<IDBDatabase | null>((resolve, reject) => {
      const opening = scope.indexedDB!.open(RECOVERY_DATABASE.name);
      // No recovery database stands at the shell's origin: the opening is aborted, so none is made there.
      opening.onupgradeneeded = () => {opening.transaction?.abort();};
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => {if (opening.error?.name === 'AbortError') resolve(null); else reject(opening.error);};
      opening.onblocked = () => reject(new Error('The recovery records are held open by another window.'));
    });
    if (!database) return carry;
    try {
      const recovery: Record<string, unknown[]> = {};
      for (const store of RECOVERY_DATABASE.stores) {
        if (!database.objectStoreNames.contains(store)) continue;
        recovery[store] = await request(database.transaction(store, 'readonly').objectStore(store).getAll());
      }
      return {...carry, recovery};
    } finally {database.close();}
  } catch (error) {
    return {...carry, recovery_error: `The recovery records were not read: ${error instanceof Error ? error.message : String(error)}`};
  }
}

/** A request's id: the host's answer names it, and an answer that names another request is not this one's. */
const requestId = (): string => globalThis.crypto?.randomUUID?.() ?? `carry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** The frame's side, before its application boots: ask the host once for the shell origin's storage and write it into the frame's
 * own. Resolves however the host answers (or does not), so the application boots in every case. */
export async function carryStorageFromHost(options: {target?: Window; timeoutMs?: number} = {}): Promise<CarryOutcome> {
  const target = options.target ?? window;
  if (target.parent === target) return {state: 'top'};
  let storage: Storage;
  try {
    storage = target.localStorage;
    if (storage.getItem(STORAGE_CARRIED_KEY) !== null) return {state: 'kept'};
  } catch {return {state: 'no-storage'};}
  const ranUncarried = () => {try {if (storage.getItem(STORAGE_UNCARRIED_KEY) === null) storage.setItem(STORAGE_UNCARRIED_KEY, new Date().toISOString());} catch {/* none */}};
  // No browser record names the host: the frame cannot address its ask, so it says so and boots now, never waiting for an answer that
  // cannot come (1R-surface.2).
  const host = knownHostOrigin(target);
  if (!host) {ranUncarried(); console.warn(NO_HOST_ORIGIN); return {state: 'no-host-origin', said: NO_HOST_ORIGIN};}
  const id = requestId();
  const answer = await new Promise<{carry: StorageCarry | null} | null>(resolve => {
    const done = (value: {carry: StorageCarry | null} | null) => {clearTimeout(timer); target.removeEventListener('message', receive); resolve(value);};
    const receive = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | null;
      if (event.source !== target.parent || event.origin !== host || !data || data.v !== 1 || data.kind !== STORAGE_CARRY || data.request_id !== id) return;
      if (typeof data.error === 'string') {done(null); return;}
      const carry = data.carry as StorageCarry | null;
      done(carry === null || (carry && carry.schema === STORAGE_CARRY_SCHEMA && Array.isArray(carry.local)) ? {carry} : null);
    };
    const timer = setTimeout(() => done(null), options.timeoutMs ?? STORAGE_CARRY_TIMEOUT_MS);
    target.addEventListener('message', receive);
    try {target.parent.postMessage({v: 1, kind: STORAGE_CARRY_REQUEST, request_id: id}, host);} catch {done(null);}
  });
  if (!answer) {ranUncarried(); return {state: 'unanswered'};}
  const at = new Date().toISOString();
  if (answer.carry === null) {
    try {storage.setItem(STORAGE_CARRIED_KEY, JSON.stringify({schema: STORAGE_CARRY_SCHEMA, at, from: null}));} catch {/* asked again next start */}
    return {state: 'same-origin'};
  }
  // A carried key never overwrites one the frame holds: the frame's own write is the newer (1R-surface.2).
  const {carry} = answer, failed: string[] = [];
  let added = 0;
  for (const [key, value] of carry.local) {
    if (typeof key !== 'string' || typeof value !== 'string' || !frameStorageKey(key)) continue;
    try {if (storage.getItem(key) === null) {storage.setItem(key, value); added++;}} catch {failed.push(key);}
  }
  let recovery: Record<string, number> | undefined, recoveryError = carry.recovery_error;
  if (carry.recovery) {
    try {recovery = await writeRecovery(target.indexedDB, carry.recovery);}
    catch (error) {recoveryError = `The recovery records were not written here: ${error instanceof Error ? error.message : String(error)}`;}
  }
  const outcome: CarryOutcome = {state: 'carried', keys: added, failed, ...(recovery ? {recovery} : {}), ...(recoveryError ? {recovery_error: recoveryError} : {})};
  // Written in part, the carry is not done: the frame records that it ran uncarried and asks again at its next start (1R-surface.1).
  if (failed.length || recoveryError) {
    ranUncarried();
    console.warn('The Expressions frame\'s storage was carried in part:', outcome);
    return {...outcome, state: 'carried-in-part', said: CARRIED_IN_PART};
  }
  try {storage.setItem(STORAGE_CARRIED_KEY, JSON.stringify({schema: STORAGE_CARRY_SCHEMA, at, from: carry.from, ...outcome}));}
  catch {/* the carry is asked again at the next start, and adds only what the frame lacks */}
  return outcome;
}

/** The recovery rows written into the frame's own recovery database, made as recovery.ts makes it; each row keeps its `id`. A row the
 * frame holds already stands, and only the rows it lacks are added. */
async function writeRecovery(factory: IDBFactory | undefined, rows: Record<string, unknown[]>): Promise<Record<string, number>> {
  if (!factory) throw new Error('This frame has no IndexedDB');
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const opening = factory.open(RECOVERY_DATABASE.name, RECOVERY_DATABASE.version);
    opening.onupgradeneeded = () => {
      for (const store of RECOVERY_DATABASE.stores) if (!opening.result.objectStoreNames.contains(store)) opening.result.createObjectStore(store, {keyPath: 'id'});
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
    opening.onblocked = () => reject(new Error('the recovery records are held open by another window'));
  });
  try {
    const written: Record<string, number> = {};
    for (const store of RECOVERY_DATABASE.stores) {
      const kept = (rows[store] ?? []).filter(row => !!row && typeof row === 'object' && typeof (row as {id?: unknown}).id === 'string');
      if (!kept.length) continue;
      written[store] = await new Promise<number>((resolve, reject) => {
        const tx = database.transaction(store, 'readwrite'), objects = tx.objectStore(store);
        let count = 0;
        for (const row of kept) {
          const held = objects.count((row as {id: string}).id);
          held.onsuccess = () => {if (held.result === 0) {objects.put(row); count++;}};
        }
        tx.oncomplete = () => resolve(count); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? new Error('aborted'));
      });
    }
    return written;
  } finally {database.close();}
}
