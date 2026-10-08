import {useEffect, useRef, useState, type FormEvent} from 'react'
import type {NativeEditorBasis, NativeEditorReading, NativeEditorReply, NativeEditorRequest} from '../../../../expressions-boundary/src/editor'
import {NATIVE_BINDINGS, entityTargets, getParamDef, entityParamDefs} from '../../../../expressions-boundary/src/parameters'
import {readNativeRacks} from '../../../../expressions-boundary/src/nativeRacks'
import {nativeRackMappingValue, type NativeParameterRack, type NativeRackChange, type NativeRackMacro, type NativeRackMapping} from '../../../../expressions-boundary/src/nativeRackSchema'
import './NativeRackEditor.css'

export type NativeRackEditorRequest = Exclude<NativeEditorRequest, {operation: 'apply'}> | {operation: 'apply'; basis: NativeEditorBasis; changes: readonly NativeRackChange[]}
export interface NativeRackEditorProps {reading: NativeEditorReading | null; request: (request: NativeRackEditorRequest) => Promise<NativeEditorReply>; configure?: boolean}
const identity = (kind: string) => `${kind}:${crypto.randomUUID()}`
const number = (value: number) => String(Number(value.toPrecision(6)))
type Apply = (changes: NativeRackChange[], basis?: NativeEditorBasis) => Promise<boolean>

function MacroControl({macro, rack, reading, disabled, apply, configure}: {macro: NativeRackMacro; rack: NativeParameterRack; reading: NativeEditorReading; disabled: boolean; apply: Apply; configure: boolean}) {
  const [draft, setDraft] = useState<string | null>(null)
  const basis = useRef(reading.basis), active = useRef(false), intended = useRef(macro.value)
  const commit = async () => {
    if (draft === null) return
    const value = draft.trim() ? Number(draft) : NaN
    if (await apply([{kind: 'rack-macro-value', rack_id: rack.id, macro_id: macro.id, value}], basis.current)) setDraft(null)
  }
  const start = () => {basis.current = reading.basis; active.current = true; intended.current = draft === null ? macro.value : Number(draft)}
  const value = draft === null ? macro.value : Number(draft)
  const excluded = rack.excluded.includes(macro.id)
  return <article className="native-rack-macro">
    <header><strong>{macro.name}</strong><label hidden={!configure} title="Retain this macro when recalling a variation"><input type="checkbox" checked={excluded} disabled={disabled} onChange={event => void apply([{kind: 'rack-exclusions', rack_id: rack.id, macro_ids: event.target.checked ? [...rack.excluded, macro.id] : rack.excluded.filter(id => id !== macro.id)}])} />Exclude recall</label></header>
    <div className="native-rack-scalar"><input type="range" aria-label={`${macro.name} macro`} min="0" max="1" step="0.001" value={Number.isFinite(value) ? value : macro.value} disabled={disabled}
      onPointerDown={start} onPointerCancel={() => {active.current = false; setDraft(null)}}
      onChange={event => {intended.current = Number(event.target.value); setDraft(event.target.value)}}
      onPointerUp={() => {if (active.current) {active.current = false; void apply([{kind: 'rack-macro-value', rack_id: rack.id, macro_id: macro.id, value: intended.current}], basis.current).then(ok => {if (ok) setDraft(null)})}}}
      onKeyDown={event => {if (!active.current) start(); if (event.key === 'Escape') {active.current = false; setDraft(null)}}}
      onKeyUp={event => {if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {active.current = false; void commit()}}} />
      <input type="text" inputMode="decimal" aria-label={`${macro.name} exact fraction`} value={draft ?? number(macro.value)} disabled={disabled} onFocus={() => {if (draft === null) basis.current = reading.basis}} onChange={event => setDraft(event.target.value)} onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); void commit()} else if (event.key === 'Escape') {event.preventDefault(); setDraft(null)}}} /><small>0–1</small>
    </div>
    {draft !== null && <small className="native-rack-draft">Intended value retained<button disabled={disabled} onClick={() => void commit()}>Apply</button><button onClick={() => setDraft(null)}>Discard</button></small>}
    <div hidden={!configure}>{macro.mappings.map(mapping => <MappingReading key={mapping.id} mapping={mapping} value={Number.isFinite(value) && value >= 0 && value <= 1 ? value : macro.value} onRemove={() => void apply([{kind: 'rack-set', rack: {...rack, macros: rack.macros.map(item => item.id === macro.id ? {...item, mappings: item.mappings.filter(value => value.id !== mapping.id)} : item)}}])} disabled={disabled} />)}</div>
    {!configure && <small className="native-rack-target-count" title={macro.mappings.map(mapping => `${mapping.target.path}: ${number(mapping.min)} → ${number(mapping.max)} ${mapping.unit}`).join('\n')}>{macro.mappings.length} {macro.mappings.length === 1 ? 'target' : 'targets'}{excluded ? ' · recall excluded' : ''}</small>}
  </article>
}

