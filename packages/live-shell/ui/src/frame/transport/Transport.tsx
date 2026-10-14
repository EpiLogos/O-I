// The one transport (FOUNDATION F7): 28 slots in Live's places, the same in every mode, each with its specimen mark from
// the icon cut; readout slots show values. What a slot does is the mode's binding (shell/modeTransports.tsx); unbound,
// it is drawn waiting — reduced, disabled, its title naming what it would do and that it waits. A slot is enabled only by
// a binding with a write path; a light shows only a reading. It knows no mode. Drawn at the mockup's floor (.tp's groups,
// .nc cells, .fld readouts, .tbtn play row; transport.css).
import type {ReactNode} from 'react'
import {Icon as CutIcon, type IconName} from '../../inhabitants/sdk/Icon'
import type {SlotBinding, SlotWords, TransportBindings, TransportSlotId} from './slots'
import './transport.css'

/** Each pressable slot's specimen mark (icon-cut.html); the slots without one are readouts. */
const MARKS: Partial<Record<TransportSlotId, IconName>> = {
  link: 'link', tap: 'tap', metro: 'metro', follow: 'follow', play: 'play', stop: 'stop', record: 'rec', overdub: 'od',
  arm: 'arm', 're-enable': 'back', capture: 'cap', 'punch-in': 'punchIn', loop: 'loop', 'punch-out': 'punchOut',
  draw: 'draw', keys: 'keys',
}
/** A readout slot's face while its owner discloses no value — Live's own empty faces. */
const EMPTY: Partial<Record<TransportSlotId, string>> = {
  tempo: '—', signature: '— / —', quantize: '—', key: '♯', root: '—', scale: '—', position: '— . — . —',
  'loop-length': '— . — . —', 'key-map': 'KEY', 'midi-map': 'MIDI', rate: '—', cpu: '—',
}
const PLAY_ROW = new Set<TransportSlotId>(['play', 'stop', 'record'])
/** The slots that only show a value; the other unmarked slots (quantize, key, the maps) are controls whose face is text. */
const READOUTS = new Set<TransportSlotId>(['tempo', 'signature', 'root', 'scale', 'position', 'loop-length', 'rate', 'cpu'])

export function Transport({bindings, words}: {bindings: TransportBindings; words: (id: TransportSlotId) => SlotWords}) {
  const slot = (id: TransportSlotId): ReactNode => <Slot key={id} id={id} binding={bindings[id]} words={words(id)} />
  return <div className="mode-transport one-transport" role="group" aria-label="Transport">
    {/* Link and Tap lead the tempo cells as one group, as the mockup's first group does. */}
    <div className="transport-group transport-lead">{slot('link')}{slot('tap')}
      <div className="transport-group transport-tempo">{slot('tempo')}{slot('signature')}{slot('metro')}{slot('quantize')}</div></div>
    <div className="transport-scale">{slot('key')}{slot('root')}{slot('scale')}</div>
    <div className="transport-spacer" />
    <div className="transport-group transport-playback">{slot('follow')}{slot('position')}{slot('play')}{slot('stop')}{slot('record')}{slot('overdub')}{slot('arm')}{slot('re-enable')}{slot('capture')}</div>
    <div className="transport-loop transport-group">{slot('punch-in')}{slot('loop')}{slot('punch-out')}{slot('loop-length')}</div>
    <div className="transport-spacer" />
    <div className="transport-system">{slot('draw')}{slot('keys')}{slot('key-map')}{slot('midi-map')}{slot('rate')}{slot('cpu')}<span className="cpu-meter" /></div>
  </div>
}

function Slot({id, binding, words}: {id: TransportSlotId; binding: SlotBinding | undefined; words: SlotWords}) {
  const title = binding?.refused ? `${words.label} — ${words.fn}. ${binding.refused}` : binding?.title ?? binding?.readout?.title ?? words.waiting
  const common = {'data-slot': id, 'data-i': words.dataI, title, 'aria-label': words.label}
  const light = binding?.lit === undefined ? undefined : binding.lit ? 'on' : 'off'
  if (binding?.control) return <span className="transport-slot" {...common} data-light={light}>{binding.control}</span>
  const mark = MARKS[id]
  const readout = binding?.readout?.value ?? EMPTY[id]
  const enabled = !binding?.refused && (binding?.press !== undefined)
  const stepper = binding?.step && !binding.refused
  if (!mark && !READOUTS.has(id)) {
    // A control whose face is text (Live's own: the quantize value, ♯, KEY, MIDI): enabled only by the owner's write.
    return <button type="button" className="native-control transport-text" {...common} data-light={light} aria-pressed={binding?.lit}
      disabled={!enabled} aria-disabled={!enabled} onClick={binding?.press}>{readout}</button>
  }
  if (!mark) {
    // A readout slot: its value; a stepped readout (tempo) carries its nudges, enabled only by the owner's step.
    // Unread (no owner value), the readout shows Live's empty face, drawn faint: a dash is not a value.
    const face = <output className={id === 'position' || id === 'loop-length' ? 'position-field' : id === 'tempo' ? 'tempo-field' : 'meter-field'} {...common} data-light={light}
      data-unread={binding?.readout ? undefined : ''}>{readout}</output>
    if (!binding?.step && id !== 'tempo') return face
    return <>{face}
      <button type="button" className="native-control" data-slot={id} data-i={words.dataI} title={title} aria-label={`${words.label} down`} disabled={!stepper} onClick={() => binding?.step?.(-1)}>‹</button>
      <button type="button" className="native-control" data-slot={id} data-i={words.dataI} title={title} aria-label={`${words.label} up`} disabled={!stepper} onClick={() => binding?.step?.(1)}>›</button>
    </>
  }
  const step = binding?.step && !binding.refused
  return <button type="button" className={`native-control${PLAY_ROW.has(id) ? ` transport-btn transport-${id === 'record' ? 'record' : id}` : ''}`} {...common}
    data-light={light} aria-pressed={binding?.lit} disabled={!enabled && !step} aria-disabled={!enabled && !step}
    onClick={binding?.press ?? (step ? () => binding?.step?.(1) : undefined)}>
    <CutIcon name={mark} size={PLAY_ROW.has(id) ? 15 : 13} />
  </button>
}
