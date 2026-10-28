// The data contract between the ingest layer (scripts/ → public/data/field.json)
// and the experience layer (src/). Both sides code against this file only.
//
// [C2-b1] Provider law (amended from the vault-named header): a corpus provider
// is anything that can publish this bundle — the contract is corpus-neutral and
// names no vault. Tier grammar (kept, C2-c3/c6): as-such → Archetype,
// theoretical instrument / the field's ground → Theoretic, symbolic form →
// Family, place-time manifestation → Occurrence. The first provider was the
// Jung archetypal-field vault; its tiers mapped
//   wiki/archetypes → Archetype · wiki/concepts → Theoretic · wiki/images → Family · wiki/instances → Occurrence
// and the vault's own vocabulary (subject, Jung cites) stays in that provider's
// published data, never here.

import type { BodyKey } from './sky';
import { providerLabels } from '../data/labels';

export type ArchetypeId = string; // slug, e.g. "great-mother"
export type TheoreticId = string; // slug, e.g. "psychoid"
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
/** [C2-b8, O-I #755] the founding triple's strongest basis is named in the provider's own words (data/labels.ts
 * basisOwn: the founding field's word from its labels, else neutral), read when drawn; the code names no corpus. */
export const DEFAULT_TIE_BASES: TieBasisDecl[] = [
  { id: 'jung', get label() { return providerLabels().basisOwn; } },
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
  | 'historical-event'
  | 'sky';

/** How trustworthy lat/lon is. "culture" = placed at the tradition's centroid. */
export type GeoPrecision = 'place' | 'region' | 'culture' | 'none';

/**
 * Where in the sky an occurrence hangs — its extraterrestrial place, independent of its Earth place (`lat/lon/geoPrecision`):
 * it may have either, both, or neither. The card rings' own geometry (src/sky/cards.ts), so a ring and a place cannot
 * disagree. A body (the planet itself, the Moon, the Earth as a body of the sky), a ring of it, an ecliptic span.
 *   body    at the body itself (a sephira, an element on the Earth)
 *   wheel   on the body's decan wheel, at an ecliptic span (a pip card, at its decan, on its ruler's wheel)
 *   rank    on the body's rank ring (the cards of its number, the Atu attributed to it)
 *   zodiac  the zodiac itself, no body: a sign, a decan, a court card's thirty degrees, a sign's Atu
 *   pole    the heavens round the celestial pole (the Princesses); `slot` is the quadrant
 * `lon`/`span` are ecliptic degrees (start and width; may wrap past 360). `slot` is the suit order (wands, cups, swords,
 * disks) on a rank ring or a pole quadrant. `basis` says where the attribution comes from; `via` the join ids it rests on.
 */
export interface SkyLocus {
  body?: BodyKey;
  ring: 'body' | 'wheel' | 'rank' | 'zodiac' | 'pole';
  lon?: number;
  span?: number;
  slot?: number;
  basis: TieBasis;
  via: string[];
}

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
  /** Whose words the passage is, when not Jung's ("Crowley", "Burt", "von Franz"); absent means Jung. */
  voice?: string;
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
  /** Ties to other archetypes, from curation alone (the numbers to the Self, the dyad to syzygy and shadow). */
  archetypes: TheoreticTie[];
  /** True when admitted from curation with no vault note yet (number archetypes). */
  synthesised?: boolean;
}

/** A tie from a theoretic to a node the field holds. */
export interface TheoreticTie {
  id: string; // archetype / family / theoretic id
  basis: TieBasis;
}

/**
 * The vault's wiki/concepts/ tier: Jung's theoretical instruments, carried as a tier of the field
 * beside archetypes, families and occurrences. Two of them are the field's own foundation and carry
 * `ground`: the psychoid is the ontological tier-marker (where the archetype stops being psyche) and
 * the archetype as such is the epistemological keystone (the irrepresentable pole known only through
 * its images). Both are the reason the field has tiers at all, so they are stated as its ground
 * rather than filed as two more entries in a list.
 */
