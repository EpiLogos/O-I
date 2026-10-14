// The field device's own picture (manual §10.4: "Compact — a small live picture and up to four controls"). It is the owner's
// picture, ported and not redrawn: the family's configuration diagram, drawn by the same `FIELD_FACE_VIEWS[family].draw` the
// pool's Field editor hosts (components/NativeDeviceEditors.tsx FieldSurface, lines 295-329, the draw call at 324), over the same reading, with the
// same in-diagram handles and their custody (components/NativeFieldHandle.tsx). On the rack the diagram is a read-only
// miniature (its handles are off, so the four controls beside it are the one way to move a value); whole and full are the
// diagram to work in. Morph and Colour have no diagram of their own — their pictures live inside the hosts that interleave
// them with controls (NativeMorphDrive, NativeColourField) — so their picture is the catalogue's own live reading of the
// device (its summary) and, for Colour, the palette stops the scene holds.
import {useCallback, useState, type ReactNode} from 'react'
import {NATIVE_BINDINGS, baseValue} from '@epilogos/expressions-boundary/parameters'
import type {NativeEditorReading, Scene} from '@epilogos/expressions-boundary/editor'
import type {DeviceSize} from '../../frame/devices/deviceRuntime'
import {NativeInputRetentionContext, type NativeInputAperture} from '../../continuity/nativeInputContext'
import {FIELD_FACE_MODELS} from '../nativeFieldFaceModel.ts'
import {FIELD_FACE_VIEWS} from '../nativeFieldFaceViews.tsx'
import type {Apply, CaptureCurrent} from '../nativeDeviceCustody'
import {expressionsFieldEntry} from './expressionsDevice'
import '../NativeDeviceEditors.css'
import './expressionsDevices.css'

export interface ExpressionsPictureProps {
  family: string
  size: DeviceSize
  reading: NativeEditorReading
  apply: Apply
  captureCurrent: CaptureCurrent
  /** The work is busy or waiting on the owner: the handles are off. */
  disabled: boolean
  /** The private input owner, carried across a pane's own React root (a pane does not inherit the rack's context). */
  aperture: NativeInputAperture | null
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))
const nativeValue = (scene: Scene, path: string): number | undefined => {
  const found = NATIVE_BINDINGS.find(row => row.path === path)
  return found ? baseValue(scene, found.key) : undefined
}

export function ExpressionsPicture(props: ExpressionsPictureProps) {
  return <NativeInputRetentionContext.Provider value={props.aperture}><Picture {...props} /></NativeInputRetentionContext.Provider>
}

function Picture({family, size, reading, apply, captureCurrent, disabled}: ExpressionsPictureProps) {
  const entry = expressionsFieldEntry(family)
  // Live values of the diagram's own handles by native path, so the drawing follows a handle while it is held.
  const [drafts, setDrafts] = useState<Record<string, number>>({})
  const setDraft = useCallback((path: string, value: number | null) => setDrafts(current => {
    if (value === null) {
      if (!(path in current)) return current
      const next = {...current}
      delete next[path]
      return next
    }
    return current[path] === value ? current : {...current, [path]: value}
  }), [])
  if (!entry) return null
  const hasDiagram = Object.hasOwn(FIELD_FACE_VIEWS, family) && Object.hasOwn(FIELD_FACE_MODELS, family)
  if (!hasDiagram) return <Readout family={family} name={entry.name} reading={reading} summary={entry.summary(reading)} size={size} />
  const model = FIELD_FACE_MODELS[family as keyof typeof FIELD_FACE_MODELS], view = FIELD_FACE_VIEWS[family as keyof typeof FIELD_FACE_VIEWS]
  const control = NATIVE_BINDINGS.find(row => row.path === model.controlPath)
  const graphValue = control ? baseValue(reading.scene, control.key) : 0
  const position = control && control.max > control.min ? (clamp(graphValue, control.min, control.max) - control.min) / (control.max - control.min) : 0
  const held = size === 'compact' || disabled
  let body: ReactNode
  try {
    body = view.draw({reading, graphValue, position, value: path => drafts[path] ?? nativeValue(reading.scene, path), family, disabled: held, apply, captureCurrent, setDraft})
  } catch (cause) {
    body = <text x="8" y="80" className="native-graph-label">Diagram not drawn: {cause instanceof Error ? cause.message : String(cause)}</text>
  }
  return <div className={`native-field-surface expr-picture expr-picture--${size}`} data-expr-picture={family}>
    <svg viewBox="0 0 360 160" role="group" aria-label={`${entry.name} configuration`}>{body}</svg>
  </div>
}

/** Whether a device has a picture to draw at a size: the diagram families always; Colour always (its stops); Morph in the whole and full
 * sizes only — on the rack its summary line above the controls is the reading, and it is not said twice. */
export function hasPicture(family: string, size: DeviceSize): boolean {
  return Object.hasOwn(FIELD_FACE_VIEWS, family) || family === 'colour' || (family === 'morph' && size !== 'compact')
}

function Readout({family, name, reading, summary, size}: {family: string; name: string; reading: NativeEditorReading; summary: string; size: DeviceSize}) {
  const palette = family === 'colour' ? reading.scene.field.palette : []
  return <div className={`expr-readout expr-readout--${size}`} data-expr-picture={family} role="group" aria-label={`${name} reading`}>
    {size !== 'compact' && <p>{summary}</p>}
    {palette.length > 0 && <div className="expr-palette" aria-label="Palette stops">{palette.map((color, index) => <i key={`${index}:${color}`} title={color} style={{background: color}} />)}</div>}
  </div>
}
