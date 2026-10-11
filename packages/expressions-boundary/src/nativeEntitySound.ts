/** Per-object sound as an admitted native device change. The bounds are the
 * app's own validator (native-field/entitySound.ts), imported rather than
 * copied, so the inspector, this boundary and prepareCompositionEdit cannot
 * disagree. The kernel's expression_profile::sound must match; the test reads
 * that Rust source and asserts the same table. Pure: no I/O, no document. */
import {DEFAULT_ENTITY_SOUND, validateEntitySound, type EntitySound} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/entitySound.ts';
import type {NativeEntitySoundChange} from './editor';

/** Refuses foreign operands and any sound the app validator refuses. Returns a
 * fresh copy, so the reducer never aliases the caller's change object. */
export function validateNativeEntitySoundChange(change: unknown): NativeEntitySoundChange {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error('Choose an admitted object sound change.');
  const row = change as Record<string, unknown>;
  if (row.kind !== 'entity-sound') throw Error('Choose an admitted object sound change.');
  if (Object.keys(row).some(key => !['kind', 'entity_id', 'sound'].includes(key))) throw Error('An object sound belongs only to its entity; foreign operands were retained.');
  if (typeof row.entity_id !== 'string' || !row.entity_id) throw Error('Choose the object whose sound changes.');
  if (!Object.hasOwn(row, 'sound')) throw Error('Give the object\'s whole sound, or null to remove it.');
  if (row.sound === null) return {kind: 'entity-sound', entity_id: row.entity_id, sound: null};
  const sound = validateEntitySound(row.sound);
  if (!sound) throw Error('Give the object\'s whole sound, or null to remove it.');
  return {kind: 'entity-sound', entity_id: row.entity_id, sound: {...sound}};
}

/** The inspector's Frequency control: a fixed pitch clears Follow cymatic. */
export function soundWithFrequency(sound: EntitySound | undefined, hz: number): EntitySound {
  const next: EntitySound = {...(sound ?? {enabled: false}), frequencyHz: hz, followCymatic: false};
  return validateEntitySound(next) as EntitySound;
}

/** The inspector's Follow cymatic control. Turning Follow off restores a fixed
 * pitch when none is set, exactly as soundControls.ts applySoundControl does. */
export function soundWithFollow(sound: EntitySound | undefined, follow: boolean): EntitySound {
  const next: EntitySound = {...(sound ?? {enabled: false}), followCymatic: follow};
  if (!follow && next.frequencyHz === undefined) next.frequencyHz = DEFAULT_ENTITY_SOUND.frequencyHz;
  return validateEntitySound(next) as EntitySound;
}
