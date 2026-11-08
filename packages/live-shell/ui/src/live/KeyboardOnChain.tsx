// The part's input (DLW §21.1 "The input": "Pointer, touch, the computer keys and MIDI all play the part through the same path"; lock
// §0.3.6 "The keyboard is the part's input, not a chain device … as Live's MIDI From; the key column of the Notes editor; … the playing
// surface in the Torus's Full and Pop-out"). R4 takes the keyboard off Live's chain (`live:keyboard`, the plate this module drew), and
// keeps the one thing that plate alone did: it was the one surface that heard MIDI (live/janko/JankoDevice.tsx `midi`, "One keyboard hears
// the hardware: the chain's plate"). PartInput is that hearing without a plate: while the instrument stands, a hardware controller's notes
// reach the torus through the part's one playing path (keyboardLayout.ts livePlayingPath: keys struck and released on the Torus's
// session, O-I 853), folded through the note devices under the mode in force; its pitch bends and channel pressures touch the notes
// it holds on the same path (jankoInput.ts touch, round 18: a rise strikes them again by the rise), and go to the part's instrument in
// the engine as before (liveEngine.ts touchInEngine, round 16). It also holds the part's input settings (Layout, Input,
// Transpose, Velocity, Pressure, Sustain, Repeat touch), Panic, the sustain pedal and MIDI out. The playing surface itself stands under
// the Torus in its Full (live/TorusOnChain.tsx TorusFull), deaf to MIDI as before; its layout stays the shell's (keyboardLayout.ts). The
// MIDI state and a refusal stand as one line on the chain, in the chain's waiting idiom.
import {useEffect, useRef, useState} from 'react'
import {
  chooseLiveMidiOut, liveMidiInitial, liveMidiLine, liveMidiOutLine, lostMidiPorts, midiExpressionAmount, midiNoteEvent, readLiveMidiOut,
  subscribeLiveMidi, subscribeLiveMidiControls, subscribeLiveMidiExpression, useLiveMidiOut, type LiveMidiState,
} from '../native/liveMidi'
import {refusalWords} from '../../../../../desktop/cradle/src/shared/Refusal'
import {touchInEngine, type LiveEngineTouch} from './liveEngine'
import {nativeHost} from '../native/application'
import {useLiveModeInForce} from '../native/liveModeCatalogue'
import {runNoteChain} from './noteDevices/noteDevices'
import {useNoteDeviceChain} from './noteDevices/noteDeviceHold'
import {KEYBOARD_RANGE, KEYBOARD_TRANSPOSE, keyToSound, keyToSoundByInput, keyToSoundByInputLine, keyToSoundLine, type KeyboardRepeatTouch, type KeyboardVelocity} from './janko/jankoInput'
import {
  engineLatency, livePlayingPath, panicLivePlaying, setKeyboardLayout, setKeyboardSettings, setLivePlayingTransform, useKeyboardLayout,
  useKeyboardSettings, useLivePlaying,
} from './keyboardLayout'
import './janko/janko.css'

/** The sustain pedal: MIDI controller 64, down from 64. */
const SUSTAIN_PEDAL = 64
/** What Pressure does, in the manual's words (DLW §21.1 The input). */
const PRESSURE_DOES = 'Lets pressure on a held key move the sound. Pressure records into the clip\'s MPE tab.'

const VELOCITY: readonly {readonly value: KeyboardVelocity; readonly label: string}[] = [
  {value: 'pointer-height', label: 'Pointer height'}, {value: 'pressure', label: 'Pressure'}, {value: 'fixed', label: 'Fixed'},
]
const REPEAT: readonly {readonly value: KeyboardRepeatTouch; readonly label: string}[] = [
  {value: 'one-note', label: 'One note'}, {value: 'each-key', label: 'Each key'},
]

/** The part's input: its MIDI heard once while the instrument stands, every note through the one playing path, the note devices first;
 * and the settings the manual gives the input, each a control of the path. */
