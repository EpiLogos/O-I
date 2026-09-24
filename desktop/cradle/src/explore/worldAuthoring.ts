/**
 * What a shared Expression may say about the World it came from
 * (shared-field/expression-projection.mjs World relations):
 *
 *   the constellation it was projected from   → `oi.world/expresses`
 *   the Position the Cradle is acting for     → `oi.world/authored-by`
 *
 * Both are read from native state, never inferred from labels: the
 * constellation from the frame reading every constructed member's subject
 * binding carries (knowledge/constructionProjection → expressionProjection
 * `binding()`), the Position from AIKit's joined `aikit whoami` reading —
 * and only when that reading proves this body holds an occupied Position.
 * Whether either becomes a relation is decided by the hosted field: only a
 * Position / constellation the field already hosts as a World entry is
 * related, and only inside that field.
 */
import type {ExpressionDocument} from "../expression/types";
import type {HostedEntry, HostedField, SharedFieldSnapshot} from "../knowledge/shared-field";

export interface WorldAuthoring {position_ref?: string; constellation_ref?: string}

/** The one constellation (WikiFrame) a constructed Expression was projected
 * from: the single non-subject reading every subject-bound entity carries.
 * A document composed any other way names none. */
export function projectedConstellationRef(document: Pick<ExpressionDocument, "entities">): string | undefined {
  const frames = new Set<string>();
  let bound = 0, framed = 0;
  for (const entity of Object.values(document.entities)) {
    const subject = entity.subject;
    if (!subject) continue;
    bound++;
    const others = (subject.readings ?? []).map(reading => reading.ref).filter(ref => ref !== subject.subject_ref && ref.startsWith("wiki:frame:"));
    if (others.length) framed++;
    for (const ref of others) frames.add(ref);
  }
  return bound > 0 && framed === bound && frames.size === 1 ? [...frames][0] : undefined;
}

/** The slice of `aikit.inhabitation-reading/v1` this decision reads. */
export interface ActingReading {
  schema?: string;
  resolved_by?: string;
  position_ref?: string | null;
  occupant_generation?: string | null;
  facets?: {occupancy?: {state?: string}};
}

/** The Position this Cradle is acting for: resolved from its own body (the
 * launch environment's `OI_POSITION_REF` + a verified `OI_OCCUPANT_GENERATION`,
 * or the occupancy whose AgentSession is this one) and currently occupied.
 * A Position named only by flag, or occupied by some other body, is not
 * one this Cradle acts for. */
export function actingPositionRef(reading: ActingReading | undefined): string | undefined {
  if (!reading || reading.schema !== "aikit.inhabitation-reading/v1") return undefined;
  const position = typeof reading.position_ref === "string" && reading.position_ref ? reading.position_ref : undefined;
  if (!position || reading.facets?.occupancy?.state !== "present") return undefined;
  if (reading.resolved_by === "agent-session") return position;
  if (reading.resolved_by === "env" && typeof reading.occupant_generation === "string" && reading.occupant_generation) return position;
  return undefined;
}

export type FieldEntry = HostedEntry & {field_ref: string};

/** Every hosted entry with the SharedField it is hosted in (the snapshot's
 * `entry_fields`); an entry whose field the snapshot does not name is left out. */
export function entriesWithField(snapshot: Pick<SharedFieldSnapshot, "entries" | "entry_fields">): FieldEntry[] {
  return snapshot.entries.flatMap(entry => {
    const field = snapshot.entry_fields?.[entry.ref];
    return field ? [{...entry, field_ref: field}] : [];
  });
}

export interface WorldHost {
  field_ref: string;
  world_ref: string;
  label: string;
  field?: HostedField;
  hosts: {position: boolean; constellation: boolean};
}

const names = (entry: HostedEntry, ref: string) => (entry.meta as {local_ref?: unknown} | undefined)?.local_ref === ref || entry.ref === ref || entry.aliases?.includes(ref);

/** The World that hosts the authoring Position and/or constellation, if the
 * hosted field holds either as a World entry: its field, its World ref and
 * label, and the field's own contract (so publishing beside it never
 * retitles it). The field hosting the most of them wins; ties go to the
 * Position's field. */
export function worldHostFor(snapshot: Pick<SharedFieldSnapshot, "entries" | "entry_fields" | "fields">, authoring: WorldAuthoring): WorldHost | undefined {
  const entries = entriesWithField(snapshot);
  const position = authoring.position_ref ? entries.filter(entry => entry.kind === "world-position" && names(entry, authoring.position_ref!)) : [];
  const constellation = authoring.constellation_ref ? entries.filter(entry => entry.kind === "constellation" && names(entry, authoring.constellation_ref!)) : [];
  const score = new Map<string, {position: boolean; constellation: boolean; world_ref: string}>();
  for (const entry of position) score.set(entry.field_ref, {...(score.get(entry.field_ref) ?? {constellation: false, world_ref: entry.world_ref}), position: true});
  for (const entry of constellation) score.set(entry.field_ref, {...(score.get(entry.field_ref) ?? {position: false, world_ref: entry.world_ref}), constellation: true});
  const ranked = [...score.entries()].sort(([, a], [, b]) => (Number(b.position) + Number(b.constellation)) - (Number(a.position) + Number(a.constellation)) || Number(b.position) - Number(a.position));
  if (!ranked.length) return undefined;
  const [field_ref, found] = ranked[0];
  const world = entries.find(entry => entry.field_ref === field_ref && entry.ref === found.world_ref);
  return {
    field_ref,
    world_ref: found.world_ref,
    label: world?.label ?? found.world_ref,
    ...(snapshot.fields.find(field => field.field_ref === field_ref) ? {field: snapshot.fields.find(field => field.field_ref === field_ref)} : {}),
    hosts: {position: found.position, constellation: found.constellation},
  };
}
