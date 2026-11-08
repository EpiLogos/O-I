// Live's transport bindings (moved from shell/modeTransports.tsx, which registers them; O-I #740: loaded when Live's transport first
// draws). The mode in force (root, scale) and its key and MIDI maps; Play and Stop over the clip THE selection names, else the open set in
// the one engine (live/liveEngine.ts); Record over the part THE selection chooses, with the Torus kept with the set (live/liveTake.ts).
import type {UseModeTransport} from '../modeTransports'
import {PITCH_CLASS_NAMES} from '../../live/modes'
import {holdOnRoot, setLiveModeHold, useLiveModeInForce} from '../../native/liveModeCatalogue'
import {MidiMapHost, MidiMapToggles} from '../../live/midiMap/midiMapControls'
import {useState} from 'react'
import {clipAddressOf, SET_QUANTIZE, SET_QUANTIZE_WORDS, useLiveClipPlay, useLiveOverdub} from '../../live/clipPlayer'
import {writeLiveSetAct} from '../../live/liveWrites'
import {refusalWords} from '../../../../../../desktop/cradle/src/shared/Refusal.tsx'
import {DEFAULT_SIGNATURE} from '../document'
import {useLiveEngineTransport} from '../../live/liveEngine'
import {useLiveArm, useLiveRecord} from '../../live/liveTake'
import {useLiveTorusReading} from '../../live/torusInstrument'
import {setSelectionOf} from '../liveSelection'
import {useOptionalContinuity} from '../../continuity/workspace'

const quantizeTitle = (quantize: string | null) => quantize
  ? `Quantize — the set's launch quantize (Live's GlobalQuantisation): every clip set to Global lands on ${quantize === 'none' ? 'no grid' : `its ${quantize}`}. Choose another to write it in the set.`
  : 'Quantize — the set\'s launch quantize: the set keeps none Live names, so a clip set to Global lands on the bar, Live\'s own, and there is none here to write.'

/** What the transport says when the set's owner refuses its Quantize: the place's words, the owner's plain words after them
 * (shared/Refusal.tsx refusalWords; the line is one line in a live region, so it holds no disclosure). */
export const QUANTIZE_NOT_WRITTEN = 'The set\'s Quantize was not written.'

/** The set's Quantize written as `word` through its owner's act (live_set_act `global_quantize`): written, or the owner's answer as it
 * came, for the line to say. */
export async function writeSetQuantize(path: string, word: string, write: typeof writeLiveSetAct = writeLiveSetAct): Promise<{readonly written: true} | {readonly cause: unknown}> {
  try { await write(path, {kind: 'global_quantize', quantize: word}); return {written: true} }
  catch (cause) { return {cause} }
}

/** The transport's Quantize (O-I #849 round 22; DLW build ruling 2026-11-05: "Quantize is written, not only shown: the transport sets the
 * set's global quantization through live-set's own act"): the set's GlobalQuantisation, chosen among Live's words for it and written by the
 * set's owner (live_set_act `global_quantize`, live-set acts.rs), the set then read again shows what it keeps. While the write is on its
 * way the choice stands as asked; a refusal stands beside it in its words, the set's own value shown. A set that keeps none to write
 * shows Live's bar, disabled. */
export function LiveQuantize({path, quantize}: {path: string; quantize: string | null}) {
  const [writing, setWriting] = useState<{word: string} | {cause: unknown} | null>(null)
  const asked = writing && 'word' in writing ? writing.word : null
  const write = (word: string) => {
    setWriting({word})
    void writeSetQuantize(path, word).then(answer => setWriting('cause' in answer ? {cause: answer.cause} : null))
  }
  return <>
    <select aria-label="Quantize" title={quantizeTitle(quantize)} disabled={!quantize || asked !== null} value={asked ?? quantize ?? SET_QUANTIZE}
      onChange={event => write(event.target.value)}>
      {SET_QUANTIZE_WORDS.map(word => <option key={word} value={word}>{word}</option>)}
    </select>
    {writing && 'cause' in writing
      ? <output className="transport-mode-line" role="status" aria-label="Quantize refused" title={refusalWords(QUANTIZE_NOT_WRITTEN, writing.cause)}>{refusalWords(QUANTIZE_NOT_WRITTEN, writing.cause)}</output>
      : null}
  </>
}

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
  // With a clip playing on the part, armed, Record overdubs into it (G13; Live's Session Record).
  const track = setSelectionOf(selection, setPath ?? undefined)?.track ?? null
  const record = useLiveRecord({setPath, track, bpm: tempoBpm, torus, mode: ready ? {root: hold.root, scale: hold.key} : null,
    overdub: useLiveOverdub(setPath, track)})
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
    // signature_of); a set that keeps none Live names stands at Live's own, as its launches and its ruler do. The Quantize is written here
    // (round 22, LiveQuantize); the signature is read, and Live writes it.
    ...(setPath ? {
      quantize: {control: <LiveQuantize path={setPath} quantize={quantize} />, title: quantizeTitle(quantize)},
      signature: {readout: {value: `${(signature ?? DEFAULT_SIGNATURE).numerator} / ${(signature ?? DEFAULT_SIGNATURE).denominator}`, title: signature
        ? `Signature — the set's time signature: a bar is ${signature.numerator} beats of a 1/${signature.denominator} note, on the ruler and the launch grid. Read from the set; Live writes it.`
        : 'Signature — the set keeps no time signature its owner reads, so a bar is four beats (Live\'s 4/4), on the ruler and the launch grid.'}},
    } : {}),
    root: {control: <select aria-label="Root note" title={`Root — the mode in force's root. ${line}`} disabled={!ready}
      value={ready ? String(hold.root) : ''} onChange={event => setLiveModeHold(holdOnRoot(reading, hold, Number(event.target.value)))}>
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
