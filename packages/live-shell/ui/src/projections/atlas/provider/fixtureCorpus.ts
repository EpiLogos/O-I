// The non-Jung TEST CORPUS for the ported atlas — Phase 2 of the L5 commission.
//
// Named source: the corpus SHAPE is C2 §1.2's bundle; the fixture-builder seed
// is the atlas's own `src/dev/fixture.ts` at the pinned HEAD (deterministic rng,
// generated SVG plates, ~1/3 occurrences imageless — re-skinned per C2 §1.4,
// which names that file "the seed of L5's non-Jung acceptance corpus" and asks
// that its Jung-named content be replaced with neutral names). Zero Jung data:
// no vault text, no vault ids, no CW locators — the cite LOCATOR SHAPE (¶/pdf)
// is kept because the corpus index anchors on it (C2-b8).
//
// Domain: a small history of northern lights-keeping (lighthouses, compasses,
// charts) — five relations, one epoch reading, one declared mark, every geo
// precision, one unplaced record. All images are generated SVG data URLs: the
// port ships no image bytes and fetches none.

import type { Archetype, Culture, Family, Field, GeoPrecision, ImageRef, Occurrence, Palette } from '../src/types/field';
import type { History, HistoryReading } from '../src/types/history';
import type { Symbols } from '../src/types/symbols';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A generated plate, as a data URL — self-contained, no external bytes. */
function plate(seed: number, p: Palette, w: number, h: number, title: string): ImageRef {
  const r = rng(seed * 977 + 13);
  const c1 = p.core;
  const c2 = p.glow;
  const c3 = p.fog;
  const cx = 30 + r() * 40;
  const cy = 28 + r() * 40;
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + r() * 0.4;
    const x = 50 + Math.cos(a) * (10 + r() * 30);
    const y = 50 + Math.sin(a) * (10 + r() * 30);
    return `<line x1="50%" y1="50%" x2="${x.toFixed(1)}%" y2="${y.toFixed(1)}%" stroke="${i % 2 ? c1 : c2}" stroke-opacity="${(0.15 + r() * 0.3).toFixed(2)}" stroke-width="${(0.5 + r() * 2).toFixed(1)}"/>`;
  }).join('');
  const ring = `<circle cx="50%" cy="50%" r="${(14 + r() * 10).toFixed(1)}%" fill="none" stroke="${c1}" stroke-opacity="0.55" stroke-width="${(1 + r() * 2).toFixed(1)}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><radialGradient id="g" cx="${cx.toFixed(0)}%" cy="${cy.toFixed(0)}%" r="85%"><stop offset="0" stop-color="${c1}"/><stop offset=".5" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${ring}${rays}</svg>`;
  const uri = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  return { src: uri, thumb: uri, width: w, height: h, tone: c2, title, credit: 'Fixture corpus (generated plate)', license: 'CC0 (fixture, no external bytes)', sourceUrl: '' };
}

// ── as-such tier (Archetype) ─────────────────────────────────────────────────
// id, name, oneLine, prime, spectrum, palette
const ARCHES: [string, string, string, boolean, number, Palette][] = [
  ['wayfinding', 'Wayfinding', 'The craft of holding a course when the shore is out of sight.', true, 0.85, { core: '#f2e4bc', glow: '#cfa960', fog: '#1d2733', deep: '#070b12' }],
  ['landfall', 'Landfall', 'The moment the seen coast confirms the reckoned one.', false, 0.55, { core: '#bfe3c0', glow: '#5f9a6e', fog: '#12241a', deep: '#040a06' }],
  ['storm', 'Storm', 'The weather that owns the sea and forgets the chart.', false, 0.15, { core: '#c8a2a8', glow: '#7d4656', fog: '#251219', deep: '#0a0407' }],
  ['haven', 'Haven', 'The sheltered water that ends a passage well.', false, 0.7, { core: '#cfe0f2', glow: '#6f93bd', fog: '#131f30', deep: '#050910' }],
];

// ── form tier (Family) ───────────────────────────────────────────────────────
// id, name, subtype, aliases, tied archetypes (id + basis: the CONTRACT's tier ids,
// labelled by the provider's meta.ties.bases below), oneLine
const FAMS: [string, string, Family['subtype'], string[], [string, Family['archetypes'][number]['basis']][], string][] = [
  ['lighthouse', 'Lighthouse', 'object', ['light', 'pharos'], [['wayfinding', 'jung'], ['landfall', 'inferred'], ['haven', 'site']], 'A fixed light standing where the coast must be known.'],
  ['compass', 'Compass', 'object', ['needle', 'binnacle'], [['wayfinding', 'jung'], ['storm', 'inferred']], 'The unseen north, held in a bowl of oil.'],
  ['chart', 'Chart', 'object', ['map', 'plan'], [['wayfinding', 'jung'], ['haven', 'inferred']], 'The sea drawn flat so a course can be laid.'],
  ['harbour', 'Harbour', 'scene', ['port', 'basin'], [['haven', 'jung'], ['landfall', 'inferred']], 'Stone arms closed against the open water.'],
  ['foghorn', 'Foghorn', 'object', ['horn', 'siren'], [['storm', 'inferred'], ['wayfinding', 'site']], 'A voice for the light when the light is swallowed.'],
  ['logbook', 'Log-book', 'object', ['log', 'journal'], [['wayfinding', 'inferred'], ['storm', 'site']], 'The passage, kept in ink against forgetting.'],
];

