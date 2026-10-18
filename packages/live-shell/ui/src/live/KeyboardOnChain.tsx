// The part's input (DLW §21.1 "The input": "Pointer, touch, the computer keys and MIDI all play the part through the same path"; lock
// §0.3.6 "The keyboard is the part's input, not a chain device … as Live's MIDI From; the key column of the Notes editor; … the playing
// surface in the Torus's Full and Pop-out"). R4 takes the keyboard off Live's chain (`live:keyboard`, the plate this module drew), and
// keeps the one thing that plate alone did: it was the one surface that heard MIDI (live/janko/JankoDevice.tsx `midi`, "One keyboard hears
// the hardware: the chain's plate"). PartInput is that hearing without a plate: while the instrument stands, a hardware controller's notes
// reach the torus through the one input path (jankoInput.ts createJankoInput, folded through the note devices under the mode in force,
// one janko stage command per chord) — ported unchanged from JankoDevice.tsx:47-63 (the mode, the note chain, the transform) and :66-91
// (the input, the MIDI subscription). The playing surface itself stands under the Torus in its Full (live/TorusOnChain.tsx TorusFull),
// deaf to MIDI as before; its layout stays the shell's (keyboardLayout.ts). The MIDI state and a refusal stand as one line on the chain,
// in the chain's waiting idiom.
import {useEffect, useMemo, useRef, useState} from 'react'
import {commitLiveStage} from './torusInstrument'
import {liveMidiInitial, liveMidiLine, midiNoteEvent, subscribeLiveMidi, type LiveMidiState} from '../native/liveMidi'
import {useLiveModeInForce} from '../native/liveModeCatalogue'
import {runNoteChain} from './noteDevices/noteDevices'
import {useNoteDeviceChain} from './noteDevices/noteDeviceHold'
import {createJankoInput, type JankoInput} from './janko/jankoInput'

/** The part's MIDI input, heard once while the instrument stands: every note through the one input path, the note devices first. */
export function PartInput() {
  const {mode} = useLiveModeInForce()
  const chain = useNoteDeviceChain()
  const transform = useRef((pitchClasses: readonly number[]) => runNoteChain(chain, pitchClasses, {mode}))
  transform.current = (pitchClasses: readonly number[]) => runNoteChain(chain, pitchClasses, {mode})
  const [midi, setMidi] = useState<LiveMidiState>(() => liveMidiInitial())
  const [refusal, setRefusal] = useState<string | null>(null)
  const input: JankoInput = useMemo(() => createJankoInput({
    send: command => commitLiveStage(command),
    onResult: result => setRefusal(result.ok ? null : result.error),
    transform: classes => transform.current(classes),
  }), [])
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
  return <p className="live-chain-waits" role="status" data-part-input={midi.kind} data-i={`Input|The part's input: MIDI plays the torus through the note devices. The pointer and the computer keys play from the surface under the Torus in its Full.`}>
    {liveMidiLine(midi)}{refusal !== null ? ` · Not sounded: ${refusal}` : ''}
  </p>
}
