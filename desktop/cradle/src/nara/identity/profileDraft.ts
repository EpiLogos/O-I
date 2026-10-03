import type {IdentityProfile, IdentityReport, JsonValue, ReportKey, TimePrecision} from './types';

export const REPORTS: {key: ReportKey; title: string; description: string}[] = [
  {key: 'jungian', title: 'Jungian / personality material', description: 'Keep a Jungian assessment, MBTI report or 16-personalities self-report in its own system.'},
  {key: 'gene_keys', title: 'Gene Keys', description: 'Import an attributable profile with named spheres, key numbers and lines.'},
  {key: 'human_design', title: 'Human Design', description: 'Import the actual BodyGraph report, including gates, channels and its nine named centres.'},
  {key: 'quintessence', title: 'Archetypal quintessence', description: 'Add an authored or imported synthesis with its own source and method.'},
];
export const OFFICE_NAMES: Record<string, string> = {
  'birthdate-name': 'Birth date & name', 'natal-chart': 'Natal chart',
  'jungian-assessment': 'Jungian / personality material', 'gene-keys': 'Gene Keys',
  'human-design': 'Human Design', 'archetypal-quintessence': 'Archetypal quintessence',
};
export interface ReportDraft {
  enabled: boolean; route: 'import' | 'self-report'; source: string; revision: string;
  standing: string; method: string; data: string; system: string; type: string; identity: string;
}
export interface IdentityDraft {
  person_ref: string; nara_ref: string; name: string; date: string; time: string;
  precision: TimePrecision; uncertainty: string; fold: string;
  place: {label: string; latitude: string; longitude: string; timezone: string; source: string};
  reports: Record<ReportKey, ReportDraft>;
  encoding_policy?: IdentityProfile['encoding_policy'];
  composition_policy?: IdentityProfile['composition_policy'];
}
export function reportDraft(report: IdentityReport | null): ReportDraft {
  return {enabled: report !== null, route: report?.route ?? 'import',
    source: report?.source.source_ref ?? '', revision: report?.source.revision ?? '',
    standing: report?.source.standing_ref ?? '', method: report?.method ?? '',
    data: report ? JSON.stringify(report.data, null, 2) : '',
    system: typeof report?.data.system === 'string' ? report.data.system : '',
    type: typeof report?.data.type === 'string' ? report.data.type : '',
    identity: typeof report?.data.identity === 'string' ? report.data.identity : ''};
}
export function draftFromProfile(profile: IdentityProfile): IdentityDraft {
  const b = profile.birth;
  return {person_ref: profile.person_ref, nara_ref: profile.nara_ref, name: profile.name,
    date: b.date ?? '', time: b.time ?? '', precision: b.precision,
    uncertainty: b.uncertainty_minutes === null ? '' : String(b.uncertainty_minutes),
    fold: b.fold === null ? '' : String(b.fold),
    place: {label: b.place?.label ?? '', latitude: b.place ? String(b.place.latitude_degrees) : '',
      longitude: b.place ? String(b.place.longitude_degrees) : '', timezone: b.place?.timezone ?? '', source: b.place?.source_ref ?? ''},
    ...(profile.encoding_policy ? {encoding_policy: structuredClone(profile.encoding_policy)} : {}),
    ...(profile.composition_policy ? {composition_policy: profile.composition_policy} : {}),
    reports: {jungian: reportDraft(profile.jungian), gene_keys: reportDraft(profile.gene_keys),
      human_design: reportDraft(profile.human_design), quintessence: reportDraft(profile.quintessence)}};
}
function numberInput(value: string, label: string): number {
  if (!value.trim() || !Number.isFinite(Number(value))) throw new Error(`Enter ${label} as a number.`);
  return Number(value);
}
export function objectJson(raw: string, label: string): {[key: string]: JsonValue} {
  let parsed: JsonValue;
  try { parsed = JSON.parse(raw) as JsonValue; } catch { throw new Error(`${label} needs valid JSON.`); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label} must be a JSON object.`);
  return parsed;
}
function reportData(key: ReportKey, report: ReportDraft): {[key: string]: JsonValue} {
  const data = objectJson(report.data || '{}', REPORTS.find(value => value.key === key)!.title);
  if (key !== 'jungian' || report.route !== 'self-report') return data;
  const current: {[key: string]: JsonValue} = {...data, system: report.system, type: report.type};
  delete current.identity;
  if (report.system === '16-personalities' && report.identity) current.identity = report.identity;
  return current;
}
/** A route change changes attribution, not the currently entered material. */
export function changeReportRoute(key: ReportKey, report: ReportDraft, route: ReportDraft['route']): ReportDraft {
  if (route === report.route) return report;
  if (key !== 'jungian') return {...report, route};
  const data = reportData(key, report);
  return {...report, route, data: JSON.stringify(data, null, 2),
    system: typeof data.system === 'string' ? data.system : '',
    type: typeof data.type === 'string' ? data.type : '',
    identity: typeof data.identity === 'string' ? data.identity : ''};
}
/** Convert entered material only; actual domain validation remains in QL. */
export function profileFromDraft(draft: IdentityDraft): IdentityProfile {
  const reports = {} as Record<ReportKey, IdentityReport | null>;
  for (const {key} of REPORTS) {
    const r = draft.reports[key];
    if (!r.enabled) { reports[key] = null; continue; }
    const data = reportData(key, r);
    reports[key] = {source: {source_ref: r.source, revision: r.revision, standing_ref: r.standing},
      method: r.method, route: r.route, data};
  }
  const hasPlace = Object.values(draft.place).some(value => value.trim() !== '');
  if (hasPlace && !draft.place.source.trim()) throw new Error('Enter the source of the birthplace coordinates before calculating.');
  return {schema: 'ql.nara-identity-profile/v1', person_ref: draft.person_ref, nara_ref: draft.nara_ref,
    ...(draft.encoding_policy ? {encoding_policy: structuredClone(draft.encoding_policy)} : {}),
    ...(draft.composition_policy ? {composition_policy: draft.composition_policy} : {}),
    name: draft.name, birth: {date: draft.date || null,
      time: draft.precision === 'unknown' ? null : draft.time || null, precision: draft.precision,
      uncertainty_minutes: draft.precision === 'approximate' ? numberInput(draft.uncertainty, 'the time uncertainty in minutes') : null,
      fold: draft.precision === 'unknown' || draft.fold === '' ? null : draft.fold === '0' ? 0 : 1,
      place: hasPlace ? {label: draft.place.label, latitude_degrees: numberInput(draft.place.latitude, 'birthplace latitude'),
        longitude_degrees: numberInput(draft.place.longitude, 'birthplace longitude'),
        timezone: draft.place.timezone, source_ref: draft.place.source} : null}, ...reports};
}
export function newDraft(): IdentityDraft {
  return draftFromProfile({schema: 'ql.nara-identity-profile/v1',
    person_ref: `person:${crypto.randomUUID()}`, nara_ref: `nara:${crypto.randomUUID()}`,
    name: '', birth: {date: null, time: null, precision: 'unknown', uncertainty_minutes: null, fold: null, place: null},
    jungian: null, gene_keys: null, human_design: null, quintessence: null});
}
