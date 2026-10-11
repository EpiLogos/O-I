/** The Expressions Studio section ids, in the order the Studio nav shows them
 * (shell.ts renders this list). Pure: no DOM, so the app shell, the native host
 * boundary and the shell tests all import one list and cannot disagree. */
export const STUDIO_SECTIONS = [
  ['formations', 'Formations'], ['sequence', 'Glyph sequence'], ['physics', 'Physics'], ['pointer', 'Pointer'],
  ['relational', 'Relational forces'], ['collision', 'Collision & medium'], ['motion', 'Morph'], ['focus', 'Travelling focus'],
  ['appearance', 'Colour & material'], ['volume', '3D body & depth'], ['resonance', 'Resonance'], ['automation', 'Automation'],
  ['layout', 'Arrangement'], ['text', 'Page text'], ['native', 'Live instrument'], ['blueprint', 'Blueprint'],
  ['canvas', 'Canvas views'], ['places', 'Places'], ['palace', 'Palace'], ['scene', 'Scene settings'],
] as const
export type StudioSection = (typeof STUDIO_SECTIONS)[number][0]

const SECTION_IDS: ReadonlySet<string> = new Set(STUDIO_SECTIONS.map(([id]) => id))
export const isStudioSection = (value: unknown): value is StudioSection => typeof value === 'string' && SECTION_IDS.has(value)

/** Where a Studio section lives in the Inspector. Mirrors the state the nav's
 * `studio-section` handler sets (app.ts) so a host-requested section lands on
 * the same tab and motion tab the nav button would. */
export function studioPlacement(section: StudioSection): {tab: 'objects' | 'motion' | 'scene' | 'field'; motionTab: 'sequence' | 'morph' | 'focus' | 'automation'} {
  return {
    tab: ['formations', 'layout'].includes(section) ? 'objects'
      : ['sequence', 'motion', 'focus', 'automation'].includes(section) ? 'motion'
      : ['scene', 'text'].includes(section) ? 'scene' : 'field',
    motionTab: section === 'automation' ? 'automation' : section === 'motion' ? 'morph' : section === 'focus' ? 'focus' : 'sequence',
  }
}
