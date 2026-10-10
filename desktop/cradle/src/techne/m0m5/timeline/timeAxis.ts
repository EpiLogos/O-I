/** The shared Timeline / Places seam (lane 2 T6).
 * Pure projection of one validated owner reading and an explicitly declared
 * session window. Native strings, precision, uncertainty and attribution are
 * carried unchanged. Numeric comparisons use Timeline's existing range owner;
 * they never replace date carriers or create a clock, store or conversion.
 */
import {
  validateReading,
  type DisclosureSession,
  type TechneReading,
  type TechneSourceProvenance,
  type TechneSourceSelector,
  type TechneTemporalFacet,
  type TechneWholeRelation,
} from "../../contract.ts";
import {facetRange, type FacetSpan} from "./scale.ts";
import {resolveTemporalQualification} from "./relations.ts";

export const TECHNE_TIME_AXIS_SCHEMA = "techne:time-axis/v1";
export type SharedTimeWindow = NonNullable<DisclosureSession["time_window"]>;
export type TimeAxisScope =
  | {state: "unbounded" | "in-scope" | "out-of-scope" | "unpositioned"}
  | {state: "unresolved"; reason: string};

export type TimeAxisEvent = TechneTemporalFacet & {
  /** Presentation identity only when the owner supplied no facet ref. */
  derived_ref?: string;
  provenance: TechneSourceProvenance[];
  provenance_selector?: TechneSourceSelector | null;
  scope: TimeAxisScope;
};
export type TimeAxisRelation = TechneWholeRelation & {
  derived_ref?: string;
  temporal_qualification: {
    state: "dated" | "trans-temporal" | "unresolved";
    facet_ref: string | null;
    problem: string | null;
  };
  scope: TimeAxisScope;
};
export interface TimeAxisBand {
  band_ref: string;
  derived_id: boolean;
  /** The current ql.techne/v1 facet schema has no authored label carrier.
   * T8's label/notes require that native seam; no kind/ref becomes a label. */
  label_verbatim: null;
  earliest: string | null;
  latest: string | null;
  interval?: TechneTemporalFacet["interval"];
  precision?: TechneTemporalFacet["precision"];
  uncertainty?: string | null;
  source_ref?: string | null;
  provenance: TechneSourceProvenance[];
  provenance_selector?: TechneSourceSelector | null;
  scope: TimeAxisScope;
}
export interface TechneTimeAxis {
  schema: typeof TECHNE_TIME_AXIS_SCHEMA;
  subject_ref: string;
  reading_ref: string;
  snapshot_revision: string | null;
  events: TimeAxisEvent[];
  relations: TimeAxisRelation[];
  bands: TimeAxisBand[];
  window: SharedTimeWindow | null;
}

function copy<T>(value: T): T {return structuredClone(value);}
function message(error: unknown): string {return error instanceof Error ? error.message : String(error);}

/** Every event remains present: out-of-scope, undated and unresolved are
 * readings, not reasons to silently filter material out of another view. */
export function timeAxisEventScope(facet: TechneTemporalFacet, window?: SharedTimeWindow | null): TimeAxisScope {
  let span: FacetSpan;
  try {span = facetRange(facet);} catch (error) {return {state: "unresolved", reason: message(error)};}
  if (span.fromMs !== null && span.toMs !== null && span.fromMs > span.toMs)
    return {state: "unresolved", reason: "The declared facet's from bound follows its to bound"};
  if (!span.positioned) return {state: "unpositioned"};
  if (!window || (window.from === null && window.to === null)) return {state: "unbounded"};
  let bounds: FacetSpan;
  try {bounds = facetRange({kind: "valid", interval: window});}
  catch (error) {return {state: "unresolved", reason: `The declared window is not comparable: ${message(error)}`};}
  if (bounds.fromMs !== null && bounds.toMs !== null && bounds.fromMs > bounds.toMs)
    return {state: "unresolved", reason: "The declared window's from bound follows its to bound"};
  if ((span.fromMs !== null && bounds.toMs !== null && span.fromMs > bounds.toMs)
    || (span.toMs !== null && bounds.fromMs !== null && span.toMs < bounds.fromMs)) return {state: "out-of-scope"};
  return {state: "in-scope"};
}

