// Where a setting of the Expressions app's own Studio opens now (manual §20.1 "Where everything is"): a field device's in the Studio's
// pane, which holds every device of the field; a scene's or a symbol's in Clip view, the scene's panels, tools and editor tabs. Nothing
// opens the app's own Studio inside the field pane (the frame's workspace.css stands it down there). Every "Open in studio" — the
// pool's, the glyph editor's — reaches this one door through panels/expressions.tsx.
import type {StudioSection} from '@epilogos/expressions-boundary'
import {DEVICE_PANE_KIND} from '../../../frame/devices/deviceDoor'
import {openInstrument} from '../../../frame/instrumentDoor'
import {showClipView} from '../../../frame/menu/objectDoor'
import {STUDIO_DEVICE_ID} from './studioBinding'

/** The sections that belong to a scene or to a symbol in it: Clip view's. Every other section is a field device's, in the Studio. */
const CLIP_SECTIONS: ReadonlySet<StudioSection> = new Set<StudioSection>(['formations', 'sequence', 'automation', 'layout', 'text', 'blueprint', 'scene'])

/** Where a section lives now. Pure. */
export const studioHomeOf = (section: StudioSection): 'clip' | 'studio' => (CLIP_SECTIONS.has(section) ? 'clip' : 'studio')

/** Open a section where it lives: the words of a refusal, or null. */
export function openStudioHome(section: StudioSection): string | null {
  if (studioHomeOf(section) === 'clip') return showClipView() ? null : 'No Clip view stands in this window to hold the scene\'s settings.'
  try {
    openInstrument(DEVICE_PANE_KIND, undefined, {ref: STUDIO_DEVICE_ID, title: 'Studio'})
    return null
  } catch (cause) {
    return cause instanceof Error ? cause.message : String(cause)
  }
}
