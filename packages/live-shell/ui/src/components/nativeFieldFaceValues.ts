import type {Scene} from '../../../../expressions-boundary/src/editor'
import {NATIVE_BINDINGS, baseValue} from '@epilogos/expressions-boundary/parameters'

/** Pure value text shared by the device-chain summaries and the Field face drawings. No React. */
export const short = (n: number) => Number.isFinite(n) ? String(Number(n.toFixed(4))) : '—'
/** Same binding lookup as the full editors: path to native key, then the reading's base value. */
export const fieldValue = (scene: Scene, path: string) => {
  const binding = NATIVE_BINDINGS.find(row => row.path === path)
  return binding ? short(baseValue(scene, binding.key)) : '—'
}
