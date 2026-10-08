import {useEffect, useRef, useState, type DragEvent, type KeyboardEvent} from 'react'
import {createPortal} from 'react-dom'
import {baseValue, entityTargets, NATIVE_BINDINGS, type NativeBinding} from '@epilogos/expressions-boundary/parameters'
import {readNativeRacks} from '../../../../expressions-boundary/src/nativeRacks'
import type {NativeParameterRack} from '../../../../expressions-boundary/src/nativeRackSchema'
import {useWorkspace} from '../shell/workspace'
import type {NativeEditorChange} from '../../../../expressions-boundary/src/editor'
import {sharedFieldBinding, sharedSettingChange} from '../../../../expressions-boundary/src/nativeSharedSettings'
import {chosenAddChange, deviceTargetFor, favouriteImportChanges, format, groupRows, mappableRacks, parameterDragFor, parameterFacts, rackMapReason, rowLabel, type ObjectScope} from './nativeBrowserModel'
import {PinAffordance} from './NativePinControls'
import {MAP_PARAMETER_EVENT, OPEN_DEVICE_EVENT, PARAMETER_MIME, encodeParameterDrag, setActiveDrag, setDragChip, type ParameterDrag} from './nativeDrag'

type Property = NativeBinding & {target: string; entityId?: string; value: number}
const idOf = (group: string) => 'world-property-group-' + group.replace(/[^a-zA-Z0-9_-]/g, '-')

/** Discovery is a reading. Pinning is an explicit native document operation.
 * A parameter may also be dragged onto the chosen controls or a macro. */
