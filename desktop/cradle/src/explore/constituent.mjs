/**
 * The Being/Thing reading of one projected world constituent
 * (SHARED-FIELD-DESKTOP §0.1): an Agent's Position, a Workcell, a practice
 * (Skill/Method) or an activity. Built only from the hosted entry's
 * published meta and the field's typed relations — never from a local
 * reading — so a visitor sees exactly what the World shared.
 *
 * Availability stays three-valued: `inspectable` (published to read),
 * `offered` (the owner listed it as offered) and granted use, which a
 * Projection never carries (`grant: none`).
 */

export const CONSTITUENT_KINDS = new Set(['world-position', 'workcell', 'practice', 'activity']);

const text = (value) => (typeof value === 'string' && value ? value : undefined);
const record = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

function neighbour(ref, entries) {
  const entry = entries.get(ref);
  return { ref, label: entry?.label ?? ref, kind: entry?.kind ?? 'unknown', summary: entry?.summary, meta: record(entry?.meta) };
}

function related(entry, relations, entries, relation, direction) {
  const seen = new Set();
  return relations
    .filter((row) => row.relation === relation && (direction === 'out' ? row.from === entry.ref : row.to === entry.ref))
    .map((row) => ({ ...neighbour(direction === 'out' ? row.to : row.from, entries), availability: text(row.availability) }))
    // The field view and the subject reading both carry the relation; one subject is one item.
    .filter((item) => !seen.has(item.ref) && seen.add(item.ref));
}

/** @returns {null | {role: 'being'|'thing', kind: string, ref: string, title: string, facts: {label: string, value: string}[], groups: {title: string, items: {ref: string, label: string, kind: string, note?: string}[]}[], world_ref: string, standing: string}} */
export function constituentReading(entry, relations = [], entryList = []) {
  if (!entry || !CONSTITUENT_KINDS.has(entry.kind)) return null;
  const entries = new Map(entryList.map((row) => [row.ref, row]));
  const meta = record(entry.meta);
  const facts = [];
  const groups = [];
  const fact = (label, value) => { if (value !== undefined && value !== null && value !== '') facts.push({ label, value: String(value) }); };
  const group = (title, items, note = (item) => item.summary) => {
    if (items.length) groups.push({ title, items: items.map((item) => ({ ref: item.ref, label: item.label, kind: item.kind, ...(note(item) ? { note: note(item) } : {}) })) });
  };

  if (entry.kind === 'world-position') {
    const occupancy = record(meta.occupancy);
    fact('Handle', text(meta.handle));
    fact('Role', text(meta.role_ref));
    fact('Agent', text(meta.agent_ref));
    if (occupancy.state) fact('Occupancy', `${occupancy.state}${occupancy.generation_ordinal ? ` · generation #${occupancy.generation_ordinal}` : ''}${occupancy.workcell_ref ? ` · ${occupancy.workcell_ref}` : ''}`);
    fact('Current work', text(record(meta.current_work).outcome));
    fact('Disclosure', text(meta.disclosure));
    group('Carried by', related(entry, relations, entries, 'oi.world/carried-by', 'out'));
    group('Practises', related(entry, relations, entries, 'oi.world/practises', 'out'), (item) => [text(item.meta.practice_kind), item.availability ?? text(item.meta.availability)].filter(Boolean).join(' · '));
    group('Takes part in', related(entry, relations, entries, 'oi.activity/participant', 'in'), (item) => text(item.meta.state));
    return { role: 'being', kind: entry.kind, ref: entry.ref, title: entry.label, facts, groups, world_ref: entry.world_ref, standing: 'Agent Position · Being' };
  }
  if (entry.kind === 'workcell') {
    fact('Workcell', text(meta.local_ref));
    fact('Material role', text(meta.material_role));
    fact('Disclosure', text(meta.disclosure));
    const offers = Array.isArray(meta.offers) ? meta.offers.map(record) : [];
    fact('Offered', offers.length ? offers.map((offer) => text(offer.offer_ref) ?? text(offer.port)).filter(Boolean).join(', ') : 'nothing offered — inspectable only');
    group('Carries', related(entry, relations, entries, 'oi.world/carried-by', 'in'), (item) => text(record(item.meta.occupancy).state));
    return { role: 'thing', kind: entry.kind, ref: entry.ref, title: entry.label, facts, groups, world_ref: entry.world_ref, standing: 'Workcell · Thing' };
  }
  if (entry.kind === 'practice') {
    fact('Kind', text(meta.practice_kind));
    fact('Practice', text(meta.source_ref));
    fact('Source revision', text(meta.source_revision));
    fact('Native owner', text(meta.native_owner));
    fact('Availability', text(meta.availability));
    fact('Granted use', text(meta.grant) === 'none' ? 'none — publication is not permission' : text(meta.grant));
    group('Practised by', related(entry, relations, entries, 'oi.world/practises', 'in'), (item) => text(item.meta.handle));
    return { role: 'thing', kind: entry.kind, ref: entry.ref, title: entry.label, facts, groups, world_ref: entry.world_ref, standing: `${text(meta.practice_kind) ?? 'Practice'} · Thing` };
  }
  fact('Run', text(meta.run_ref));
  fact('Custody', text(meta.custody_ref));
  fact('State', text(meta.state));
  fact('Liveness', text(meta.liveness));
  fact('Purpose', text(meta.purpose_summary));
  const participants = related(entry, relations, entries, 'oi.activity/participant', 'out');
  group('Participants', participants, (item) => text(item.meta.handle));
  if (!participants.length) fact('Participants', 'none attested by the owner');
  group('Works on', related(entry, relations, entries, 'oi.activity/works-on', 'out'));
  return { role: 'thing', kind: entry.kind, ref: entry.ref, title: entry.label, facts, groups, world_ref: entry.world_ref, standing: 'Activity' };
}
