// The small glyph by a Central document's save state (DLW §17.4: "A small glyph shows saved, saving or held"; §17.8 Autosave), drawn as
// the Canvas draws its own (expressions-app research-save-glyph): a dot for saved, a ring for saving, the accent for held. What it means
// is said in words on it (useAutosave.ts, autosave.ts autosaveGlyph). Presentation only.
import type {AutosaveGlyph as Glyph} from './autosave'

const NAMES = {saved: 'Saved', saving: 'Saving', held: 'Held, not saved'} as const

export function AutosaveGlyph({glyph}: {glyph: Glyph}) {
  return <span className="document-autosave-glyph" role="img" data-save-state={glyph.state} aria-label={glyph.words} title={glyph.words}
    data-i={`${NAMES[glyph.state]}|${glyph.words}`} />
}
