import type {NativeBinding} from '@epilogos/expressions-boundary/parameters'

/** Pure handle geometry: the SVG line that a binding's soft range min..max spans. dir is a unit vector in SVG user units. */
export interface HandleGeometry {origin: {x: number; y: number}; dir: {x: number; y: number}; length: number}
export type HandleBinding = Pick<NativeBinding, 'label' | 'min' | 'max' | 'hardMin' | 'hardMax' | 'step' | 'scale' | 'unit' | 'defaultValue'>

const logScale = (binding: Pick<HandleBinding, 'min' | 'max' | 'scale'>) => binding.scale === 'log' && binding.min > 0 && binding.max > binding.min
const bounded = (binding: Pick<HandleBinding, 'hardMin' | 'hardMax'>, value: number) => Math.min(binding.hardMax, Math.max(binding.hardMin, value))
const shortValue = (value: number) => Number.isFinite(value) ? String(Number(value.toFixed(4))) : '—'

/** Soft-range fraction in [0,1]. Log mapping matches NativeChosenControls fraction/fromFraction. */
export function fraction(binding: HandleBinding, value: number): number {
  if (binding.max === binding.min) return 0
  const ratio = logScale(binding)
    ? Math.log(Math.max(binding.min, value) / binding.min) / Math.log(binding.max / binding.min)
    : (value - binding.min) / (binding.max - binding.min)
  return Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0
}
export function fromFraction(binding: HandleBinding, ratio: number): number {
  return logScale(binding) ? binding.min * (binding.max / binding.min) ** ratio : binding.min + ratio * (binding.max - binding.min)
}
/** Round to the binding step grid; toPrecision strips float noise such as 0.30000000000000004. */
export function snap(binding: Pick<HandleBinding, 'step'>, value: number): number {
  if (!(binding.step > 0)) return value
  return Number((Math.round(value / binding.step) * binding.step).toPrecision(12))
}
/** Clamp to hard bounds, round to the step grid, then clamp again because rounding can cross a bound. */
export function settle(binding: HandleBinding, value: number): number {
  return bounded(binding, snap(binding, bounded(binding, value)))
}

export function handlePosition(binding: HandleBinding, geometry: HandleGeometry, value: number): {x: number; y: number} {
  const along = fraction(binding, value) * geometry.length
  return {x: geometry.origin.x + geometry.dir.x * along, y: geometry.origin.y + geometry.dir.y * along}
}
/** Signed distance of a point along the handle axis, measured from the origin. */
const along = (geometry: HandleGeometry, point: {x: number; y: number}) => (point.x - geometry.origin.x) * geometry.dir.x + (point.y - geometry.origin.y) * geometry.dir.y
/** Axis distance from the pointer to the handle at grab time; keeps the value still until the pointer moves. */
export function grabOffset(binding: HandleBinding, geometry: HandleGeometry, value: number, point: {x: number; y: number}): number {
  return fraction(binding, value) * geometry.length - along(geometry, point)
}
export function valueFromPoint(binding: HandleBinding, geometry: HandleGeometry, point: {x: number; y: number}, offset: number): number {
  const ratio = geometry.length > 0 ? Math.min(1, Math.max(0, (along(geometry, point) + offset) / geometry.length)) : 0
  return settle(binding, fromFraction(binding, ratio))
}

/** Arrows step by one grid unit (x10 with Shift); PageUp/PageDown always step x10. Home and other keys return null. */
export function keyboardValue(binding: HandleBinding, value: number, key: string, shiftKey: boolean): number | null {
  const unit = binding.step > 0 ? binding.step : 0
  const coarse = shiftKey ? 10 : 1
  const steps = key === 'ArrowRight' || key === 'ArrowUp' ? coarse
    : key === 'ArrowLeft' || key === 'ArrowDown' ? -coarse
    : key === 'PageUp' ? 10 : key === 'PageDown' ? -10 : null
  return steps === null ? null : settle(binding, value + steps * unit)
}

/** The disclosed source default, only when it is finite and inside the hard bounds. */
export function resetValue(binding: HandleBinding): number | null {
  const value = binding.defaultValue
  return typeof value === 'number' && Number.isFinite(value) && value >= binding.hardMin && value <= binding.hardMax ? value : null
}

/** Accessible value text: 'Label value unit'. */
export function valueText(binding: HandleBinding, value: number): string {
  return [binding.label, shortValue(value), binding.unit].filter(Boolean).join(' ')
}
