/** The Expressions frame's storage, carried once from the shell's origin to the frame's own (O-I #747 round 896, item 0.3).
 *
 * The frame has an origin of its own, so no script in it can reach the shell's realm, and the host's IPC with it (native_shell.rs
 * `expressions_entry`). Its browser storage moved with it: until this round the frame was served at the shell's origin, and what the
 * person kept there (the Library, drafts, the recovery records, the workspace and the frame's other settings in localStorage, and the
 * recovery database in IndexedDB) stands at the shell's origin. That is the one thing the isolation took away from the frame, so it is
 * carried through the boundary: before the frame's application boots, the frame asks its host once (`STORAGE_CARRY_REQUEST`, to the
 * host's exact origin), the host reads its own origin's storage and posts it back (`STORAGE_CARRY`, to the frame's exact origin, only
 * before the frame has given its first state), and the frame writes it into its own storage, then marks the carry done
 * (`STORAGE_CARRIED_KEY`), so it is asked once. The newer value stands: the carried one over what the frame's origin held before
 * (written by an older application, before the frame was served at the shell's origin), unless the frame has run here without its carry
 * (`STORAGE_UNCARRIED_KEY`: a carry not answered, asked again at the next start), when what it wrote since stands and the carry only
 * adds what it lacks. A host that serves the frame at its own origin answers that there is nothing to carry. The shell's storage is
 * read, never moved. */
import {hostOrigin} from './hostOrigin.ts';

export const STORAGE_CARRY_REQUEST = 'oi-storage-carry-request';
export const STORAGE_CARRY = 'oi-storage-carry';
export const STORAGE_CARRY_SCHEMA = 'oi.expressions-storage-carry/v1';
/** The frame's record that its storage was carried (and from where, and what was not). */
export const STORAGE_CARRIED_KEY = 'oi.expressions.storage-carried.v1';
/** The frame's record that it ran here before its storage was carried: what it wrote since then stands over the carry. */
export const STORAGE_UNCARRIED_KEY = 'oi.expressions.storage-uncarried.v1';
const OWN_KEYS: ReadonlySet<string> = new Set([STORAGE_CARRIED_KEY, STORAGE_UNCARRIED_KEY]);
/** The frame's recovery database (field-studies-journeys/src/recovery.ts `db`): its name, version and stores, each keyed by `id`. */
export const RECOVERY_DATABASE = {name: 'oi.expression-recovery', version: 3, stores: ['drafts', 'nativeWorking', 'quarantine']} as const;
/** How long the frame waits for its host's carry before it boots without it (and asks again at its next start). */
export const STORAGE_CARRY_TIMEOUT_MS = 10_000;

export interface StorageCarry {
  schema: typeof STORAGE_CARRY_SCHEMA;
  /** The shell's origin, read from. */
  from: string;
  /** Every localStorage entry of the shell's origin but the carry's own record. */
  local: [string, string][];
  /** The recovery database's rows, per store; null where the shell's origin holds no recovery database. */
  recovery: Record<string, unknown[]> | null;
  /** Why the recovery database was not read, where it was not. */
  recovery_error?: string;
}

export interface CarryOutcome {
  state: 'top' | 'kept' | 'carried' | 'same-origin' | 'unanswered' | 'no-storage';
  keys?: number;
  failed?: string[];
  recovery?: Record<string, number>;
  recovery_error?: string;
}

interface StorageScope {location: {origin: string}; localStorage: Storage; indexedDB?: IDBFactory}
const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => {r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);});

/** The host's side: what the shell's origin holds of the frame's storage, for a frame served at `frameOrigin`. Null when that is the
 * shell's own origin: the frame reads that storage itself. The recovery database is opened only where it stands, never made. */
