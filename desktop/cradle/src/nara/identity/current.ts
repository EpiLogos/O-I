import {useSyncExternalStore} from 'react';
import type {IdentityReading, IdentitySource} from './types';

export interface CurrentIdentity {
  reading: IdentityReading; source: IdentitySource;
  /** Actual explicit UI selection, not a native execution/recognition receipt. */
  selection_ref: string;
}
let current: CurrentIdentity | null = null;
const listeners = new Set<() => void>();
const read = () => current;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => {listeners.delete(listener);}; };
const notify = () => {for (const listener of listeners) listener();};
/** No personal facts are written to browser storage. Central remains the owner. */
export function selectCurrentIdentity(reading: IdentityReading, source: IdentitySource): void {
  if (!source.source_ref || !source.revision || reading.person_ref !== reading.profile.person_ref
      || reading.nara_ref !== reading.profile.nara_ref) throw new Error('A current saved identity source is required.');
  current = {reading, source: {...source}, selection_ref: `nara-identity-selection:${crypto.randomUUID()}`};
  notify();
}
export function clearCurrentIdentity(person_ref?: string): void {
  if (current && (!person_ref || current.reading.person_ref === person_ref)) {current = null; notify();}
}
export function currentIdentity(): CurrentIdentity | null { return current; }
export function useCurrentIdentity(): CurrentIdentity | null {return useSyncExternalStore(subscribe, read, read);}
