// Live's transport bindings (moved from shell/modeTransports.tsx, which registers them; O-I #740: loaded when Live's transport first
// draws). The mode in force (root, scale) and its key and MIDI maps; Play and Stop over the clip THE selection names, else the open set in
// the one engine (live/liveEngine.ts); Record over the part THE selection chooses, with the Torus kept with the set (live/liveTake.ts).
import type {UseModeTransport} from '../modeTransports'
import {PITCH_CLASS_NAMES} from '../../live/modes'
import {setLiveModeHold, useLiveModeInForce} from '../../native/liveModeCatalogue'
import {MidiMapHost, MidiMapToggles} from '../../live/midiMap/midiMapControls'
import {clipAddressOf, SET_QUANTIZE, useLiveClipPlay} from '../../live/clipPlayer'
import {DEFAULT_SIGNATURE} from '../document'
import {useLiveEngineTransport} from '../../live/liveEngine'
import {useLiveArm, useLiveRecord} from '../../live/liveTake'
import {useLiveTorusReading} from '../../live/torusInstrument'
import {setSelectionOf} from '../liveSelection'
import {useOptionalContinuity} from '../../continuity/workspace'

export const useLiveTransport: UseModeTransport = ({tempoBpm, setPath = null, quantize = null, signature = null}) => {
  const {reading, hold, refresh, groups, mode, line} = useLiveModeInForce()
  const ready = reading.state === 'ready'
  const choice = mode.state === 'in-force' ? mode.selection : null
  // Play and Stop (manual §21.2 Transport, "Play | Plays the clips of the part on the torus"; Views, "In Clip view, the Torus plays the
  // notes of the clip that you select"): the clip THE selection names, at the set's tempo; with no clip selected, the open set in the
  // one engine (§21.1 Rules: every part sounds in one engine, to the Main track).
  const selection = useOptionalContinuity()?.current.context?.selection
  const clip = useLiveClipPlay(selection, tempoBpm)
  const engine = useLiveEngineTransport(setPath)
  // Record (§21.2 Transport, "Record | Records what you play into Arrangement view as notes"; §21.1, "each pass lies as a take lane under
  // its track"; O-I #855): what you play on the part THE selection chooses, laid in the set as a take; the set keeps the Torus with it.
  const torus = useLiveTorusReading()
  const record = useLiveRecord({setPath, track: setSelectionOf(selection, setPath ?? undefined)?.track ?? null, bpm: tempoBpm, torus,
    mode: ready ? {root: hold.root, scale: hold.key} : null})
  // Arm (§21.2 Transport, "Arm | Records your parameter moves as automation lanes"; O-I 853): while a take records, each move of a mapped
  // control lies on its parameter's lane.
  const arm = useLiveArm()
  const playStop = clipAddressOf(selection) ? clip : engine
  return {
    ...playStop,
    record,
    arm,
    tempo: {readout: {value: tempoBpm?.toFixed(2) ?? '—', title: 'Tempo — the set\'s tempo · document read-only until the editing owner lands'}},
    // The transport's Quantize and the signature are the open set's, as its owner reads them (O-I #849 round 21: model.rs global_quantize,
    // signature_of); a set that keeps none Live names stands at Live's own, as its launches and its ruler do. Read here; Live writes them.
    ...(setPath ? {
      quantize: {readout: {value: quantize ?? SET_QUANTIZE, title: quantize
        ? `Quantize — the set's launch quantize (Live's GlobalQuantisation): every clip set to Global lands on ${quantize === 'none' ? 'no grid' : `its ${quantize}`}. Read from the set; Live writes it.`
        : `Quantize — the set's launch quantize: the set keeps none Live names, so a clip set to Global lands on the bar, Live's own. Live writes it.`}},
      signature: {readout: {value: `${(signature ?? DEFAULT_SIGNATURE).numerator} / ${(signature ?? DEFAULT_SIGNATURE).denominator}`, title: signature
        ? `Signature — the set's time signature: a bar is ${signature.numerator} beats of a 1/${signature.denominator} note, on the ruler and the launch grid. Read from the set; Live writes it.`
        : 'Signature — the set keeps no time signature its owner reads, so a bar is four beats (Live\'s 4/4), on the ruler and the launch grid.'}},
    } : {}),
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
