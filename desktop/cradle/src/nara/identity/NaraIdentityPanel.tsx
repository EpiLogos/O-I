import {useEffect, useId, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {useKernel} from '../../kernel/KernelProvider';
import {naraIdentity} from './client';
import {clearCurrentIdentity, selectCurrentIdentity, useCurrentIdentity} from './current';
import {ReportFields} from './ReportFields';
import type {
  IdentityReading, IdentityReport, IdentitySource, JsonValue,
  NatalComposition, NatalResult, ReportKey, SavedIdentity, TimePrecision,
} from './types';
import './identity.css';

import {REPORTS, OFFICE_NAMES, reportDraft, objectJson, newDraft, draftFromProfile, profileFromDraft, changeReportRoute} from './profileDraft';
import type {ReportDraft, IdentityDraft} from './profileDraft';
export {draftFromProfile, profileFromDraft, changeReportRoute} from './profileDraft';
export type {IdentityDraft} from './profileDraft';

function Field({label, hint, children}: {label: string; hint?: string; children: ReactNode}) {
  return <label className="oi-field nara-id-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function DataReading({value}: {value: JsonValue}) {
  if (value === null) return <span className="nara-id-muted">Not supplied</span>;
  if (typeof value !== 'object') return <span>{String(value)}</span>;
  if (Array.isArray(value)) return value.length ? <ul className="nara-id-data-list">{value.map((v, i) => <li key={i}><DataReading value={v}/></li>)}</ul> : <span className="nara-id-muted">None recorded</span>;
  return <dl className="nara-id-data">{Object.entries(value).map(([key, v]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd><DataReading value={v}/></dd></div>)}</dl>;
}
function ReportEditor({reportKey, value, onChange, onError}: {
  reportKey: ReportKey; value: ReportDraft; onChange: (value: ReportDraft) => void; onError: (value: string) => void;
}) {
  const definition = REPORTS.find(r => r.key === reportKey)!;
  const fileInput = useRef<HTMLInputElement>(null);
  const [importText, setImportText] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const currentValue = useRef(value);
  currentValue.current = value;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const set = (key: keyof ReportDraft, v: string) => onChange({...value, [key]: v});
  const useImport = (raw: string) => {
    try {
      if (new TextEncoder().encode(raw).length > 256 * 1024) throw new Error('The import is larger than 256 KiB.');
      const parsed = objectJson(raw, definition.title);
      if (parsed.route !== 'import' || !parsed.source || typeof parsed.source !== 'object' || Array.isArray(parsed.source)
          || typeof parsed.source.source_ref !== 'string' || typeof parsed.source.revision !== 'string'
          || typeof parsed.source.standing_ref !== 'string' || typeof parsed.method !== 'string'
          || !parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
        throw new Error('Import a complete report with source (source_ref, revision, standing_ref), method, route: "import", and data.');
      }
      if (Object.keys(parsed).some(k => !['source', 'method', 'route', 'data'].includes(k))) throw new Error('The report has unsupported fields; preserve the native report shape.');
      if (Object.keys(parsed.source).some(k => !['source_ref', 'revision', 'standing_ref'].includes(k))) throw new Error('The source attribution contains fields outside the native source schema. They have not been discarded; correct the report before importing. Additional report material belongs in data.');
      onChange(reportDraft(parsed as unknown as IdentityReport));
      setImportText(raw);
      setImportNotice('Imported. Review the reported fields and attribution below, then use Inspect identity for native validation.');
      onError('');
    } catch (error) { onError(error instanceof Error ? error.message : String(error)); }
  };
  return <details className="nara-id-report">
    <summary>{definition.title}<span className="nara-id-muted">{value.enabled ? value.route === 'self-report' ? 'Self-report' : 'Import route' : 'Not supplied'}</span></summary>
    <p className="nara-id-muted">{definition.description}</p>
    {(value.route === 'import' || !value.enabled) && <div className="nara-id-import">
      <button type="button" className="oi-action" data-primary="true" onClick={() => fileInput.current?.click()}>Import {definition.title} file</button>
      <p className="nara-id-muted">Choose an attributable report in the native JSON format, including its source, revision, standing and method. Maximum 256 KiB.</p>
      {importNotice && <p role="status">{importNotice}</p>}
      <input ref={fileInput} className="nara-id-file-input" type="file" accept="application/json,.json" aria-label={`Import ${definition.title}`} onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = '';
        if (!file) return;
        if (file.size > 256 * 1024) { onError('The import is larger than 256 KiB.'); return; }
        const basis = value;
        try {
          const raw = await file.text();
          if (!mounted.current) return;
          if (currentValue.current !== basis) { onError('The report changed while the file was being read. Import it again to replace the current report.'); return; }
          useImport(raw);
        } catch { if (mounted.current) onError('The selected file could not be read.'); }
      }}/>
      <details><summary>Paste a complete report instead</summary>
        <Field label="Complete report JSON" hint="source, method, route: import, and data."><textarea className="oi-input" rows={5} spellCheck={false} value={importText} onChange={e => setImportText(e.target.value)}/></Field>
        <button type="button" className="oi-action" onClick={() => useImport(importText)}>Import pasted report</button>
      </details>
    </div>}
    <label className="nara-id-check"><input type="checkbox" checked={value.enabled} onChange={e => onChange({...value, enabled: e.target.checked})}/> Include this material</label>
    {value.enabled && <>
      {(reportKey === 'jungian' || reportKey === 'quintessence') && <Field label="Source route"><select className="oi-input" value={value.route} onChange={e => {
        try {onChange(changeReportRoute(reportKey, value, e.target.value as ReportDraft['route'])); onError('');}
        catch (error) {onError(error instanceof Error ? error.message : String(error));}
      }}><option value="import">Attributable import</option><option value="self-report">My own report</option></select></Field>}
      {(reportKey !== 'jungian' || value.route === 'import') && <ReportFields kind={reportKey} raw={value.data} onChange={data => set('data', data)}/>}
      {reportKey === 'jungian' && value.route === 'self-report' && <div className="nara-id-grid">
        <Field label="Reported system"><select className="oi-input" value={value.system} onChange={e => onChange({...value, system: e.target.value, identity: ''})}><option value="">Choose a system</option><option value="jungian">Jungian</option><option value="mbti">MBTI</option><option value="16-personalities">16-personalities</option></select></Field>
        <Field label="Four-letter type"><input className="oi-input" maxLength={4} value={value.type} autoCapitalize="characters" onChange={e => set('type', e.target.value.toUpperCase())}/></Field>
        {value.system === '16-personalities' && <Field label="Reported A / T identity"><select className="oi-input" value={value.identity} onChange={e => set('identity', e.target.value)}><option value="">Not supplied</option><option value="A">A — Assertive</option><option value="T">T — Turbulent</option></select></Field>}
      </div>}
      <div className="nara-id-grid">
        <Field label="Source reference"><input className="oi-input" value={value.source} onChange={e => set('source', e.target.value)}/></Field>
        <Field label="Source revision"><input className="oi-input" value={value.revision} onChange={e => set('revision', e.target.value)}/></Field>
        <Field label="Source standing"><input className="oi-input" value={value.standing} onChange={e => set('standing', e.target.value)}/></Field>
        <Field label="Method / provider"><input className="oi-input" value={value.method} onChange={e => set('method', e.target.value)}/></Field>
      </div>
      {!(reportKey === 'jungian' && value.route === 'self-report') && <details><summary>Advanced report data</summary><p className="nara-id-muted">The complete imported data is preserved here, including additional fields. Editing the form changes only the fields you choose. QL validates the report when you review the identity.</p><Field label="Report data JSON"><textarea className="oi-input" rows={7} spellCheck={false} value={value.data} onChange={e => set('data', e.target.value)}/></Field></details>}
    </>}
  </details>;
}
function NatalChart({natal}: {natal: NatalResult}) {
  const [image, setImage] = useState<{svg: string; url: string} | null>(null);
  const enlarged = useRef<HTMLDialogElement>(null);
  const svg = natal.chart?.svg;
  useEffect(() => {
    enlarged.current?.close();
    if (!svg) { setImage(null); return; }
    const next = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
    setImage({svg, url: next});
    return () => URL.revokeObjectURL(next);
  }, [svg]);
  const url = image?.svg === svg ? image?.url : null;
  const unavailable: Record<string, string> = {
    'incomplete-birth-date': 'A complete birth date is needed to calculate the chart.',
    'unknown-birth-time': 'Birth time is unknown. No clock time, ascendant or houses have been invented.',
    'missing-birthplace': 'Enter the birthplace coordinates, timezone and source to calculate the chart.',
    'chart-latitude-outside-unadjusted-provider-range': 'Planetary positions are calculated. This provider cannot draw houses at this latitude without relocating the birthplace, so no chart is shown.',
  };
  return <section className="nara-id-natal" aria-label="Calculated natal chart">
    <h3>Natal chart</h3>
    {natal.reason && <p>{unavailable[natal.reason] ?? natal.reason}</p>}
    {natal.chart && <>
      <p className="nara-id-muted">{natal.chart.zodiac} · {natal.chart.houses_system_name} houses · Kerykeion {natal.provider.kerykeion_version}</p>
      {natal.chart.conditional && <p className="nara-id-notice">Approximate birth time, ±{natal.chart.uncertainty_minutes} minutes. The displayed angles and houses are conditional on the entered time.</p>}
      {natal.time_resolution && <p className="nara-id-muted">Entered time: <time>{natal.time_resolution.local_datetime}</time> · {natal.time_resolution.timezone}. The chart labels show UTC.</p>}
      {url && <img className="nara-id-chart" src={url} alt={`${natal.chart.conditional ? 'Approximate n' : 'N'}atal chart calculated by Kerykeion for the entered birth details`}/>}
      {url && <>
        <button type="button" className="oi-action" onClick={() => enlarged.current?.showModal()}>Enlarge natal chart</button>
        <dialog ref={enlarged} className="nara-id-chart-dialog" aria-label="Enlarged natal chart">
          <header><h3>{natal.chart.conditional ? 'Approximate natal chart' : 'Natal chart'}</h3><button type="button" className="oi-action" autoFocus onClick={() => enlarged.current?.close()}>Close chart</button></header>
          <div className="nara-id-chart-scroll"><img src={url} alt="Full-size Kerykeion natal chart for the entered birth details"/></div>
        </dialog>
      </>}
    </>}
    {natal.sky && <details><summary>Calculated planetary positions</summary><div className="nara-id-table-scroll"><table><caption>Geocentric ecliptic longitudes at {natal.epoch_utc}</caption><thead><tr><th scope="col">Body</th><th scope="col">Longitude</th><th scope="col">Motion</th></tr></thead><tbody>{natal.sky.bodies.map(body => <tr key={body.body}><th scope="row">{body.body}</th><td>{body.longitude_degrees.toFixed(6)}°</td><td>{body.retrograde ? 'Retrograde' : 'Direct'}</td></tr>)}</tbody></table></div></details>}
  </section>;
}
function CompositionReading({value}: {value: NatalComposition}) {
  const number = (v: number) => v.toLocaleString(undefined, {maximumFractionDigits: 5});
  return <div className="nara-id-native-composition">
    <h4>Natal elemental balance</h4>
    <p className="nara-id-muted">The native calculation applies its source-defined planetary weights and dignity multipliers. The percentages below are the normalized natal contribution.</p>
    <dl className="nara-id-elements">{value.basis_order.map((element, i) => <div key={element}><dt>{element}</dt><dd>{(value.elemental_balance_l1[i] * 100).toFixed(2)}<small>%</small></dd></div>)}</dl>
    <p><strong>Natal quaternion</strong> <code className="nara-id-quaternion">({number(value.q_natal.w)}, {number(value.q_natal.x)}, {number(value.q_natal.y)}, {number(value.q_natal.z)})</code></p>
    <p className="nara-id-muted">Components follow {value.basis_order.join(', ')}. This is the natal contribution. The other identity constituents have not yet been combined with it into a full identity.</p>
    <details><summary>Planetary weighting</summary><div className="nara-id-table-scroll"><table><caption>Retained model weights, adjusted by the source dignity rule</caption><thead><tr><th scope="col">Body / sign</th><th scope="col">Element</th><th scope="col">Weight</th><th scope="col">Dignity</th><th scope="col">Contribution</th></tr></thead><tbody>{value.planetary_contributions.map(p => <tr key={p.native_planet_id}><th scope="row">{p.body}<small className="nara-id-table-note">{p.sign}</small></th><td>{p.element}</td><td>{number(p.keplerian_weight)}</td><td>{p.dignity} × {p.dignity_multiplier}</td><td>{number(p.weighted_contribution)}</td></tr>)}</tbody></table></div></details>
    <h4>Seven-centre evidence distribution</h4><p className="nara-id-muted">Planetary evidence follows the native body relationships. The Sun remains the parent, and Earth remains the grounding anchor.</p>
    <div className="nara-id-table-scroll"><table><caption>Independent evidence totals in {value.basis_order.join(', ')} order</caption><thead><tr><th scope="col">Centre</th><th scope="col">Related bodies</th><th scope="col">Evidence</th></tr></thead><tbody>{value.centre_evidence.map(c => <tr key={c.ordinal}><th scope="row">{c.label}</th><td>{c.planet_ids.map(id => value.planetary_contributions.find(p => p.native_planet_id === id)?.body ?? `Native body ${id}`).join(', ') || 'No mapped planetary evidence'}</td><td>{c.raw_efwa_evidence.map(number).join(' · ')}</td></tr>)}</tbody></table></div>
    <p className="nara-id-muted">These evidence totals do not yet determine how each centre moves, sounds or couples to the others. A personal Expression cannot be activated from this reading alone.</p>
    <details><summary>Composition source</summary><dl className="nara-id-provenance"><div><dt>Policy</dt><dd>{value.policy}</dd></div><div><dt>Repository</dt><dd>{value.policy_source.repository}</dd></div><div><dt>Source</dt><dd>{value.policy_source.path}</dd></div><div><dt>Revision</dt><dd>{value.policy_source.revision}</dd></div></dl><p className="nara-id-muted">{value.policy_source.standing}</p><p className="nara-id-muted">{value.dynamics_standing}</p></details>
  </div>;
}
function IdentityMatrix({reading}: {reading: IdentityReading}) {
  return <section className="nara-id-matrix" aria-label="Full identity matrix">
    <h3>Full identity matrix</h3><p className="nara-id-muted">Each constituent keeps its source, route and availability. Missing material stays visible.</p>
    {reading.matrix.map(row => <details className="nara-id-matrix-row" key={row.coordinate}>
      <summary><span><small>{row.coordinate}</small>{OFFICE_NAMES[row.kind] ?? row.kind.replaceAll('-', ' ')}</span><span className="nara-id-muted">{row.available ? row.route.replaceAll('-', ' ') : 'Not supplied'}</span></summary>
      {!row.available && <p>{row.absence_reason ?? 'Not supplied'}</p>}
      {row.source && <dl className="nara-id-provenance"><div><dt>Source</dt><dd>{row.source.source_ref}</dd></div><div><dt>Revision</dt><dd>{row.source.revision}</dd></div><div><dt>Standing</dt><dd>{row.source.standing_ref}</dd></div>{row.method && <div><dt>Method</dt><dd>{row.method}</dd></div>}</dl>}
      {row.kind === 'natal-chart' ? <p className="nara-id-muted">The chart and planetary positions are shown below.</p> : row.available && <DataReading value={row.data}/>}
    </details>)}
    <details className="nara-id-composition"><summary>How this identity is composed</summary>
      <p>Identity material, the dated event and current activity remain distinct contributions. An identity digest records the supplied sources; it does not stand in for a quaternion or a centre calculation.</p>
      <p className="nara-id-muted">{reading.material.standing}</p>
      {reading.natal_composition != null ? <CompositionReading value={reading.natal_composition}/> : <p>The native owner has not returned a natal composition for this reading.</p>}
      <details><summary>Exact identity basis</summary><dl className="nara-id-provenance"><div><dt>Input revision</dt><dd>{reading.input_revision}</dd></div><div><dt>Material digest</dt><dd>{reading.material.value}</dd></div></dl></details>
    </details>
    {reading.natal && <NatalChart natal={reading.natal}/>}
  </section>;
}

