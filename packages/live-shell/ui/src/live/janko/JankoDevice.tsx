// The Jankó instrument device (T-LIVE-JANKO-DEVICE): the Live keyboard row beside the torus. Two layouts, one input path. The Jankó surface is the
// owner's window (jankoLayout.ts); the piano is the admitted alternative. Every key sends its pitch class through the one input path
// (jankoInput.ts) as a janko stage command; the owner answers, and a refusal is named here. The computer keyboard plays only while the
// keyboard holds focus, never from editable text, and never with a modifier held. MIDI from the native host joins the same path (liveMidi.ts):
// a hardware controller plays whether or not the keyboard holds focus, and only while this device is mounted.

import {useEffect, useMemo, useState, type KeyboardEvent, type PointerEvent} from 'react'
import {commitLiveStage, useLiveTorusReading} from '../torusInstrument'
import {
  JANKO_PLACEMENT_NOTE, pianoKeys, useLiveJankoWindow, type JankoKey, type JankoWindowState,
} from './jankoLayout'
import {requestLiveJankoWindow} from '../../native/liveJankoWindow'
import {liveMidiInitial, liveMidiLine, midiNoteEvent, subscribeLiveMidi, type LiveMidiState} from '../../native/liveMidi'
import {useLiveModeInForce} from '../../native/liveModeCatalogue'
import {pitchMask} from '../modes'
import {COMPUTER_KEY_PITCH, createJankoInput, keyboardGate, type JankoInput, type NoteEvent} from './jankoInput'
import './janko.css'

export type JankoLayout = 'janko' | 'piano'

const editable = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null
  return !!element && (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName))
}

export function JankoDevice() {
  const windowState = useLiveJankoWindow()
  // The surface follows the instrument's acting lens (the owner's lens12 is ql's --lens index); read again only when it changes.
  const torus = useLiveTorusReading()
  const lens = torus?.ok ? torus.determinants?.lens.lens12 ?? null : null
  useEffect(() => { void requestLiveJankoWindow(lens) }, [lens])
  // The surface recolours to the set's mode in force: the owner's pitch set only. A source scale serves no pitch set, so nothing is marked.
  const {mode} = useLiveModeInForce()
  const mask = mode.state === 'in-force' ? pitchMask(mode.selection.scale) : null
  return <JankoDeviceView windowState={windowState} modeMask={mask} modeLine={mode.state === 'in-force' ? mode.line : null}/>
}

