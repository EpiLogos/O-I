// A set device's live picture, in its well on the chain, whole in the pool, full in a pane and small on the rail. Its owner states
// no curve of what the effect does to the sound, so the picture draws nothing of the kind (manual §16.11: "Do not draw a likely
// picture"): it draws the device's stored values themselves, each on its own range — a bar for a quantity, a lamp for a switch, a
// step for a choice — from the same readings its plate draws (the owner's stored-parameter table and stored values, or the deep
// document's parameters with their disclosed ranges where no table stands; live/liveChainDevices.ts setDeviceFaced, setDeviceReading).
// A value the owner does not report draws no mark, and the well says so when none is reported. Pure apart from the drawing.
import type {CSSProperties} from 'react'
import type {DeviceInstance} from '../frame/devices/deviceRuntime'
import type {SetParameter} from '../shell/document'

export type SetValueMark =
  | {readonly key: string; readonly title: string; readonly kind: 'range'; readonly at: number}
  | {readonly key: string; readonly title: string; readonly kind: 'switch'; readonly on: boolean}
  | {readonly key: string; readonly title: string; readonly kind: 'step'; readonly step: number; readonly steps: number}

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const unit = (value: number, min: number, max: number) => Math.min(1, Math.max(0, (value - min) / (max - min)))

/** The marks a device's readings make, in the device's own row order: only values the owner reports, each on a range it states. */
export function setValueMarks(device: DeviceInstance, params?: readonly SetParameter[]): SetValueMark[] {
  const marks: SetValueMark[] = []
  for (const row of device.rows) {
    if (row.key.startsWith('·') || row.key === device.enabledKey) continue
    const value = device.values[row.key]
    if (value === undefined) continue
    const min = row.range?.min, max = row.range?.max
    if (row.type === 'number' && finite(value) && finite(min) && finite(max) && max > min) marks.push({key: row.key, title: row.title, kind: 'range', at: unit(value, min, max)})
    else if (row.type === 'boolean' && typeof value === 'boolean') marks.push({key: row.key, title: row.title, kind: 'switch', on: value})
    else if (row.type === 'enumerated' && typeof value === 'string' && (row.values?.length ?? 0) > 1) {
      const step = row.values!.indexOf(value)
      if (step >= 0) marks.push({key: row.key, title: row.title, kind: 'step', step, steps: row.values!.length})
    } else if (row.type === 'string') {
      // The deep document's reading: a number with the range the document discloses, or a stored switch.
      const param = params?.find(item => item.id === row.key)
      const read = Number.parseFloat(String(value)), low = Number.parseFloat(param?.min ?? ''), high = Number.parseFloat(param?.max ?? '')
      if (finite(read) && finite(low) && finite(high) && high > low) marks.push({key: row.key, title: row.title, kind: 'range', at: unit(read, low, high)})
      else if (value === 'true' || value === 'false') marks.push({key: row.key, title: row.title, kind: 'switch', on: value === 'true'})
    }
  }
  return marks
}

/** How many marks each size has room for: nothing scrolls in a well. */
const ROOM = {compact: 9, whole: 9, full: 18} as const
const STYLE: CSSProperties = {width: '100%', height: '100%', display: 'block'}

export function SetDevicePicture({marks, size}: {marks: readonly SetValueMark[]; size: 'compact' | 'whole' | 'full'}) {
  const shown = marks.slice(0, ROOM[size]), W = 140, row = 14, H = Math.max(row * shown.length + 14, 40), x0 = 58, x1 = W - 6
  if (!shown.length) return <svg className="set-values" viewBox="0 0 140 40" preserveAspectRatio="xMidYMid meet" style={STYLE} role="img" aria-label="No stored value is reported">
    <text x={70} y={23} textAnchor="middle" className="set-values-none">No stored value</text>
  </svg>
  return <svg className="set-values" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={STYLE} role="img"
    aria-label={`The device's stored values${marks.length > shown.length ? `, the first ${shown.length} of ${marks.length}` : ''}`} data-set-values={marks.length}>
    {shown.map((mark, index) => {
      const y = 9 + index * row
      return <g key={mark.key} data-set-value={mark.key} data-set-mark={mark.kind}>
        <text x={4} y={y + 4} className="set-values-name">{mark.title.length > 12 ? `${mark.title.slice(0, 11)}…` : mark.title}</text>
        {mark.kind === 'range' && <>
          <rect x={x0} y={y - 2} width={x1 - x0} height={5} rx={1} className="set-values-track" />
          <rect x={x0} y={y - 2} width={Math.max(.5, (x1 - x0) * mark.at)} height={5} rx={1} className="set-values-fill" />
        </>}
        {mark.kind === 'switch' && <circle cx={x0 + 3} cy={y + .5} r={3} className={mark.on ? 'set-values-lamp set-values-lamp--on' : 'set-values-lamp'} />}
        {mark.kind === 'step' && Array.from({length: mark.steps}, (_, step) => {
          const w = (x1 - x0) / mark.steps
          return <rect key={step} x={x0 + step * w + .5} y={y - 2} width={Math.max(1, w - 1)} height={5} rx={1} className={step === mark.step ? 'set-values-fill' : 'set-values-track'} />
        })}
      </g>
    })}
  </svg>
}
