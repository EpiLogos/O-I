import { useId, useState } from 'react'
import type { SettingsAdapter, SettingSpec } from './adapter'
import { displayValue, rawValue } from './model'
import type { CSSProperties } from 'react'
import type { TableRepresentation } from './model'

interface ControlProps { spec: SettingSpec; raw: unknown; onChange: (raw: unknown) => void; adapter: SettingsAdapter; disabled?: boolean; errorId?: string; representation?: TableRepresentation }

/** Compact typed editors adapted from Cradle SettingControl; edits remain local. */
export function SettingControl({ spec, raw, onChange, adapter, disabled, errorId, representation }: ControlProps) {
  const id = useId()
  const [pickerError, setPickerError] = useState<string | null>(null)
  const schema = spec.value_schema
  const common = { disabled, 'aria-label': spec.title, 'aria-describedby': errorId, 'aria-invalid': !!errorId }
  if (schema.type === 'boolean') return <label className="settings-switch"><input {...common} type="checkbox" checked={raw === true} onChange={e => onChange(e.target.checked)} /><span>{raw === true ? 'On' : 'Off'}</span></label>
  if (schema.type === 'enum') {const options=schema.options??[];const selected=options.findIndex(o=>Object.is(o.value,raw));return <select {...common} disabled={disabled||!options.length} value={selected<0?'':String(selected)} onChange={e=>{const choice=options[Number(e.target.value)];if(choice)onChange(choice.value)}}><option value="" disabled>{options.length?'Choose…':'Owner choices unavailable'}</option>{options.map((o,index)=><option key={index} value={String(index)}>{o.title??String(o.value)}</option>)}</select>}
  if (schema.type === 'number' || schema.type === 'integer') return <div className="settings-number"><input {...common} type="text" inputMode="decimal" value={String(raw ?? '')} onChange={e => onChange(e.target.value)} spellCheck={false} /><span>{schema.minimum !== undefined ? schema.minimum : '−∞'} – {schema.maximum !== undefined ? schema.maximum : '∞'}{schema.type === 'integer' ? ' · whole numbers' : ''}</span></div>
  if (schema.type === 'secret') return <button type="button" disabled={!adapter.navigate} onClick={() => adapter.navigate?.({ kind: 'credentials', native_ref: String(spec.native_ref), setting_ref: spec.setting_ref })}>Open credential editor</button>
  if (schema.type === 'list') {
    const values = Array.isArray(raw) ? raw : []
    return <div className="settings-list">{values.map((value, index) => <div className="settings-list-row" key={index}><input disabled={disabled} aria-label={`${spec.title}, item ${index + 1}`} value={String(value)} onChange={e => onChange(values.map((v, i) => i === index ? e.target.value : v))} /><button type="button" disabled={disabled} aria-label={`Remove ${spec.title} item ${index + 1}`} onClick={() => onChange(values.filter((_, i) => i !== index))}>×</button></div>)}<button type="button" disabled={disabled} onClick={() => onChange([...values, ''])}>+ Add item</button>{!values.length && <span className="settings-muted">No explicit entries</span>}</div>
  }
  if (schema.type === 'table') {
    const rows = Array.isArray(raw) ? raw as Record<string, unknown>[] : []
    return <div className="settings-table" role="group" aria-label={spec.title} style={{'--setting-columns':schema.columns.length} as CSSProperties}>
      <div className="settings-table-head">{schema.columns.map(c => <span key={c.name}>{c.name}</span>)}<span /></div>
      {rows.map((row, index) => <div className="settings-table-row" key={index}>{schema.columns.map(col => {
        const choices = spec.setting_ref === 'central:skills:central.skills' && col.name === 'standing' ? [{value:'active',title:'Active'},{value:'retired',title:'Retired'}] : adapter.choices?.(spec, col.name, row)
        const label = `${spec.title}, row ${index + 1}, ${col.name}`
        const dependsOnHarness = spec.setting_ref === 'ai-kit:permissions:permissions.default-mode' && col.name === 'mode'
        if (col.type === 'boolean') return <label className="settings-switch" key={col.name}><input disabled={disabled} type="checkbox" aria-label={label} checked={row[col.name] === true} onChange={e => onChange(rows.map((r, i) => i === index ? { ...r, [col.name]: e.target.checked } : r))} /><span>{row[col.name] ? 'On' : 'Off'}</span></label>
        const update = (value: string) => {
          const changed = { ...row, [col.name]: value }
          // A dependent selection is never silently carried to another harness.
          if (col.name === 'harness') for (const dependent of ['model', 'mode']) if (Object.hasOwn(changed, dependent)) changed[dependent] = ''
          onChange(rows.map((r, i) => i === index ? changed : r))
        }
        if (choices || dependsOnHarness) return <div key={col.name}><select disabled={disabled || !choices?.length} aria-label={label} value={String(row[col.name] ?? '')} onChange={e => update(e.target.value)}><option value="">{choices?.length ? 'Choose…' : 'Catalogue unavailable'}</option>{choices?.map(c => <option value={c.value} key={c.value}>{c.title}</option>)}</select>{dependsOnHarness && !choices?.length && <small>Read this harness’s advertised modes first.</small>}</div>
        if (col.type === 'list' || col.type === 'table') return <label key={col.name} className="settings-collection-cell"><span>{col.name}</span><textarea disabled={disabled} aria-label={label} rows={2} value={typeof row[col.name] === 'string' ? row[col.name] as string : JSON.stringify(row[col.name] ?? (col.type === 'list' ? [] : {}))} onChange={e=>update(e.target.value)} spellCheck={false}/></label>
        return <input key={col.name} disabled={disabled} aria-label={label} value={String(row[col.name] ?? '')} onChange={e => update(e.target.value)} spellCheck={false} />
      })}{representation !== 'record' && <button type="button" disabled={disabled} aria-label={`Remove ${spec.title} row ${index + 1}`} onClick={() => onChange(rows.filter((_, i) => i !== index))}>×</button>}</div>)}
      {representation !== 'record' && <button type="button" disabled={disabled} onClick={() => onChange([...rows, Object.fromEntries(schema.columns.map(c => [c.name, c.type === 'boolean' ? true : c.type === 'list' ? [] : c.type === 'table' ? {} : '']))])}>+ Add entry</button>}{!rows.length && <span className="settings-muted">No explicit overrides</span>}
    </div>
  }
  return <div className="settings-resource"><input id={id} {...common} value={String(raw ?? '')} onChange={e => onChange(e.target.value)} spellCheck={false} placeholder={schema.type === 'reference' ? schema.subject_kind : schema.type === 'path' ? 'Native path' : undefined} />{schema.type === 'path' && <button type="button" disabled={disabled || !adapter.pickResource} title={!adapter.pickResource ? 'Native resource picker is not connected.' : undefined} onClick={async()=>{try{setPickerError(null);const value=await adapter.pickResource?.(spec);if(value!==null&&value!==undefined)onChange(value)}catch(error){setPickerError(error instanceof Error?error.message:String(error))}}}>Browse…</button>}{pickerError&&<p className="settings-field-error" role="alert">{pickerError}</p>}</div>
}

export function ReadOnlyValue({ spec, value }: { spec: SettingSpec; value: unknown }) {
  return <output className="settings-readonly">{displayValue(value, spec.sensitive || spec.value_schema.type === 'secret')}</output>
}
export { rawValue }
