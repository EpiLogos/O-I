/** Drag protocol for the native Browser, chosen-control rack and macro rack.
 * Pure: no React. dataTransfer is unreadable during dragover, so the active
 * drag is also held here for the duration of one gesture. */

export const PARAMETER_MIME = 'application/x-oi-native-parameter'
export const CHOSEN_MIME = 'application/x-oi-chosen-control'
/** Window events that let keyboard actions reach the rack editor and device strip. */
export const MAP_PARAMETER_EVENT = 'oi:native-parameter-map'
export const OPEN_DEVICE_EVENT = 'oi:native-open-device'
/** Chosen controls ask the Browser to show the parameter list. */
export const PARAMETER_BROWSE_EVENT = 'oi:expression-browse-parameters'
/** Asks the centre Expressions Studio to show a device's full panel: detail {section} (a studio section id). */
export const OPEN_STUDIO_EVENT = 'oi:native-open-studio'
export const DEVICE_MIME = 'application/x-oi-native-device'

/** `path` is the rack-target path (Field: binding.path; object: binding.key),
 * `key` is the chosen-control key. Object drags name the object they were taken from. */
export interface ParameterDrag {
  path: string
  key: string
  label: string
  unit: string | null
  min: number
  max: number
  kind: 'field' | 'object'
  scope: 'field' | 'selected' | 'named'
  entityId?: string
}

export type ActiveDrag = {kind: 'parameter'; drag: ParameterDrag} | {kind: 'chosen'; entry_id: string; index: number}

const text = (value: unknown, max = 200): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** Validates a parameter payload from any source; anything malformed is refused. */
export function parseParameterDrag(raw: unknown): ParameterDrag | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (!text(row.path) || !text(row.key) || !text(row.label, 300) || !finite(row.min) || !finite(row.max)) return null
  if (row.unit !== null && row.unit !== undefined && !text(row.unit, 40)) return null
  const unit = typeof row.unit === 'string' ? row.unit : null
  if (row.kind === 'field') return row.scope === 'field' ? {path: row.path, key: row.key, label: row.label, unit, min: row.min, max: row.max, kind: 'field', scope: 'field'} : null
  if (row.kind !== 'object' || (row.scope !== 'selected' && row.scope !== 'named') || !text(row.entityId)) return null
  return {path: row.path, key: row.key, label: row.label, unit, min: row.min, max: row.max, kind: 'object', scope: row.scope, entityId: row.entityId}
}

export function encodeParameterDrag(drag: ParameterDrag): string {return JSON.stringify(drag)}

export function decodeParameterDrag(encoded: string): ParameterDrag | null {
  try {return parseParameterDrag(JSON.parse(encoded))} catch {return null}
}

let active: ActiveDrag | null = null
export function setActiveDrag(value: ActiveDrag | null): void {active = value}
export function activeDrag(): ActiveDrag | null {return active}

/** A small amber-bordered chip used as the drag image; removed on the next tick. */
export function setDragChip(transfer: DataTransfer, label: string): void {
  if (typeof document === 'undefined') return
  const chip = document.createElement('div')
  chip.className = 'native-drag-chip'
  chip.textContent = label
  document.body.appendChild(chip)
  transfer.setDragImage(chip, 8, 8)
  setTimeout(() => chip.remove(), 0)
}

// ---- Expanded device open request ----------------------------------------

/** The scope names where a device's panel lives. The family's registry scope decides how it is shown; a 'field' request for a
 * scene family (older senders) is still accepted and routed by that family. */
export interface OpenDeviceRequest {scope: 'field' | 'entity' | 'scene'; family: string}
const familyId = (value: unknown): value is string => typeof value === 'string' && /^[a-z][A-Za-z0-9]{0,31}$/.test(value)

/** The one typed open request for a device panel. Unknown scopes and malformed family ids are refused. */
export function parseOpenDevice(raw: unknown): OpenDeviceRequest | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const scope = row.scope
  if ((scope !== 'field' && scope !== 'entity' && scope !== 'scene') || !familyId(row.family)) return null
  return {scope, family: row.family}
}

/** Dispatches a valid request to the window; an invalid one is dropped without an event. */
export function dispatchOpenDevice(request: OpenDeviceRequest): void {
  const valid = parseOpenDevice(request)
  if (valid && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OPEN_DEVICE_EVENT, {detail: valid}))
}

// ---- Device drag onto the rack (catalogue row -> rack insertion) ---------

export function encodeDeviceDrag(family: string): string {return JSON.stringify({family})}
/** The family id of a device drag payload, or null for anything else. */
export function parseDeviceDrag(raw: string): string | null {
  try {
    const row: unknown = JSON.parse(raw)
    const family = row && typeof row === 'object' && !Array.isArray(row) ? (row as {family?: unknown}).family : undefined
    return familyId(family) ? family : null
  } catch {return null}
}

/** Insertion index among the rack's widget cards (left-to-right rects) for a pointer x: the cards whose midpoint lies left of it. */
export function deviceInsertIndex(x: number, cards: readonly {left: number; right: number}[]): number {
  let index = 0
  while (index < cards.length && x >= (cards[index].left + cards[index].right) / 2) index++
  return index
}

/** The device-add anchor for an insertion index: null inserts first, otherwise the widget just before the gap. */
/** The Browser state a parameter-browse event applies: Parameters category, pool open, search cleared. */
export function parameterBrowsePatch(): {category: 'properties'; poolOpen: true; query: ''} {
  return {category: 'properties', poolOpen: true, query: ''}
}

/** A device-open detail the Browser may admit. Null refuses the event. The caller mints the nonce. */
export function admittedDeviceOpen(detail: unknown): {scope: 'field' | 'entity' | 'scene'; family: string} | null {
  return parseOpenDevice(detail)
}

export function afterIdFor(index: number, ids: readonly string[]): string | null {
  if (index <= 0 || !ids.length) return null
  return ids[Math.min(index, ids.length) - 1] ?? null
}
