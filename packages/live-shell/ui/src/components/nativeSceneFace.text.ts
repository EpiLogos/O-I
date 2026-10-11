import type {Scene} from '../../../../expressions-boundary/src/editor'
import {
  TEXT_ALIGNS, TEXT_LAYER_BUDGET, TEXT_MAX_LENGTH, TEXT_NUMERIC_RANGE, validateTextLayerValues,
  type NativeSceneTextChange, type NativeTextLayerValues,
} from '../../../../expressions-boundary/src/sceneMaterialEdits'
import type {SceneFaceModel} from './nativeSceneFaceModel.ts'

export type TextLayer = Scene['text'][number]
/** The inspector's exact-value controls for one selected layer (inspector.ts Page text group). */
export type TextControl = 'kicker' | 'title' | 'italic' | 'body' | 'size' | 'width' | 'x' | 'y'
export const TEXT_CONTROL_LABELS: Record<TextControl, string> = {
  kicker: 'Small heading', title: 'Title', italic: 'Italic line', body: 'Supporting text',
  size: 'Type size', width: 'Block width', x: 'Page X', y: 'Page Y',
}
export const TEXT_NUMERIC_CONTROLS = ['size', 'width', 'x', 'y'] as const satisfies readonly TextControl[]
export const TEXT_TEXT_CONTROLS = ['kicker', 'title', 'italic', 'body'] as const satisfies readonly TextControl[]

/** Reference stage width in the stage's own pixels. app.ts textLayout (capture.ts:8) reads t.x/t.y as fractions of the stage and
 * t.size/t.width as stage pixels; the page preview uses this width as its reference, so it sizes text in container units. */
export const PAGE_REFERENCE_WIDTH = 1600
/** capture.ts textLayout caps a text block at 45% of the stage width on desktop widths. */
const BLOCK_CAP = 0.45
/** The admitted page-position range (sceneMaterialEdits TEXT_NUMERIC_RANGE). The stage drag in app.ts clamps to -0.1…0.95 instead. */
export const POSITION_RANGE = TEXT_NUMERIC_RANGE.x

export const layerTitle = (layer: TextLayer) => layer.title || 'Text block'
/** The summary line the rack widget and Browser show: `N layers · first title`. An absent list is named as not disclosed, never as empty. */
export function textSummary(layers: readonly TextLayer[] | undefined): string {
  if (!layers) return 'Page text not disclosed'
  if (!layers.length) return 'No text layers'
  const count = layers.length
  return `${count} layer${count === 1 ? '' : 's'} · ${layerTitle(layers[0])}`
}

/** A page box for one visible layer, as fractions of the page. The box spans [x, x + width] whatever the alignment (capture.ts textLayout). */
export interface PageBox {
  id: string; title: string; visible: boolean; align: TextLayer['align']
  /** The italic line's text, drawn in italic (inspector "Italic line" is a text field, not a flag). */
  italic: string
  /** Anchor position as percentages of the page: left = x * 100, top = y * 100. */
  leftPct: number; topPct: number
  /** Box width as a percentage of the page width, after the 45% desktop cap. */
  widthPct: number
  /** Type size in container-query width units (cqw) of the page: size / reference width * 100. */
  fontCqw: number
  /** True when the anchor or the box leaves the page; the preview clips such a layer at the page edge and says so. */
  past: boolean
}
export function pagePreview(layers: readonly TextLayer[]): PageBox[] {
  return layers.filter(layer => layer.visible).map(layer => {
    const widthFraction = Math.min(layer.width, PAGE_REFERENCE_WIDTH * BLOCK_CAP) / PAGE_REFERENCE_WIDTH
    const past = layer.x < 0 || layer.x > 1 || layer.y < 0 || layer.y > 1 || layer.x + widthFraction > 1
    return {id: layer.id, title: layerTitle(layer), visible: layer.visible, align: layer.align, italic: layer.italic,
      leftPct: layer.x * 100, topPct: layer.y * 100, widthPct: widthFraction * 100, fontCqw: layer.size / PAGE_REFERENCE_WIDTH * 100, past}
  })
}

/** Position with the admitted range and the inspector's two-decimal step. */
export function clampPosition(value: number): number {
  const rounded = Math.round(value * 100) / 100
  return Math.min(POSITION_RANGE[1], Math.max(POSITION_RANGE[0], rounded))
}
/** The page position under a pointer drag: the origin plus the pointer's travel as a fraction of the page box. */
export function dragPosition(origin: {x: number; y: number}, start: {clientX: number; clientY: number}, pointer: {clientX: number; clientY: number},
  page: {width: number; height: number}): {x: number; y: number} {
  if (!(page.width > 0) || !(page.height > 0)) return {x: clampPosition(origin.x), y: clampPosition(origin.y)}
  return {x: clampPosition(origin.x + (pointer.clientX - start.clientX) / page.width), y: clampPosition(origin.y + (pointer.clientY - start.clientY) / page.height)}
}
/** Arrow keys on the page handle: plain arrows step 0.01, Shift steps 0.1. Returns null for any other key. */
export function keyStep(key: string, shift: boolean): {x: number; y: number} | null {
  const step = shift ? 0.1 : 0.01
  if (key === 'ArrowLeft') return {x: -step, y: 0}
  if (key === 'ArrowRight') return {x: step, y: 0}
  if (key === 'ArrowUp') return {x: 0, y: -step}
  if (key === 'ArrowDown') return {x: 0, y: step}
  return null
}