// ── instance tier (Occurrence) ───────────────────────────────────────────────
// id, family, year, yearDisplay, lat, lon, precision, place, cultures, co-families, parallels
const OCCS: [string, string, number, string, number, number, GeoPrecision, string, string[], string[], string[]][] = [
  ['eddystone-1698', 'lighthouse', 1698, '1698', 50.18, -4.27, 'place', 'Eddystone reef, English Channel', ['north-atlantic'], ['harbour'], ['bell-rock-1814']],
  ['bell-rock-1814', 'lighthouse', 1814, '1814', 56.3, -2.38, 'place', 'Bell Rock, North Sea', ['north-atlantic'], ['chart'], ['eddystone-1698']],
  ['skerryvore-1844', 'lighthouse', 1844, '1844', 56.32, -7.1, 'place', 'Skerryvore reef, Hebrides', ['north-atlantic'], [], ['eddystone-1698']],
  ['flannan-1899', 'lighthouse', 1899, '1899', 58.29, -7.59, 'place', 'Eilean Mòr, Flannan Isles', ['north-atlantic'], ['foghorn'], []],
  ['brest-fires-1717', 'harbour', 1717, 'c. 1717', 48.36, -4.5, 'place', 'Brest roads, Brittany', ['north-atlantic'], ['lighthouse'], []],
  ['smith-point-1828', 'lighthouse', 1828, '1828', 37.89, -75.36, 'place', 'Smith Point, Chesapeake', ['north-atlantic'], [], []],
  ['adriatic-lead-1800', 'compass', 1800, 'c. 1800', 44.5, 13.0, 'region', 'the Adriatic crossing', ['adriatic'], ['chart'], []],
  ['baltic-reckoning-1751', 'logbook', 1751, '1751', 56.0, 19.0, 'region', 'the Baltic middle grounds', ['baltic'], ['compass'], []],
  ['med draught-1620', 'chart', 1620, 'c. 1620', 37.5, 15.0, 'culture', 'a Sicilian draught of the straits', ['adriatic'], [], []],
  ['unwatched-light-1931', 'foghorn', 1931, '1931', 0, 0, 'none', '(a light proposed, never sighted)', [], [], []],
];

const O_BODY = (name: string, family: string): string[] => [
  `${name} stands in the record as a ${family} of the northern services: built, kept, and paid for by the coast it watched over.`,
  'The keepers' + '’ notes give the winds and the works in the same breath; the fixture keeps them short.',
];

