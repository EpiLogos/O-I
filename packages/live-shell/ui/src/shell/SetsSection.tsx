// Sets (manual §10.2): "To keep an arrangement, save it as a set and give it a name. To return to it, select it from
// the browser." The book holds them (NamedSet: the mode's own tree with its frame); this section saves the arrangement
// in front of you and lists every set, newest first. Selecting a set stands in its mode and takes its arrangement.
import {useState} from 'react'
import {useOptionalContinuity} from '../continuity/workspace'
import {MODE_CURATION} from '../../../../../desktop/cradle/src/workspace/mode'

export function SetsSection() {
  const continuity = useOptionalContinuity()
  const [naming, setNaming] = useState<string | null>(null)
  // Sets live in the book; with no book mounted (a detached view, a render test) there is nothing to list or keep.
  if (!continuity) return null
  const sets = continuity.current.sets ?? []
  const save = () => { if (naming?.trim()) continuity.saveSet(naming); setNaming(null) }
  return <section className="browser-sets" aria-label="Sets" data-browser-category="sets">
    <header className="browser-sets-head">
      <span>Sets</span>
      {naming === null
        ? <button type="button" data-action="save-set" title="Keep this arrangement of panes, detail and browser under a name" onClick={() => setNaming('')}>Save set…</button>
        : <form onSubmit={event => { event.preventDefault(); save() }}>
            <input autoFocus aria-label="Set name" value={naming} placeholder="Name this set" onChange={event => setNaming(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setNaming(null) }} />
          </form>}
    </header>
    {sets.length === 0
      ? <p className="browser-sets-empty">No sets yet. Save the arrangement in front of you to come back to it.</p>
      : <ul>
          {sets.map(set => <li key={set.id} data-set-row={set.id}>
            <button type="button" title={`Return to ${set.name} (${MODE_CURATION[set.mode].label}), saved ${new Date(set.savedAt).toLocaleString()}`} onClick={() => continuity.applySet(set.id)}>
              <b>{set.name}</b><span>{MODE_CURATION[set.mode].label}</span>
            </button>
          </li>)}
        </ul>}
  </section>
}
