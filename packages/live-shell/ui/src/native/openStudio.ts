import {isStudioSection, type StudioSection} from '@epilogos/expressions-boundary'

/** A device's "Open in studio" request to the Expressions Studio: {section}. */
export const NATIVE_OPEN_STUDIO = 'oi:native-open-studio'
/** A menu bar item the frame does not route itself (App.tsx `oi:command`): File › Export and View › Present (manual §20.1, O-I #747). The
 * mode that stands answers it by calling preventDefault on the event ({detail: {id}}); unanswered, the frame says so on the status bar. */
export const MENU_ACT = 'oi:menu-act'
/** The Expressions panel asks the shell to show its body in the centre. */
export const NATIVE_PRESENT_EXPRESSIONS = 'oi:native-present-expressions'

/** Typed parse of an open-studio request. Anything malformed is not a request. */
export function parseNativeOpenStudio(detail: unknown): StudioSection | null {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null
  const section = (detail as {section?: unknown}).section
  return isStudioSection(section) ? section : null
}
