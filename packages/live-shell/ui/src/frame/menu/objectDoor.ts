// The doors the object menu acts through (manual §10.9). A clip's own facts — its name, its colour, whether it is switched on — are
// written by its Clip view (each mode's clip binding, frame/detail/clipBinding.ts), which knows the owner, the revision read and the
// owner's refusals. The hosted clip publishes its binding here while Clip view holds it; the menu reads it to say which of those acts
// the owner takes, and writes through it. While Clip view is hidden, the frame's door brings it forward first (manual §10.1: a
// switch brings its view forward), and the act waits for the clip's binding to stand. Pure TypeScript, no React.
import type {ClipBinding} from '../detail/clipBinding'

let held: ClipBinding | null = null
const waiting = new Set<(binding: ClipBinding) => void>()

/** The hosted clip publishes its binding while Clip view holds it (null as it leaves). */
export function publishHostedClip(binding: ClipBinding | null): void {
  held = binding
  if (binding) for (const wake of [...waiting]) wake(binding)
}

/** The binding Clip view holds now, if any. */
export const hostedClip = (): ClipBinding | null => held

/** The frame's door that brings Clip view forward (App.tsx publishes it; absent in a host with no detail area). */
let bringClip: (() => void) | null = null
export function publishClipViewDoor(door: (() => void) | null): void { bringClip = door }

/** A clip's ref as its Clip view names it: the clip's own id, or that id with the owner's suffix (Factory's `#task/n`). Pure. */
export const bindsClip = (binding: Pick<ClipBinding, 'ref'>, clipId: string): boolean =>
  binding.ref === clipId || binding.ref.startsWith(`${clipId}#`) || clipId.startsWith(`${binding.ref}#`)

/** The clip's binding: the one Clip view holds when it is this clip's, else Clip view brought forward and its binding awaited (the
 * selection is the shell's, made before the act). Refuses in words when no Clip view comes to hold it. */
export function clipBinding(clipId: string, within = 1500): Promise<ClipBinding> {
  if (held && bindsClip(held, clipId)) return Promise.resolve(held)
  if (!bringClip) return Promise.reject(new Error('No Clip view stands in this window to write the clip through.'))
  bringClip()
  return new Promise((resolve, reject) => {
    const wake = (binding: ClipBinding) => {
      if (!bindsClip(binding, clipId)) return
      waiting.delete(wake); clearTimeout(timer); resolve(binding)
    }
    const timer = setTimeout(() => { waiting.delete(wake); reject(new Error('Clip view did not come to hold the clip: select it and try again.')) }, within)
    waiting.add(wake)
  })
}

/** Write one of a clip's own facts through its Clip view: the owner's receipt, or its refusal in its words. */
export async function writeClip(clipId: string, key: string, value: unknown): Promise<{ok: true; note?: string}> {
  const binding = await clipBinding(clipId)
  if (!binding.write) throw new Error('Clip view takes no change of this clip.')
  await binding.write([{key, value: value as never}])
  return {ok: true}
}