function MappingReading({mapping, value, onRemove, disabled}: {mapping: NativeRackMapping; value: number; onRemove: () => void; disabled: boolean}) {
  const definition = mapping.target.kind === 'field' ? getParamDef(mapping.target.path) : entityParamDefs(0, {}).find(item => item.path === 'entities.0.' + mapping.target.path)
  const low = Math.min(mapping.min, mapping.max), high = Math.max(mapping.min, mapping.max)
  const ordinate = (fraction: number) => high === low ? 32 : 52 - (nativeRackMappingValue(mapping, fraction) - low) / (high - low) * 40
  const points = Array.from({length: 33}, (_, i) => `${8 + i * 4.5},${ordinate(i / 32)}`).join(' ')
  return <div className="native-rack-mapping"><div><strong>{definition?.label.replace(/^Entity 1 · /, '') ?? mapping.target.path}</strong><span>{number(mapping.min)} → {number(mapping.max)} {mapping.unit} · {mapping.law} · {mapping.max < mapping.min ? 'reverse' : 'forward'}</span><small>Mapped {number(nativeRackMappingValue(mapping, value))} {mapping.unit}</small></div>
    <svg viewBox="0 0 160 64" aria-label={`${mapping.law} mapping response in ${mapping.unit}`}><path d="M8 8V52H152" /><polyline points={points} /><circle cx={8 + value * 144} cy={ordinate(value)} r="3" /></svg><button aria-label={`Remove ${definition?.label ?? mapping.target.path} mapping`} disabled={disabled} onClick={onRemove}>×</button></div>
}

function MappingForm({rack, reading, disabled, apply}: {rack: NativeParameterRack; reading: NativeEditorReading; disabled: boolean; apply: Apply}) {
  const entityId = rack.scope.kind === 'entity' ? Object.keys(reading.entityOccurrences).find(id => reading.entityOccurrences[id] === (rack.scope.kind === 'entity' ? rack.scope.entity_ref : '')) : undefined
  const bindings = rack.scope.kind === 'field' ? NATIVE_BINDINGS : entityTargets(reading.scene).filter(item => item.entityId === entityId)
  const [path, setPath] = useState(''), [macroId, setMacroId] = useState(rack.macros[0]?.id ?? ''), [min, setMin] = useState(''), [max, setMax] = useState(''), [law, setLaw] = useState<'linear' | 'log'>('linear')
  const selectPath = (path: string) => {setPath(path); const binding = bindings.find(item => (rack.scope.kind === 'field' ? item.path : item.key) === path); if (binding) {setMin(number(binding.min * binding.factor)); setMax(number(binding.max * binding.factor)); setLaw(binding.scale === 'log' && binding.min > 0 ? 'log' : 'linear')}}
  const binding = bindings.find(item => (rack.scope.kind === 'field' ? item.path : item.key) === path)
  const definition = binding && (rack.scope.kind === 'field' ? getParamDef(path) : entityParamDefs(0, {}).find(item => item.path === 'entities.0.' + path))
  const submit = (event: FormEvent) => {
    event.preventDefault(); if (!definition || !binding) return
    const mapping: NativeRackMapping = {id: identity('mapping'), target: rack.scope.kind === 'field' ? {kind: 'field', path} : {kind: 'entity', entity_ref: rack.scope.entity_ref, path}, min: min.trim() ? Number(min) : NaN, max: max.trim() ? Number(max) : NaN, unit: definition.unit ?? 'scalar', law}
    void apply([{kind: 'rack-set', rack: {...rack, macros: rack.macros.map(macro => macro.id === macroId ? {...macro, mappings: [...macro.mappings, mapping]} : macro)}}]).then(ok => {if (ok) setPath('')})
  }
  return <form className="native-rack-map-form" onSubmit={submit}><strong>Map native parameter</strong><select aria-label="Mapping macro" value={macroId} disabled={disabled} onChange={event => setMacroId(event.target.value)}>{rack.macros.map(macro => <option key={macro.id} value={macro.id}>{macro.name}</option>)}</select>
    <select aria-label="Native mapping parameter" value={path} disabled={disabled} onChange={event => selectPath(event.target.value)}><option value="">Choose parameter…</option>{bindings.map(item => <option key={item.key} value={rack.scope.kind === 'field' ? item.path : item.key}>{item.label}</option>)}</select>
    {definition && <><label>At 0<input aria-label="Mapping minimum" value={min} onChange={event => setMin(event.target.value)} disabled={disabled} inputMode="decimal" /></label><label>At 1<input aria-label="Mapping maximum" value={max} onChange={event => setMax(event.target.value)} disabled={disabled} inputMode="decimal" /></label><select aria-label="Mapping law" value={law} onChange={event => setLaw(event.target.value as 'linear' | 'log')} disabled={disabled}><option value="linear">Linear</option><option value="log">Logarithmic</option></select><small>{number(definition.hardMin)}–{number(definition.hardMax)} {definition.unit ?? 'scalar'} · {definition.hardMin < 0 ? 'signed' : 'positive domain'}</small><button disabled={disabled || !rack.macros.some(macro => macro.id === macroId)} type="submit">Add mapping</button></>}
  </form>
}