export function JankoDeviceView({windowState, initialLayout = 'janko', modeMask = null, modeLine = null, initialMidi = null}: {windowState: JankoWindowState | null; initialLayout?: JankoLayout; modeMask?: readonly boolean[] | null; modeLine?: string | null; initialMidi?: LiveMidiState | null}) {
  const [layout, setLayout] = useState<JankoLayout>(initialLayout)
  const [armed, setArmed] = useState(false)
  const [held, setHeld] = useState<readonly number[]>([])
  const [refusal, setRefusal] = useState<string | null>(null)
  const [midi, setMidi] = useState<LiveMidiState>(() => initialMidi ?? liveMidiInitial())
  const input: JankoInput = useMemo(() => createJankoInput({
    send: command => commitLiveStage(command),
    onResult: result => setRefusal(result.ok ? null : result.error),
    onHeld: setHeld,
  }), [])
  // MIDI joins the one input path. A hardware controller is explicit input, so it plays whether or not the keyboard holds focus; it is heard
  // only while this device is mounted, and the unsubscribe on unmount releases the host's listeners.
  useEffect(() => subscribeLiveMidi({
    onState: setMidi,
    onNotes: notes => {
      setRefusal(null)
      for (const note of notes) {
        const event = midiNoteEvent(note)
        if (event.kind === 'down') input.down(event)
        else input.up(event)
      }
    },
  }), [input])
  const press = (pitchClass: number, source: NoteEvent['source'], pressure?: number | null) => {
    setRefusal(null)
    input.down({kind: 'down', pitchClass, source, pressure})
  }
  const release = (pitchClass: number, source: NoteEvent['source']) => input.up({kind: 'up', pitchClass, source})
  const pointerSource = (event: PointerEvent<HTMLButtonElement>): NoteEvent['source'] => event.pointerType === 'touch' ? 'touch' : 'pointer'
  const pen = (event: PointerEvent<HTMLButtonElement>) => event.pointerType === 'pen' ? event.pressure : null

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const pitchClass = COMPUTER_KEY_PITCH[event.key.toLowerCase()]
    if (pitchClass === undefined) return
    if (!keyboardGate({armed, editable: editable(event.target), modifier: event.ctrlKey || event.metaKey || event.altKey, repeat: event.repeat})) return
    event.preventDefault()
    press(pitchClass, 'keyboard')
  }
  const onKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    const pitchClass = COMPUTER_KEY_PITCH[event.key.toLowerCase()]
    if (pitchClass !== undefined && armed) release(pitchClass, 'keyboard')
  }

  const keyButton = (pitchClass: number, label: string, detail: string, key?: JankoKey, black = false) => (
    <button key={key ? `${key.row}/${key.column}` : `piano/${pitchClass}`} type="button" className={`janko-key${black ? ' is-black' : ''}`}
      aria-label={`${label}, ${detail}${modeMask ? (modeMask[pitchClass] ? ', in the mode' : ', outside the mode') : ''}`} aria-pressed={held.includes(pitchClass)}
      data-janko-in-mode={modeMask ? (modeMask[pitchClass] ? 'yes' : 'no') : undefined}
      data-janko-pitch-class={pitchClass} data-janko-row={key?.row} data-janko-column={key?.column} data-janko-touch-point={key?.touchPoint}
      onPointerDown={event => { press(pitchClass, pointerSource(event), pen(event)) }}
      onPointerUp={event => release(pitchClass, pointerSource(event))}
      onPointerLeave={event => { if (held.includes(pitchClass)) release(pitchClass, pointerSource(event)) }}
      onClick={event => { if (event.detail === 0) { press(pitchClass, 'pointer'); release(pitchClass, 'pointer') } }}>
      {label}
    </button>
  )

  const surface = layout === 'piano'
    ? <div className="janko-piano" role="group" aria-label="Piano keyboard: twelve pitch classes, one key each">
        {pianoKeys().map(key => keyButton(key.pitchClass, key.pitchName, `pitch class ${key.pitchClass}`, undefined, key.black))}
      </div>
    : windowState === null
      ? <p className="janko-note" data-janko-window="absent">Reading the Jankó surface from the owner (ql music janko window). The piano layout is available.</p>
      : !windowState.ok
        ? <p className="janko-note is-fault" role="alert" data-janko-window="refused">{`Refused surface: ${windowState.fault}. No key is laid out from a plausible surface.`}</p>
        : <div className="janko-surface" role="group" aria-label="Jankó keyboard: six rows, whole-tone families alternating, repeated touch-points">
            {windowState.window.rows.map((row, index) => (
              <div key={index} className="janko-row" data-janko-family={row[0]?.family ?? 0}>
                {row.map(key => keyButton(key.pitchClass, key.pitchName,
                  `row ${key.row + 1}, column ${key.column + 1}, touch-point ${key.touchPoint + 1}`, key))}
              </div>
            ))}
          </div>

  return (
    <section className="janko" aria-label="Jankó keyboard" data-janko-layout={layout} data-janko-armed={armed ? 'yes' : 'no'} data-janko-mode={modeMask ? 'in-force' : 'none'} title={modeLine ?? undefined}>
      <header className="janko-head">
        <span className="janko-title">Keyboard</span>
        <div className="janko-layouts" role="group" aria-label="Keyboard layout">
          <button type="button" aria-pressed={layout === 'janko'} onClick={() => setLayout('janko')}>Jankó</button>
          <button type="button" aria-pressed={layout === 'piano'} onClick={() => setLayout('piano')}>Piano</button>
        </div>
      </header>
      <div className="janko-play" tabIndex={0} role="application" aria-label="Keyboard input: focus to play from the computer keyboard"
        onFocus={() => setArmed(true)} onBlur={() => setArmed(false)} onKeyDown={onKeyDown} onKeyUp={onKeyUp}>
        {surface}
      </div>
      <p className="janko-hint">Focus the keyboard to play it from the computer keyboard (A–J row). Typing in a text field never plays a note.</p>
      <p className="janko-placement" data-janko-placement>{JANKO_PLACEMENT_NOTE}</p>
      <p className="janko-note" data-janko-midi={midi.kind}>{liveMidiLine(midi)}</p>
      {refusal !== null && <p className="janko-note is-fault" role="alert" data-janko-refusal>{`Not sounded: ${refusal}`}</p>}
    </section>
  )
}
