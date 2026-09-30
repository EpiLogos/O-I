/** Read the native identity matrix without inventing assessments, scores or
 * mappings. Every supplied field remains inspectable, including nested reports. */
import React, {useEffect, useState} from 'react';
import type {IdentityReading, IdentityMatrixRow, JsonValue} from '../../../src/nara/identity/types';
import {OFFICE_NAMES} from '../../../src/nara/identity/profileDraft';
import './IdentityMatrix.css';

type Data = {[key: string]: JsonValue};
const object = (value: JsonValue | undefined): Data | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
const named: Record<string, string> = {
  birth: 'Birth circumstances', date: 'Birth date', time: 'Local birth time', precision: 'Time precision',
  uncertainty_minutes: 'Uncertainty (± minutes)', fold: 'Repeated clock occurrence', place: 'Birthplace',
  latitude_degrees: 'Latitude (degrees)', longitude_degrees: 'Longitude (degrees)', timezone: 'Timezone',
  system: 'Reported system', type: 'Reported type', identity: 'A / T identity',
  personality_gates: 'Personality gates', design_gates: 'Design gates', defined_centres: 'Defined BodyGraph centres',
  channels: 'Reported channels', spheres: 'Reported spheres', key: 'Gene Key', line: 'Line',
  abs_pos: 'Absolute longitude (degrees)', position: 'Position within sign (degrees)', retrograde: 'Retrograde', houses_system_name: 'House system', zodiac: 'Zodiac', conditional: 'Approximate-time reading',
};
function heading(key: string): string {return key.replace(/[_-]/g, ' ').replace(/^./, value => value.toUpperCase());}
function label(key: string): string {return named[key] ?? heading(key);}
function itemTitle(value: JsonValue, index: number): string {
  const data = object(value), title = data?.name ?? data?.title;
  return typeof title === 'string' || typeof title === 'number' ? String(title) : `Item ${index + 1}`;
}
function Kind({value}: {value: JsonValue}) {
  if (value === null) return <span className="nara-matrix-missing">Not supplied</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'string') return value.length ? <span className="nara-matrix-text">{value}</span> : <span className="nara-matrix-missing">Empty text supplied</span>;
  return <span className="nara-matrix-number">{String(value)}</span>;
}
/** Expand only the requested branches and page long lists. No truncation,
 * flattening, key loss, HTML interpretation, or imposed quintessence schema. */