function buildField(): Field {
  const archetypes: Archetype[] = ARCHES.map(([id, name, oneLine, prime, spectrum, palette], i) => ({
    id,
    name,
    oneLine,
    prime,
    spectrum: { position: spectrum },
    palette,
    body: [`${name} is one of the fixture's four as-such grades of the northern keepers' world.`, 'Bodies of text exercise the deep-sheet paragraphs; this is the second.'],
    image: i % 2 === 0 ? plate(i + 1, palette, 1920, 1080, name) : undefined,
    familyIds: FAMS.filter(([, , , , ties]) => ties.some(([aid]) => aid === id)).map(([fid]) => fid),
    occurrenceCount: OCCS.filter(([fam]) => FAMS.find(([fid]) => fid === fam)?.[4].some(([aid]) => aid === id)).length,
  }));
  const families: Family[] = FAMS.map(([id, name, subtype, aliases, ties, oneLine], i) => ({
    id,
    name,
    subtype,
    aliases,
    oneLine,
    archetypes: ties.map(([aid, basis]) => ({ id: aid, basis })),
    spectrum: { position: archetypes.find((a) => a.id === ties[0][0])!.spectrum.position },
    palette: archetypes.find((a) => a.id === ties[0][0])!.palette,
    body: [`${name}: a form-tier entry of the fixture, exercising tie bases and the family sheet.`],
    image: i % 3 === 0 ? plate(100 + i, archetypes.find((a) => a.id === ties[0][0])!.palette, 1280, 960, name) : undefined,
    occurrenceIds: OCCS.filter(([fam]) => fam === id).map(([oid]) => oid),
    synthesised: false,
  }));
  const occurrences: Occurrence[] = OCCS.map(([id, familyId, year, yearDisplay, lat, lon, geoPrecision, place, cultureIds, coFamilyIds, parallelIds], i) => ({
    id,
    // [C2 §1.3] the one additive field: the native identity the encounter spine addresses
    subject_ref: `fixture:northern-lights/${id}`,
    title: `${id.replace(/-/g, ' ')} — a fixture record of the ${familyId}`,
    label: id.replace(/-/g, ' ').slice(0, 48),
    familyId,
    coFamilyIds,
    locusType: 'historical-event',
    cultureIds,
    place,
    lat,
    lon,
    geoPrecision,
    year,
    yearDisplay,
    // cite LOCATOR SHAPE kept (¶ anchors the corpus index); the words are the fixture's own
    cites: [
      { work: 'keepers-1', workTitle: 'The Keepers' + '’ Register (KR1)', year: String(year), locator: `¶${40 + i} (pdf p${12 + i})` },
      ...(i % 3 === 0 ? [{ work: 'board-2', workTitle: 'Northern Board Minutes (NBM)', year: yearDisplay, locator: `¶${90 + i}` }] : []),
    ],
    quote: i === 0 ? 'A light so placed that no vessel need doubt the shore.' : undefined,
    body: O_BODY(id.replace(/-/g, ' '), familyId),
    parallelIds,
    image: i % 3 !== 1 ? plate(200 + i, families.find((f) => f.id === familyId)!.palette, 960, 720, id) : undefined,
  }));
  const cultures: Culture[] = [
    { id: 'north-atlantic', name: 'North Atlantic keepers', lat: 55.5, lon: -6.5, occurrenceCount: 6 },
    { id: 'adriatic', name: 'Adriatic pilots', lat: 43.5, lon: 14.5, occurrenceCount: 2 },
    { id: 'baltic', name: 'Baltic pilots', lat: 56.5, lon: 19.5, occurrenceCount: 1 },
  ];
  return {
    meta: {
      generatedAt: '2026-10-09T00:00:00Z',
      // [C2 §1.3] the provider descriptor — the only place the corpus is named
      provider: {
        id: 'fixture-northern-lights',
        name: 'the northern lights-keeping fixture',
        home: 'workspace://fixture-corpus',
        labels: {
          citesHeading: 'The register’s texts',
          citesMeet: 'Where the register meets it',
          citePrefix: 'The Register',
          readingTagline: 'A keepers’ reading of the northern lights',
        },
      },
      freshness: 'fixture, generated at port time',
      // [C2-b2] the provider declares its tie bases: CONTRACT tier ids, the provider's own labels
      ties: {
        bases: [
          { id: 'jung', label: 'Primary' },
          { id: 'inferred', label: 'Inferred' },
          { id: 'site', label: 'Local' },
        ],
      },
      counts: { archetypes: archetypes.length, families: families.length, occurrences: occurrences.length, cultures: cultures.length, images: occurrences.filter((o) => o.image).length },
      yearMin: 1620,
      yearMax: 1931,
    },
    archetypes,
    families,
    occurrences,
    cultures,
  };
}

