// A note device's live picture, in its well on the chain, whole in the pool, full in a pane and small on the rail (manual §16.11: "Draw
// every mark from the device's values or readings, by the device's own law"). The twelve pitch classes stand twice: along the top as
// they are played, along the bottom as the device hands them to the torus, and a line runs from each class to the class it sounds as.
// The mode in force lights the classes it holds (the owner's pitch set, modes.ts pitchMask, read through the Scale device's plan); the
// device's own fold draws each line (noteDevices.ts foldPitchClass, under its tie rule). Bypassed, or under a mode that serves no pitch
// set, every line runs straight down: the notes pass as they were played, and the word under the lines says so. Nothing is drawn
// that the device and the owner's mode do not state; the picture moves only when they do.
import type {CSSProperties} from 'react'
import {PITCH_CLASS_NAMES, type ModeInForce} from '../modes'
import {foldPitchClass, scalePlan, type NoteDevice} from './noteDevices'
import {noteDeviceReading} from '../liveChainDevices'

const W = 132, H = 112, TOP = 26, BOTTOM = 80
const x = (pitchClass: number) => 11 + pitchClass * 10
const STYLE: CSSProperties = {width: '100%', height: '100%', display: 'block'}

/** Where each of the twelve classes sounds after the device: itself when bypassed or passing, else its fold. Pure. */
export function foldMap(device: NoteDevice, mode: ModeInForce): {readonly to: readonly number[]; readonly mask: readonly boolean[] | null} {
  const plan = scalePlan(mode)
  const mask = plan.state === 'fold' ? plan.mask : null
  const to = PITCH_CLASS_NAMES.map((_, pitchClass) => (device.enabled && mask ? foldPitchClass(pitchClass, mask, device.params.tie) : pitchClass))
  return {to, mask}
}

export function NoteFoldPicture({device, mode}: {device: NoteDevice; mode: ModeInForce}) {
  const reading = noteDeviceReading(device, mode)
  const {to, mask} = foldMap(device, mode)
  const word = reading.word.length > 26 ? `${reading.word.slice(0, 25)}…` : reading.word
  return <svg className="note-fold" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={STYLE} role="img" aria-label={reading.line}
    data-note-fold={reading.state}>
    {PITCH_CLASS_NAMES.map((name, pitchClass) => {
      const target = to[pitchClass]!, moved = target !== pitchClass, held = mask?.[pitchClass] ?? null
      return <g key={name} data-pitch-class={pitchClass} data-sounds-as={target}>
        <text x={x(pitchClass)} y={TOP - 8} textAnchor="middle" className="note-fold-name">{name}</text>
        <circle cx={x(pitchClass)} cy={TOP} r={2.4} className="note-fold-played" />
        <path d={`M${x(pitchClass)} ${TOP + 3}L${x(target)} ${BOTTOM - 3}`} className={moved ? 'note-fold-line note-fold-line--moved' : 'note-fold-line'} />
        <circle cx={x(pitchClass)} cy={BOTTOM} r={3} className={held === null ? 'note-fold-sound' : held ? 'note-fold-sound note-fold-sound--held' : 'note-fold-sound note-fold-sound--out'} />
      </g>
    })}
    <text x={W / 2} y={H - 8} textAnchor="middle" className="note-fold-word">{word}</text>
  </svg>
}
