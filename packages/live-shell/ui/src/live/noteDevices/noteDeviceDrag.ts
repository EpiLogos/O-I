// A note device carried by a drag, from the browser's row to the chain's end (manual §10.3: "double-click it or drag it";
// the mockup's .dropz, "Drop an instrument or effect here"). The payload is the kind alone: what lands is the same device a
// double-click on the row adds (noteDeviceHold.ts addNoteDevice), so the two gestures cannot differ.
import {NOTE_DEVICE_LABEL, type NoteDeviceKind} from './noteDevices'

export const NOTE_DEVICE_MIME = 'application/x-oi-note-device'

/** The kind a payload names, or null for anything that is not a note device the chain can take. */
export function parseNoteDeviceDrag(payload: string): NoteDeviceKind | null {
  return Object.hasOwn(NOTE_DEVICE_LABEL, payload) ? payload as NoteDeviceKind : null
}
