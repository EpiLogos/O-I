import {Refusal} from '../../../../../desktop/cradle/src/shared/Refusal.tsx'
import {useState} from 'react'
import type {NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {objectAddChange, presetAddChange, presetRows, type ObjectRow, type PresetRow} from './nativeBrowserModel'
import {runStarter, starterRows, starterSteps, type StarterRequest, type StarterRow} from './nativeStarters'
import {FORMATION_SCENE_LIMIT as limit} from '../../../../expressions-boundary/src/nativeFormations'
import {useHostedChrome} from '../projections/expressionsPaneHost'
import {stagePlace} from '../native/stageCommands'
import './NativeObjectBrowser.css'

/** The Browser's Objects category: creatable formations and force pins in the open Scene. Each add is one native
 * apply, committed once. Add by '+ Add to Scene', Enter or double-click. Drag onto the stage is not wired. */
export function NativeObjectBrowser({rows, reading, request, query = ''}: {rows: readonly ObjectRow[]; reading: NativeEditorReading | null;
  request: StarterRequest; query?: string}) {
  const [text, setText] = useState('O'), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [selected, setSelected] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const blocked = !reading || reading.standing.pending
  const count = reading?.scene.entities.length ?? 0
  const add = async (row: ObjectRow) => {
    if (busy || blocked || row.full) return
    setBusy(true); setError(null)
    try {
      const reply = await request([objectAddChange(row.kind, text)])
      if (!reply.ok) setError(reply.error)
    } catch (cause) {setError(cause instanceof Error ? cause.message : String(cause))}
    finally {setBusy(false)}
  }
  // A starter is one or two applies on the selected formation. The second step uses the reply's own reading and basis.
  const starter = async (row: StarterRow) => {
    if (busy || blocked || row.reason || !reading) return
    setBusy(true); setError(null); setProgress(null)
    try {
      const result = await runStarter(starterSteps(row.id, reading.selection?.entity_ids?.[0]), reading, request, setProgress)
      if (!result.ok) setError(result.error)
      else setProgress(`${row.name}: placed`)
    } catch (cause) {setError(cause instanceof Error ? cause.message : String(cause))}
    finally {setBusy(false)}
  }
  // A built-in preset's objects, one native edit (O-I #747 round 894, the app's add-built-in and chakra-add): the owner's formation-preset.
  const addPreset = async (row: PresetRow) => {
    if (busy || blocked) return
    setBusy(true); setError(null); setProgress(null)
    try {
      const reply = await request([presetAddChange(row.preset)])
      if (!reply.ok) setError(reply.error)
      else setProgress(`${row.name}: its objects are in the Scene`)
    } catch (cause) {setError(cause instanceof Error ? cause.message : String(cause))}
    finally {setBusy(false)}
  }
  // Click-to-place (O-I #747 round 894; manual §20.1 Form, "Draws a form in the field"): the field holds a placement of this shape, and the next
  // click in the field places it there, one edit of the field's own.
  const field = useHostedChrome()?.run ?? null
  const place = async (row: ObjectRow) => {
    if (busy || blocked || row.full || row.kind === 'force' || !field) return
    setBusy(true); setError(null); setProgress(null)
    try {
      const result = await field(stagePlace(row.kind, row.kind === 'text' ? text.trim() || 'O' : undefined))
      if (!result.ok) setError(result.error)
      else setProgress(`${row.name}: click in the field to place it`)
    } catch (cause) {setError(cause instanceof Error ? cause.message : String(cause))}
    finally {setBusy(false)}
  }
  const starters = starterRows(reading), presets = presetRows(reading, query)
  return <section className="native-object-browser" aria-label="Native objects">
    <label className="native-object-text">Glyph or word <input value={text} maxLength={120} disabled={busy} placeholder="O" onChange={event => setText(event.target.value)}/></label>
    {!rows.length && <p className="native-empty">No object matches this search.</p>}
    <ul className="native-object-rows">{rows.map(row => <li key={row.kind} className="native-object-row-item">
      <button type="button" data-browser-row className={`native-object-row${selected === row.kind ? ' selected' : ''}`} aria-pressed={selected === row.kind}
        title={`${row.name} · ${row.summary}. Enter or double-click adds it to the Scene.`}
        onClick={() => setSelected(row.kind)}
        onDoubleClick={() => void add(row)}
        onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); void add(row)}}}>
        <span className="native-object-row-name">{row.name}</span>
        <span className="native-object-row-summary">{row.summary}</span>
      </button>
      <button type="button" className="native-object-add" disabled={busy || blocked || row.full} aria-label={`Add ${row.name} to Scene`}
        title={row.full ? `A scene holds up to ${limit} formations and pins` : `Add ${row.name} to the Scene`} onClick={() => void add(row)}>+ Add to Scene</button>
      {row.kind !== 'force' && <button type="button" className="native-object-add native-object-place" disabled={busy || blocked || row.full || !field}
        aria-label={`Place ${row.name} in the field`} title={!field ? 'Open Expressions first: the field places a form once its application is mounted.'
          : row.full ? `A scene holds up to ${limit} formations and pins` : `Place ${row.name} in the field: the next click there places it`}
        onClick={() => void place(row)}>Place in the field</button>}
    </li>)}</ul>
    <section className="native-object-starters" aria-label="Starters">
      <h3 className="native-object-starters-title">Starters</h3>
      <p className="native-object-starters-note">Sequence starters replace the selected formation's states; undo restores them.</p>
      <ul className="native-object-rows">{starters.map(row => <li key={row.id} className="native-object-row-item">
        <button type="button" className="native-starter-run" disabled={busy || blocked || !!row.reason} aria-label={`Run starter ${row.name}`}
          title={row.reason ?? row.summary} onClick={() => void starter(row)}>{row.name}</button>
        {row.reason && <small className="native-object-row-summary">{row.reason}</small>}
      </li>)}</ul>
      {progress && <p className="native-object-budget" aria-live="polite">{progress}</p>}
    </section>
    {presets.length > 0 && <section className="native-object-starters" aria-label="Presets">
      <h3 className="native-object-starters-title">Presets</h3>
      <p className="native-object-starters-note">A preset's objects join the open Scene in one edit; undo takes them back.</p>
      <ul className="native-object-rows">{presets.map(row => <li key={row.preset} className="native-object-row-item">
        <button type="button" className="native-starter-run" disabled={busy || blocked} aria-label={`${row.name}: its objects into the Scene`}
          title={blocked ? 'Open a native Expression to add a preset.' : `${row.name}: ${row.summary}.`} onClick={() => void addPreset(row)}>{row.name}</button>
        <small className="native-object-row-summary">{row.summary}</small>
      </li>)}</ul>
    </section>}
    {reading && <p className="native-object-budget" aria-live="polite">{count} of {limit} formations and pins in this Scene</p>}
    {error && <Refusal className="native-error" said="The Scene's formations and pins could not be changed." error={error} ownWords/>}
  </section>
}
