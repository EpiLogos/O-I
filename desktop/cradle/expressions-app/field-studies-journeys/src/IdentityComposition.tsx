import React, {useState} from 'react';
import type {BirthdateEncoding, DecanicReading, EncodingPolicy, IdentityReading, NatalComposition, IdentityCompositionPolicy} from '../../../src/nara/identity/types';

const elements = ['Earth', 'Fire', 'Water', 'Air'];
const number = (value: number) => value.toLocaleString(undefined, {maximumFractionDigits: 6});
const coefficients: [keyof EncodingPolicy, string][] = [
  ['full_pass_factor', 'Full lens pass'], ['anchor_factor', 'Direct anchor'],
  ['inverse_factor', 'Inverse position'], ['square_factor', 'Square diffusion'],
  ['mobius_factor', 'Möbius return'], ['spanda_factor', 'Direct / conjugate partner'],
  ['tritone_factor', 'Tritone mirror'], ['position_element_factor', 'Position element'],
  ['lens_element_factor', 'Lens element'], ['cap_factor', 'Aether / Mineral caps'],
  ['direct_element_multiplier', 'Direct alchemical multiplier'],
];
function Balance({values, name}: {values: number[]; name: string}) {
  return <div className="nara-element-reading" aria-label={`${name} elemental proportions`}>{elements.map((element, i) => <div key={element}>
    <div><span>{element}</span><strong>{values[i] > 0 && values[i] < .001 ? '<0.1' : (values[i] * 100).toFixed(1)}%</strong></div>
    <meter min={0} max={1} value={values[i]} aria-label={`${element} ${name} proportion`}/>
  </div>)}</div>;
}
function Policy({reading, disabled, onUse}: {reading: BirthdateEncoding; disabled: boolean; onUse?: (policy: EncodingPolicy) => void}) {
  const [value, setValue] = useState(() => structuredClone(reading.policy));
  const [raw, setRaw] = useState(''), [error, setError] = useState('');
  const change = (next: EncodingPolicy) => {
    setValue({...next, policy_ref: `personal:encoding-policy:${crypto.randomUUID()}`});
    setRaw(''); setError('');
  };
  return <details className="nara-personal-depth"><summary>Calculation policy and calibration</summary>
    <p>The source supplies provisional coefficients. This reading {reading.selected ? 'uses the policy saved with this profile' : 'previews the draft policy; it is not a saved personal choice'}. Its numerical result is a contribution, not a questionnaire assessment.</p>
    <ul>{reading.policy_notes.map(note => <li key={note}>{note}</li>)}</ul>
    <fieldset disabled={disabled}><legend>Name/date policy</legend>
      <label>Y in the supplied name <select value={value.y_policy} onChange={event => change({...value, y_policy: event.target.value as EncodingPolicy['y_policy']})}><option value="consonant">Consonant</option><option value="vowel">Vowel</option></select></label>
      <details><summary>Refraction and elemental coefficients</summary><div className="nara-table-scroll"><table><thead><tr><th>Contribution</th><th>Coefficient</th></tr></thead><tbody>{coefficients.map(([key, title]) => <tr key={key}><th scope="row">{title}</th><td><input aria-label={title} type="number" min={0} step="any" value={value[key] as number} onChange={event => {const n = event.target.valueAsNumber;if (Number.isFinite(n) && n >= 0) change({...value, [key]: n});}}/></td></tr>)}</tbody></table></div></details>
      <details><summary>Datum weights and lens affinities</summary><p>Every included datum has its own weight and twelve explicit affinities. Missing rows retain numeric evidence without supplying a numerical contribution.</p><div className="nara-table-scroll"><table><thead><tr><th>Datum</th><th>Weight</th>{reading.lens_order.map(lens => <th key={lens}>{lens.replace('p', '′')}</th>)}</tr></thead><tbody>{Object.entries(value.roles).map(([role, policy]) => <tr key={role}><th scope="row">{role.replaceAll('_', ' ')}</th><td><input aria-label={`${role} weight`} type="number" min={0} step="any" value={policy.weight} onChange={event => {const n = event.target.valueAsNumber;if (Number.isFinite(n) && n >= 0) change({...value, roles: {...value.roles, [role]: {...policy, weight: n}}});}}/></td>{policy.lens_affinities.map((affinity, i) => <td key={i}><input aria-label={`${role} ${reading.lens_order[i]} affinity`} type="number" min={0} step="any" value={affinity} onChange={event => {const n = event.target.valueAsNumber;if (Number.isFinite(n) && n >= 0) change({...value, roles: {...value.roles, [role]: {...policy, lens_affinities: policy.lens_affinities.map((v, j) => i === j ? n : v)}}});}}/></td>)}</tr>)}</tbody></table></div></details>
      {onUse && <button type="button" onClick={() => onUse(value)}>Use this policy and review the identity</button>}
      <details><summary>Complete policy data</summary><p>For an explicitly specified policy with additional datum roles, edit the complete native configuration. The native owner validates it during recalculation.</p><textarea aria-label="Complete name and date policy" rows={9} spellCheck={false} value={raw || JSON.stringify(value, null, 2)} onChange={event => setRaw(event.target.value)}/>{onUse && <button type="button" onClick={() => {try {const parsed = JSON.parse(raw || JSON.stringify(value));if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('A policy must be an object.');onUse(parsed as EncodingPolicy);} catch (failure) {setError(failure instanceof Error ? failure.message : String(failure));}}}>Review this policy data</button>}{error && <p role="alert">{error}</p>}</details>
    </fieldset>
    <dl><dt>Source</dt><dd>{reading.source.repository} / {reading.source.path}</dd><dt>Source commit</dt><dd>{reading.source.commit}</dd><dt>Source blob</dt><dd>{reading.source.blob}</dd><dt>Standing</dt><dd>{reading.source.standing}</dd></dl>
  </details>;
}
function NameDate({reading, disabled, onUse}: {reading: BirthdateEncoding; disabled: boolean; onUse?: (policy: EncodingPolicy) => void}) {
  return <section><h3>Supplied name and birth date</h3><p>The numeric reading passes through twelve lenses and their six positions before elemental extraction. The supplied name is not assumed to be a birth or received name.</p>
    {reading.elemental.balance_efwa && <Balance values={reading.elemental.balance_efwa} name="name and date"/>}
    {reading.absence_reasons.map(reason => <p className="nara-personal-muted" key={reason}>{reason}</p>)}
    <details className="nara-personal-depth"><summary>Follow the calculation</summary><div className="nara-table-scroll"><table><thead><tr><th>Datum</th><th>Raw value</th><th>Direct → inverse</th><th>Anchor</th><th>Meaning / contribution</th></tr></thead><tbody>{reading.evidence.map(datum => <tr key={datum.id}><th scope="row">{datum.id.replaceAll('_', ' ')}</th><td>{datum.raw}</td><td>P{datum.mod6} → P{datum.inverse}</td><td>{datum.anchor_lens.replace('p', '′')}</td><td>{datum.direct_cell_meaning}{datum.weighted ? <details><summary>Contributing cells</summary><ul>{datum.cells.map(cell => <li key={`${cell.lens}:${cell.position}`}>{cell.lens.replace('p', '′')} · P{cell.position}: {cell.meaning} · {number(cell.total)}</li>)}</ul></details> : <p>{datum.unweighted_reason}</p>}</td></tr>)}</tbody></table></div>
      {Object.entries(reading.matrices).map(([name, matrix]) => <details key={name}><summary>{name.replaceAll('_', ' ')} · 12 × 6</summary><div className="nara-table-scroll"><table><thead><tr><th>Lens</th>{[0,1,2,3,4,5].map(p => <th key={p}>P{p}</th>)}</tr></thead><tbody>{reading.lens_order.map(lens => <tr key={lens}><th scope="row">{lens.replace('p', '′')}</th>{matrix[lens].map((v, p) => <td key={p}>{number(v)}</td>)}</tr>)}</tbody></table></div></details>)}
      <p className="nara-math">Name/date quaternion (EFWA): {reading.elemental.quaternion ? (['w','x','y','z'] as const).map(k => number(reading.elemental.quaternion![k])).join(' · ') : 'Unavailable'}</p>
    </details>
    <Policy reading={reading} disabled={disabled} onUse={onUse}/>
  </section>;
}
function Natal({reading: c}: {reading: NatalComposition}) {
  return <section><h3>Natal contribution</h3><Balance values={c.elemental_balance_l1} name="natal"/>
    <h3>Seven receiving centres</h3><p className="nara-personal-muted">The graph routes Saturn, Jupiter, Mars, Venus, Mercury, Moon and Sun from root to crown. Earth is the distinct grounding anchor. These evidence totals do not yet determine live centre amplitudes.</p>
    <div className="nara-centre-evidence">{c.centre_evidence.map(centre => <div key={centre.ordinal}><strong>{centre.label}</strong><section>
      {centre.planet_ids.map(id => {const planet = c.planetary_contributions.find(p => p.native_planet_id === id);return <div key={id}>{planet?.body ?? id}{planet?.planetary_chakra_route && <details><summary>Planetary resonance source</summary><p>{planet.planetary_chakra_route.planet_coordinate} → {planet.planetary_chakra_route.chakra_coordinate}</p><p>Graph: {planet.planetary_chakra_route.registry_revision}</p><p>Source: {planet.planetary_chakra_route.source_revision}</p><ul>{planet.planetary_chakra_route.relations.map(relation => <li key={relation.relation_ref}>{relation.source_kind} · {relation.relation_ref}</li>)}</ul></details>}</div>;})}
      {centre.natal_orientation && <details><summary>Natal elemental direction</summary>{centre.natal_orientation.quaternion ? <dl>{(['w','x','y','z'] as const).map(k => <React.Fragment key={k}><dt>{centre.natal_orientation!.derivation.mapping[k]}</dt><dd>{number(centre.natal_orientation!.quaternion![k])}</dd></React.Fragment>)}</dl> : <p>{centre.natal_orientation.reason}</p>}<p>{centre.natal_orientation.role}</p></details>}
    </section></div>)}</div>
    {c.decanic_channel && <Decanic reading={c.decanic_channel} centres={c.centre_evidence}/>}
    <details className="nara-personal-depth"><summary>Planetary weights and natal quaternion</summary><div className="nara-table-scroll"><table><thead><tr><th>Planet</th><th>Element</th><th>Weight</th><th>Dignity multiplier</th><th>Contribution</th></tr></thead><tbody>{c.planetary_contributions.map(p => <tr key={p.native_planet_id}><td>{p.body}</td><td>{p.element}</td><td>{number(p.keplerian_weight)}</td><td>{number(p.dignity_multiplier)}</td><td>{number(p.weighted_contribution)}</td></tr>)}</tbody></table></div><p className="nara-math">Natal quaternion (EFWA): {(['w','x','y','z'] as const).map(k => number(c.q_natal[k])).join(' · ')}</p><p>{c.quaternion_role}</p></details>
    <details className="nara-personal-depth"><summary>Natal source and calculation policy</summary><p>{c.policy_source.standing}</p><dl><dt>Policy</dt><dd>{c.policy}</dd><dt>Source</dt><dd>{c.policy_source.repository} / {c.policy_source.path}</dd><dt>Revision</dt><dd>{c.policy_source.revision}</dd></dl></details>
  </section>;
}
function Decanic({reading, centres}: {reading: DecanicReading; centres: NatalComposition['centre_evidence']}) {
  const centreName = (ordinal: number | null) => ordinal === null ? 'Unresolved' : centres.find(c => c.ordinal === ordinal)?.label ?? `Centre ${ordinal + 1}`;
  return <section><h4>Decan rulers and receiving centres</h4>
    <p>Each natal placement also falls within a ten-degree decan. Its graph-defined ruling planet provides a separate route to a receiving centre. This route remains separate from the natal planet’s own centre above.</p>
    <div className="nara-table-scroll"><table><thead><tr><th>Natal planet</th><th>Decan</th><th>Graph ruler</th><th>Receiving centre</th></tr></thead><tbody>{reading.planetary_contributions.map(p => <tr key={p.native_planet_id}>
      <th scope="row">{p.body}</th><td>{p.decan_global_index + 1} · {number(p.longitude_degrees)}°</td><td>{p.decan_ruler ?? 'Source conflict'}</td><td>{centreName(p.receiving_centre_ordinal)}<details><summary>Inspect contribution</summary>
        <dl><dt>Element</dt><dd>{p.element}</dd><dt>Natal magnitude</dt><dd>{number(p.weighted_contribution)}</dd><dt>EFWA evidence</dt><dd>{p.raw_efwa.map(number).join(' · ')}</dd><dt>Ruler resolution</dt><dd>{p.ruler_resolution}</dd></dl>
        <p>{p.role}</p>
        <details><summary>Graph route and source records</summary><pre>{JSON.stringify(p.graph_decan_route, null, 2)}</pre>{p.decan_ruler_chakra_route && <><p>{p.decan_ruler_chakra_route.planet_coordinate} → {p.decan_ruler_chakra_route.chakra_coordinate}</p><ul>{p.decan_ruler_chakra_route.relations.map(r => <li key={r.relation_ref}>{r.source_kind} · {r.relation_ref}</li>)}</ul></>}</details>
        <details><summary>Retained C comparison</summary><p>The retained C table reads {p.retained_c_ruler}. {p.retained_c_agrees_with_graph === null ? 'The graph ruler remains unresolved.' : p.retained_c_agrees_with_graph ? 'It agrees with the resolved graph ruler here.' : 'It disagrees with the graph ruler and does not select this recipient.'}</p><ul>{p.faces.map(face => <li key={face.face}>{face.face === 0 ? 'Light' : 'Shadow'} · {face.source_coordinate ?? `native row ${face.native_decan_index}`}</li>)}</ul><p>Both faces remain visible; this calculation does not choose one.</p></details>
      </details></td>
    </tr>)}</tbody></table></div>
    <details className="nara-personal-depth"><summary>Inspect decanic totals and method</summary>
      <div className="nara-table-scroll"><table><thead><tr><th>Receiving centre</th><th>Natal planets</th><th>Weighted evidence</th><th>EFWA evidence</th></tr></thead><tbody>{reading.centre_evidence.map(c => <tr key={c.ordinal}><th scope="row">{centreName(c.ordinal)}</th><td>{c.natal_planet_ids.map(id => reading.planetary_contributions.find(p => p.native_planet_id === id)?.body ?? id).join(', ') || 'None resolved'}</td><td>{number(c.weighted_power)}</td><td>{c.raw_efwa_evidence.map(number).join(' · ')}</td></tr>)}</tbody></table></div>
      <p>These are sourced natal contributions. They do not by themselves set live force, amplitude, phase or coupling.</p><p>{reading.weighting_source}</p><ul>{reading.method_notes.map(note => <li key={note}>{note}</li>)}</ul>
      <dl><dt>Weighting policy</dt><dd>{reading.weighting_policy}</dd><dt>Method source</dt><dd>{reading.method_source.repository} / {reading.method_source.path}</dd><dt>Revision</dt><dd>{reading.method_source.revision}</dd><dt>Standing</dt><dd>{reading.method_source.standing}</dd><dt>Native registry</dt><dd>{reading.native_source.registry_revision}</dd></dl>
      <details><summary>Source disagreement</summary><p>{reading.source_conflict.detail}</p><p>{reading.source_conflict.path} · {reading.source_conflict.section}</p><a href={reading.source_conflict.reference} target="_blank" rel="noreferrer">Read the source comparison</a></details>
    </details>
  </section>;
}
export function IdentityComposition({reading, disabled = false, onUsePolicy, onUseComposition}: {reading: IdentityReading | null; disabled?: boolean; onUsePolicy?: (policy: EncodingPolicy) => void; onUseComposition?: (policy: IdentityCompositionPolicy | undefined) => void}) {
  if (!reading) return <div className="nara-personal-empty"><h2>Understand the composition.</h2><p>Calculate and review the identity to inspect its native contributions.</p></div>;
  return <article className="nara-composition-reading" key={reading.input_revision}>
    <header><p className="nara-personal-caption">Composition</p><h2>What contributes to this reading</h2><p>Each calculation keeps its source and policy. These contributions remain distinct from a complete integrated identity and its live reception.</p></header>
    {reading.identity_composition&&<section aria-label="Core identity composition"><h3>Name, date and decanic core</h3>
      <p>The recovered draft combines the selected name/date quaternion at 40% and the decanic quaternion at 60%, then normalizes the result. Both inputs are required. Optional reports keep their own readings.</p>
      <p>{reading.identity_composition.selected?'This profile selects the draft core policy.':'No core composition policy is selected.'}</p>
      {reading.identity_composition.q_core&&<p className="nara-math">Core quaternion · Earth, Fire, Water, Air: {(['w','x','y','z'] as const).map(key=>number(reading.identity_composition!.q_core![key])).join(' · ')}</p>}
      {reading.identity_composition.missing_inputs.map(input=><p className="nara-personal-muted" key={input}>Required: {input.replaceAll('_',' ')}</p>)}
      {onUseComposition&&<button type="button" disabled={disabled} onClick={()=>onUseComposition(reading.identity_composition?.selected?undefined:'draft-core-birthdate-decanic-40-60-v1')}>{reading.identity_composition.selected?'Remove core policy and review':'Select draft core policy and review'}</button>}
      <details className="nara-personal-depth"><summary>Core calculation source and limits</summary><p>{reading.identity_composition.standing}</p><p>This selected identity calculation supplies no centre amplitude, phase or coupling law.</p><pre>{JSON.stringify({source:reading.identity_composition.source,inputs:reading.identity_composition.inputs,weights:reading.identity_composition.weights,caps:reading.identity_composition.caps},null,2)}</pre></details>
    </section>}
    {reading.birthdate_encoding && <NameDate reading={reading.birthdate_encoding} disabled={disabled} onUse={onUsePolicy}/>}
    {reading.natal_composition ? <Natal reading={reading.natal_composition}/> : <p className="nara-personal-muted">A natal contribution is unavailable for the supplied birth circumstances.</p>}
    {reading.derived_identity_contributions && <ReportedContributions reading={reading.derived_identity_contributions}/>}
  </article>;
}
function ReportedContributions({reading}: {reading: NonNullable<IdentityReading['derived_identity_contributions']>}) {
  const j = reading.jungian;
  return <section><h3>Reported identity material</h3>
    <h4>Jungian function strengths</h4>
    {j.balance_efwa ? <><Balance values={j.balance_efwa} name="reported function strengths"/><p>{j.score_basis}</p>
      <p>Sensation → Earth; intuition → Fire; feeling → Water; thinking → Air.</p>
      <details><summary>Measured values and quaternion</summary><p>EFWA magnitudes: {j.raw_efwa?.map(number).join(' · ')}</p><p>EFWA quaternion: {j.quaternion && (['w','x','y','z'] as const).map(k => number(j.quaternion![k])).join(' · ')}</p>
        <p>Aether gate: {j.caps?.aether_gate == null ? 'Not supplied' : number(j.caps.aether_gate)} · Mineral cap: {j.caps?.mineral_cap == null ? 'Not supplied' : number(j.caps.mineral_cap)}</p>
      </details></> : <p>{j.absence_reason}</p>}
    {!!j.unprojected_score_keys?.length && <p>Preserved without elemental conversion: {j.unprojected_score_keys.join(', ')}.</p>}
    <h4>Gene Keys</h4><p>{reading.gene_keys.absence_reason}</p>
    {!!reading.gene_keys.spheres?.length && <details><summary>Reported spheres and source correspondences</summary><div className="nara-table-scroll"><table><thead><tr><th>Sphere</th><th>Key · line</th><th>Direct → inverse</th><th>Lens</th><th>Provisional line element</th></tr></thead><tbody>{reading.gene_keys.spheres.map((s, i) => <tr key={i}><th scope="row">{s.name}</th><td>{s.key.number} · {s.line_projection.line}</td><td>P{s.key.mod6} → P{s.key.inverse}</td><td>{s.key.anchor_lens.replace('p', '′')}</td><td>{s.line_projection.element}</td></tr>)}</tbody></table></div></details>}
    <h4>Human Design</h4><p>{reading.human_design.absence_reason}</p>
    {!!reading.human_design.gates?.length && <details><summary>Reported gate correspondences</summary><div className="nara-table-scroll"><table><thead><tr><th>Side</th><th>Gate</th><th>Direct → inverse</th><th>Lens</th></tr></thead><tbody>{reading.human_design.gates.map((g, i) => <tr key={i}><th scope="row">{g.side}</th><td>{g.gate.number}</td><td>P{g.gate.mod6} → P{g.gate.inverse}</td><td>{g.gate.anchor_lens.replace('p', '′')}</td></tr>)}</tbody></table></div></details>}
    <details className="nara-personal-depth"><summary>Derivation sources</summary>{(['jungian','gene_keys','human_design'] as const).map(key => !!reading[key].source && <div key={key}><h4>{key.replaceAll('_', ' ')}</h4><pre>{JSON.stringify(reading[key].source, null, 2)}</pre></div>)}</details>
  </section>;
}
