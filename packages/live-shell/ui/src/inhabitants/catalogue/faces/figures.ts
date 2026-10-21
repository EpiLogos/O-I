// The figures: the creatures that are the faces of agent types, and which one stands for each pattern (face-rig CREATURE-SPEC.md
// sections 20 to 26; creatures-roster.js is the roster this table is cut from). A creature is the face of a type, chosen by its real
// mechanism and never by its name: a pattern names the animal whose behaviour it is (agency.ts, `animals`), and where that animal is
// not built yet its face is the figure's glyph, named and dark.
import type {RunState} from './agency'

export type InkName = 'obsidian' | 'bone' | 'cinnabar' | 'lapis' | 'malachite' | 'amber' | 'umber' | 'gold'
/** The roster's eight inks (creature-kit.js ROSTER). */
export const INK: Readonly<Record<InkName, string>> = {obsidian: '#1A1A2E', bone: '#E8E4D9', cinnabar: '#C44536', lapis: '#2E5A88', malachite: '#3A7D5C', amber: '#D4A03C', umber: '#6B5B4F', gold: '#B8963E'}
export type Element = 'fire' | 'earth' | 'air' | 'water'
/** The element's ink: the additive colour of the act (spec 26). Fire with intuition amber, earth with sensation malachite, air with thinking lapis, water with feeling cinnabar. */
export const ELEMENT_INK: Readonly<Record<Element, InkName>> = {fire: 'amber', earth: 'malachite', air: 'lapis', water: 'cinnabar'}
export const ELEMENT_FUNCTION: Readonly<Record<Element, string>> = {fire: 'intuition', earth: 'sensation', air: 'thinking', water: 'feeling'}

/** How a built figure is mounted: on the kit (`def` names it), the lion's own handle, or the continuous-body engine (the serpent). */
export type Mount = {readonly kind: 'kit'; readonly def: string; readonly files: readonly string[]} | {readonly kind: 'lion'; readonly files: readonly string[]} | {readonly kind: 'serpent'; readonly files: readonly string[]}
export interface Figure {
  readonly id: string
  readonly name: string
  /** The zodiac sign, where the figure has one: the glyph a figure that is not built draws. */
  readonly sign?: string
  readonly ink: InkName
  readonly element?: Element
  readonly habitat: string
  readonly zone: string
  readonly mount?: Mount
}
const kit = (def: string): Mount => ({kind: 'kit', def, files: [`creature-${def}`]})
const F = (id: string, name: string, ink: InkName, habitat: string, zone: string, extra: Partial<Figure> = {}): Figure => ({id, name, ink, habitat, zone, ...extra})
const FIGURE_LIST: readonly Figure[] = [
  F('serpent', 'Serpent', 'malachite', 'tree', 'roots, trunk, crown: one run climbs them', {mount: {kind: 'serpent', files: ['creature-ring', 'creature-body', 'creature-serpent']}}),
  F('lion', 'Lion', 'amber', 'grassland', 'kopje rock (the vantage) and grass', {sign: '♌', element: 'fire', mount: {kind: 'lion', files: ['creature-lion']}}),
  F('bull', 'Bull', 'malachite', 'grassland', 'pasture', {sign: '♉', element: 'earth', mount: kit('bull')}),
  F('ram', 'Ram · Lamb', 'cinnabar', 'mountain', 'ledge and slope', {sign: '♈', element: 'fire', mount: kit('ram')}),
  F('fishes', 'Fishes', 'lapis', 'water', 'current and pool', {sign: '♓', element: 'water', mount: kit('fishes')}),
  F('eagle', 'Eagle', 'lapis', 'sky', 'perch and thermal; the crown of a tree', {mount: kit('eagle')}),
  F('crab', 'Crab', 'bone', 'shore', 'tideline and burrow', {sign: '♋', element: 'water', mount: kit('crab')}),
  F('horse', 'Horse', 'bone', 'grassland', 'the open plain, with the herd', {mount: kit('horse')}),
  F('honeybee', 'Honeybee', 'amber', 'hive', 'the dance floor, between the comb and the entrance', {mount: kit('honeybee')}),
  F('ant', 'Ant', 'umber', 'hive', 'entrance and floor', {mount: kit('ant')}),
  F('monarch', 'Monarch', 'cinnabar', 'tree', 'the crown, hung on the bough', {mount: kit('monarch')}),
  // Not built yet: each draws its glyph, named and dark.
  F('bat', 'Bat · Dolphin', 'obsidian', 'sky', 'the cave and the open air'),
  F('dragonfly', 'Dragonfly', 'lapis', 'water', 'the pond and its margin'),
  F('firefly', 'Firefly', 'amber', 'forest', 'the dark under the trees'),
  F('dog', 'Dog', 'umber', 'field', 'the edge of the flock'),
  F('octopus', 'Octopus', 'cinnabar', 'water', 'the reef'),
  F('hoverfly', 'Hoverfly', 'amber', 'field', 'the flowering margin'),
  F('raven', 'Raven · Crow', 'obsidian', 'sky', 'the high branch'),
  F('bear', 'Bear', 'umber', 'forest', 'the den', {}),
  F('elephant', 'Elephant', 'umber', 'grassland', 'the waterhole route'),
  F('twins', 'Twins', 'lapis', 'none', 'one post, two figures', {sign: '♊', element: 'air'}),
  F('cuckoo', 'Cuckoo', 'umber', 'tree', 'the host\'s nest'),
  F('rider', 'Rider', 'bone', 'grassland', 'on the carrier'),
]
export const FIGURES: Readonly<Record<string, Figure>> = Object.fromEntries(FIGURE_LIST.map(f => [f.id, f]))
export const figureOf = (id: string): Figure => FIGURES[id] ?? FIGURES.serpent!
export const built = (f: Figure) => f.mount !== undefined
/** The element's ink as a colour, where the figure has an element; else the figure's own. */
export const elementColour = (f: Figure) => INK[f.element ? ELEMENT_INK[f.element] : f.ink]