export function PartInput() {
  const {mode} = useLiveModeInForce()
  const chain = useNoteDeviceChain()
  const transform = useRef((pitchClasses: readonly number[]) => runNoteChain(chain, pitchClasses, {mode}))
  transform.current = (pitchClasses: readonly number[]) => runNoteChain(chain, pitchClasses, {mode})
  const [midi, setMidi] = useState<LiveMidiState>(() => liveMidiInitial())
  const {refusal} = useLivePlaying()
  const settings = useKeyboardSettings()
  const layout = useKeyboardLayout()
  const out = useLiveMidiOut()
  const input = livePlayingPath()
  // what the part's last pitch bend and channel pressure did not move, each in plain words (null: it moved the part's instrument)
  const [unmoved, setUnmoved] = useState<Record<LiveEngineTouch, string | null>>({bend: null, pressure: null})
  const midiOn = useRef(settings.inputs.midi)
  midiOn.current = settings.inputs.midi
  useEffect(() => { setLivePlayingTransform(classes => transform.current(classes)) })
  useEffect(() => {
    let heard: LiveMidiState = {kind: 'reading'}
    return subscribeLiveMidi({
      onState: state => {
        // Losing a device releases every note it held.
        const lost = lostMidiPorts(heard, state)
        heard = state
        if (lost.length) input.releaseWhere(press => press.source === 'midi' && lost.includes(press.port ?? ''))
        setMidi(state)
      },
      onNotes: notes => {
        for (const note of notes) {
          const event = midiNoteEvent(note)
          if (event.kind === 'down') input.down(event)
          else input.up(event)
        }
      },
    })
  }, [input])
  // The sustain pedal holds the part's notes as Sustain does; every other control is the MIDI map's.
  useEffect(() => subscribeLiveMidiControls({
    onControls: controls => { for (const control of controls) if (control.controller === SUSTAIN_PEDAL) input.pedal(control.value >= 64) },
  }), [input])
  // Pitch bend and channel pressure touch the notes MIDI holds, each as it came (a rise strikes them again by the rise, so none is
  // passed over), and reach the part's instrument in the engine, the latest of each kind in a batch (the engine passes over the ones
  // between, as the wheel outruns it); MIDI switched off moves nothing.
  useEffect(() => subscribeLiveMidiExpression({
    onExpressions: expressions => {
      if (!midiOn.current) return
      for (const expression of expressions) input.touch(expression.kind, midiExpressionAmount(expression), 'midi')
      for (const kind of ['bend', 'pressure'] as const) {
        let last = null
        for (const expression of expressions) if (expression.kind === kind) last = expression
        if (last) void touchInEngine(kind, midiExpressionAmount(last)).then(said =>
          setUnmoved(was => ({...was, [kind]: said === null ? null : refusalWords('Not moved:', said)})))
      }
    },
  }), [input])
  useEffect(() => { if (nativeHost()) void readLiveMidiOut() }, [])
  const choice = <T extends string>(setting: string, options: readonly {readonly value: T; readonly label: string}[], current: T, pick: (value: T) => void) =>
    <span className="part-input-choice" role="group" data-part-setting={setting}>
      {options.map(option => <button key={option.value} type="button" aria-pressed={current === option.value} onClick={() => pick(option.value)}>{option.label}</button>)}
    </span>
  const toggle = (setting: string, label: string, on: boolean, flip: () => void) =>
    <button type="button" data-part-setting={setting} aria-pressed={on} onClick={flip}>{label}</button>
  const ports = out.kind === 'reading' ? [] : out.ports
  const port = out.kind === 'reading' ? null : out.port
  return <div className="part-input" role="group" aria-label="The part's input" data-part-input={midi.kind}
    data-i={`Input|The part's input: pointer, touch, the computer keys and MIDI play the torus through one path, the note devices first. The pointer and the computer keys play from the surface under the Torus in its Full.`}>
    <p className="live-chain-waits" role="status">
      {liveMidiLine(midi)} · {liveMidiOutLine(out)}{refusal !== null ? ` · Not sounded: ${refusal}` : ''}
      {[unmoved.bend, unmoved.pressure].filter(said => said !== null).map(said => ` · ${said}`).join('')}
    </p>
    {/* The last strike's key-to-sound, joined from the parts that exist (O-I 853, round 18). */}
    {(() => { const last = input.latency().at(-1); const joined = last ? keyToSound(last, engineLatency()) : null
      return joined ? <p className="live-chain-waits" data-part-key-to-sound="">{keyToSoundLine(joined)}</p> : null })()}
    {/* The engine's own key-to-sound, the latest strike of each input, in ms and blocks (DLW build ruling 2026-11-06). */}
    {(() => { const line = keyToSoundByInputLine(keyToSoundByInput(input.latency(), engineLatency()))
      return line !== null ? <p className="live-chain-waits" data-part-engine-key-to-sound="">{line}</p> : null })()}
    <div className="part-input-settings">
      <span className="part-input-row"><span className="part-input-label">Layout</span>
        {choice('layout', [{value: 'janko', label: 'Jankó'}, {value: 'piano', label: 'Piano'}] as const, layout, setKeyboardLayout)}</span>
      <span className="part-input-row"><span className="part-input-label">Input</span>
        {toggle('input-pointer', 'Pointer and touch', settings.inputs.pointer, () => setKeyboardSettings({inputs: {...settings.inputs, pointer: !settings.inputs.pointer}}))}
        {toggle('input-keys', 'Computer keys', settings.inputs.keys, () => setKeyboardSettings({inputs: {...settings.inputs, keys: !settings.inputs.keys}}))}
        {toggle('input-midi', 'MIDI', settings.inputs.midi, () => setKeyboardSettings({inputs: {...settings.inputs, midi: !settings.inputs.midi}}))}</span>
      <span className="part-input-row" data-part-setting="transpose"><span className="part-input-label">Transpose</span>
        <button type="button" aria-label="Transpose down a semitone" disabled={settings.transpose <= KEYBOARD_TRANSPOSE.min}
          onClick={() => setKeyboardSettings({transpose: settings.transpose - 1})}>−</button>
        <output aria-label="Transpose in semitones">{settings.transpose > 0 ? `+${settings.transpose}` : settings.transpose}</output>
        <button type="button" aria-label="Transpose up a semitone" disabled={settings.transpose >= KEYBOARD_TRANSPOSE.max}
          onClick={() => setKeyboardSettings({transpose: settings.transpose + 1})}>+</button></span>
      <span className="part-input-row" data-part-setting="range" title="The size of the playing surface: 2 to 8 octaves about middle C."><span className="part-input-label">Range</span>
        <button type="button" aria-label="Range down an octave" disabled={settings.range <= KEYBOARD_RANGE.min}
          onClick={() => setKeyboardSettings({range: settings.range - 1})}>−</button>
        <output aria-label="Range in octaves">{`${settings.range} octaves`}</output>
        <button type="button" aria-label="Range up an octave" disabled={settings.range >= KEYBOARD_RANGE.max}
          onClick={() => setKeyboardSettings({range: settings.range + 1})}>+</button></span>
      <span className="part-input-row"><span className="part-input-label">Velocity</span>
        {choice('velocity', VELOCITY, settings.velocity, velocity => setKeyboardSettings({velocity}))}</span>
      <span className="part-input-row">
        <span title={PRESSURE_DOES}>{toggle('pressure', 'Pressure', settings.pressure, () => setKeyboardSettings({pressure: !settings.pressure}))}</span>
        {toggle('sustain', 'Sustain', settings.sustain, () => setKeyboardSettings({sustain: !settings.sustain}))}</span>
      <span className="part-input-row"><span className="part-input-label">Repeat touch</span>
        {choice('repeat-touch', REPEAT, settings.repeatTouch, repeatTouch => setKeyboardSettings({repeatTouch}))}</span>
      <span className="part-input-row">
        <button type="button" data-part-setting="panic" onClick={panicLivePlaying} title="Releases every note the part holds, at once.">Panic</button>
        <select aria-label="MIDI output" data-part-setting="midi-out" value={port ?? ''} disabled={out.kind !== 'ports' && ports.length === 0}
          onChange={event => { void chooseLiveMidiOut(event.target.value === '' ? null : event.target.value) }}>
          <option value="">No MIDI output</option>
          {ports.map(name => <option key={name} value={name}>{name}</option>)}
        </select></span>
    </div>
  </div>
}
