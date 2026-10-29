// Live's transport bindings (moved from shell/modeTransports.tsx, which registers them; O-I #740: loaded when Live's transport first
// draws). The mode in force (root, scale) and its key and MIDI maps; Play and Stop over the clip THE selection names.
import type {UseModeTransport} from '../modeTransports'
import {PITCH_CLASS_NAMES} from '../../live/modes'
import {setLiveModeHold, useLiveModeInForce} from '../../native/liveModeCatalogue'
import {MidiMapHost, MidiMapToggles} from '../../live/midiMap/midiMapControls'
import {useLiveClipPlay} from '../../live/clipPlayer'
import {useOptionalContinuity} from '../../continuity/workspace'

export const useLiveTransport: UseModeTransport = ({tempoBpm}) => {
  const {reading, hold, refresh, groups, mode, line} = useLiveModeInForce()
  const ready = reading.state === 'ready'
  const choice = mode.state === 'in-force' ? mode.selection : null
  // Play and Stop (manual §21.2 Transport, "Play | Plays the clips of the part on the torus"; Views, "In Clip view, the Torus plays the
  // notes of the clip that you select"): the clip THE selection names, at the set's tempo.
  const clip = useLiveClipPlay(useOptionalContinuity()?.current.context?.selection, tempoBpm)
  return {
    ...clip,
    tempo: {readout: {value: tempoBpm?.toFixed(2) ?? '—', title: 'Tempo — the set\'s tempo · document read-only until the editing owner lands'}},
    root: {control: <select aria-label="Root note" title={`Root — the mode in force's root. ${line}`} disabled={!ready}
      value={ready ? String(hold.root) : ''} onChange={event => setLiveModeHold({root: Number(event.target.value)})}>
      {ready ? PITCH_CLASS_NAMES.map((name, pitch) => <option key={pitch} value={pitch}>{name}</option>) : <option>—</option>}
    </select>},
    scale: {control: <>
      <select aria-label="Scale mode" title={`Scale — the mode in force, one of the kernel's scales. ${line}`} disabled={!ready || groups.length === 0}
        value={choice?.scale.key ?? ''} onChange={event => setLiveModeHold({key: event.target.value || null})}>
        <option value="">{!ready ? '—' : groups.length ? 'none chosen' : 'no catalogued mode on this root'}</option>
        {groups.map(group => <optgroup key={group.label} label={group.label}>
          {group.scales.map(scale => <option key={scale.key} value={scale.key}>{scale.label}</option>)}
        </optgroup>)}
      </select>
      <output className="transport-mode-line" aria-label="Mode in force" title={line}>{line}</output>
      <button type="button" className="native-control" aria-label="Re-read the mode catalogue" title="Re-read the owner's mode catalogue through the kernel"
        disabled={reading.state === 'loading'} onClick={refresh}>↻</button>
    </>},
    // Live's two map toggles stand together in the key-map slot, as in Live; the map host rides with them.
    'key-map': {control: <><MidiMapToggles /><MidiMapHost /></>},
    'midi-map': {control: <></>},
  }
}
