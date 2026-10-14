// The Day die's face list — the mockup's form device "Die · Day · 4+2" (world-shell-mockup.html `formDevice`, `.dlist/.dli`):
// the six positions as a list, index · name · role, the open face lit, a press turning the die to that face. A press goes
// through the one write door the device carries (its `submit`: the owner's mutate-field on the Day document,
// centralDeviceWrites.ts), exactly as the "Open face" row does; the list is a second hand on the same control, not a second
// writer. The open face is the owner's reading (the lit entry is never the pressed one until the owner holds it). A refusal
// is shown here, in the owner's words. Shell tokens only.
import {useState} from 'react'
import {DIE_POSITIONS} from './dayDie'

export interface DieFaceListProps {
  /** The open face the owner holds (null: no Day stands, so none is lit). */
  readonly face: number | null
  /** Turn the die to a face through the device's write door; absent, the list is a reading. */
  readonly turn?: (face: number) => Promise<void>
}

export function DieFaceList({face, turn}: DieFaceListProps) {
  const [pending, setPending] = useState<number | null>(null)
  const [fault, setFault] = useState<string | null>(null)
  const press = (n: number) => {
    if (!turn || pending !== null) return
    setPending(n)
    setFault(null)
    turn(n).catch((error: unknown) => setFault(error instanceof Error ? error.message : String(error))).finally(() => setPending(null))
  }
  return <div className="central-die-faces" data-die-faces role="group" aria-label="Day die faces">
    {DIE_POSITIONS.map(position => {
      const open = position.n === face
      return <button key={position.n} type="button" className={`central-die-face${open ? ' on' : ''}`} data-face={position.n} data-open={open ? 'true' : undefined}
        aria-pressed={face === null ? undefined : open} disabled={!turn || face === null || pending !== null}
        title={face === null ? 'No Day stands, so the die has no open face to turn' : open ? `#${position.n} ${position.name} is the open face` : `Turn the die to #${position.n} ${position.name}`}
        onClick={() => press(position.n)}>
        <span className="d">{position.n}</span><span className="n">{position.name}</span><span className="d">{position.role}</span>
      </button>
    })}
    {fault && <p className="inhabitant-device-fault" role="alert" data-die-fault>{fault}</p>}
  </div>
}