// ── the epoch reading (Aion) ─────────────────────────────────────────────────
function buildHistory(): History {
  const palette = ARCHES[0][5];
  const reading: HistoryReading = {
    id: 'northern-light',
    title: 'The Northern Light',
    author: 'The Keepers' + '’ Guild (fixture)',
    from: 1620,
    to: 2000,
    // [C2-b10] the reading's default precession convention travels with the reading
    convention: 'iau',
    // [C2-b9] the reading's own conditional mark (same data shape the founding
    // reading uses for its Aquarian dating; the fixture's content is its own)
    marks: [
      {
        id: 'aquarian-beginnings', // the display slot's stable data id (aion/skyclock.ts)
        name: 'The Guild',
        eventIds: ['automation-horizon-1931', 'automation-horizon-2064'],
        range: { from: 1980, to: 2100 },
        rangeNote: '“indefinite while oil remains”',
        locator: 'KR1 ¶150 (fixture locator)',
      },
    ],
    epochs: [
      {
        id: 'oil-and-tallow',
        name: 'Oil and tallow',
        from: 1620,
        to: 1860,
        polarity: 'neutral',
        spectrum: 0.4,
        palette,
        oneLine: 'Lights burned what the shore could give.',
        body: ['Argand lamps and clockwork turning; the keeper as the mechanism.'],
        passages: [{ text: 'The light is the coast’s promise, kept in oil.', work: 'keepers-1', locator: '¶41' }],
        archetypeIds: ['wayfinding'],
      },
      {
        id: 'the-fixed-machine',
        name: 'The fixed machine',
        parentId: 'oil-and-tallow',
        from: 1782,
        to: 1860,
        polarity: 'light',
        spectrum: 0.6,
        palette,
        oneLine: 'Clockwork and lens made the light regular.',
        body: ['The epicyclic machine turned the lamps without a hand.'],
        passages: [{ text: 'So uniform a light as the machine alone can keep.', work: 'board-2', locator: '¶9' }],
      },
      {
        id: 'iron-and-hydrogen',
        name: 'Iron and gas',
        from: 1860,
        to: 1940,
        polarity: 'shadow',
        spectrum: 0.3,
        palette: ARCHES[2][5],
        oneLine: 'The weather still owned the rock.',
        body: ['Storms unmade what boards had built; the foghorn joined the light.'],
        passages: [{ text: 'The sea keeps its own minutes.', work: 'keepers-1', locator: '¶77' }],
        archetypeIds: ['storm', 'wayfinding'],
      },
      {
        id: 'the-unwatched-light',
        name: 'The unwatched light',
        from: 1940,
        to: 2000,
        polarity: 'union',
        spectrum: 0.8,
        palette: ARCHES[3][5],
        oneLine: 'Automation retired the last keepers.',
        body: ['Acetylene and solar cells burned without a household.'],
        passages: [{ text: 'No man now tends the light, and it burns.', work: 'board-2', locator: '¶120' }],
        archetypeIds: ['haven'],
      },
    ],
    events: [
      { id: 'eddystone-lit', name: 'Eddystone first lit', year: 1698, yearDisplay: '1698', place: 'Eddystone reef', lat: 50.18, lon: -4.27, epochId: 'oil-and-tallow', polarity: 'light', oneLine: 'The first offshore light.', body: [], passages: [], familyIds: ['lighthouse'], occurrenceIds: ['eddystone-1698'] },
      { id: 'bell-rock-lit', name: 'Bell Rock first lit', year: 1814, yearDisplay: '1814', place: 'Bell Rock', lat: 56.3, lon: -2.38, epochId: 'the-fixed-machine', polarity: 'light', oneLine: 'Stevenson’s greatest work.', body: [], passages: [], familyIds: ['lighthouse', 'chart'], occurrenceIds: ['bell-rock-1814'] },
      { id: 'flannan-vanish', name: 'The Flannan keepers vanish', year: 1900, yearDisplay: 'December 1900', place: 'Eilean Mòr', lat: 58.29, lon: -7.59, epochId: 'iron-and-hydrogen', polarity: 'shadow', oneLine: 'Three keepers gone; the lamp trimmed.', body: [], passages: [], familyIds: ['logbook'], occurrenceIds: ['flannan-1899'] },
      { id: 'automation-horizon-1931', name: 'First automated northern light', year: 1931, yearDisplay: '1931', epochId: 'the-unwatched-light', polarity: 'neutral', oneLine: 'The first light without a household.', body: [], passages: [], familyIds: ['foghorn'], occurrenceIds: ['unwatched-light-1931'] },
      { id: 'automation-horizon-2064', name: 'The last manned light (projected)', year: 2064, yearDisplay: '2064 (a calculation)', epochId: 'the-unwatched-light', polarity: 'neutral', oneLine: 'A calculation, not an event.', body: [], passages: [], familyIds: [], occurrenceIds: [] },
    ],
    threads: [
      { id: 'the-long-dimming', name: 'The long dimming of the keeper’s trade', polarity: 'neutral', eventIds: ['eddystone-lit', 'bell-rock-lit', 'flannan-vanish', 'automation-horizon-1931'], oneLine: 'From household to machine to no one.' },
    ],
  };
  return { generatedAt: '2026-10-09T00:00:00Z', readings: [reading] };
}

// ── the editorial overlay (symbols) — exercises b8's source-title-from-data ──
function buildSymbols(): Symbols {
  return {
    source: {
      id: 'keepers-manual',
      title: 'The Keeper’s Manual (fixture)',
      editor: 'The Guild',
      year: 1887,
      sourcePath: '(fixture; no PDF is served)',
    },
    entries: [
      {
        familyId: 'lighthouse',
        title: 'Of towers',
        pages: [12, 13],
        pdfPages: [14, 15],
        body: ['The manual’s paraphrase of the tower: its site is its meaning. Fixture text, never anyone’s quoted words.'],
        resonances: ['harbour', 'foghorn'],
      },
    ],
  };
}

/** The whole fixture bundle, built deterministically on demand. */
export function fixtureCorpus(): { field: Field; history: History; symbols: Symbols } {
  return { field: buildField(), history: buildHistory(), symbols: buildSymbols() };
}
