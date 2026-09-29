import {useState, type ReactNode} from 'react';
import type {JsonValue, ReportKey} from './types';

type Data = {[key: string]: JsonValue};
function record(value: JsonValue): Data | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function Field({label, children}: {label: string; children: ReactNode}) {
  return <label className="oi-field nara-id-field"><span>{label}</span>{children}</label>;
}
function number(value: string): JsonValue {
  return value === '' ? null : /^\d+$/.test(value) ? Number(value) : value;
}
function shown(value: JsonValue | undefined): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
/** Explicit field corrections preserve every other imported field. Domain
 * validation is performed by QL when the person reviews the whole profile. */
export function ReportFields({kind, raw, onChange}: {kind: ReportKey; raw: string; onChange: (raw: string) => void}) {
  const data = (() => {
    try { return record(JSON.parse(raw || '{}')); } catch { return null; }
  })();
  if (!data) return <p className="nara-id-notice">This report cannot be shown as fields yet. Correct its object in Advanced report data or import the report again.</p>;
  const set = (key: string, value: JsonValue) => onChange(JSON.stringify({...data, [key]: value}, null, 2));
  if (kind === 'jungian') return <section aria-label="Imported personality report fields"><h4>Reported personality material</h4><div className="nara-id-grid">
    <Field label="Reported system"><select className="oi-input" value={shown(data.system)} onChange={e => set('system', e.target.value)}><option value="">Not supplied</option>{typeof data.system === 'string' && !['jungian', 'mbti', '16-personalities', ''].includes(data.system) && <option value={data.system}>{data.system} — imported value</option>}<option value="jungian">Jungian</option><option value="mbti">MBTI</option><option value="16-personalities">16-personalities</option></select></Field>
    <Field label="Reported four-letter type"><input className="oi-input" maxLength={4} autoCapitalize="characters" value={shown(data.type)} onChange={e => set('type', e.target.value.toUpperCase())}/></Field>
    {(data.system === '16-personalities' || data.identity !== undefined) && <Field label="Reported A / T identity"><select className="oi-input" value={shown(data.identity)} onChange={e => {
      if (e.target.value) set('identity', e.target.value);
      else { const next = {...data}; delete next.identity; onChange(JSON.stringify(next, null, 2)); }
    }}><option value="">Not supplied</option>{typeof data.identity === 'string' && !['A', 'T', ''].includes(data.identity) && <option value={data.identity}>{data.identity} — imported value</option>}<option value="A">A — Assertive</option><option value="T">T — Turbulent</option></select><small>A / T belongs only to a 16-personalities report.</small></Field>}
  </div><FunctionScores data={data} onChange={onChange}/></section>;
  if (kind === 'gene_keys') {
    const spheres = data.spheres;
    return <section aria-label="Gene Keys report fields">
      <h4>Reported spheres</h4><p className="nara-id-muted">Copy the names, keys and lines from your source profile. No sphere is calculated here.</p>
      {!Array.isArray(spheres) ? <><p>{spheres === undefined ? 'Spheres not supplied.' : 'The imported spheres need correction in Advanced report data.'}</p>{spheres === undefined && <button type="button" className="oi-action" onClick={() => set('spheres', [])}>Record spheres from my report</button>}</> : <>
        {!spheres.length && <p className="nara-id-notice">No spheres recorded. QL requires at least one named sphere.</p>}
        {spheres.map((value, index) => {
          const sphere = record(value);
          if (!sphere) return <p className="nara-id-notice" key={index}>Sphere {index + 1} is not an object. Its original value is retained in Advanced report data.</p>;
          const change = (key: string, v: JsonValue) => set('spheres', spheres.map((held, i) => i === index ? {...sphere, [key]: v} : held));
          return <fieldset key={index} aria-label={`Sphere ${index + 1}`}>
            <div className="nara-id-grid"><Field label={`Sphere ${index + 1} name`}><input className="oi-input" value={shown(sphere.name)} onChange={e => change('name', e.target.value)}/></Field>
              <Field label="Gene Key (1–64)"><input className="oi-input" type="number" min={1} max={64} step={1} value={shown(sphere.key)} onChange={e => change('key', number(e.target.value))}/></Field>
              <Field label="Line (1–6)"><input className="oi-input" type="number" min={1} max={6} step={1} value={shown(sphere.line)} onChange={e => change('line', number(e.target.value))}/></Field></div>
            <button type="button" className="oi-action" onClick={() => set('spheres', spheres.filter((_, i) => i !== index))}>Remove sphere {index + 1}</button>
          </fieldset>;
        })}
        <button type="button" className="oi-action" disabled={spheres.length >= 64} onClick={() => set('spheres', [...spheres, {name: '', key: null, line: null}])}>Add a reported sphere</button>
      </>}
    </section>;
  }
  if (kind === 'human_design') return <section aria-label="Human Design report fields">
    <h4>BodyGraph report</h4><div className="nara-id-grid">{['type', 'strategy', 'authority', 'profile', 'definition'].map(key => <Field key={key} label={`Reported ${key}`}><input className="oi-input" value={shown(data[key])} onChange={e => set(key, e.target.value)}/></Field>)}</div>
    {(['personality_gates', 'design_gates'] as const).map(key => <GateList key={key} name={key === 'personality_gates' ? 'Personality gates' : 'Design gates'} value={data[key]} onChange={v => set(key, v)}/>)}
    <h4>Defined BodyGraph centres</h4><p className="nara-id-muted">These are the report’s nine Human Design centres. They remain distinct from the seven-centre Expression.</p>
    {data.defined_centres === undefined ? <><p>Not supplied.</p><button type="button" className="oi-action" onClick={() => set('defined_centres', [])}>Record defined centres from my report</button></> : Array.isArray(data.defined_centres) ? <>
      {!data.defined_centres.length && <p>Explicitly recorded: no defined centres.</p>}
      <div className="nara-id-grid">{['head', 'ajna', 'throat', 'g', 'heart', 'spleen', 'solar-plexus', 'sacral', 'root'].map(centre => <label key={centre} className="nara-id-check"><input type="checkbox" checked={(data.defined_centres as JsonValue[]).includes(centre)} onChange={e => set('defined_centres', e.target.checked ? [...data.defined_centres as JsonValue[], centre] : (data.defined_centres as JsonValue[]).filter(value => value !== centre))}/>{centre === 'g' ? 'G' : centre.replace('-', ' ')}</label>)}</div>
    </> : <p className="nara-id-notice">The imported centre list needs correction in Advanced report data.</p>}
    <h4>Reported channels</h4>
    {data.channels === undefined ? <><p>Not supplied.</p><button type="button" className="oi-action" onClick={() => set('channels', [])}>Record channels from my report</button></> : Array.isArray(data.channels) ? <>
      {!data.channels.length && <p>Explicitly recorded: no channels.</p>}
      {data.channels.map((channel, index) => <fieldset key={index} aria-label={`Channel ${index + 1}`}>
        {Array.isArray(channel) && channel.length === 2 ? <div className="nara-id-grid">{[0, 1].map(side => <Field key={side} label={`Channel ${index + 1}, gate ${side + 1}`}><input className="oi-input" type="number" min={1} max={64} step={1} value={shown(channel[side])} onChange={e => set('channels', (data.channels as JsonValue[]).map((held, i) => i === index ? channel.map((gate, j) => j === side ? number(e.target.value) : gate) : held))}/></Field>)}</div> : <p className="nara-id-notice">This channel is not a two-gate pair. Its value is retained in Advanced report data.</p>}
        <button type="button" className="oi-action" onClick={() => set('channels', (data.channels as JsonValue[]).filter((_, i) => i !== index))}>Remove channel {index + 1}</button>
      </fieldset>)}
      <button type="button" className="oi-action" onClick={() => set('channels', [...data.channels as JsonValue[], [null, null]])}>Add a reported channel</button>
    </> : <p className="nara-id-notice">The imported channels need correction in Advanced report data.</p>}
    <p className="nara-id-muted">QL checks distinct gates 1–64, distinct centres and channel pairs, and whether each channel gate appears in the imported gate lists.</p>
  </section>;
  if (kind === 'quintessence') return <AuthoredFields data={data} set={set}/>;
  return null;
}
function FunctionScores({data, onChange}: {data: Data; onChange: (raw: string) => void}) {
  const scores = data.questionnaire_scores === undefined ? {} : record(data.questionnaire_scores);
  const replace = (next: Data) => onChange(JSON.stringify(next, null, 2));
  return <details><summary>Actual questionnaire function strengths</summary>
    <p>Use measured function strengths from one comparable scale. A type label or a percentage preference between two traits does not supply these magnitudes.</p>
    <Field label="Function-strength scale and basis"><input className="oi-input" value={shown(data.questionnaire_score_basis)} onChange={e => {const next = {...data};if (e.target.value) next.questionnaire_score_basis = e.target.value;else delete next.questionnaire_score_basis;replace(next);}}/></Field>
    {scores ? <div className="nara-id-grid">{['sensation', 'intuition', 'feeling', 'thinking', 'introversion', 'extroversion'].map(name => <Field key={name} label={`Reported ${name} strength`}><input className="oi-input" type="number" min={0} step="any" value={shown(scores[name])} onChange={e => {const next = {...scores};if (e.target.value === '') delete next[name];else if (Number.isFinite(e.target.valueAsNumber)) next[name] = e.target.valueAsNumber;else return;replace({...data, questionnaire_scores: next});}}/></Field>)}</div> : <p>The imported scores are not an object. Correct the source report; the original value is retained.</p>}
    <p>Leave unmeasured functions empty. All four elemental functions are required; introversion and extroversion remain separate cap readings.</p>
  </details>;
}
function GateList({name, value, onChange}: {name: string; value: JsonValue | undefined; onChange: (value: JsonValue) => void}) {
  if (value === undefined) return <div><p>{name}: not supplied.</p><button type="button" className="oi-action" onClick={() => onChange([])}>Record {name.toLowerCase()} from my report</button></div>;
  if (!Array.isArray(value) && typeof value !== 'string') return <p className="nara-id-notice">{name} needs correction in Advanced report data.</p>;
  const raw = Array.isArray(value) ? value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ') : value;
  return <Field label={`${name} — comma-separated numbers, 1–64`}><input className="oi-input" value={raw} onChange={e => {
    const entered = e.target.value, parts = entered.trim().split(/[\s,]+/);
    onChange(!entered.trim() ? [] : parts.every(part => /^\d+$/.test(part)) ? parts.map(Number) : entered);
  }}/><small>{Array.isArray(value) && !value.length ? 'Explicitly recorded: no gates.' : 'Retain the gates recorded by the report. QL validates the list when you review.'}</small></Field>;
}
function AuthoredFields({data, set}: {data: Data; set: (key: string, value: JsonValue) => void}) {
  const [heading, setHeading] = useState('');
  return <section aria-label="Authored quintessence material"><h4>Authored material</h4>
    <p className="nara-id-muted">Use your source’s own headings and material. No fixed quintessence calculation or fields are imposed.</p>
    {Object.entries(data).map(([key, value]) => <AuthoredValue key={key} name={key} value={value} onChange={v => set(key, v)}/>)}
    <Field label="Add your own heading"><input className="oi-input" value={heading} onChange={e => setHeading(e.target.value)}/></Field>
    <button type="button" className="oi-action" disabled={!heading.trim() || Object.prototype.hasOwnProperty.call(data, heading.trim())} onClick={() => {set(heading.trim(), ''); setHeading('');}}>Add text field</button>
  </section>;
}
function AuthoredValue({name, value, onChange}: {name: string; value: JsonValue; onChange: (value: JsonValue) => void}) {
  const [emptyKind, setEmptyKind] = useState('string');
  const kind = value === null ? emptyKind : typeof value;
  return <div>
    {value === null && <Field label={`${name.replaceAll('_', ' ')} — value type`}><select className="oi-input" value={emptyKind} onChange={e => setEmptyKind(e.target.value)}><option value="string">Text</option><option value="number">Number</option><option value="boolean">Yes / no</option></select><small>Not supplied. Choosing a type does not add a value.</small></Field>}
    <Field label={name.replaceAll('_', ' ')}>
      {kind === 'string' ? <textarea className="oi-input" rows={3} value={value === null ? '' : String(value)} onChange={e => onChange(e.target.value)}/> : kind === 'number' ? <input className="oi-input" type="number" step="any" value={value === null ? '' : String(value)} onChange={e => {setEmptyKind('number'); onChange(e.target.value === '' ? null : Number(e.target.value));}}/> : kind === 'boolean' ? <select className="oi-input" value={value === null ? '' : String(value)} onChange={e => {setEmptyKind('boolean'); onChange(e.target.value === '' ? null : e.target.value === 'true');}}><option value="">Not supplied</option><option value="true">Yes</option><option value="false">No</option></select> : <small>Structured source material retained. Inspect or correct it in Advanced report data.</small>}
    </Field>
  </div>;
}