export async function gatherStorageCarry(frameOrigin: string, scope: StorageScope = window): Promise<StorageCarry | null> {
  if (frameOrigin === scope.location.origin) return null;
  const local: [string, string][] = [];
  for (let i = 0; i < scope.localStorage.length; i++) {
    const key = scope.localStorage.key(i);
    if (key === null || OWN_KEYS.has(key)) continue;
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
  const host = hostOrigin(target);
  if (!host) return {state: 'top'};
  const answer = await new Promise<{carry: StorageCarry | null} | null>(resolve => {
    const done = (value: {carry: StorageCarry | null} | null) => {clearTimeout(timer); target.removeEventListener('message', receive); resolve(value);};
    const receive = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | null;
      if (event.source !== target.parent || event.origin !== host || !data || data.v !== 1 || data.kind !== STORAGE_CARRY) return;
      if (typeof data.error === 'string') {done(null); return;}
      const carry = data.carry as StorageCarry | null;
      done(carry === null || (carry && carry.schema === STORAGE_CARRY_SCHEMA && Array.isArray(carry.local)) ? {carry} : null);
    };
    const timer = setTimeout(() => done(null), options.timeoutMs ?? STORAGE_CARRY_TIMEOUT_MS);
    target.addEventListener('message', receive);
    try {target.parent.postMessage({v: 1, kind: STORAGE_CARRY_REQUEST}, host);} catch {done(null);}
  });
  if (!answer) {
    try {if (storage.getItem(STORAGE_UNCARRIED_KEY) === null) storage.setItem(STORAGE_UNCARRIED_KEY, new Date().toISOString());} catch {/* none */}
    return {state: 'unanswered'};
  }
  const ranUncarried = storage.getItem(STORAGE_UNCARRIED_KEY) !== null;
  const at = new Date().toISOString();
  if (answer.carry === null) {
    try {storage.setItem(STORAGE_CARRIED_KEY, JSON.stringify({schema: STORAGE_CARRY_SCHEMA, at, from: null}));} catch {/* asked again next start */}
    return {state: 'same-origin'};
  }
  const {carry} = answer, failed: string[] = [];
  for (const [key, value] of carry.local) {
    if (typeof key !== 'string' || typeof value !== 'string' || OWN_KEYS.has(key)) continue;
    try {if (!ranUncarried || storage.getItem(key) === null) storage.setItem(key, value);} catch {failed.push(key);}
  }
  let recovery: Record<string, number> | undefined, recoveryError = carry.recovery_error;
  if (carry.recovery) {
    try {recovery = await writeRecovery(target.indexedDB, carry.recovery, ranUncarried);}
    catch (error) {recoveryError = `The recovery records were not written here: ${error instanceof Error ? error.message : String(error)}`;}
  }
  const outcome: CarryOutcome = {state: 'carried', keys: carry.local.length - failed.length, failed, ...(recovery ? {recovery} : {}),
    ...(recoveryError ? {recovery_error: recoveryError} : {})};
  try {storage.setItem(STORAGE_CARRIED_KEY, JSON.stringify({schema: STORAGE_CARRY_SCHEMA, at, from: carry.from, ...outcome}));}
  catch {/* the carry is asked again at the next start, and writes the same values */}
  if (failed.length || recoveryError) console.warn('The Expressions frame\'s storage was carried in part:', outcome);
  return outcome;
}

/** The recovery rows written into the frame's own recovery database, made as recovery.ts makes it; each row keeps its `id`. `keep`:
 * a row the frame holds already stands, and only the rows it lacks are added. */
async function writeRecovery(factory: IDBFactory | undefined, rows: Record<string, unknown[]>, keep: boolean): Promise<Record<string, number>> {
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
          if (!keep) {objects.put(row); count++; continue;}
          const held = objects.count((row as {id: string}).id);
          held.onsuccess = () => {if (held.result === 0) {objects.put(row); count++;}};
        }
        tx.oncomplete = () => resolve(count); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? new Error('aborted'));
      });
    }
    return written;
  } finally {database.close();}
}
