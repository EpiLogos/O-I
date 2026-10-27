// The designed clips: Clip view for each mode (ProjectCentral/docs/1-vision/dlw/DLW.md §16.5, and each mode's "tracks and clips" section). Each is its own
// module, loaded when the gallery asks for it, so one clip that does not build never stops another from drawing.
import type {ClipMode, DesignedClip} from './design'

export const CLIP_MODES: readonly ClipMode[] = ['techne', 'central', 'factory', 'expressions', 'live']

const MODULES: Readonly<Record<ClipMode, () => Promise<{clip: DesignedClip}>>> = {
  techne: () => import('./techne'),
  central: () => import('./central'),
  factory: () => import('./factory'),
  expressions: () => import('./expressions'),
  live: () => import('./live'),
}

export const isClipMode = (mode: string): mode is ClipMode => (CLIP_MODES as readonly string[]).includes(mode)

/** A mode's designed clip. */
export async function loadClip(mode: ClipMode): Promise<DesignedClip> {
  return (await MODULES[mode]()).clip
}
