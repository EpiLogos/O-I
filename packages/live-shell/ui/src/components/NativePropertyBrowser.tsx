import {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {baseValue, entityTargets, NATIVE_BINDINGS, type NativeBinding} from '@epilogos/expressions-boundary/parameters'
import {useWorkspace} from '../shell/workspace'

type Property = NativeBinding & {target: string; entityId?: string; value: number}
const format = (value: number) => Number.isFinite(value) ? String(Number(value.toPrecision(6))) : 'Unavailable'

/** Discovery is a reading. Pinning is an explicit native document operation. */
export function NativePropertyBrowser({query, detailHost}: {query: string; detailHost: HTMLElement | null}) {
  const workspace = useWorkspace(), latest = useRef(workspace)
  latest.current = workspace
  const reading = workspace.editorReading
  const [kind, setKind] = useState<'field' | 'object'>('field')
  const [group, setGroup] = useState('')
  const [selected, setSelected] = useState<{expression: string; scene: string; target: string} | null>(null)
  const [scope, setScope] = useState<'selected' | 'named'>('selected')
  const [busy, setBusy] = useState(false), [fault, setFault] = useState<string | null>(null)
  useEffect(() => {setFault(null)}, [reading?.basis.expression_ref, reading?.basis.scene_ref])
  const entityId = reading?.selection.entity_ids[0]
  const entity = reading?.scene.entities.find(row => row.id === entityId)
  const properties: Property[] = !reading ? [] : kind === 'field'
    ? NATIVE_BINDINGS.map(binding => ({...binding, target: 'field.' + binding.key, value: baseValue(reading.scene, binding.key)}))
    : entityTargets(reading.scene).filter(binding => binding.entityId === entityId)
  const groups = [...new Set(properties.map(binding => binding.group))]
  const needle = query.trim().toLocaleLowerCase()
  const visible = properties.filter(binding => (!group || binding.group === group) && (!needle || `${binding.label} ${binding.group}`.toLocaleLowerCase().includes(needle)))
  const property = selected && reading && selected.expression === reading.basis.expression_ref && selected.scene === reading.basis.scene_ref
    ? properties.find(binding => binding.target === selected.target) : undefined
  const chosenScope = kind === 'field' ? 'field' : scope
  const pinned = property && reading?.chosenControls?.entries.some(entry => entry.key === property.key && entry.scope === chosenScope && (entry.scope !== 'named' || entry.entityId === property.entityId))
  const available = !!property && !!reading?.chosenControls?.available && !!workspace.editor && !reading.standing.pending && !busy && !(kind === 'object' && entity?.locked)
  async function pin() {
    if (!available || !property || !reading || !workspace.editor) return
    const editor = workspace.editor, basis = structuredClone(reading.basis), workspaceId = workspace.workspaceId
    const captured = {...property}, capturedScope = chosenScope
    setBusy(true); setFault(null)
    try {
      const result = await editor.request({operation: 'apply', basis, changes: [{kind: 'chosen-add', key: captured.key, scope: capturedScope, ...(capturedScope === 'named' ? {entity_id: captured.entityId} : {})}]})
      if (latest.current.workspaceId !== workspaceId || latest.current.editor !== editor || latest.current.editorReading?.basis.expression_ref !== basis.expression_ref || latest.current.editorReading.basis.scene_ref !== basis.scene_ref) return
      if (!result.ok) setFault(result.error)
    } catch (error) {
      if (latest.current.workspaceId === workspaceId && latest.current.editor === editor && latest.current.editorReading?.basis.expression_ref === basis.expression_ref && latest.current.editorReading.basis.scene_ref === basis.scene_ref) setFault(error instanceof Error ? error.message : String(error))
    } finally {setBusy(false)}
  }
  const preview = <div className="world-property-preview" aria-label="Selected parameter detail">
    {property ? <>
      <strong>{property.label}</strong>
      <div className="world-property-value"><output>{format(property.value)}</output><span>{property.unit ?? 'Scalar'}</span></div>
      <dl><dt>Range</dt><dd>{format(property.min)} – {format(property.max)}</dd><dt>Typed bounds</dt><dd>{format(property.hardMin)} – {format(property.hardMax)}</dd></dl>
      {kind === 'object' && <label>Control follows <select aria-label="Chosen parameter binding" value={scope} onChange={event => setScope(event.target.value as 'selected' | 'named')} disabled={busy}><option value="selected">Selected object</option><option value="named">{entity?.name ?? 'This object'}</option></select></label>}
      <button type="button" className="world-property-pin" disabled={!available || !!pinned} onClick={() => void pin()}>{busy ? 'Pinning…' : pinned ? 'In toolbelt' : 'Add to toolbelt'}</button>
      {property.note && <details><summary>Parameter details</summary><p>{property.note}</p></details>}
      {kind === 'object' && entity?.locked && <p role="status">This object is locked.</p>}
      {!reading?.chosenControls && <p role="status">The retained owner has not disclosed its chosen controls.</p>}
    </> : <p className="native-empty">Select a parameter to inspect its range and choose its binding.</p>}
    {fault && <p className="native-error" role="alert">{fault}</p>}
  </div>
  return <section className="world-property-browser" aria-label="Native parameters">
    <div className="world-property-filters"><div role="group" aria-label="Parameter scope"><button type="button" aria-pressed={kind === 'field'} onClick={() => {setKind('field'); setGroup('')}}>Field</button><button type="button" aria-pressed={kind === 'object'} onClick={() => {setKind('object'); setGroup('')}}>Object</button></div><select aria-label="Parameter family" value={group} onChange={event => setGroup(event.target.value)}><option value="">All families</option>{groups.map(value => <option key={value}>{value}</option>)}</select></div>
    {!reading && <p className="native-empty">Open an Expression to browse its parameters.</p>}
    {reading && kind === 'object' && !entity && <p className="native-empty">Select an object in the Expression.</p>}
    <ul>{visible.map(binding => <li key={binding.target}><button type="button" className={`world-file-row${property?.target === binding.target ? ' selected' : ''}`} aria-pressed={property?.target === binding.target} title={`${binding.label} · ${binding.unit ?? 'scalar'}`} onClick={() => {setSelected({expression: reading!.basis.expression_ref, scene: reading!.basis.scene_ref, target: binding.target}); setFault(null)}}><span aria-hidden="true">○</span><span>{binding.label.replace(/^.*? · /, '')}</span></button></li>)}</ul>
    {reading && !!properties.length && !visible.length && <p className="native-empty">No parameters match this search.</p>}
    {detailHost ? createPortal(preview, detailHost) : preview}
  </section>
}