export function NativePropertyBrowser({query, detailHost, onCount}: {query: string; detailHost: HTMLElement | null; onCount?: (count: number) => void}) {
  const workspace = useWorkspace(), latest = useRef(workspace)
  latest.current = workspace
  const reading = workspace.editorReading
  const [kind, setKind] = useState<'field' | 'object'>('field')
  const [group, setGroup] = useState('')
  const [selected, setSelected] = useState<{expression: string; scene: string; target: string} | null>(null)
  const [scope, setScope] = useState<ObjectScope>('selected')
  const [busy, setBusy] = useState(false), [fault, setFault] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  useEffect(() => {setFault(null)}, [reading?.basis.expression_ref, reading?.basis.scene_ref])
  const entityId = reading?.selection.entity_ids[0]
  const entity = reading?.scene.entities.find(row => row.id === entityId)
  const properties: Property[] = !reading ? [] : kind === 'field'
    ? NATIVE_BINDINGS.map(binding => ({...binding, target: 'field.' + binding.key, value: baseValue(reading.scene, binding.key)}))
    : entityTargets(reading.scene).filter(binding => binding.entityId === entityId)
  const groups = [...new Set(properties.map(binding => binding.group))]
  const needle = query.trim().toLocaleLowerCase()
  const visible = properties.filter(binding => (!group || binding.group === group) && (!needle || `${binding.label} ${binding.group}`.toLocaleLowerCase().includes(needle)))
  const sections = groupRows(visible)
  const property = selected && reading && selected.expression === reading.basis.expression_ref && selected.scene === reading.basis.scene_ref
    ? properties.find(binding => binding.target === selected.target) : undefined
  const drag: ParameterDrag | null = property ? parameterDragFor(property, kind, scope) : null
  const pinned = drag && reading?.chosenControls?.entries.some(entry => entry.key === drag.key && entry.scope === drag.scope && (entry.scope !== 'named' || entry.entityId === drag.entityId))
  const available = !!drag && !!reading?.chosenControls?.available && !!workspace.editor && !reading.standing.pending && !busy && !(kind === 'object' && entity?.locked)
  const effective = property && reading?.observation?.effectiveValues?.[property.target]
  let racks: NativeParameterRack[] = []
  try {racks = reading ? readNativeRacks(reading.scene, reading.entityOccurrences).racks : []} catch {racks = []}
  const mappable = drag && reading ? mappableRacks(drag, racks, reading) : []
  const mapHint = !drag ? '' : mappable.length ? 'Opens the macro mapping form; you confirm the range' : racks.length ? rackMapReason(drag, racks[0], reading) ?? '' : 'Create a Field or object rack first'
  const device = property ? deviceTargetFor(property, kind) : null
  const facts = property ? parameterFacts(property, property.value, effective, kind === 'field' ? 'Field' : entity?.name ?? 'Object') : null
  const report = useRef(onCount)
  report.current = onCount
  useEffect(() => {report.current?.(visible.length)}, [visible.length])

  async function pin() {
    if (!available || !drag || !reading || !workspace.editor) return
    const editor = workspace.editor, basis = structuredClone(reading.basis), workspaceId = workspace.workspaceId
    const change = chosenAddChange(drag)
    setBusy(true); setFault(null)
    try {
      const result = await editor.request({operation: 'apply', basis, changes: [change]})
      if (latest.current.workspaceId !== workspaceId || latest.current.editor !== editor || latest.current.editorReading?.basis.expression_ref !== basis.expression_ref || latest.current.editorReading.basis.scene_ref !== basis.scene_ref) return
      if (!result.ok) setFault(result.error)
    } catch (error) {
      if (latest.current.workspaceId === workspaceId && latest.current.editor === editor && latest.current.editorReading?.basis.expression_ref === basis.expression_ref && latest.current.editorReading.basis.scene_ref === basis.scene_ref) setFault(error instanceof Error ? error.message : String(error))
    } finally {setBusy(false)}
  }
  // Expression sharing (legacy app.ts toggle-global) and Scene favourite import (app.ts import-favourites): one apply each through the same editor request as pin.
  const sharedNow = !!property && !!reading?.sharedTargets?.includes(property.target)
  const shareable = kind === 'field' && !!property && !!sharedFieldBinding(property.target)
  const favourites = reading && kind === 'field' && reading.scene.favourites?.length ? favouriteImportChanges(reading.scene.favourites, reading.chosenControls?.entries ?? []) : null
  async function applyEdit(changes: NativeEditorChange[]) {
    if (!workspace.editor || !reading || reading.standing.pending || busy || !changes.length) return
    const editor = workspace.editor, basis = structuredClone(reading.basis), workspaceId = workspace.workspaceId
    const stillHere = () => latest.current.workspaceId === workspaceId && latest.current.editor === editor && latest.current.editorReading?.basis.expression_ref === basis.expression_ref && latest.current.editorReading.basis.scene_ref === basis.scene_ref
    setBusy(true); setFault(null)
    try {
      const result = await editor.request({operation: 'apply', basis, changes})
      if (stillHere() && !result.ok) setFault(result.error)
    } catch (error) {
      if (stillHere()) setFault(error instanceof Error ? error.message : String(error))
    } finally {setBusy(false)}
  }
  // Pin mode: one click is one admitted change transaction on the captured basis, the same request the preview's Add to toolbelt sends.
  const pinApply = (changes: readonly NativeEditorChange[]) => workspace.editor && reading
    ? workspace.editor.request({operation: 'apply', basis: structuredClone(reading.basis), changes}) : Promise.resolve({ok: false as const, error: 'The native editor is not attached.'})
  const choose = (binding: Property) => {
    if (!reading) return
    setSelected({expression: reading.basis.expression_ref, scene: reading.basis.scene_ref, target: binding.target}); setFault(null)
  }
  function startDrag(event: DragEvent<HTMLButtonElement>, binding: Property) {
    const payload = parameterDragFor(binding, kind, scope)
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(PARAMETER_MIME, encodeParameterDrag(payload))
    setActiveDrag({kind: 'parameter', drag: payload})
    setDragChip(event.dataTransfer, rowLabel(binding.label))
  }
  const rowKey = (binding: Property) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ') return
    event.preventDefault(); choose(binding)
  }
  const preview = <div className="world-property-preview" aria-label="Selected parameter detail">
    {property && drag ? <>
      <strong>{property.label}</strong>
      <div className="world-property-value"><output>{format(property.value)}</output><span>{property.unit ?? 'Scalar'}</span></div>
      {facts && <dl>
        <dt>Scope</dt><dd>{facts.scope}</dd>
        <dt>Range</dt><dd>{facts.soft}</dd>
        <dt>Typed bounds</dt><dd>{facts.hard}</dd>
        <dt>Step</dt><dd>{facts.step}</dd>
        <dt>Native path</dt><dd><code>{facts.native}</code></dd>
        <dt>Base</dt><dd>{facts.base} {facts.unit}</dd>
        {facts.effective !== null && <><dt>Effective</dt><dd>{facts.effective} {facts.unit}</dd></>}
      </dl>}
      {kind === 'object' && <label>Control follows <select aria-label="Chosen parameter binding" value={scope} onChange={event => setScope(event.target.value as ObjectScope)} disabled={busy}><option value="selected">Selected object</option><option value="named">{entity?.name ?? 'This object'}</option></select></label>}
      <div className="world-property-actions">
        <button type="button" className="world-property-pin" disabled={!available || !!pinned} onClick={() => void pin()}>{busy ? 'Pinning…' : pinned ? 'In toolbelt' : 'Add to toolbelt'}</button>
        {shareable && <button type="button" className="world-property-action" aria-pressed={sharedNow} disabled={busy || !workspace.editor || !reading || reading.standing.pending}
          title={sharedNow ? 'Shared across the Expression: it overrides each Scene. Use local value gives each Scene its own copy back.' : 'Shared across the Expression: it overrides each Scene’s own value and suspends that Scene’s automation of it.'}
          onClick={() => void applyEdit([sharedSettingChange(property.target, !sharedNow)])}>{sharedNow ? 'Use local value' : 'Share across Expression'}</button>}
        <button type="button" className="world-property-action" disabled={!mappable.length} title={mapHint} aria-describedby="world-property-map-hint"
          onClick={() => window.dispatchEvent(new CustomEvent(MAP_PARAMETER_EVENT, {detail: drag}))}>Map to macro…</button>
        <button type="button" className="world-property-action" disabled={!device} title={device ? `Open the ${device.family} editor that discloses this parameter` : 'No device editor discloses this parameter'}
          onClick={() => device && window.dispatchEvent(new CustomEvent(OPEN_DEVICE_EVENT, {detail: device}))}>Open device</button>
      </div>
      {!mappable.length && mapHint && <small id="world-property-map-hint" className="world-property-hint">{mapHint}</small>}
      {property.note && <details><summary>Parameter details</summary><p>{property.note}</p></details>}
      {kind === 'object' && entity?.locked && <p role="status">This object is locked.</p>}
      {!reading?.chosenControls && <p role="status">The retained owner has not disclosed its chosen controls.</p>}
    </> : <p className="native-empty">Select a parameter to inspect its range and choose its binding. Drag a parameter onto the chosen controls or a macro to map it.</p>}
    {fault && <p className="native-error" role="alert">{fault}</p>}
  </div>
  return <section className="world-property-browser" aria-label="Native parameters">
    <div className="world-property-filters"><div role="group" aria-label="Parameter scope"><button type="button" aria-pressed={kind === 'field'} onClick={() => {setKind('field'); setGroup('')}}>Field</button><button type="button" aria-pressed={kind === 'object'} onClick={() => {setKind('object'); setGroup('')}}>Object</button></div><select aria-label="Parameter family" value={group} onChange={event => setGroup(event.target.value)}><option value="">All families</option>{groups.map(value => <option key={value}>{value}</option>)}</select></div>
    {favourites && <div className="world-property-actions">
      <button type="button" disabled={busy || !favourites.changes.length || !workspace.editor || !reading?.chosenControls?.available || !!reading?.standing.pending}
        title="Adds each Scene favourite that names a native Field parameter to the chosen controls, in one change"
        onClick={() => void applyEdit(favourites.changes)}>{favourites.changes.length ? `Import Scene favourites (${favourites.changes.length})` : 'Scene favourites are in the toolbelt'}</button>
      {!!favourites.skipped.length && <small className="world-property-hint">{favourites.skipped.length} favourite{favourites.skipped.length === 1 ? '' : 's'} name no native Field parameter and stay unimported.</small>}
    </div>}
    {!reading && <p className="native-empty">Open an Expression to browse its parameters.</p>}
    {reading && kind === 'object' && !entity && <p className="native-empty">Select an object in the Expression.</p>}
    <ul className="world-property-groups">{sections.map(section => {
      const open = !collapsed.has(section.group)
      return <li key={section.group}>
        <button type="button" className="world-property-group" aria-expanded={open} aria-controls={idOf(section.group)}
          onClick={() => setCollapsed(before => {const next = new Set(before); next.has(section.group) ? next.delete(section.group) : next.add(section.group); return next})}>
          <span aria-hidden="true">{open ? '▾' : '▸'}</span><span>{section.group}</span><small>{section.rows.length}</small></button>
        {open && <ul id={idOf(section.group)} className="world-property-rows">{section.rows.map(binding => <li key={binding.target}>
          <button type="button" data-browser-row className={`world-file-row world-property-row${property?.target === binding.target ? ' selected' : ''}`} draggable
            aria-pressed={property?.target === binding.target} title={`${binding.label} · ${binding.unit ?? 'scalar'}. Drag onto the chosen controls or a macro.`}
            onDragStart={event => startDrag(event, binding)} onDragEnd={() => setActiveDrag(null)}
            onClick={() => choose(binding)} onKeyDown={rowKey(binding)} onKeyUp={event => {if (event.key === ' ') event.preventDefault()}}>
            <span aria-hidden="true">○</span><span>{rowLabel(binding.label)}</span></button>
          {reading && (kind === 'field' ? <PinAffordance reading={reading} control={{kind: 'field', path: binding.path}} label={binding.label} apply={pinApply} />
            : entityId ? <PinAffordance reading={reading} control={{kind: 'entity', entityId, key: binding.key}} label={binding.label} apply={pinApply} /> : null)}
        </li>)}</ul>}
      </li>
    })}</ul>
    {reading && !!properties.length && !visible.length && <p className="native-empty">No parameters match this search.</p>}
    {detailHost ? createPortal(preview, detailHost) : preview}
  </section>
}
