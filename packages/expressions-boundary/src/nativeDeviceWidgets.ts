/** Device widgets are the shell's ordered device identities, stored as the sibling
 * Journey.shared.devices list. They are not toolbelt entries: a toolbelt entry binds a
 * control, a device widget places a device. Adoption is the same as chosen controls:
 * one DocumentStore change, committed through the existing composition_set path. */
import type {NativeDeviceWidget, NativeDeviceWidgetChange} from './editor';
import {clone, validateJourney, type Journey} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import {admittedFamily} from './familyAdmission';

const MAX_DEVICES = 64;

/** The retained ordered device list, as a reading. Absent means none. */
export function readNativeDeviceWidgets(document: Journey): NativeDeviceWidget[] {
  return clone(document.shared?.devices ?? []);
}

/** Validates the complete batch before adoption and returns a new validated document. */
export function applyNativeDeviceWidgetChanges(document: Journey, changes: readonly NativeDeviceWidgetChange[]): Journey {
  if (!Array.isArray(changes) || !changes.length || changes.length > 64) throw Error('Supply one bounded device-widget transaction');
  const next = clone(document);
  if (!next.shared) throw Error('The retained Expression has no shared authoring owner');
  const devices: NativeDeviceWidget[] = next.shared.devices ?? (next.shared.devices = []);
  // The lowest free "family-n" keeps minting deterministic for the same retained list.
  const mint = (family: string) => {
    for (let n = 1; ; n++) {
      const id = `${family}-${n}`;
      if (!devices.some(d => d.id === id)) return id;
    }
  };
  for (const change of changes) {
    if (change.kind === 'device-add') {
      const admission = admittedFamily(change.family);
      if (!admission) throw Error('Choose a defined device family');
      if (!admission.repeatable && devices.some(d => d.family === change.family)) throw Error('This device is already placed in the Scene');
      if (devices.length >= MAX_DEVICES) throw Error('The device list is full');
      const device: NativeDeviceWidget = {id: mint(change.family), family: change.family};
      if (change.after_id === undefined) devices.push(device);
      else if (change.after_id === null) devices.unshift(device);
      else {
        const index = devices.findIndex(d => d.id === change.after_id);
        if (index < 0) throw Error('The device to insert after no longer exists');
        devices.splice(index + 1, 0, device);
      }
    } else if (change.kind === 'device-remove') {
      const index = devices.findIndex(d => d.id === change.device_id);
      if (index < 0) throw Error('The device widget no longer exists');
      devices.splice(index, 1);
    } else if (change.kind === 'device-order') {
      const ids = change.device_ids;
      if (!Array.isArray(ids) || ids.length !== devices.length || new Set(ids).size !== devices.length || ids.some(id => !devices.some(d => d.id === id))) throw Error('Reordering must retain every device widget exactly once');
      const byId = new Map(devices.map(d => [d.id, d] as const));
      devices.splice(0, devices.length, ...ids.map(id => byId.get(id)!));
    } else throw Error('Unsupported device-widget operation');
  }
  return validateJourney(next);
}
