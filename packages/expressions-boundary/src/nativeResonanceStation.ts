/** The plate tuned to one of its stations: the app's station tick (app.ts case 'tune-station'), ported whole (O-I #747 round 895, the port
 * ledger's tune-station; DLW build ruling 2026-11-08). One step under the app's own label, "Tune frequency", writing what the app's tune
 * writes together: the drive frequency at the station's Hz, the Frequency driver Manual, the sweep off, and every automation lane on
 * field.frequency disabled, so the drive is never left half-tuned (Manual with the sweep still running). The station is the engine's own
 * (engine.ts `stations()`), found by its index at the moment of the change; a list the shell read earlier decides nothing. Pure. */
import type {Journey, NativeResonanceStation, NativeResonanceStationChange} from './editor';
import {clone, validateJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';

/** The app's label for the step (app.ts `changed(..., 'Tune frequency')`): what Undo and Redo say. */
export const TUNE_STATION_LABEL = 'Tune frequency';
const STATION_KEYS = ['kind', 'station_index'];

/** Admit one station tune exactly, or refuse with the legible reason. Returns the station's index. */
export function validateResonanceStation(change: unknown): number {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error('Choose a station of the plate to tune to.');
  const row = change as Record<string, unknown>;
  if (row.kind !== 'resonance-station' || Object.keys(row).some(key => !STATION_KEYS.includes(key))) throw Error('A station tune carries only the station\'s number.');
  const index = row.station_index;
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 63) throw Error('Name the station by its number on the plate.');
  return index;
}

/** A request that carries a station tune carries nothing else: the tune is one step of its own, as the app's is. */
export function validateResonanceStationRequest(changes: readonly {kind: string}[]): void {
  if (changes.some(change => change.kind === 'resonance-station') && changes.length !== 1)
    throw Error('A station tune is one step of its own: send it alone.');
}

/** Tunes the Scene's plate to the engine's station, as the app's tune does. `stations` is the engine's own list now. */
export function applyNativeResonanceStation(journey: Journey, sceneId: string, changes: readonly NativeResonanceStationChange[],
  stations: readonly NativeResonanceStation[] | undefined): Journey {
  if (!Array.isArray(changes) || changes.length !== 1) throw Error('Tune to one station at a time.');
  const index = validateResonanceStation(changes[0]);
  if (!stations?.length) throw Error('The engine computes no stations for the plate now (it computes none while the native field follows the domain): there is nothing to tune to.');
  const station = stations.find(row => row.index === index);
  if (!station) throw Error(`The plate has no station ${index + 1}: the engine holds stations 1 to ${stations.length}.`);
  if (typeof station.frequencyHz !== 'number' || !Number.isFinite(station.frequencyHz)) throw Error(`Station ${index + 1} reports no frequency.`);
  const draft = clone(journey), scene = draft.scenes.find(value => value.id === sceneId);
  if (!scene) throw Error('The addressed Scene is no longer in this Expression.');
  scene.field.params.frequency = station.frequencyHz;
  scene.composition.frequencyDriver = 'manual';
  scene.engine.autoSweep = false;
  scene.automation.filter(lane => lane.target === 'field.frequency').forEach(lane => {lane.enabled = false});
  validateJourney(draft);
  return draft;
}
