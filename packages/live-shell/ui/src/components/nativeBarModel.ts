import {NATIVE_BINDINGS, baseValue, type NativeBinding} from '@epilogos/expressions-boundary/parameters'
import type {HostedAppState, StageTool} from '@epilogos/expressions-boundary'
import type {NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {FIELD_PANEL_SETTINGS} from '../../../../expressions-boundary/src/nativeFieldPanelSettings'
import {STAGE_TOOL_LABELS, stageReadings} from '../native/stageCommands'

/** Pure facts for the top bar. Nothing here owns a clock, a document or a write:
 * every value is read from the owner's reading or the frame's hosted state, and
 * every control it describes is one admitted request. */

/** Ableton's Draw-mode slot: the stage tool rail, in the order the frame offers it. */
export const BAR_TOOLS: readonly StageTool[] = ['select', 'interact', 'pin', 'text', 'formation']
export interface BarTool {tool: StageTool; label: string; pressed: boolean | undefined}
/** pressed is undefined when the frame has not reported its tool, so no button claims a state it cannot read. */
export function barToolRail(state: HostedAppState | null): BarTool[] {
  const tool = stageReadings(state).tool
  return BAR_TOOLS.map(item => ({tool: item, label: STAGE_TOOL_LABELS[item], pressed: tool === undefined ? undefined : tool === item}))
}
/** Repeat pins is a Pin placement mode, offered only while Pin is the active tool. */
export const barRepeatPins = (state: HostedAppState | null): {visible: boolean; pressed: boolean | undefined} => {
  const readings = stageReadings(state)
  return {visible: readings.tool === 'pin', pressed: readings.repeatPins}
}

export type PointerMode = (typeof FIELD_PANEL_SETTINGS.pointerMode.options)[number]
export type PointerClick = (typeof FIELD_PANEL_SETTINGS.pointerClick.options)[number]
export type PointerScope = (typeof FIELD_PANEL_SETTINGS.pointerScope.options)[number]
export interface BarPointer {
  mode: PointerMode; click: PointerClick; scope: PointerScope
  modes: readonly PointerMode[]; clicks: readonly PointerClick[]; scopes: readonly PointerScope[]
}
/** The pointer force mode, click effect and scope, shown beside the tool rail while Interact is the active tool. Null otherwise. */
export function barPointer(reading: NativeEditorReading | null, state: HostedAppState | null): BarPointer | null {
  if (!reading || stageReadings(state).tool !== 'interact') return null
  const engine = reading.scene.engine
  return {
    mode: engine.pointerMode, click: engine.pointerClick ?? 'pulse', scope: reading.scene.pointerScope === 'local' ? 'local' : 'global',
    modes: FIELD_PANEL_SETTINGS.pointerMode.options, clicks: FIELD_PANEL_SETTINGS.pointerClick.options, scopes: FIELD_PANEL_SETTINGS.pointerScope.options,
  }
}

export type EngineLightKind = 'recording' | 'held' | 'running' | 'unknown'
export interface EngineLight {kind: EngineLightKind; label: string; title: string}
/** The CPU-light slot: what the engine is doing now, read-only. Recording outranks held, held outranks running. */
export function barEngineLight(state: HostedAppState | null, playback: {field_paused: boolean} | null | undefined): EngineLight {
  if (state?.propertyRecording) return {kind: 'recording', label: 'Recording', title: 'A property take is recording the chosen controls.'}
  if (state?.recording) return {kind: 'recording', label: 'Recording', title: 'The stage is recording video.'}
  if (!playback) return {kind: 'unknown', label: 'Engine', title: 'The engine state is not reported yet.'}
  return playback.field_paused
    ? {kind: 'held', label: 'Held', title: 'Physics is held: the field is paused.'}
    : {kind: 'running', label: 'Running', title: 'Physics is running.'}
}

const bindingAt = (path: string): NativeBinding | undefined => NATIVE_BINDINGS.find(item => item.path === path)
export interface BarParameter {
  path: string; key: string; target: string; label: string; unit: string
  /** The base value as authored. */
  base: number
  /** The engine's effective value, shown separately only when it differs and the target is automated. */
  effective: number | undefined; automated: boolean
  min: number; max: number; hardMin: number; hardMax: number; step: number
}
/** One numeric field parameter as the bar shows it: real label, unit, ranges; base and effective kept apart. Null when the registry has no such path. */
export function barParameter(reading: NativeEditorReading, path: string): BarParameter | null {
  const binding = bindingAt(path)
  if (!binding) return null
  const target = 'field.' + binding.key
  const automated = reading.scene.automation.some(lane => lane.enabled && lane.target === target)
  const observed = reading.observation?.effectiveValues?.[target]
  return {
    path, key: binding.key, target, label: binding.label, unit: binding.unit ?? '', base: baseValue(reading.scene, binding.key),
    effective: automated && observed !== undefined && Number.isFinite(observed) ? observed : undefined, automated,
    min: binding.min, max: binding.max, hardMin: binding.hardMin, hardMax: binding.hardMax, step: binding.step,
  }
}

const clampTo = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
/** A typed value, admitted only when finite and inside the registry's hard bounds (the same check the owner applies). */
export function parseBarValue(text: string, parameter: Pick<BarParameter, 'hardMin' | 'hardMax'>): number | null {
  if (!text.trim()) return null
  const value = Number(text)
  return Number.isFinite(value) && value >= parameter.hardMin && value <= parameter.hardMax ? value : null
}
/** Dragging a value: the soft range spans this many pixels; Shift gives fine control. */
export const BAR_DRAG_SPAN = 200
export function scrubBarValue(start: number, dx: number, parameter: Pick<BarParameter, 'min' | 'max' | 'hardMin' | 'hardMax'>, fine = false): number {
  const range = parameter.max - parameter.min
  // Rounded to six places so a streamed value carries no float noise into the take or the document.
  return clampTo(Number((start + (dx / BAR_DRAG_SPAN) * range * (fine ? 0.1 : 1)).toFixed(6)), parameter.hardMin, parameter.hardMax)
}
/** Arrow-key stepping: one registry step, ten with Shift, kept inside the hard bounds. */
export function stepBarValue(value: number, parameter: Pick<BarParameter, 'step' | 'hardMin' | 'hardMax'>, direction: 1 | -1, large = false): number {
  const next = value + direction * parameter.step * (large ? 10 : 1)
  return clampTo(Number(next.toFixed(6)), parameter.hardMin, parameter.hardMax)
}
/** Display text for a value: the registry step decides the decimals. */
export function formatBarValue(value: number, parameter: Pick<BarParameter, 'step'>): string {
  const decimals = Math.min(4, Math.max(0, Math.ceil(-Math.log10(parameter.step || 1))))
  return value.toFixed(decimals)
}

export type PlayRoute = 'take-start' | 'take-stop' | 'play'
/** Arm automation + Play starts a property take; Stop finishes it. Arm alone records nothing, and Record is never an immediate-record button.
 * A take that cannot start (no chosen properties, another Scene presented, video running) never blocks Play: the Scene plays and the reason is shown. */
export function barPlayRoute(input: {armed: boolean; recording: boolean; startReason: string | null}): {route: PlayRoute; blockedReason: string | null} {
  if (input.recording) return {route: 'take-stop', blockedReason: null}
  if (!input.armed) return {route: 'play', blockedReason: null}
  return input.startReason === null ? {route: 'take-start', blockedReason: null} : {route: 'play', blockedReason: input.startReason}
}
/** Re-enable automation (the orange button): visible only while a manual live gesture holds parameters off their automation. */
export function barResume(state: HostedAppState | null): {visible: boolean; count: number} {
  const count = state?.automationHeld ?? 0
  return {visible: count > 0, count}
}