export function NaraIdentityPanel({onEnter}: {onEnter?: (reading: IdentityReading) => void | Promise<void>}) {
  const {transport} = useKernel();
  const activeIdentity = useCurrentIdentity();
  const previousDraft = useRef('');
  const uid = useId();
  const [draft, setDraft] = useState<IdentityDraft | null>(null);
  const [reading, setReading] = useState<IdentityReading | null>(null);
  const [readingDraft, setReadingDraft] = useState('');
  const [savedDraft, setSavedDraft] = useState('');
  const [source, setSource] = useState<IdentitySource | null>(null);
  const [profiles, setProfiles] = useState<SavedIdentity[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [listError, setListError] = useState('');
  const [sourceErrors, setSourceErrors] = useState<Array<{source_ref: string; error: string}>>([]);
  const [switchTo, setSwitchTo] = useState<{kind: 'new'} | {kind: 'open'; source_ref: string} | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    void naraIdentity(transport, {operation: 'list'}).then(result => {
      if (current) { setProfiles(result.profiles ?? []); setSourceErrors(result.errors ?? []); setListError(''); }
    }).catch(e => { if (current) setListError(e instanceof Error ? e.message : String(e)); });
    return () => { current = false; };
  }, [transport]);
  const encodedDraft = draft ? JSON.stringify(draft) : '';
  useEffect(() => {
    if (draft && previousDraft.current && previousDraft.current !== encodedDraft && draft.person_ref === activeIdentity?.reading.person_ref) clearCurrentIdentity(draft.person_ref);
    previousDraft.current = encodedDraft;
  }, [encodedDraft, draft?.person_ref, activeIdentity?.reading.person_ref]);
  const dirty = draft !== null && encodedDraft !== savedDraft;
  const currentReading = reading !== null && encodedDraft === readingDraft;
  const perform = async (label: string, action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(label); setError(''); setNotice('');
    try { await action(); } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(''); }
  };
  const startNew = () => {
    const value = newDraft();
    setDraft(value); setSavedDraft(JSON.stringify(value)); setReading(null); setReadingDraft('');
    setSource(null); setSelected(''); setError(''); setNotice('New private identity material. Nothing is saved yet.'); setSwitchTo(null);
  };
  const open = (source_ref: string) => void perform('Opening profile', async () => {
    const result = await naraIdentity(transport, {operation: 'open', source_ref});
    if (!result.reading || !result.source) throw new Error('Central did not return the saved profile and its revision.');
    if (!mounted.current) return;
    const value = draftFromProfile(result.reading.profile);
    clearCurrentIdentity(result.reading.person_ref);
    setDraft(value); setSavedDraft(JSON.stringify(value)); setReadingDraft(JSON.stringify(value));
    setReading(result.reading); setSource(result.source); setSelected(result.source.source_ref); setSwitchTo(null);
    setNotice('Saved profile reopened. Calculate the natal chart from this input when needed.');
  });
  const switchProfile = (next: NonNullable<typeof switchTo>) => {
    if (dirty) { setSwitchTo(next); return; }
    if (next.kind === 'new') startNew(); else open(next.source_ref);
  };
  const inspect = (operation: 'inspect' | 'calculate') => void perform(operation === 'calculate' ? 'Calculating natal chart' : 'Inspecting identity', async () => {
    if (!draft) return;
    const profile = profileFromDraft(draft);
    const result = await naraIdentity(transport, {operation, profile});
    if (!result.reading) throw new Error('The native owner did not return an identity reading.');
    if (!mounted.current) return;
    // A new derived reading is not the previously reviewed selection, even
    // when its authored input revision is unchanged. Carry it only after review.
    clearCurrentIdentity(result.reading.person_ref);
    setReading(result.reading); setReadingDraft(JSON.stringify(draft));
    setNotice(operation === 'calculate' ? result.reading.natal?.status === 'available' ? 'Natal chart calculated from this identity input.' : 'The native reading records which natal data is available.' : 'Identity sources inspected.');
  });
  const save = () => void perform('Saving profile', async () => {
    if (!draft) return;
    const result = await naraIdentity(transport, {operation: 'save', profile: profileFromDraft(draft),
      source_ref: source?.source_ref ?? null, expected_revision: source?.revision ?? null});
    if (!result.source || !result.reading) throw new Error('Central did not confirm the saved source and reading. Your edits remain here.');
    if (!mounted.current) return;
    setSource(result.source); setSelected(result.source.source_ref); setSavedDraft(JSON.stringify(draft));
    // Saving source must not discard a matching calculated result already held
    // in this view; derived output is never sent to Central as authored profile.
    if (!currentReading || reading?.input_revision !== result.reading.input_revision) {
      setReading(result.reading); setReadingDraft(JSON.stringify(draft));
    }
    setProfiles(old => [...old.filter(p => p.source_ref !== result.source!.source_ref),
      {...result.source!, name: result.reading!.profile.name, person_ref: result.reading!.person_ref}]);
    setNotice('Profile saved in Central.');
  });
  const edit = (key: keyof IdentityDraft, value: string) => { if (draft) setDraft({...draft, [key]: value}); };
  const editPlace = (key: keyof IdentityDraft['place'], value: string) => { if (draft) setDraft({...draft, place: {...draft.place, [key]: value}}); };

  return <section className="nara-identity-panel" aria-labelledby={`${uid}-title`} aria-busy={!!busy}>
    <header className="nara-id-header"><div><p className="oi-eyebrow">Personal · Identity</p><h2 id={`${uid}-title`}>Identity & Expression</h2><p className="nara-id-muted">Review the material that belongs to this person, then carry its native reading into Expression.</p></div><button type="button" className="oi-action" disabled={!!busy} onClick={() => switchProfile({kind: 'new'})}>New profile</button></header>
    <div className="nara-id-saved"><Field label="Saved profiles"><select className="oi-input" value={selected} disabled={!!busy} onChange={e => setSelected(e.target.value)}><option value="">Choose a saved profile</option>{profiles.map(p => <option key={p.source_ref} value={p.source_ref}>{p.name}</option>)}</select></Field><button type="button" className="oi-action" disabled={!selected || !!busy} onClick={() => switchProfile({kind: 'open', source_ref: selected})}>Open</button><button type="button" className="oi-action" disabled={!!busy} onClick={() => void perform('Refreshing profiles', async () => {const result = await naraIdentity(transport, {operation: 'list'}); if (mounted.current) {setProfiles(result.profiles ?? []); setSourceErrors(result.errors ?? []); setListError('');}})}>Refresh</button></div>
    {listError && <p className="nara-id-muted">Saved profiles unavailable: {listError}</p>}
    {sourceErrors.length > 0 && <details className="oi-disclosure"><summary>{sourceErrors.length} saved {sourceErrors.length === 1 ? "source could" : "sources could"} not be opened</summary><ul>{sourceErrors.map(item => <li key={item.source_ref}><span className="oi-ref">{item.source_ref}</span>: {item.error}</li>)}</ul></details>}
    {switchTo && <div className="nara-id-notice" role="group" aria-label="Unsaved profile changes"><p>There are unsaved edits in this profile.</p><div className="nara-id-actions"><button type="button" className="oi-action" onClick={() => setSwitchTo(null)}>Keep editing</button><button type="button" className="oi-action" disabled={!!busy} onClick={() => { if (switchTo.kind === 'new') startNew(); else open(switchTo.source_ref); }}>Discard edits and {switchTo.kind === 'new' ? 'start new' : 'open saved profile'}</button></div></div>}
    <div className="nara-id-status" aria-live="polite">{busy || notice}</div>
    {error && <p className="nara-id-error" role="alert">{error}</p>}
    {!draft ? <p className="nara-id-empty">Open saved identity material or create a new profile to begin.</p> : <>
      <div className="nara-id-workspace"><form onSubmit={e => {e.preventDefault(); inspect('inspect');}}>
        <fieldset disabled={!!busy}><legend>Identity material</legend>
          <Field label="Name"><input className="oi-input" autoComplete="off" value={draft.name} onChange={e => edit('name', e.target.value)}/></Field>
          <div className="nara-id-grid"><Field label="Birth date" hint="YYYY-MM-DD, YYYY-MM or YYYY. Leave empty if unknown."><input className="oi-input" inputMode="numeric" value={draft.date} onChange={e => edit('date', e.target.value)}/></Field><Field label="Time precision"><select className="oi-input" value={draft.precision} onChange={e => setDraft({...draft, precision: e.target.value as TimePrecision, ...(e.target.value === 'unknown' ? {time: '', uncertainty: '', fold: ''} : e.target.value === 'exact' ? {uncertainty: ''} : {})})}><option value="unknown">Unknown</option><option value="exact">Exact as reported</option><option value="approximate">Approximate</option></select></Field></div>
          {draft.precision !== 'unknown' && <div className="nara-id-grid"><Field label="Local birth time" hint="HH:MM or HH:MM:SS"><input className="oi-input" inputMode="numeric" value={draft.time} onChange={e => edit('time', e.target.value)}/></Field>{draft.precision === 'approximate' && <Field label="Uncertainty ± minutes"><input className="oi-input" type="number" min={1} max={1440} step={1} value={draft.uncertainty} onChange={e => edit('uncertainty', e.target.value)}/></Field>}<Field label="Repeated clock time" hint="Only choose earlier or later if the timezone repeats this local time."><select className="oi-input" value={draft.fold} onChange={e => edit('fold', e.target.value)}><option value="">Not specified</option><option value="0">Earlier occurrence</option><option value="1">Later occurrence</option></select></Field></div>}
          <h3>Birthplace</h3><p className="nara-id-muted">Use the actual place, coordinates and IANA timezone from your source. Leave the whole section empty if unknown.</p>
          <Field label="Place name"><input className="oi-input" value={draft.place.label} onChange={e => editPlace('label', e.target.value)}/></Field>
          <div className="nara-id-grid"><Field label="Latitude"><input className="oi-input" type="number" step="any" min={-90} max={90} value={draft.place.latitude} onChange={e => editPlace('latitude', e.target.value)}/></Field><Field label="Longitude"><input className="oi-input" type="number" step="any" min={-180} max={180} value={draft.place.longitude} onChange={e => editPlace('longitude', e.target.value)}/></Field><Field label="IANA timezone" hint="Use the named timezone in the birth record or geocoding source."><input className="oi-input" value={draft.place.timezone} onChange={e => editPlace('timezone', e.target.value)}/></Field><Field label="Place / coordinate source"><input className="oi-input" value={draft.place.source} onChange={e => editPlace('source', e.target.value)}/></Field></div>
          <h3>Identity constituents</h3>{REPORTS.map(r => <ReportEditor key={`${draft.person_ref}:${r.key}`} reportKey={r.key} value={draft.reports[r.key]} onChange={value => setDraft(current => current?.person_ref === draft.person_ref ? {...current, reports: {...current.reports, [r.key]: value}} : current)} onError={setError}/>)}
          <div className="nara-id-actions nara-id-primary-actions"><button className="oi-action" type="submit">Inspect identity</button><button className="oi-action" type="button" onClick={() => inspect('calculate')}>Calculate natal chart</button><button className="oi-action" type="button" onClick={save}>Save profile</button></div>
        </fieldset>
      </form><div className="nara-id-reading">{reading ? <>{!currentReading && <p className="nara-id-notice">This reading belongs to the earlier input. Inspect or recalculate to include your changes.</p>}<IdentityMatrix reading={reading}/></> : <div className="nara-id-empty"><h3>Review the full identity</h3><p>Inspect the entered sources to see all six constituents, their evidence and what is still absent.</p></div>}</div></div>
      <footer className="nara-id-footer"><div><p>{source ? dirty ? 'Unsaved changes' : 'Saved in Central' : 'Not saved yet'}</p>{source && <details><summary>Saved source</summary><dl className="nara-id-provenance"><div><dt>Reference</dt><dd>{source.source_ref}</dd></div><div><dt>Revision</dt><dd>{source.revision}</dd></div></dl></details>}</div><button type="button" className="oi-action" disabled={!source || dirty || !currentReading || !!busy} onClick={() => {if (reading && source && currentReading && !dirty) {selectCurrentIdentity(reading, source); setNotice("This saved identity is selected for Nara. Open Nara to continue in the same personal Expression.");}}}>{activeIdentity && source && reading && activeIdentity.source.source_ref === source.source_ref && activeIdentity?.source.revision === source?.revision && activeIdentity.reading === reading ? "Selected for Nara" : "Use this identity"}</button>{onEnter && <button type="button" className="oi-action" data-primary="true" disabled={!currentReading || !!busy} onClick={() => void perform('Entering Expression', async () => {if (reading && currentReading) await onEnter(reading);})}>Enter personal Expression</button>}</footer>
    </>}
  </section>;
}