function StructuredValue({value, depth = 0}: {value: JsonValue; depth?: number}) {
  const [count, setCount] = useState(12);
  if (value === null || typeof value !== 'object') return <Kind value={value}/>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="nara-matrix-missing">Explicitly supplied: empty list</span>;
    return <div className="nara-matrix-list"><ol>{value.slice(0, count).map((item, index) => <li key={index}>
      {item !== null && typeof item === 'object' ? <details open={depth === 0 && value.length <= 6}><summary>{Array.isArray(item) ? `Item ${index + 1} · ${item.length} values` : itemTitle(item, index)}</summary><StructuredValue value={item} depth={depth + 1}/></details> : <Kind value={item}/>}</li>)}</ol>
      {count < value.length && <button type="button" className="nara-matrix-more" onClick={() => setCount(count + 12)}>Read {Math.min(12, value.length - count)} more · {value.length - count} remaining</button>}</div>;
  }
  const entries = Object.entries(value);
  if (!entries.length) return <span className="nara-matrix-missing">Explicitly supplied: empty object</span>;
  return <div><dl className="nara-matrix-fields">{entries.slice(0, count).map(([key, entry]) => <div key={key}>
    <dt title={`Source field: ${key}`}>{label(key)}</dt><dd>{entry !== null && typeof entry === 'object'
      ? <details open={depth === 0}><summary>{Array.isArray(entry) ? `${entry.length} ${entry.length === 1 ? 'item' : 'items'}` : `${Object.keys(entry).length} source fields`}</summary><StructuredValue value={entry} depth={depth + 1}/></details>
      : <Kind value={entry}/>}</dd></div>)}</dl>
    {count < entries.length && <button type="button" className="nara-matrix-more" onClick={() => setCount(count + 12)}>Read {Math.min(12, entries.length - count)} more source fields · {entries.length - count} remaining</button>}</div>;
}
function Field({name, data}: {name: string; data: Data}) {
  return <div><dt>{label(name)}</dt><dd>{Object.prototype.hasOwnProperty.call(data, name) ? <StructuredValue value={data[name]}/> : <span className="nara-matrix-missing">Not supplied</span>}</dd></div>;
}
function Fields({data, names}: {data: Data; names: string[]}) {
  return <dl className="nara-matrix-fields">{names.map(name => <Field key={name} name={name} data={data}/>)}</dl>;
}
function Additional({data, used}: {data: Data; used: string[]}) {
  const extra = Object.fromEntries(Object.entries(data).filter(([key]) => !used.includes(key)));
  return Object.keys(extra).length ? <details className="nara-matrix-extra"><summary>Additional source material · {Object.keys(extra).length} fields</summary><StructuredValue value={extra}/></details> : null;
}
function Birth({data}: {data: Data}) {
  const birth=object(data.birth),place=object(birth?.place);
  return <>
    <Fields data={data} names={['name']}/>
    {birth&&<Fields data={birth} names={['date','time','precision',...(birth.precision==='approximate'?['uncertainty_minutes']:[])]}/>}
    {place&&<Fields data={place} names={['label','timezone']}/>}
    <details className="nara-matrix-extra"><summary>Coordinates, clock detail and original fields</summary><StructuredValue value={data}/></details>
  </>;
}
function Personality({data}: {data: Data}) {
  const fields = ['system', 'type', ...(Object.prototype.hasOwnProperty.call(data, 'identity') ? ['identity'] : [])];
  return <><Fields data={data} names={fields}/><p className="nara-matrix-note">The reported system remains part of the result. A / T belongs to a 16-personalities report.</p><Additional data={data} used={fields}/></>;
}
function GeneKeys({data}: {data: Data}) {
  return <><p className="nara-matrix-note">Sphere names, Gene Keys and lines are retained from the source report.</p><Fields data={data} names={['spheres']}/><Additional data={data} used={['spheres']}/></>;
}
function HumanDesign({data}: {data: Data}) {
  const fields = ['type', 'strategy', 'authority', 'profile', 'definition'];
  const bodyGraph = ['defined_centres', 'personality_gates', 'design_gates', 'channels'];
  return <><Fields data={data} names={fields}/><section className="nara-matrix-bodygraph"><h4>Nine-centre BodyGraph</h4><p className="nara-matrix-note">These are Human Design report fields. They are distinct from the seven chakral centres of the Expression; no equivalence or centre dynamics are inferred.</p><Fields data={data} names={bodyGraph}/></section><Additional data={data} used={[...fields, ...bodyGraph]}/></>;
}
function Natal({data, onShowNatal}: {data: Data; onShowNatal?: () => void}) {
  const chart = object(data.chart), svg = chart?.svg;
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (typeof svg !== 'string' || !svg) {setUrl(''); return;}
    const value = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'})); setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [svg]);
  const all = {...data};
  // The native SVG is a chart artifact, displayed as an inert image and offered
  // intact for download; it is not duplicated as thousands of markup fields.
  if (chart) all.chart = Object.fromEntries(Object.entries(chart).filter(([key]) => key !== 'svg'));
  return <>
    {chart ? <><Fields data={chart} names={['zodiac', 'houses_system_name', 'precision', 'conditional']}/>
      <p className="nara-matrix-note">{chart.conditional === true ? 'Conditional on the entered approximate birth time.' : 'Calculated from the entered birth circumstances.'}</p>
      <div className="nara-personal-actions">{onShowNatal && <button type="button" onClick={onShowNatal}>Open natal chart</button>}</div>
      {url && <details className="nara-matrix-chart"><summary>Inspect the calculated chart</summary><figure><img src={url} alt="Native calculated natal chart"/><figcaption><a href={url} download="natal-chart.svg">Download this exact calculated chart</a></figcaption></figure></details>}
      <details className="nara-matrix-extra"><summary>Planets, houses and angles</summary><Fields data={chart} names={['bodies', 'houses', 'angles']}/></details>
    </> : <p className="nara-matrix-missing">{typeof data.reason === 'string' ? data.reason : 'No calculated chart was returned for this input.'}</p>}
    <details className="nara-matrix-extra"><summary>Complete calculation fields and provider provenance</summary><StructuredValue value={all}/></details>
  </>;
}
function Office({row, onShowNatal}: {row: IdentityMatrixRow; onShowNatal?: () => void}) {
  const data = object(row.data);
  const route = row.route === 'entered-source' ? 'Entered by you' : row.route === 'self-report' ? 'Self-report' : row.route === 'import' ? 'Imported report' : row.route === 'calculation' ? 'Calculation' : row.route;
  return <section className="nara-matrix-office" aria-label={OFFICE_NAMES[row.kind] ?? label(row.kind)}>
    <header><div><p className="nara-personal-caption">{row.coordinate}</p><h3>{OFFICE_NAMES[row.kind] ?? label(row.kind)}</h3></div><span className="nara-matrix-route">{row.available ? route : 'Not available'}</span></header>
    {!row.available && <p className="nara-matrix-missing">{row.absence_reason ?? 'The native owner reports this office as unavailable.'}</p>}
    {row.kind === 'birthdate-name' && data ? <Birth data={data}/>
      : row.kind === 'natal-chart' && data ? <Natal data={data} onShowNatal={onShowNatal}/>
      : data && row.kind === 'jungian-assessment' ? <Personality data={data}/>
      : data && row.kind === 'human-design' ? <HumanDesign data={data}/>
      : data && row.kind === 'gene-keys' ? <GeneKeys data={data}/>
      : row.data !== null ? <StructuredValue value={row.data}/> : row.available ? <p className="nara-matrix-missing">This office is marked available, but its source value is null.</p> : null}
    <details className="nara-matrix-attribution"><summary>Source and method</summary><dl className="nara-matrix-fields">
      <div><dt>Route</dt><dd>{route}</dd></div><div><dt>Method</dt><dd>{row.method ?? (row.kind === 'natal-chart' ? 'See the native calculation’s provider provenance.' : 'No separate method supplied')}</dd></div>
      <div><dt>Source</dt><dd>{row.source?.source_ref ?? 'No available source'}</dd></div><div><dt>Source revision</dt><dd>{row.source?.revision ?? 'Not supplied'}</dd></div><div><dt>Standing</dt><dd>{row.source?.standing_ref ?? 'Not supplied'}</dd></div>
    </dl></details>
  </section>;
}
export function IdentityMatrix({reading, onShowNatal}: {reading: IdentityReading | null; onShowNatal?: () => void}) {
  if (!reading) return <div className="nara-personal-empty"><h2>Your identity matrix</h2><p>Enter and review an identity to inspect its six offices and their actual source material.</p></div>;
  return <article className="nara-identity-matrix" key={`${reading.person_ref}:${reading.input_revision}`}>
    <header className="nara-matrix-heading"><p className="nara-personal-caption">{reading.profile.name}</p><h2>The identity material, together.</h2><p>Read what has been supplied, what was calculated and what remains unknown. Each office keeps its own source and method.</p></header>
    <div className="nara-matrix-offices">{reading.matrix.map((row, index) => <Office key={`${row.coordinate}:${row.kind}:${index}`} row={row} onShowNatal={onShowNatal}/>)}</div>
    <p className="nara-matrix-note">These offices are source material for this person. Their presence does not imply that a complete integrated identity quaternion or seven-centre response has been determined.</p>
  </article>;
}
