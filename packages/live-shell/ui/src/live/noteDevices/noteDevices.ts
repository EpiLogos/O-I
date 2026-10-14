// The note-device chain (T-LIVE-MODE-SCALES item 3; DEVICE-SEMANTICS-LOCK §0.2 item 5): the devices that transform every played act
// before it reaches the torus. A device is a pure function of its own parameters, the act's pitch classes and the mode in force; the
// chain is their composition in chain order. An empty or all-bypassed chain is the identity, so today's behaviour is unchanged.
//
// Law: a device holds no pitch set of its own. The Scale device folds onto the owner's pitch set (pitchMask over the catalogue the
// transport holds). A mode that serves no pitch set passes notes through and says why. Nothing here is 12-TET.
//
// Pure. No React, no store, no I/O.

import {pitchMask, type ModeInForce, type PitchClass} from '../modes'

export type NoteDeviceKind = 'scale'

/** The Scale device's tie rule: where a class lies equally far from an in-mode class above and below. */
export type TieRule = 'up' | 'down'
export const TIE_RULES: readonly TieRule[] = Object.freeze(['up', 'down'])
export const TIE_RULE_LABEL: Readonly<Record<TieRule, string>> = Object.freeze({up: 'Up', down: 'Down'})
export const DEFAULT_TIE_RULE: TieRule = 'up'

export interface ScaleNoteDevice {
  readonly id: string
  readonly kind: 'scale'
  /** Power: a bypassed device passes the act through unchanged. */
  readonly enabled: boolean
  readonly params: {readonly tie: TieRule}
}

export type NoteDevice = ScaleNoteDevice

export interface NoteDeviceEnv {
  readonly mode: ModeInForce
}

/** One device's reading of an act: the pitch classes it hands on, and its line when it passed the act through unchanged. */
export interface NoteDeviceStage {
  readonly pitchClasses: readonly PitchClass[]
  readonly passed: string | null
}

/** What the Scale device does under the mode in force: fold onto the owner's pitch set, or pass through and say why. */
export type ScalePlan =
  | {readonly state: 'fold'; readonly mask: readonly boolean[]; readonly line: string}
  | {readonly state: 'pass'; readonly line: string}

/** The Scale device's plan under a mode in force. No mode, or a mode that serves no pitch set (a maqam), passes through. */
export function scalePlan(mode: ModeInForce): ScalePlan {
  if (mode.state !== 'in-force') return {state: 'pass', line: `Passes notes through. ${mode.line}`}
  const mask = pitchMask(mode.selection.scale)
  if (mask === null || !mask.some(Boolean)) {
    return {state: 'pass', line: `Passes notes through: ${mode.selection.scale.label} serves no pitch set, so nothing folds and no 12-TET mapping is invented.`}
  }
  return {state: 'fold', mask, line: `Folds onto ${mode.selection.scale.label}, the owner's pitch set.`}
}

/**
 * The nearest in-mode pitch class to `pitch`, by the fewest semitones either way. A class in the mask stays. A class equally far from
 * an in-mode class above and below goes to the tie rule. An empty mask leaves the class where it is (the caller never asks for one).
 */
export function foldPitchClass(pitch: PitchClass, mask: readonly boolean[], tie: TieRule): PitchClass {
  if (mask[pitch]) return pitch
  for (let step = 1; step <= 6; step += 1) {
    const up = (pitch + step) % 12
    const down = (pitch - step + 12) % 12
    if (mask[up] && mask[down]) return tie === 'up' ? up : down
    if (mask[up]) return up
    if (mask[down]) return down
  }
  return pitch
}

/** Ascending, without duplicates: a chord's classes after a fold, so one act never sounds a class twice. */
export function distinctSorted(pitchClasses: readonly PitchClass[]): PitchClass[] {
  return [...new Set(pitchClasses)].sort((a, b) => a - b)
}

/** The Scale device: each played class folds onto the mode's pitch set; duplicates within the act collapse. Pass-through under no mode. */
export function scaleStage(device: ScaleNoteDevice, pitchClasses: readonly PitchClass[], env: NoteDeviceEnv): NoteDeviceStage {
  const plan = scalePlan(env.mode)
  if (plan.state === 'pass') return {pitchClasses, passed: plan.line}
  return {pitchClasses: distinctSorted(pitchClasses.map(pitch => foldPitchClass(pitch, plan.mask, device.params.tie))), passed: null}
}

/** One device's stage. The switch is exhaustive over the kinds: a new kind is a compile error until it has a transform. */
export function runStage(device: NoteDevice, pitchClasses: readonly PitchClass[], env: NoteDeviceEnv): NoteDeviceStage {
  switch (device.kind) {
    case 'scale':
      return scaleStage(device, pitchClasses, env)
  }
}

/** Composition in order: the first stage's output is the second's input. The chain is this, over its enabled devices. */
export function composeInOrder<T>(stages: readonly ((input: T) => T)[], input: T): T {
  return stages.reduce((value, stage) => stage(value), input)
}

export interface NoteChainTrace {
  readonly pitchClasses: readonly PitchClass[]
  /** The enabled devices that ran, in chain order, with the line each gave when it passed the act through. */
  readonly stages: readonly {readonly id: string; readonly kind: NoteDeviceKind; readonly passed: string | null}[]
}

/** One act through the chain, in chain order. Bypassed devices are skipped. With no enabled device the input is returned as it came. */
export function traceNoteChain(chain: readonly NoteDevice[], pitchClasses: readonly PitchClass[], env: NoteDeviceEnv): NoteChainTrace {
  const stages: {id: string; kind: NoteDeviceKind; passed: string | null}[] = []
  let current = pitchClasses
  for (const device of chain) {
    if (!device.enabled) continue
    const stage = runStage(device, current, env)
    current = stage.pitchClasses
    stages.push({id: device.id, kind: device.kind, passed: stage.passed})
  }
  return {pitchClasses: current, stages}
}

/** The pitch classes an act sounds after the chain. The identity for an empty or all-bypassed chain. */
export function runNoteChain(chain: readonly NoteDevice[], pitchClasses: readonly PitchClass[], env: NoteDeviceEnv): readonly PitchClass[] {
  return traceNoteChain(chain, pitchClasses, env).pitchClasses
}

/** A new device of a kind, at its defaults and powered on. */
export function newNoteDevice(kind: NoteDeviceKind, id: string): NoteDevice {
  switch (kind) {
    case 'scale':
      return {id, kind: 'scale', enabled: true, params: {tie: DEFAULT_TIE_RULE}}
  }
}

export const NOTE_DEVICE_LABEL: Readonly<Record<NoteDeviceKind, string>> = Object.freeze({scale: 'Scale'})

/** The devices the add control names but does not offer: their owners have not served them. Named, never faked. */
export const NOTE_DEVICES_WAITING: readonly {readonly label: string; readonly waiting: string}[] = Object.freeze([
  {label: 'Exact-ratio tuning', waiting: 'waiting on its owner (exact-ratio tuning)'},
  {label: 'Sky', waiting: 'waiting on its owner (planetary modulation sources)'},
])
