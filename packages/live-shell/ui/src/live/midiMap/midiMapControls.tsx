// The MIDI and Key map, as the Live surface shows it (T-LIVE-MIDI leg 2). Three presentations over one hold (midiMapHold.ts):
//   · MidiMapToggles: the transport's Key map and MIDI map slots, real toggles that enter and leave a map mode;
//   · MidiMapTarget: a wrapper each mappable parameter sits in. In map mode it shows the map overlay and takes the click; outside map mode
//     it shows the mapped marker and the owner's refusal, if any;
//   · MidiMapHost: the one listener of the session. It takes the host's control changes and the computer keys, and routes them.
// Owners write, faces read: the faces only arm, bind and show. Every value moves through the parameter's own write (midiMapTargets.ts).

import {useEffect, type MouseEvent, type ReactNode} from 'react'
import {slotDataI, slotMeaning} from '../../shell/modeGrammar'
import {nativeHost} from '../../native/application'
import {LIVE_MIDI_ABSENT, subscribeLiveMidiControls} from '../../native/liveMidi'
import {keyboardGate} from '../janko/jankoInput'
import {readMapTargets} from './midiMapTargets'
import {createMapRouter} from './midiMapRouter'
import {applyMapValue, type MapMode} from './midiMapModel'
import {
  bindArmed, clickMapTarget, leaveMapMode, mappingChip, midiMapState, onBindingChanged, pressMapKey, removeArmedMapping, setMapMode,
  setMapNotice, setMapRefusal, useMidiMap,
} from './midiMapHold'
import './midiMap.css'

/** The one router of the session: control changes and keys, outside map mode, reach the parameters' writes through it. */
export const liveMapRouter = createMapRouter({
  read: () => {
    const state = midiMapState()
    return {mode: state.mode, bindings: state.bindings}
  },
  targets: readMapTargets,
  apply: applyMapValue,
  refusal: setMapRefusal,
})

// A rebound or removed parameter starts afresh: its last value is not held against its next control.
onBindingChanged(targetId => liveMapRouter.forget(targetId))

/** The line the map shows in map mode: the mode's instruction or the last act, then where the mappings live. */
const PERSISTENCE = 'Held for this session only: the set document has no owner write for mappings, and recording them as automation waits on the arrangement\'s automation owner.'

function mapLine(notice: string | null, absent: boolean): string {
  const head = absent ? LIVE_MIDI_ABSENT : notice ?? ''
  return `${head} ${PERSISTENCE}`.trim()
}

/** The Key map and MIDI map slots of the Live transport. Each is a toggle; the second press, or Escape, leaves. */
export function MidiMapToggles() {
  const map = useMidiMap()
  const keyMeaning = slotMeaning('live', 'key-map')
  const midiMeaning = slotMeaning('live', 'midi-map')
  const absent = map.mode === 'midi' && !nativeHost()
  const line = mapLine(map.notice, absent)
  return <>
    <button type="button" className="native-control midi-map-toggle" aria-label="Key mapping" aria-pressed={map.mode === 'key'}
      data-i={slotDataI(keyMeaning)} title={`${keyMeaning.label} — ${keyMeaning.fn}. ${map.mode === 'key' ? 'Click or Escape leaves key map mode.' : 'Click to map keys; Escape leaves.'}`}
      onClick={() => setMapMode(map.mode === 'key' ? 'off' : 'key')}>Key</button>
    <button type="button" className="native-control midi-map-toggle" aria-label="MIDI mapping" aria-pressed={map.mode === 'midi'}
      data-i={slotDataI(midiMeaning)} title={`${midiMeaning.label} — ${midiMeaning.fn}. ${map.mode === 'midi' ? 'Click or Escape leaves MIDI map mode.' : 'Click to map hardware controls; Escape leaves.'}`}
      onClick={() => setMapMode(map.mode === 'midi' ? 'off' : 'midi')}>MIDI</button>
    {map.mode !== 'off' && <output className="midi-map-line" role="status" data-midi-map-mode={map.mode} title={line}>{line}</output>}
  </>
}

