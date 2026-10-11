// The data contract between the ingest layer (scripts/ → public/data/field.json)
// and the experience layer (src/). Both sides code against this file only.
//
// [C2-b1] Provider law (amended from the vault-named header): a corpus provider
// is anything that can publish this bundle — the contract is corpus-neutral and
// names no vault. Tier grammar (kept, C2-c3/c6): as-such → Archetype,
// symbolic form → Family, place-time manifestation → Occurrence. The first
// provider was the Jung archetypal-field vault; its tiers mapped
//   wiki/archetypes  → Archetype · wiki/images → Family · wiki/instances → Occurrence
// and the vault's own vocabulary (subject, Jung cites) stays in that provider's
// published data, never here.

export type ArchetypeId = string; // slug, e.g. "great-mother"
export type FamilyId = string; // slug, e.g. "serpent"
export type OccurrenceId = string; // vault filename slug
export type CultureId = string; // normalised slug, e.g. "latin-alchemy"

/** Where an archetype tie comes from. Never present "site" or "inferred" as the strongest basis's word. */
export type TieBasis = 'jung' | 'inferred' | 'site';

/** [C2-b2] The tie bases as the provider declares them: strongest first. Data keeps its ids;
 * labels and strength order travel with the field, not the code. Defaults to the founding triple. */
export interface TieBasisDecl {
  id: TieBasis;
  label: string;
}
export const DEFAULT_TIE_BASES: TieBasisDecl[] = [
  { id: 'jung', label: 'Jung' },
  { id: 'inferred', label: 'Inferred' },
  { id: 'site', label: 'Site' },
];
/** The provider's declared bases, strongest first (defaulting to the founding triple). */
export function tieBases(meta: FieldMeta): TieBasisDecl[] {
  return meta.ties?.bases?.length ? meta.ties.bases : DEFAULT_TIE_BASES;
}
/** Tier index of a basis id in the declaration: 0 = strongest; unknown ids sit weakest. */
export function tieTier(bases: TieBasisDecl[], id: TieBasis | undefined): number {
  if (id === undefined) return bases.length;
  const i = bases.findIndex((b) => b.id === id);
  return i === -1 ? bases.length : i;
}

export type LocusType =
  | 'artifact'
  | 'text-passage'
  | 'myth-episode'
  | 'ritual'
  | 'dream'
  | 'vision'
  | 'active-imagination'
  | 'clinical-case'
  | 'historical-event';

/** How trustworthy lat/lon is. "culture" = placed at the tradition's centroid. */
export type GeoPrecision = 'place' | 'region' | 'culture' | 'none';

export interface ImageRef {
  /** Site-relative path, e.g. "img/families/serpent.jpg" (served from public/). */
  src: string;
  /** Smaller variant for in-field markers; may equal src. */
  thumb: string;
  width: number;
  height: number;
  /** Dominant colour sampled from the image, hex — lets the UI tint before load. */
  tone?: string;
  title: string;
  credit: string; // artist / institution as given by the source
  license: string; // e.g. "Public domain", "CC BY-SA 4.0"
  sourceUrl: string; // the Commons/museum page, for attribution
}

export interface Cite {
  /** Jung work key as in the vault: "cw12", "sem-visions", "letters-pauli"… */
  work: string;
  /** Human label, e.g. "Psychology and Alchemy (CW12)". */
  workTitle: string;
  /** Year(s) of Jung's engagement as written, e.g. "1936/44". */
  year: string;
  /** Locator as written, e.g. "fig. 131, ¶357 (pdf p268)". */
  locator: string;
}

/**
 * The instinct ↔ spirit spectrum (CW8 ¶414–420): instinct sits at the
 * infra-red end, the archetype-as-image at the ultra-violet end.
 * 0 = instinct / infra-red (dense, warm, terrestrial)
 * 1 = spirit / ultra-violet (clear, cool, fine)
 */
export interface Spectrum {
  position: number; // 0..1
}

/** Atmosphere colours the experience layer blends between. All hex "#rrggbb". */
export interface Palette {
  core: string; // the archetype's own luminous colour (markers, focus ring)
  glow: string; // atmosphere rim / halo
  fog: string; // ambient fog / background wash
  deep: string; // darkest tone for space / shadows
}

