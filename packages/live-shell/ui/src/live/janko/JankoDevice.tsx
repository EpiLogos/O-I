// The Jankó instrument device (T-LIVE-JANKO-DEVICE): the Live keyboard row beside the torus. Two layouts, one input path. The Jankó surface is the
// owner's window (jankoLayout.ts); the piano is the admitted alternative. Every key plays through the part's one playing path
// (keyboardLayout.ts livePlayingPath, jankoInput.ts): the key pressed, with its row and column, strikes the Torus and its release lets it
// go (O-I #853); the owner answers, and a refusal is named here. The computer keyboard plays only while the keyboard holds focus, never
// from editable text, and never with a modifier held; when the keyboard or the window loses focus, the notes it holds are released.
// MIDI from the native host joins the same path (liveMidi.ts): a hardware controller plays whether or not the keyboard holds focus, and
// only while this device is mounted.

import {useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react'
import {useLiveTorusReading} from '../torusInstrument'
import {
  JANKO_PLACEMENT_NOTE, pianoKeys, useLiveJankoWindow, type JankoKey, type JankoWindowState,
} from './jankoLayout'
import {followLiveJankoWindow, jankoLensOf} from '../../native/liveJankoWindow'
import {liveMidiInitial, liveMidiLine, lostMidiPorts, midiNoteEvent, subscribeLiveMidi, type LiveMidiState} from '../../native/liveMidi'
import {useLiveModeInForce} from '../../native/liveModeCatalogue'
import {pitchMask} from '../modes'
import {runNoteChain} from '../noteDevices/noteDevices'
import {useNoteDeviceChain} from '../noteDevices/noteDeviceHold'
import {computerKeyNote, lostDevicePress, pointerNote, pointerSource as sourceOf, surfaceOctaves, surfacePress, typingTarget} from './jankoInput'
import {livePlayingPath, setLivePlayingTransform, useKeyboardSettings, useLivePlaying} from '../keyboardLayout'
import './janko.css'

export type JankoLayout = 'janko' | 'piano'

/** With no note device the act sounds as it was struck. */
const NO_NOTE_DEVICES = (pitchClasses: readonly number[]): readonly number[] => pitchClasses

/** On the chain the keyboard is a plate of the device runtime (live/KeyboardOnChain.tsx): the plate holds its layout and its
 * name, so the surface stands bare in the plate's picture, and the hint and placement note move to the surface's own hover. */
export interface JankoPlateProps {
  /** The layout the plate holds; absent, the keyboard holds its own. */
  layout?: JankoLayout
  /** Drawn as a plate's picture: no head, no hint lines. */
  plate?: boolean
  /** Whether this surface hears MIDI (default: it does). One keyboard hears the hardware: the chain's plate. A second surface of the
   * same keyboard — its picture in the pool, a pane, the rail, the torus's Full — plays from the pointer and the computer keys only, so
   * a MIDI note is struck once, never once for each surface drawn. */
  midi?: boolean
}

export function JankoDevice({layout, plate, midi = true}: JankoPlateProps = {}) {
  const windowState = useLiveJankoWindow()
  // The surface follows the instrument's acting lens (the owner's lens12 is ql's --lens index); read again only when it changes.
  const torus = useLiveTorusReading()
  const lens = jankoLensOf(torus)
  useEffect(() => { void followLiveJankoWindow(lens) }, [lens])
  // The surface recolours to the set's mode in force: the owner's pitch set only. A source scale serves no pitch set, so nothing is marked.
  const {mode} = useLiveModeInForce()
  const mask = mode.state === 'in-force' ? pitchMask(mode.selection.scale) : null
  // The note devices before the torus (T-LIVE-MODE-SCALES item 3): every act folds through the chain, under the mode in force, before its stage command.
  const chain = useNoteDeviceChain()
  const noteTransform = (pitchClasses: readonly number[]) => runNoteChain(chain, pitchClasses, {mode})
  return <JankoDeviceView windowState={windowState} modeMask={mask} modeLine={mode.state === 'in-force' ? mode.line : null} noteTransform={noteTransform} layout={layout} plate={plate} midi={midi}/>
}

const KEYBOARD_HINT = 'Focus the keyboard to play it from the computer keyboard (A–J row). Typing in a text field never plays a note.'

export function JankoDeviceView({windowState, initialLayout = 'janko', modeMask = null, modeLine = null, initialMidi = null, noteTransform = NO_NOTE_DEVICES, layout: plateLayout, plate = false, midi: hears = true}: {windowState: JankoWindowState | null; initialLayout?: JankoLayout; modeMask?: readonly boolean[] | null; modeLine?: string | null; initialMidi?: LiveMidiState | null; noteTransform?: (pitchClasses: readonly number[]) => readonly number[]} & JankoPlateProps) {
  const [own, setLayout] = useState<JankoLayout>(initialLayout)
  const layout = plateLayout ?? own
  const [armed, setArmed] = useState(false)
  const {held, refusal} = useLivePlaying()
  // Range (DLW §21.1 The input; DLW build ruling 2026-11-08, LT06): the surface draws that many octaves of the owner's window about
  // middle C, each key carrying its own note, so it strikes its key of that octave by the one law (keyForNote).
  const octaves = surfaceOctaves(useKeyboardSettings().range)
  const [midi, setMidi] = useState<LiveMidiState>(() => initialMidi ?? liveMidiInitial())
  // The part's one path; it reads the chain as it stands at each act.
  const input = livePlayingPath()
  const transformRef = useRef(noteTransform)
  transformRef.current = noteTransform
  // The chain under the mode in force, as this surface last drew it: every surface and the part's input draw the same one.
  useEffect(() => { setLivePlayingTransform(classes => transformRef.current(classes)) })
  // The window losing focus (another application, a dialog) releases what the surface holds, as the keyboard losing focus does.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const lost = () => input.releaseWhere(surfacePress)
    window.addEventListener('blur', lost)
    return () => window.removeEventListener('blur', lost)
  }, [input])
  // MIDI joins the one input path. A hardware controller is explicit input, so it plays whether or not the keyboard holds focus; it is heard
  // only while this device is mounted, and the unsubscribe on unmount releases the host's listeners. A surface that does not hear MIDI
  // (a second drawing of the keyboard) subscribes to nothing.
  useEffect(() => {
    if (!hears) return undefined
    let heard: LiveMidiState = {kind: 'reading'}
    return subscribeLiveMidi({
    onState: state => {
      // A device lost releases the notes it held.
      const lost = lostMidiPorts(heard, state)
      heard = state
      if (lost.length) input.releaseWhere(lostDevicePress(lost))
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
  }, [input, hears])
  // Each source's note is its own adapter's (jankoInput.ts pointerNote, computerKeyNote; liveMidi.ts midiNoteEvent), so every way of
  // playing reaches the one path alike (O-I #853 round 23). A pointer's press carries its own identity (its pointer id), so two
  // touch-points of one class let go independently; a Jankó key goes with its note, so the note sounds at that key's own touch-point, and
  // where the press landed on the key is its strength under Pointer height.
  const heightOn = (event: PointerEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return box.height > 0 ? Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) : null
  }
  const pointerOf = (event: PointerEvent<HTMLButtonElement>, height: number | null = null) =>
    ({pointerType: event.pointerType, pointerId: event.pointerId, pressure: event.pressure, height})
  const press = (pitchClass: number, event: PointerEvent<HTMLButtonElement>, key?: JankoKey, note?: number) =>
    input.down(pointerNote('down', pitchClass, pointerOf(event, heightOn(event)), key, note))
  const release = (pitchClass: number, event: PointerEvent<HTMLButtonElement>) => input.up(pointerNote('up', pitchClass, pointerOf(event)))
  const pointerSource = (event: PointerEvent<HTMLButtonElement>) => sourceOf(event.pointerType)
  const pen = (event: PointerEvent<HTMLButtonElement>) => event.pointerType === 'pen' ? event.pressure : null
  const computerKeyOf = (event: KeyboardEvent<HTMLDivElement>) => ({key: event.key, repeat: event.repeat, modifier: event.ctrlKey || event.metaKey || event.altKey})

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const note = computerKeyNote('down', computerKeyOf(event), {armed, editable: typingTarget(event.target)})
    if (!note) return
    event.preventDefault()
    input.down(note)
  }
  const onKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    const note = computerKeyNote('up', computerKeyOf(event), {armed, editable: typingTarget(event.target)})
    if (note) input.up(note)
  }

  // Each key names its octave as notes are named (middle C, 60, is octave 4) and carries its note.
  const keyButton = (pitchClass: number, label: string, detail: string, octave: number, key?: JankoKey, black = false) => (
    <button key={key ? `${key.row}/${key.column}/${octave}` : `piano/${pitchClass}/${octave}`} type="button" className={`janko-key${black ? ' is-black' : ''}`}
      aria-label={`${label}, ${detail}, octave ${octave - 1}${modeMask ? (modeMask[pitchClass] ? ', in the mode' : ', outside the mode') : ''}`} aria-pressed={held.includes(pitchClass)}
      data-janko-in-mode={modeMask ? (modeMask[pitchClass] ? 'yes' : 'no') : undefined}
      data-janko-pitch-class={pitchClass} data-janko-row={key?.row} data-janko-column={key?.column} data-janko-touch-point={key?.touchPoint}
      data-janko-octave={octave - 1} data-janko-note={12 * octave + pitchClass}
      onPointerDown={event => { press(pitchClass, event, key, 12 * octave + pitchClass) }}
      onPointerMove={event => { if (event.buttons !== 0 && pen(event) !== null) input.touch('pressure', event.pressure, pointerSource(event), `pointer-${event.pointerId}`) }}
      onPointerUp={event => release(pitchClass, event)}
      onPointerLeave={event => release(pitchClass, event)}
      onPointerCancel={event => release(pitchClass, event)}
      onClick={event => {
        // A key pressed from the keyboard's own activation (Space or Enter on a focused key) strikes and lets go at once.
        if (event.detail === 0) { input.down({kind: 'down', pitchClass, source: 'pointer', pressure: null, note: 12 * octave + pitchClass, ...(key ? {key: {row: key.row, column: key.column}} : {})}); input.up({kind: 'up', pitchClass, source: 'pointer'}) }
      }}>
      {label}
    </button>
  )

  const surface = layout === 'piano'
    ? <div className="janko-piano" role="group" aria-label={`Piano keyboard: twelve pitch classes, one key each, in ${octaves.length} octaves`}
        style={{gridTemplateColumns: `repeat(${12 * octaves.length}, minmax(0, 1fr))`}}>
        {octaves.flatMap(octave => pianoKeys().map(key => keyButton(key.pitchClass, key.pitchName, `pitch class ${key.pitchClass}`, octave, undefined, key.black)))}
      </div>
    : windowState === null
      ? <p className="janko-note" data-janko-window="absent">Reading the Jankó surface from the owner (ql music janko window). The piano layout is available.</p>
      : !windowState.ok
        ? <p className="janko-note is-fault" role="alert" data-janko-window="refused">{`Refused surface: ${windowState.fault}. No key is laid out from a plausible surface.`}</p>
        : <div className="janko-surface" role="group" aria-label={`Jankó keyboard: six rows, whole-tone families alternating, repeated touch-points, in ${octaves.length} octaves`}>
            {windowState.window.rows.map((row, index) => (
              <div key={index} className="janko-row" data-janko-family={row[0]?.family ?? 0}
                style={{gridTemplateColumns: `repeat(${row.length * octaves.length}, minmax(0, 1fr))`}}>
                {octaves.flatMap(octave => row.map(key => keyButton(key.pitchClass, key.pitchName,
                  `row ${key.row + 1}, column ${key.column + 1}, touch-point ${key.touchPoint + 1}`, octave, key)))}
              </div>
            ))}
          </div>

  return (
    <section className={`janko${plate ? ' janko--plate' : ''}`} aria-label="Jankó keyboard" data-janko-layout={layout} data-janko-armed={armed ? 'yes' : 'no'} data-janko-mode={modeMask ? 'in-force' : 'none'} title={modeLine ?? undefined}>
      {!plate && <header className="janko-head">
        <span className="janko-title">Keyboard</span>
        <div className="janko-layouts" role="group" aria-label="Keyboard layout">
          <button type="button" aria-pressed={layout === 'janko'} onClick={() => setLayout('janko')}>Jankó</button>
          <button type="button" aria-pressed={layout === 'piano'} onClick={() => setLayout('piano')}>Piano</button>
        </div>
      </header>}
      <div className="janko-play" tabIndex={0} role="application" aria-label="Keyboard input: focus to play from the computer keyboard"
        title={plate ? `${KEYBOARD_HINT} ${JANKO_PLACEMENT_NOTE}` : undefined} data-janko-placement={plate ? '' : undefined}
        onFocus={() => setArmed(true)} onBlur={() => { setArmed(false); input.releaseWhere(surfacePress) }} onKeyDown={onKeyDown} onKeyUp={onKeyUp}>
        {surface}
      </div>
      {!plate && <p className="janko-hint">{KEYBOARD_HINT}</p>}
      {!plate && <p className="janko-placement" data-janko-placement>{JANKO_PLACEMENT_NOTE}</p>}
      {hears && <p className="janko-note" data-janko-midi={midi.kind}>{liveMidiLine(midi)}</p>}
      {refusal !== null && <p className="janko-note is-fault" role="alert" data-janko-refusal>{`Not sounded: ${refusal}`}</p>}
    </section>
  )
}