function attribution(reading: TechneReading, facet: TechneTemporalFacet) {
  const exact = (reading.provenance ?? []).filter(row => row.selector?.unit === "other"
    && row.selector.kind === "techne-temporal-facet" && facet.facet_ref != null
    && row.selector.value === facet.facet_ref);
  // Source-level provenance stays source-level. It cannot fabricate a facet
  // selector, and multiple possible selectors are never narrowed by guessing.
  const provenance = exact.length ? exact : (reading.provenance ?? []).filter(row => facet.source_ref != null && row.source_ref === facet.source_ref);
  return {provenance: copy(provenance),
    ...(exact.length === 1 && exact[0].selector !== undefined ? {provenance_selector: copy(exact[0].selector)} : {})};
}

/** Validity facets supply existing period extents. Undated/open validity
 * remains listed with null bounds; no closed or named period is fabricated. */
export function timeAxis(reading: TechneReading, declaredWindow?: SharedTimeWindow | null): TechneTimeAxis {
  const checked = validateReading(reading);
  if (!checked.valid) throw Error(`Cannot project a drifted Technē reading: ${checked.errors.join("; ")}`);
  if (declaredWindow != null && (Object.keys(declaredWindow).some(key => key !== "from" && key !== "to")
    || ![declaredWindow.from, declaredWindow.to].every(bound => bound === null || typeof bound === "string")))
    throw Error("A shared time window requires only explicit from/to strings or null bounds");
  const window = declaredWindow == null ? null : copy(declaredWindow);
  const events: TimeAxisEvent[] = (reading.temporal ?? []).map((facet, index) => ({
    ...copy(facet),
    ...(facet.facet_ref == null ? {derived_ref: `derived:techne:timeline:temporal[${index}]`} : {}),
    ...attribution(reading, facet), scope: timeAxisEventScope(facet, window),
  }));
  const relations: TimeAxisRelation[] = (reading.whole?.relations ?? []).map((relation, index) => {
    let temporal_qualification: TimeAxisRelation["temporal_qualification"];
    try {
      const resolved = resolveTemporalQualification(relation, reading.temporal ?? []);
      temporal_qualification = {state: resolved.state, facet_ref: resolved.facet_ref, problem: resolved.problem};
    } catch (error) {temporal_qualification = {state: "unresolved", facet_ref: relation.temporal_facet_ref ?? null, problem: message(error)};}
    const facet = relation.temporal_facet_ref == null ? undefined : reading.temporal?.find(row => row.facet_ref === relation.temporal_facet_ref);
    const scope: TimeAxisScope = temporal_qualification.state === "trans-temporal" ? {state: "unpositioned"}
      : temporal_qualification.state === "unresolved" ? {state: "unresolved", reason: temporal_qualification.problem ?? "The temporal qualification is unresolved"}
      : timeAxisEventScope(facet!, window);
    return {...copy(relation), ...(relation.relation_ref == null ? {derived_ref: `derived:techne:relation[${index}]`} : {}), temporal_qualification, scope};
  });
  const bands: TimeAxisBand[] = events.filter(event => event.kind === "valid").map(event => ({
    band_ref: event.facet_ref ?? event.derived_ref!, derived_id: event.facet_ref == null,
    label_verbatim: null,
    // Keep authored carriers byte-exact: numeric precision extents belong to
    // scale.ts, never to the source's earliest/latest strings.
    earliest: event.interval ? event.interval.from ?? null : event.instant ?? null,
    latest: event.interval ? event.interval.to ?? null : event.instant ?? null,
    ...(event.interval !== undefined ? {interval: copy(event.interval)} : {}),
    ...(event.precision !== undefined ? {precision: event.precision} : {}),
    ...(event.uncertainty !== undefined ? {uncertainty: event.uncertainty} : {}),
    ...(event.source_ref !== undefined ? {source_ref: event.source_ref} : {}),
    provenance: copy(event.provenance),
    ...(event.provenance_selector !== undefined ? {provenance_selector: copy(event.provenance_selector)} : {}),
    scope: copy(event.scope),
  }));
  return {schema: TECHNE_TIME_AXIS_SCHEMA, subject_ref: reading.subject.subject_ref,
    reading_ref: reading.reading_ref, snapshot_revision: reading.snapshot?.revision ?? null,
    events, relations, bands, window};
}