export function NativeRackEditor({reading, request, configure = false}: NativeRackEditorProps) {
  const [selected, setSelected] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [variationName, setVariationName] = useState('')
  const pending = useRef(false), currentBasis = useRef(reading?.basis)
  currentBasis.current = reading?.basis
  const [attempt, setAttempt] = useState<{changes: NativeRackChange[]; basis: NativeEditorBasis} | null>(null)
  useEffect(() => {setSelected(null); setError(''); setAttempt(null)}, [reading?.basis.expression_ref, reading?.basis.scene_ref])
  if (!reading) return configure ? <section className="native-rack-editor">Open a native Scene to read its parameter racks.</section> : null
  let racks: NativeParameterRack[]
  try {racks = readNativeRacks(reading.scene, reading.entityOccurrences).racks} catch (error) {return <section className="native-rack-editor" role="alert">{String(error)}</section>}
  const rack = racks.find(rack => rack.id === selected) ?? racks[0]
  const owner = rack?.scope.kind === 'entity' ? reading.scene.entities.find(entity => reading.entityOccurrences[entity.id] === (rack.scope.kind === 'entity' ? rack.scope.entity_ref : '')) : undefined
  const unavailable = rack?.scope.kind === 'entity' && !owner
  const disabled = busy || reading.standing.pending || !!owner?.locked || unavailable
  const apply: Apply = async (changes, basis = reading.basis) => {
    if (pending.current) return false
    pending.current = true; setBusy(true); setError(''); setAttempt({changes, basis})
    try {const reply = await request({operation: 'apply', basis, changes}); if (basis.expression_ref !== currentBasis.current?.expression_ref || basis.scene_ref !== currentBasis.current?.scene_ref) return false; if (!reply.ok) {setError(reply.error); return false} setAttempt(null); return true}
    catch (error) {if (basis.expression_ref === currentBasis.current?.expression_ref && basis.scene_ref === currentBasis.current?.scene_ref) setError(error instanceof Error ? error.message : String(error)); return false}
    finally {pending.current = false; setBusy(false)}
  }
  const create = (entity: boolean) => {
    const id = reading.selection.entity_ids.length === 1 ? reading.selection.entity_ids[0] : undefined
    const ref = id && reading.entityOccurrences[id]
    if (entity && !ref) return
    const next: NativeParameterRack = {schema: 'oi.parameter-rack/v1', id: identity('rack'), title: entity ? `${reading.scene.entities.find(item => item.id === id)?.name ?? 'Entity'} rack` : 'Field rack', scope: entity ? {kind: 'entity', entity_ref: ref!} : {kind: 'field'}, macros: [{id: identity('macro'), name: 'Macro 1', value: .5, mappings: []}], excluded: [], variations: []}
    void apply([{kind: 'rack-set', rack: next}]).then(ok => {if (ok) setSelected(next.id)})
  }
  if (!rack && !configure) return null
  return <section className={`native-rack-editor ${configure ? 'is-configuring' : 'is-compact'}`} aria-label="Native parameter racks">
    <header><strong>Macros</strong><select aria-label="Selected rack" value={rack?.id ?? ''} onChange={event => setSelected(event.target.value)}><option value="" disabled>Select rack</option>{racks.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><span hidden={!configure} className="native-rack-create"><button disabled={busy || reading.standing.pending || racks.length >= 32} onClick={() => create(false)}>+ Field</button><button disabled={busy || reading.standing.pending || racks.length >= 32 || reading.selection.entity_ids.length !== 1 || !reading.entityOccurrences[reading.selection.entity_ids[0]] || reading.scene.entities.find(entity => entity.id === reading.selection.entity_ids[0])?.locked} onClick={() => create(true)}>+ Selected object</button></span></header>
    {rack ? <div key={reading.basis.scene_ref + rack.id}><div className="native-rack-scope"><span>{rack.scope.kind === 'field' ? 'Field' : owner?.name ?? 'Bound object absent'}</span><code hidden={!configure} title={rack.scope.kind === 'entity' ? rack.scope.entity_ref : reading.basis.scene_ref}>{rack.scope.kind === 'entity' ? rack.scope.entity_ref : reading.basis.scene_ref}</code><button hidden={!configure} disabled={disabled} onClick={() => void apply([{kind: 'rack-remove', rack_id: rack.id}])}>Remove rack</button></div>
      {unavailable && <p>Retained rack belongs to an off-page entity. Return to its Scene to operate it.</p>}{owner?.locked && <p>Unlock {owner.name} to edit this rack.</p>}
      <div className="native-rack-macros">{rack.macros.map(macro => <MacroControl key={macro.id} macro={macro} rack={rack} reading={reading} disabled={disabled} apply={apply} configure={configure} />)}</div>
      <div hidden={!configure} className="native-rack-configuration"><button disabled={disabled || rack.macros.length >= 16} onClick={() => {const id = identity('macro'); void apply([{kind: 'rack-set', rack: {...rack, macros: [...rack.macros, {id, name: `Macro ${rack.macros.length + 1}`, value: .5, mappings: []}], variations: rack.variations.map(variation => ({...variation, values: {...variation.values, [id]: .5}}))}}])}}>Add macro</button>
      <MappingForm key={rack.id + ':' + rack.macros.length} rack={rack} reading={reading} disabled={disabled} apply={apply} />
      <div className="native-rack-variations"><strong>Variations</strong><input aria-label="Variation name" placeholder="Name this variation" value={variationName} maxLength={160} disabled={disabled} onChange={event => setVariationName(event.target.value)} /><button disabled={disabled || !variationName.trim() || rack.variations.length >= 128} onClick={() => void apply([{kind: 'rack-variation-capture', rack_id: rack.id, variation_id: identity('variation'), name: variationName.trim()}]).then(ok => {if (ok) setVariationName('')})}>Capture</button>{rack.variations.map(variation => <span key={variation.id}><button disabled={disabled} onClick={() => void apply([{kind: 'rack-variation-recall', rack_id: rack.id, variation_id: variation.id}])}>{variation.name}</button><button disabled={disabled} aria-label={`Remove variation ${variation.name}`} onClick={() => void apply([{kind: 'rack-variation-remove', rack_id: rack.id, variation_id: variation.id}])}>×</button></span>)}</div></div>
    </div> : <p>Create a Field or selected entity rack, then map native parameters to its macros.</p>}
    {error && <div role="alert" className="native-rack-error">{error}{attempt && <><button disabled={busy || unavailable || attempt.basis.expression_ref !== reading.basis.expression_ref || attempt.basis.scene_ref !== reading.basis.scene_ref} onClick={() => void apply(attempt.changes, reading.basis)}>Retry on current revision</button><button onClick={() => {setAttempt(null); setError('')}}>Discard pending request</button></>}</div>}
    <footer hidden={!configure}>Native r{reading.basis.revision} · authored r{reading.basis.authored_revision} · {busy ? 'Committing through owner…' : reading.standing.pending ? 'Native acknowledgement pending' : reading.standing.dirty ? 'Retained draft' : 'Native readback current'}</footer>
  </section>
}