/** Which figure is the face of each pattern: the built animal whose mechanism it is, else the first named one that is not built. */
export const FACE_OF: Readonly<Record<string, string>> = {
  watch: 'eagle', ambush: 'serpent', scout: 'honeybee', guard: 'lion', ping: 'bat', intercept: 'dragonfly',
  trail: 'ant', recruit: 'honeybee', quorum: 'honeybee', flock: 'fishes', sync: 'firefly', drive: 'lion', herd: 'dog', arm: 'octopus',
  contest: 'bull', exchange: 'fishes', mimic: 'hoverfly',
  tend: 'honeybee', clear: 'ant', shed: 'crab', cache: 'raven', dormancy: 'bear', hold: 'elephant', relief: 'twins',
  relay: 'monarch', home: 'fishes', haul: 'ant', vacate: 'crab', drop: 'cuckoo', mount: 'horse',
  metamorph: 'monarch', imprint: 'ram',
}
export const faceOf = (pattern: string): Figure => figureOf(FACE_OF[pattern] ?? 'serpent')

/** What a creature does in each run state (spec 25): a posture, or a gait, and an act that plays over it. A stalled creature has no pose of
 * its own: it freezes where it stopped. The postures and actions are each creature's own (its page lists them). */
export interface Pose {readonly posture?: string; readonly gait?: string; readonly act?: string; readonly args?: Readonly<Record<string, unknown>>}
type Poses = Readonly<Partial<Record<RunState, Pose>>>
export const POSES: Readonly<Record<string, Poses>> = {
  eagle: {queued: {posture: 'perched'}, thinking: {posture: 'perched', act: 'glance'}, acting: {posture: 'crouch'}, waiting: {posture: 'perched', act: 'headsLook'}, producing: {posture: 'displayed'}, done: {posture: 'perched'}, failed: {posture: 'crouch'}},
  bull: {queued: {posture: 'lie'}, thinking: {posture: 'stand', act: 'listen'}, acting: {posture: 'brace'}, waiting: {posture: 'stand', act: 'glance'}, producing: {posture: 'stand', act: 'bellow'}, done: {posture: 'lie'}, failed: {posture: 'kneel'}},
  ram: {queued: {posture: 'lie'}, thinking: {posture: 'stand', act: 'listen'}, acting: {posture: 'brace'}, waiting: {posture: 'stand', act: 'glance'}, producing: {posture: 'agnus'}, done: {posture: 'lie'}, failed: {posture: 'kneel'}},
  horse: {queued: {posture: 'doze'}, thinking: {posture: 'alert', act: 'listen'}, acting: {posture: 'stand', gait: 'walk'}, waiting: {posture: 'stand', act: 'glance'}, producing: {posture: 'alert', act: 'whinny'}, done: {posture: 'lie'}, failed: {posture: 'kneel'}},
  fishes: {queued: {posture: 'sign'}, thinking: {posture: 'close'}, acting: {posture: 'ring'}, waiting: {posture: 'sign'}, producing: {posture: 'classic'}, done: {posture: 'sign'}, failed: {posture: 'lying'}},
  crab: {queued: {posture: 'rest'}, thinking: {posture: 'raised', act: 'scan'}, acting: {posture: 'raised', gait: 'scuttle'}, waiting: {posture: 'rest'}, producing: {posture: 'raised', act: 'moon'}, done: {posture: 'tucked'}, failed: {posture: 'dug-in'}},
  honeybee: {queued: {posture: 'rest'}, thinking: {posture: 'stand', act: 'groom'}, acting: {posture: 'fan'}, waiting: {posture: 'stand'}, producing: {posture: 'dance'}, done: {posture: 'rest'}, failed: {posture: 'fallen'}},
  ant: {queued: {posture: 'low'}, thinking: {posture: 'stand', act: 'groom'}, acting: {posture: 'carry'}, waiting: {posture: 'stand'}, producing: {posture: 'tend'}, done: {posture: 'low'}, failed: {posture: 'low'}},
  monarch: {queued: {posture: 'roost'}, thinking: {posture: 'bask'}, acting: {posture: 'fly'}, waiting: {posture: 'roost'}, producing: {posture: 'feed'}, done: {posture: 'roost'}, failed: {posture: 'down'}},
  lion: {queued: {posture: 'lie'}, thinking: {posture: 'sit'}, acting: {posture: 'stand'}, waiting: {posture: 'sit'}, producing: {posture: 'rear'}, done: {posture: 'lie'}, failed: {posture: 'crouch'}},
  serpent: {queued: {act: 'rest'}, thinking: {act: 'raise'}, acting: {act: 'rear'}, waiting: {act: 'raise'}, producing: {act: 'offer'}, done: {act: 'rest'}, failed: {act: 'drop'}},
}
/** The states in which a creature breathes (spec 25.2: only while check-ins arrive); every other state holds still. */
export const BREATHES: Readonly<Record<RunState, boolean>> = {queued: false, thinking: true, acting: true, waiting: true, stalled: false, producing: true, done: false, failed: false}
/** How far a state dims the figure's ink toward the ground: a settled or queued figure rests dim, as the stage dims the serpent (done .45, queued .2). */
export const DIM: Readonly<Record<RunState, number>> = {queued: 0.38, thinking: 0, acting: 0, waiting: 0, stalled: 0.12, producing: 0, done: 0.5, failed: 0.3}
/** How far a face enlarges a figure's canvas about its centre, so the figure fills its box (the kit's own camera frames each posture inside the
 * canvas, and a creature with empty margins, such as the fishes, would draw small). */
export const ZOOM: Readonly<Record<string, number>> = {fishes: 1.45, crab: 1.2, ant: 1.45, honeybee: 1.1, monarch: 1.1, bull: 1.15, ram: 1.2, horse: 1.2, eagle: 1.1, lion: 1.05, serpent: 1}