export interface Theoretic {
  id: TheoreticId;
  name: string; // display, e.g. "The Psychoid"
  oneLine: string; // ≤ 90 chars, orienting
  ground: 'ontological' | 'epistemological' | null;
  spectrum: Spectrum;
  palette: Palette;
  /** Verbatim Jung quote with cite, picked from the vault's mentions — never typed. */
  definition?: { text: string; cite: string };
  body: string[]; // plain text paragraphs; may be empty
  archetypes: TheoreticTie[];
  families: TheoreticTie[];
  theoretics: TheoreticTie[]; // the theoretical web: this concept's own neighbours
  occurrenceCount: number; // every occurrence its tied archetypes and families carry
  /** The Theory section that already carries this concept, when one does. A link, never a choice. */
  section?: string;
  /** Another lens that already carries this concept (aion-time → Aion, synchronicity → Coincidences). */
  lens?: string;
  image?: ImageRef;
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
  /** Verbatim Jung quote with cite, picked from the vault's mentions — never typed. */
  definition?: { text: string; cite: string };
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

/** [T6 — WORLD-SHELL-DESIGN §3.1, §10.6] The owner reading an occurrence was read from: the owner's ref and the
 * revision, epoch and read instant that owner returned for it. A basis says where a record came from; it never
 * upgrades its standing. Names follow the owners' returns: `ref` ← the QL sky snapshot's `snapshot_ref` or a Factory
 * run ref; `epoch` ← the snapshot's `epoch_utc`; `read_at_unix_ms` ← its `receipt_unix_ms`; `revision` ← a Factory
 * Return's `revision`. */
export interface OccurrenceBasis {
  ref: string;
  revision?: string;
  epoch?: string;
  read_at_unix_ms?: number;
}

export interface Occurrence {
  id: OccurrenceId;
  /** [C2 §1.3, the one additive field] The native identity the shell's encounter
   * spine addresses (design §10.6). Absent ⇒ `id` stands in. */
  subject_ref?: string;
  /** [T6] The owner reading this record was read from. Absent for records whose source states no reading
   * (the founding Jung field); present when an owner produced the record (Factory binding, QL sky). */
  basis?: OccurrenceBasis;
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
  /** [§8.4 host, T-N3-ATLAS-SUITE-PROVIDER] `false` ⇒ the owner declares no date: the occurrence is undated, an honest state.
   * Convention, stated as the lat/lon one is: `year` is always present, and for an undated occurrence it is a placeholder (the
   * field's yearMax) that no code may read as a date; `dated: false` decides. An undated occurrence stands outside the time
   * scale: its slider position is UNDATED_U (data/time.ts), it is never gated by the time window, and its `yearDisplay` says
   * "undated". Absent (or true) ⇒ `year` is the occurrence's date, as in the found contract. */
  dated?: false;
  yearRange?: [number, number];
  /** [C2-b7] renamed from `jung` at the seam: the field name was corpus-named; the
   * shape {work, workTitle, year, locator} is generic. Ingest re-emits. */
  cites: Cite[];
  /** Short verbatim quote from the record body, when present. */
  quote?: string;
  /** the quote is a plate caption as printed (an object label), shown as one, never as a quotation */
  caption?: true;
  /** Plain-text paragraphs of the record body. */
  body: string[];
  parallelIds: OccurrenceId[]; // resolvable parallels only
  /**
   * Where it hangs in the sky, when a source puts it there (the Thoth card on its ruler's decan wheel, a sign on the
   * zodiac). Independent of the Earth place: `lat/lon` stay 0,0 and `geoPrecision` 'none' when this is its only place.
   */
  sky?: SkyLocus[];
  image?: ImageRef; // occurrence-specific image when one was found
}

/**
 * The provider's own words for every line that names whose field this is, whose word a tie is, or whose reading a page
 * follows (C2-b8): the corpus is named by its provider, in data, never in code. Each key is optional; the code holds a
 * neutral default for each (src/data/labels.ts), so a field whose provider gives none reads in a voice that names no one.
 * Archetypal Earth's own words are its provider data: curation/provider.json, published as field.json meta.provider.
 */
export interface ProviderLabels {
  /** the landing line (shell/landing.ts) */
  landing?: string;
  /** the Aion lens's line in the menu (shell/lens.ts) */
  lensAion?: string;
  /** the Astrology lens's line in the menu (shell/lens.ts) */
  lensAstrology?: string;
  /** the Aion reading's line in its Options (aion/view.ts) */
  readingTagline?: string;
  /** the title of the J chip: a passage asserted in the reading's own text (aion/view.ts) */
  readingOwnText?: string;
  /** the equal-months convention's name (aion/precession.ts) */
  conventionOwn?: string;
  /** the sky clock's opening sentences (aion/skyclock.ts) */
  skyClockLede?: string;
  /** the row of the reading's own span of a sign (aion/skyclock.ts) */
  skyClockOwnSpan?: string;
  /** the note under a sign the reading divides in two (aion/skyclock-view.ts) */
  skyClockFishes?: string;
  /** whose conditional dating of Aquarius the rows give (aion/skyclock-view.ts) */
  skyClockMarkBy?: string;
  /** the J chip's title on a concept's quotation (dynamics/marks.ts) */
  dynamicsOwnText?: string;
  /** the V chip's title: another reader's reading, not the author's (dynamics/marks.ts) */
  dynamicsOtherText?: string;
  /** the Options row that opens the Theory lens (dynamics/view.ts, lenses/theory.ts) */
  theoryRoute?: string;
  /** the heading over the author's own lines (lenses/theory.ts, ui/deep.ts) */
  voiceHeading?: string;
  /** the strongest basis's name: the tie filter and the joins' own system (graph/tools.ts, ui/related.ts) */
  basisOwn?: string;
  /** after a tie the author makes (ui/deep.ts) */
  tieOwnNote?: string;
  /** the heading over the works an archetype is cited from (ui/deep.ts) */
  citesHeading?: string;
  /** the heading over an occurrence's cites (ui/deep.ts) */
  citesMeet?: string;
  /** the voice a cite reads in when it names none of its own (ui/format.ts) */
  citePrefix?: string;
  /** a tie the author makes, as the sky and the Astrology walk name it (lenses/astrology.ts, sky/orbits.ts) */
  tieOwnLink?: string;
  /** the Astrology lens's opening line (lenses/astrology.ts) */
  astrologyIntro?: string;
  /** the line under the Sun, where every walk ends (lenses/astrology.ts) */
  astrologySun?: string;
  /** the atlas's own links, beside the author's (lenses/astrology.ts) */
  astrologyOtherTies?: string;
  /** the atlas's own links, where the author gives none (lenses/astrology.ts) */
  astrologyOtherTiesOnly?: string;
  /** the Charts option's description (lenses/astrology.ts) */
  astrologyCharts?: string;
  /** the link from four to the quaternity (lenses/card-reading.ts) */
  quaternityLink?: string;
  /** the framing a coincidence log opens (lenses/coincidences.ts) */
  coincidencesFraming?: string;
  /** the Dreams lens's opening line (lenses/dreams.ts) */
  dreamsIntro?: string;
  /** the framing a dream journal opens (lenses/dreams.ts) */
  dreamsMethod?: string;
  /** the Symbols lens's opening line (lenses/symbols.ts) */
  symbolsIntro?: string;
  /** what the field holds, when a symbol is not in it (lenses/symbols.ts) */
  symbolsNone?: string;
  /** an archetype the author ties to an image (practice/amplify-view.ts) */
  amplifyTieOwn?: string;
  /** the note over an image's dreams and visions (practice/amplify-view.ts) */
  amplifyDreams?: string;
  /** an image with no definition (practice/amplify-view.ts) */
  amplifyNoDefinition?: string;
  /** a dream or vision that is the author's own (practice/amplify-view.ts, lenses/depth.ts) */
  subjectOwn?: string;
  /** the Red Book's opening line (redbook/view.ts) */
  redbookLede?: string;
  /** what a birth chart is read in (sky/chart.ts) */
  birthFraming?: string;
  /** what a birth chart states and does not (sky/chart.ts) */
  birthLimits?: string;
}

/** Who publishes the field: a stable id, its name (the one place the corpus is named), and its own words. */
export interface FieldProvider {
  id: string;
  /** with its article, as it reads after "Drawn from" */
  name: string;
  labels?: ProviderLabels;
}

export interface FieldMeta {
  generatedAt: string; // ISO
  /** [C2 §1.3] The provider descriptor — replaces `vaultPath`/`vaultLedgerLine`.
   * `name` is the only place the corpus is named (C2 §1.2). */
  provider: {
    id: string;
    name: string;
    home?: string;
    /** [C2-b8] The provider's own words for every line that names the corpus (ProviderLabels); the code carries
     * neutral defaults (data/labels.ts). This is how the founding provider keeps its words as data. */
    labels?: ProviderLabels;
  };
  /** [C2 §1.3] Optional freshness line, provider-declared (was the vault ledger heading). */
  freshness?: string;
  /** [C2-b2] The provider's tie bases, strongest first (see `tieBases`). */
  ties?: { bases: TieBasisDecl[] };
  counts: { archetypes: number; theoretics: number; families: number; occurrences: number; cultures: number; images: number; joins?: number };
  yearMin: number;
  yearMax: number;
}

/**
 * A general relation between two nodes of the field, of any tier to any tier (curation/joins.json, nothing else).
 * Basis says where the relation comes from, as for ties: never present "site" or "inferred" as Jung's word.
 * `system` names the tradition the join belongs to (e.g. "thoth"); `voice` names whose reading it is.
 * Joins carry no quotations in field.json.
 */
export interface Join {
  id: string; // kebab-case, unique
  a: { type: 'archetype' | 'theoretic' | 'family'; id: string };
  b: { type: 'archetype' | 'theoretic' | 'family'; id: string };
  basis: TieBasis;
  note: string; // one plain sentence, no wikilinks, ≤ 400 chars
  system?: string;
  voice?: string;
}

export interface Field {
  meta: FieldMeta;
  archetypes: Archetype[];
  theoretics: Theoretic[];
  families: Family[];
  occurrences: Occurrence[];
  cultures: Culture[];
  /** Cross-system relations between any two nodes. Optional: older field.json files carry none. */
  joins?: Join[];
}