// ---- Change builders: the shapes NativeSceneTextChange admits ----------------

export const addLayerChange = (): NativeSceneTextChange => ({kind: 'text-layer-add'})
export const removeLayerChange = (layerId: string): NativeSceneTextChange => ({kind: 'text-layer-remove', layer_id: layerId})
export const setLayerChange = (layerId: string, values: NativeTextLayerValues): NativeSceneTextChange => ({kind: 'text-layer-set', layer_id: layerId, values})
/** The visibility toggle is one text-layer-set of the visible field. */
export const visibleChange = (layer: TextLayer, visible: boolean): NativeSceneTextChange | null =>
  layer.visible === visible ? null : setLayerChange(layer.id, {visible})
export const alignChange = (layer: TextLayer, align: string): {change: NativeSceneTextChange | null; problem: string | null} => {
  if (!(TEXT_ALIGNS as readonly string[]).includes(align)) return {change: null, problem: 'Alignment is left, centre or right'}
  return {change: layer.align === align ? null : setLayerChange(layer.id, {align: align as TextLayer['align']}), problem: null}
}
/** One pointer-up or one arrow key: both coordinates in one text-layer-set. Null when neither moved. */
export const positionChange = (layer: TextLayer, x: number, y: number): NativeSceneTextChange | null => {
  const next = {x: clampPosition(x), y: clampPosition(y)}
  return next.x === layer.x && next.y === layer.y ? null : setLayerChange(layer.id, next)
}

/** The layer budget: Add is refused with the boundary's own message once the Scene holds the maximum. */
export const addLayerProblem = (layers: readonly TextLayer[]): string | null =>
  layers.length >= TEXT_LAYER_BUDGET ? `A Scene supports ${TEXT_LAYER_BUDGET} text layers` : null

/** One exact-value control's commit: parse what was typed, keep a value the boundary would refuse out of the request, and return
 * the one text-layer-set for a real change. A problem names the bound; nothing is sent when it is set. */
export function fieldChange(layer: TextLayer, control: TextControl, raw: string): {change: NativeSceneTextChange | null; problem: string | null} {
  const label = TEXT_CONTROL_LABELS[control]
  const value = parseField(control, raw, label)
  if (typeof value !== 'string' && typeof value !== 'number') return {change: null, problem: value.problem}
  try {validateTextLayerValues({[control]: value})}
  catch (cause) {return {change: null, problem: cause instanceof Error ? cause.message : String(cause)}}
  if (layer[control] === value) return {change: null, problem: null}
  return {change: setLayerChange(layer.id, {[control]: value} as NativeTextLayerValues), problem: null}
}
/** The typed value, or the problem that keeps it out of any request. Numbers are exact decimals inside the admitted range. */
function parseField(control: TextControl, raw: string, label: string): string | number | {problem: string} {
  if ((TEXT_NUMERIC_CONTROLS as readonly string[]).includes(control)) {
    const [min, max] = TEXT_NUMERIC_RANGE[control as keyof typeof TEXT_NUMERIC_RANGE], text = raw.trim()
    const value = text === '' ? NaN : Number(text)
    if (!Number.isFinite(value)) return {problem: `${label} must be a number from ${min} to ${max}`}
    if (value < min || value > max) return {problem: `${label} must be from ${min} to ${max}`}
    return value
  }
  const max = TEXT_MAX_LENGTH[control as keyof typeof TEXT_MAX_LENGTH]
  if (raw.length > max) return {problem: `${label} is at most ${max} characters`}
  return raw
}

export const textFaceModel: SceneFaceModel = {
  name: 'Page text',
  groups: [{title: 'Text layers'}, {title: 'Selected layer'}],
  summary: reading => textSummary(reading.scene?.text),
  enabled: () => undefined,
  // Summary plus Add layer only: the rack widget has no numeric control for a layer, so the one compact action is the layer budget's add.
  compactActions: reading => {
    const layers = reading.scene?.text
    return [{label: 'Add layer', title: `Add a text layer to this Scene (${TEXT_LAYER_BUDGET} maximum)`, changes: [addLayerChange()],
      disabled: layers ? addLayerProblem(layers) : 'Page text is not disclosed by this reading'}]
  },
  studio: 'text',
}