/** A mappable parameter's frame. Outside map mode it shows its marker and the owner's refusal; in map mode it shows the overlay and takes the
 * click, so a control under it (even a disabled one) never receives the press. */
export function MidiMapTarget({id, children}: {id: string; children: ReactNode}) {
  const map = useMidiMap()
  const open = map.mode !== 'off'
  const armed = map.armed === id
  const chip = mappingChip(id)
  const refusal = map.refusals[id] ?? null
  const press = (event: MouseEvent<HTMLDivElement>) => {
    if (!open) return
    event.preventDefault()
    event.stopPropagation()
    clickMapTarget(id, readMapTargets())
  }
  return (
    <div className={`midi-map-target${open ? ' is-map-open' : ''}${armed ? ' is-armed' : ''}${chip !== null ? ' is-mapped' : ''}`}
      data-midi-target={id} data-midi-open={open ? 'yes' : 'no'} data-midi-armed={armed ? 'yes' : 'no'} data-midi-mapped={chip !== null ? 'yes' : 'no'}
      onClickCapture={press} onMouseDownCapture={event => { if (open) event.preventDefault() }}>
      {children}
      {chip !== null && <small className="midi-map-mark" data-midi-mark={id} title="This parameter is mapped. In map mode, click it to remove the mapping.">{chip}</small>}
      {refusal !== null && <small className="midi-map-refusal" role="alert" data-midi-refusal={id}>{`Refused by the owner: ${refusal}`}</small>}
    </div>
  )
}

const isEditable = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null
  return !!element && (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName))
}

/** Where a computer key goes: `leave` the map mode (Escape), `remove` the armed parameter's mapping (Delete, Backspace), `press` a key into
 * key map mode, `step` a bound parameter outside map mode, or `ignore` (editable text, a modifier, a held key, or a MIDI map mode, which
 * takes no key). Pure: the gate is keyboardGate, the one the Jankó keyboard uses. */
export type MapKeyRoute = 'leave' | 'remove' | 'press' | 'step' | 'ignore'
export function mapKeyRoute(input: {readonly key: string; readonly editable: boolean; readonly modifier: boolean; readonly repeat: boolean}, mode: MapMode): MapKeyRoute {
  if (mode !== 'off' && !input.editable && input.key === 'Escape') return 'leave'
  if (mode !== 'off' && !input.editable && !input.modifier && (input.key === 'Delete' || input.key === 'Backspace')) return 'remove'
  if (!keyboardGate({armed: true, editable: input.editable, modifier: input.modifier, repeat: input.repeat})) return 'ignore'
  if (mode === 'key') return 'press'
  if (mode === 'midi') return 'ignore'
  return 'step'
}

/** The session's one listener: the host's control changes, and the computer keyboard. Mounted once, with the Live transport. */
export function MidiMapHost() {
  useEffect(() => subscribeLiveMidiControls({
    onControls: controls => {
      if (midiMapState().mode === 'midi') {
        for (const control of controls) bindArmed({kind: 'cc', port: control.port, channel: control.channel, controller: control.controller}, readMapTargets())
        return
      }
      liveMapRouter.control(controls)
    },
    onRefused: reason => setMapNotice(reason),
  }), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const route = mapKeyRoute({key: event.key, editable: isEditable(event.target), modifier: event.ctrlKey || event.metaKey || event.altKey, repeat: event.repeat}, midiMapState().mode)
      if (route === 'ignore') return
      if (route === 'step') {
        if (liveMapRouter.key(event.key.toLowerCase())) event.preventDefault()
        return
      }
      event.preventDefault()
      if (route === 'leave') leaveMapMode()
      else if (route === 'remove') removeArmedMapping(readMapTargets())
      else pressMapKey(event.key, readMapTargets())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return null
}