export interface Archetype {
  id: ArchetypeId;
  name: string; // display, e.g. "Great Mother"
  oneLine: string; // ≤ 90 chars, orienting; empty when the vault gives no line
  prime: boolean; // true only for "self"
  spectrum: Spectrum;
  palette: Palette;
  /** Verbatim Jung quote with cite, when the vault has pinned one. */
  definition?: { text: string; cite: string };
  /** 1–3 short paragraphs of plain text for the deep layer. May be empty. */
  body: string[];
  image?: ImageRef;
  familyIds: FamilyId[]; // families tied to it (any basis), most occurrences first
  occurrenceCount: number; // via its families
}

export interface Family {
  id: FamilyId;
  name: string; // display, e.g. "Serpent"
  subtype: 'figure' | 'object' | 'process' | 'scene' | 'unknown';
  aliases: string[];
  oneLine: string; // ≤ 90 chars; empty when the vault gives no line
  archetypes: { id: ArchetypeId; basis: TieBasis }[];
  /** Blended from its archetypes, or set directly in curation. */
  spectrum: Spectrum;
  palette: Palette;
  body: string[]; // plain text paragraphs; may be empty
  image?: ImageRef;
  occurrenceIds: OccurrenceId[]; // sorted by year ascending
  /** True when the vault has no note for this family yet (only instance_of refs). */
  synthesised: boolean;
}

export interface Culture {
  id: CultureId;
  name: string; // "Latin alchemy"
  lat: number;
  lon: number; // centroid used for culture-precision placement
  occurrenceCount: number;
}

export interface Occurrence {
  id: OccurrenceId;
  /** [C2 §1.3, the one additive field] The native identity the shell's encounter
   * spine addresses (design §10.6). Absent ⇒ `id` stands in. */
  subject_ref?: string;
  title: string; // full record title
  label: string; // ≤ 48 chars, for the one-line marker label
  familyId: FamilyId; // primary instance_of
  coFamilyIds: FamilyId[];
  locusType: LocusType;
  // [C2 §1.3] `subject: 'jung' | 'patient-anon' | 'n/a'` dropped from the contract —
  // corpus-specific vocabulary; it moves into the founding provider's ingest.
  cultureIds: CultureId[];
  place: string; // prose, cleaned of source syntax
  lat: number;
  /** Convention (stated as law, C2 §1.3): lat/lon are ALWAYS present — (0,0) when
   * unplaced; `geoPrecision: 'none'` decides `located`. Providers must follow it. */
  lon: number;
  geoPrecision: GeoPrecision;
  year: number; // representative year, negative = BCE
  yearDisplay: string; // human truth, e.g. "~11th c."
  yearRange?: [number, number];
  /** [C2-b7] renamed from `jung` at the seam: the field name was corpus-named; the
   * shape {work, workTitle, year, locator} is generic. Ingest re-emits. */
  cites: Cite[];
  /** Short verbatim quote from the record body, when present. */
  quote?: string;
  /** Plain-text paragraphs of the record body. */
  body: string[];
  parallelIds: OccurrenceId[]; // resolvable parallels only
  image?: ImageRef; // occurrence-specific image when one was found
}

export interface FieldMeta {
  generatedAt: string; // ISO
  /** [C2 §1.3] The provider descriptor — replaces `vaultPath`/`vaultLedgerLine`.
   * `name` is the only place the corpus is named (C2 §1.2). */
  provider: {
    id: string;
    name: string;
    home?: string;
    /** [C2-b8] The provider's own words for the cite surfaces; the code carries
     * generic defaults. This is how the founding provider keeps its words as data. */
    labels?: { citesHeading?: string; citesMeet?: string; citePrefix?: string; readingTagline?: string };
  };
  /** [C2 §1.3] Optional freshness line, provider-declared (was the vault ledger heading). */
  freshness?: string;
  /** [C2-b2] The provider's tie bases, strongest first (see `tieBases`). */
  ties?: { bases: TieBasisDecl[] };
  counts: { archetypes: number; families: number; occurrences: number; cultures: number; images: number };
  yearMin: number;
  yearMax: number;
}

export interface Field {
  meta: FieldMeta;
  archetypes: Archetype[];
  families: Family[];
  occurrences: Occurrence[];
  cultures: Culture[];
}
