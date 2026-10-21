// The rack of an instrument of the map (manual §16.16): an instrument's working parts, positions 1 to 4, as chains side by side, framed by
// its position 0 above and its position 5 below. Live's nearest: the Instrument Rack's chain list, and its zone editor drawn as a map.
// The display is the rack whole: the frame's two bars, the four chains as columns, and each chain's own six positions as cells, as deep as
// the map goes. A part a device carries is lit and names it; a part nothing carries keeps its place, named and dark. The Torus (M1′), the
// Sky (M2′) and the M3 clock (M3′) carry this rack as their Rack page (RackBands below, on the same keys); M4′ has no instrument face of
// its own in a chain, so its rack stands as this device.
//
// Owners, and the keys on their paths:
//   rack        {instrument, coordinate, name, face, registry, positions: [{pos, ref, name, device, where, ledger, parts: [{ref, name,
//               ledger}]}]}. The positions, their names and their parts are Quaternal Logic's M registry, read coordinate by coordinate
//               (`ql kernel ledger <coordinate>`: names, children), at the registry's revision; never a reading of the census capture.
//               `ledger` is three rungs from the same ledger: in the map, bound (a computational binding names the coordinate) and
//               verified (a capability row on it stands verified in C or Rust). `device` is the catalogue device that carries the part
//               (`<family>:<face>`), and `where` the control that works it, as the instrument's entry names them; the host answers both
//               from what it holds. A part with no `where` is dark.
//   rack.part   the part you chose ('0'..'5'): the shell holds this choice.
// No kernel op reaches `ql kernel ledger` yet: the binding owes the route, and until it lands the rack draws its parts as the host holds
// them and its rungs as "—". Nothing here writes the map: the map's own refresh owns that.
import type {CSSProperties} from 'react'
import {Band, Display, Folded, Handle, Ladder, Panel, Readout, Rows, Section, Tile, type LightState, type RowItem} from '../../sdk/panel'
import {NONE, clampTo, json, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './quaternal-logic__map-rack.css'

type V = ViewProps['v']
type Rungs = readonly (boolean | null)[]
interface Part {readonly ref: string; readonly name: string; readonly ledger?: Rungs}
interface Position extends Part {readonly pos: number; readonly device?: string; readonly where?: string; readonly parts: readonly Part[]}
interface Rack {readonly instrument: string; readonly coordinate: string; readonly name: string; readonly face?: string; readonly registry?: string; readonly positions: readonly Position[]}

const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const txt = (x: unknown): string | undefined => (typeof x === 'string' && x ? x : undefined)
const rungsOf = (x: unknown): Rungs | undefined => (Array.isArray(x) && x.length === 3 ? x.map(r => (typeof r === 'boolean' ? r : null)) : undefined)
/** A coordinate in the map's grammar: the M prefix (QL-MEF's registry still writes the old `#`). */
const canon = (ref: string): string => ref.replace(/^#/, 'M')
const partOf = (x: unknown): Part[] => (rec(x) && txt(x.ref) ? [{ref: canon(x.ref as string), name: txt(x.name) ?? canon(x.ref as string), ledger: rungsOf(x.ledger)}] : [])
/** The rack the host reported, or undefined. */
export function rackOf(v: V): Rack | undefined {
  const raw = json<unknown>(v, 'rack', undefined)
  if (!rec(raw) || !Array.isArray(raw.positions)) return undefined
  const positions = raw.positions.flatMap((x): Position[] => (rec(x) && typeof x.pos === 'number' && txt(x.ref)
    ? [{pos: x.pos, ref: canon(x.ref as string), name: txt(x.name) ?? canon(x.ref as string), device: txt(x.device), where: txt(x.where), ledger: rungsOf(x.ledger),
      parts: Array.isArray(x.parts) ? x.parts.flatMap(partOf) : []}] : [])).sort((a, b) => a.pos - b.pos)
  return {instrument: txt(raw.instrument) ?? NONE, coordinate: txt(raw.coordinate) ? canon(txt(raw.coordinate)!) : NONE, name: txt(raw.name) ?? NONE, face: txt(raw.face), registry: txt(raw.registry), positions}
}
const RUNGS = ['in the map', 'bound', 'verified']
const lit = (x: Position) => x.where !== undefined
/** The device's own name from its id: 'quaternal-logic:m-prime-matrices' → 'M′ matrices'. */
const DEVICE_WORD: Record<string, string> = {'quaternal-logic:torus': 'Torus', 'quaternal-logic:sky': 'Sky', 'quaternal-logic:m3-clock': 'M3 clock', 'quaternal-logic:m-prime-matrices': 'M′ matrices',
  'quaternal-logic:deck': 'Deck', 'quaternal-logic:binding': 'Binding', 'quaternal-logic:chakra': 'Chakra', 'live:scale-mapping': 'Scale mapping'}
const deviceWord = (id: string | undefined) => (id === undefined ? undefined : DEVICE_WORD[id] ?? id.slice(id.indexOf(':') + 1))
const short = (name: string, n: number) => { const s = name.replace(/ - .*$/, ''); return s.length > n ? `${s.slice(0, n - 1)}…` : s }
const chosenOf = (v: V, rack: Rack | undefined) => { const n = Number(strOf(v, 'rack.part') ?? NaN); return rack?.positions.find(x => x.pos === n) }
export const rackCount = (v: V) => { const r = rackOf(v); if (!r) return undefined; const parts = r.positions.filter(x => x.pos >= 1 && x.pos <= 4); return `${parts.filter(lit).length}/${parts.length}` }

/** The rack whole: position 0 as the bar above, 5 as the bar below, 1 to 4 as columns between, each with its own six positions. Handle 1
 * is the part you chose: drag it along the rack. */
export function RackWell({p, w, h, labels, handles}: {p: ViewProps; w: number; h: number; labels: boolean; handles: boolean}) {
  const rack = rackOf(p.v)
  if (!rack) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{w > 100 ? 'No reading of the rack' : NONE}</text>
  const pad = 5, top = w > 80 ? 15 : pad, bar = labels ? 16 : 10, x0 = pad, x1 = w - pad, cw = (x1 - x0) / 4, y0 = top + bar + 4, y1 = h - pad - bar - 4
  const at = (n: number) => rack.positions.find(x => x.pos === n), chosen = chosenOf(p.v, rack), fs = labels ? 8 : 6.5
  const off = st(p, 'rack.part').disabled
  const frame = (x: Position | undefined, y: number, n: number) => <g>
    <rect x={x0} y={y} width={x1 - x0} height={bar} rx={2} fill={x && lit(x) ? 'var(--dp-value)' : 'var(--dp-well)'} opacity={x && lit(x) ? .28 : 1}
      stroke={chosen?.pos === n ? 'var(--dp-on)' : 'var(--dp-value-dim)'} strokeWidth={chosen?.pos === n ? 1.4 : .7} strokeDasharray={x && !lit(x) ? '3 2' : undefined} />
    <text x={x0 + 4} y={y + bar / 2 + 3} className="dp-ink" style={{fontSize: fs}}>{`${n}${labels && x ? `  ${short(x.name, 34)}` : ''}`}</text>
  </g>
  return <g>
    {frame(at(0), top, 0)}
    {frame(at(5), h - pad - bar, 5)}
    {[1, 2, 3, 4].map((n, i) => { const x = at(n), cx = x0 + i * cw, on = x !== undefined && lit(x), kids = x?.parts ?? [], rows = Math.max(6, kids.length)
      const ch = (y1 - y0 - (labels ? 16 : 10)) / rows
      return <g key={n}>
        <rect x={cx + 2} y={y0} width={cw - 4} height={y1 - y0} rx={3} fill="none" stroke={chosen?.pos === n ? 'var(--dp-on)' : on ? 'var(--dp-value)' : 'var(--dp-value-dim)'}
          strokeWidth={chosen?.pos === n ? 1.4 : .8} strokeDasharray={on ? undefined : '3 2'} opacity={on ? 1 : .7} />
        <text x={cx + cw / 2} y={y0 + (labels ? 11 : 8)} textAnchor="middle" className={on ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: fs + (labels ? 1 : 0)}}>{n}</text>
        {Array.from({length: rows}, (_, k) => { const kid = kids[k], y = y0 + (labels ? 16 : 10) + k * ch
          return <rect key={k} x={cx + 6} y={y + 1} width={cw - 12} height={Math.max(1.5, ch - 2)} rx={1}
            fill={kid && on ? 'var(--dp-value)' : 'none'} opacity={kid ? (on ? (kid.ledger?.[1] ? .7 : .35) : 1) : .25}
            stroke={kid && !on ? 'var(--dp-value-dim)' : 'none'} strokeDasharray={kid && !on ? '2 2' : undefined} strokeWidth={.6} /> })}
        {labels && x && <text x={cx + cw / 2} y={y1 - 3} textAnchor="middle" className="dp-axis" style={{fontSize: fs - .5}}>{short(x.name, Math.floor(cw / 4.6))}</text>}
      </g> })}
    {handles && chosen && <Handle n={1} shape="ring" label="Part"
      x={chosen.pos === 0 || chosen.pos === 5 ? x1 - 10 : x0 + (chosen.pos - .5) * cw} y={chosen.pos === 0 ? top + bar / 2 : chosen.pos === 5 ? h - pad - bar / 2 : y0 + (labels ? 7 : 5)}
      does={`Drag along the rack, or up and down to the frame: the part to read.${off ? ` ${off}` : ''}`}
      onDrag={off ? undefined : (x, y) => { const n = y < y0 - 2 ? 0 : y > y1 + 2 ? 5 : clampTo(1, 4, Math.floor((x - x0) / cw) + 1); if (n !== chosen.pos) p.set('rack.part', String(n)) }} />}
  </g>
}

const partRows = (rack: Rack | undefined): RowItem[] => (rack?.positions ?? []).map(x => ({id: String(x.pos), name: `${x.pos} ${short(x.name, 22)}`, light: lit(x) ? 'lit' : 'dark', tone: 'value',
  note: x.pos === 0 || x.pos === 5 ? 'frame' : deviceWord(x.device) ?? (lit(x) ? undefined : 'dark'),
  why: lit(x) ? undefined : 'Nothing carries this part yet. It keeps its place, named and dark.', does: `${x.ref} · ${x.where ?? 'nothing carries it'}`}))
const childRows = (x: Position | undefined, carried: boolean): RowItem[] => (x?.parts ?? []).map(k => ({id: k.ref, name: short(k.name, 24), light: carried ? 'lit' : 'dark', tone: 'value',
  meter: k.ledger ? <Ladder rungs={k.ledger} labels={RUNGS} label={k.ref} /> : undefined, does: k.ref}))
const RACK_DOES = 'The rack: position 0 above and 5 below frame it; positions 1 to 4 are its chains, each with its own six. A dashed part is one nothing carries yet. Drag handle 1 to choose a part.'

/** The rack as an instrument carries it on its Rack page: the rack whole, the chain list, the part you chose, its own six. */
export function RackBands({p}: {p: ViewProps}) {
  const rack = rackOf(p.v), chosen = chosenOf(p.v, rack), choose = st(p, 'rack.part').disabled ? undefined : (id: string) => p.set('rack.part', id)
  return <>
    <Band>
      <Section width={198}><Display w={186} h={146} label="The rack" does={RACK_DOES} corner={rack ? `${rack.instrument} · ${rackCount(p.v)}` : NONE}>
        <RackWell p={p} w={186} h={146} labels handles /></Display></Section>
      <Section label="Parts" width={170}><Rows does="The instrument's six positions: 0 and 5 frame it, 1 to 4 work. A dark row is a part nothing carries yet. Press a row to read it." items={partRows(rack)} size={6}
        onSelect={choose} selected={chosen ? String(chosen.pos) : undefined} /></Section>
      <Section label="Part" grow>
        <Readout big label={chosen ? `${chosen.pos}` : 'part'} does="The part you chose, by its name in the map." value={chosen ? short(chosen.name, 18) : undefined} tone={chosen && lit(chosen) ? 'value' : undefined} />
        <Readout label="coordinate" does="The part's coordinate in the map. Press to copy it." value={chosen?.ref} copy={chosen?.ref} />
        <Readout label="carried by" does="The device that carries the part, or dark where nothing does." value={chosen ? deviceWord(chosen.device) ?? (lit(chosen) ? 'a page' : 'dark') : undefined} tone={chosen && !lit(chosen) ? 'stall' : undefined} />
        <div className="mrk-ladder" data-i={`Ledger|${chosen?.ledger ? RUNGS.map((r, i) => `${r} ${chosen.ledger![i] ? 'yes' : chosen.ledger![i] === false ? 'no' : '—'}`).join(' · ') : 'No reading of the ledger.'}`}>
          <Ladder rungs={chosen?.ledger ?? [null, null, null]} labels={RUNGS} size="tall" label="The part in the ledger" /></div>
      </Section>
    </Band>
    <Band>
      <Section label={chosen ? `Its own · ${chosen.parts.length}` : 'Its own'} grow>
        <Rows does={`The part's own positions, as the map holds them. The ticks: in the map, bound, verified.${chosen && !lit(chosen) ? ' Dark: nothing carries the part yet.' : ''}`}
          items={chosen ? (chosen.parts.length ? childRows(chosen, lit(chosen)) : [{id: 'none', name: 'The map holds no positions under it', light: 'dark'}]) : [{id: 'none', name: rack ? 'Choose a part' : 'No reading of the rack', light: 'unknown'}]}
          size={6} columns={2} />
        <div className="mrk-where">
          <Readout label="where you work it" does="The control or page that works the part, as the instrument's entry names it." value={chosen ? chosen.where ?? 'nothing yet' : undefined} />
          <Readout label="registry" does="The revision of the map the rack reads." value={rack?.registry} />
        </div>
      </Section>
    </Band>
  </>
}

const LIGHT_WHY = 'A rack of the map has no on or off. The light stays hollow.'
const head = (p: ViewProps, title: string) => ({title, light: 'unknown' as LightState, lightWhy: LIGHT_WHY, onFold: p.nav.fold, onFull: p.nav.full})
const titleOf = (v: V) => { const r = rackOf(v); return r ? `${r.instrument} rack` : 'Rack' }

export const RACK_M1 = "{\"instrument\": \"M1′\", \"coordinate\": \"M1\", \"name\": \"Paramasiva\", \"face\": \"quaternal-logic:torus\", \"registry\": \"c211a781094d\", \"positions\": [{\"pos\": 0, \"ref\": \"M1-0\", \"name\": \"Bimba - Original Aspect\", \"device\": null, \"where\": \"Frames the instrument\", \"ledger\": [true, true, false], \"parts\": []}, {\"pos\": 1, \"ref\": \"M1-1\", \"name\": \"Pratibimba - Reflection Aspect\", \"device\": null, \"where\": null, \"ledger\": [true, true, false], \"parts\": []}, {\"pos\": 2, \"ref\": \"M1-2\", \"name\": \"Ananda\", \"device\": \"quaternal-logic:m-prime-matrices\", \"where\": \"Oscillator, M′ matrices\", \"ledger\": [true, true, false], \"parts\": [{\"ref\": \"M1-2-0\", \"name\": \"Matrix 0: The Original (Bimba)\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-2-1\", \"name\": \"Matrix 1: The Offset (Pratibimba)\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-2-2\", \"name\": \"Matrix 2: The Sum (Constructive Synthesis)\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-2-3\", \"name\": \"Matrix 3: First Difference (Pure Polarity)\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-2-4\", \"name\": \"Matrix 4: Second Difference (Complementary Polarity)\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-2-5\", \"name\": \"Matrix 5: Non-Dual Quintessence (Paradox Holder)\", \"ledger\": [true, true, false]}]}, {\"pos\": 3, \"ref\": \"M1-3\", \"name\": \"Spanda\", \"device\": \"quaternal-logic:torus\", \"where\": \"Pulses and the frame\", \"ledger\": [true, true, false], \"parts\": [{\"ref\": \"M1-3-0\", \"name\": \"Spanda Seed\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-3-1\", \"name\": \"Primal Differentiation - Original Pole\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-3-2\", \"name\": \"Primal Differentiation - Reflection Pole\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-3-3\", \"name\": \"Trika Synthesis\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-3-4\", \"name\": \"Contextual Flowering\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-3-5\", \"name\": \"Quintessential Meta-Reflection\", \"ledger\": [true, true, false]}]}, {\"pos\": 4, \"ref\": \"M1-4\", \"name\": \"Quaternal Logic Flowering\", \"device\": \"live:scale-mapping\", \"where\": \"Lens, frame, Scale mapping\", \"ledger\": [true, true, false], \"parts\": [{\"ref\": \"M1-4.0\", \"name\": \"Foundational Encoding\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-4.1\", \"name\": \"Explicate-Implicate Framework\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-4.2\", \"name\": \"Principle of Inversion\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-4.3\", \"name\": \"Bi-Directional Synthesis\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-4.4\", \"name\": \"Contextual Flowering\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-4.5\", \"name\": \"Harmonic Meta-Frames & Quintessential Integration\", \"ledger\": [true, true, false]}]}, {\"pos\": 5, \"ref\": \"M1-5\", \"name\": \"Quaternionic Integration\", \"device\": \"quaternal-logic:torus\", \"where\": \"The torus and its body\", \"ledger\": [true, true, false], \"parts\": [{\"ref\": \"M1-5-0\", \"name\": \"Quaternionic Foundation\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-5-1\", \"name\": \"Volumetric Potential\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-5-2\", \"name\": \"Double-Covering Principle\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-5-3\", \"name\": \"Inversion and Shadow Dynamics\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-5-4\", \"name\": \"Bridge to Parashakti\", \"ledger\": [true, true, false]}, {\"ref\": \"M1-5-5\", \"name\": \"Complete Self-Realization\", \"ledger\": [true, true, false]}]}]}"
export const RACK_M2 = "{\"instrument\": \"M2′\", \"coordinate\": \"M2\", \"name\": \"Parashakti\", \"face\": \"quaternal-logic:sky\", \"registry\": \"c211a781094d\", \"positions\": [{\"pos\": 0, \"ref\": \"M2-0\", \"name\": \"Archetypal Numerical Ground\", \"device\": null, \"where\": \"Frames the instrument\", \"ledger\": [true, true, true], \"parts\": []}, {\"pos\": 1, \"ref\": \"M2-1\", \"name\": \"MEF - Meta-Logikon\", \"device\": \"live:scale-mapping\", \"where\": \"Lens, frame, Scale mapping\", \"ledger\": [true, true, true], \"parts\": [{\"ref\": \"M2-1-0\", \"name\": \"Archetypal-Numerical Foundation\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-1-1\", \"name\": \"Causal Lens\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-1-2\", \"name\": \"Logical Lens (Tetralemma)\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-1-3\", \"name\": \"Processual Lens\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-1-4\", \"name\": \"Meta-Epistemic Lens\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-1-5\", \"name\": \"Divine-Scalar Lens - Vak Cosmology\", \"ledger\": [true, true, false]}]}, {\"pos\": 2, \"ref\": \"M2-2\", \"name\": \"36 Tattvas System\", \"device\": \"quaternal-logic:torus\", \"where\": \"Body source\", \"ledger\": [true, true, true], \"parts\": [{\"ref\": \"M2-2-0\", \"name\": \"Shuddha Tattvas\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-2-1\", \"name\": \"Shuddhashuddha Tattvas\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-2-2\", \"name\": \"Ashuddha Tattvas\", \"ledger\": [true, true, false]}]}, {\"pos\": 3, \"ref\": \"M2-3\", \"name\": \"Decans System\", \"device\": \"quaternal-logic:sky\", \"where\": \"The ring of decans\", \"ledger\": [true, true, true], \"parts\": [{\"ref\": \"M2-3-1\", \"name\": \"Fire Element Decans\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-3-2\", \"name\": \"Earth Element Decans\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-3-3\", \"name\": \"Air Element Decans\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-3-4\", \"name\": \"Water Element Decans\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-3-5/0\", \"name\": \"Quintessence Element\", \"ledger\": [true, true, false]}]}, {\"pos\": 4, \"ref\": \"M2-4\", \"name\": \"Vibrational Templateure\", \"device\": \"live:scale-mapping\", \"where\": \"Source scales\", \"ledger\": [true, true, true], \"parts\": [{\"ref\": \"M2-4.0\", \"name\": \"Asma ul-Husna\", \"ledger\": [true, true, true]}, {\"ref\": \"M2-4.1\", \"name\": \"100 Shaivite Mantras\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-4.2\", \"name\": \"24 Spiritual Maqamat\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-4.3\", \"name\": \"72 Musical Maqamat\", \"ledger\": [true, true, true]}, {\"ref\": \"M2-4.5\", \"name\": \"72 Names of God System\", \"ledger\": [true, true, true]}]}, {\"pos\": 5, \"ref\": \"M2-5\", \"name\": \"Planetary Harmonic Integration\", \"device\": \"quaternal-logic:sky\", \"where\": \"The Sky and its moves\", \"ledger\": [true, true, true], \"parts\": [{\"ref\": \"M2-5-0/1\", \"name\": \"Sun\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-5-2\", \"name\": \"Venus\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-5-3\", \"name\": \"Mercury\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-5-4\", \"name\": \"Moon\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-5-5\", \"name\": \"Saturn\", \"ledger\": [true, true, false]}, {\"ref\": \"M2-5-6\", \"name\": \"Jupiter\", \"ledger\": [true, true, false]}]}]}"
export const RACK_M3 = "{\"instrument\": \"M3′\", \"coordinate\": \"M3\", \"name\": \"Mahamaya\", \"face\": \"quaternal-logic:m3-clock\", \"registry\": \"c211a781094d\", \"positions\": [{\"pos\": 0, \"ref\": \"M3-0\", \"name\": \"Quaternionic Reception & Parashakti Integration Matrix\", \"device\": \"quaternal-logic:binding\", \"where\": \"Nonets\", \"ledger\": [true, true, true], \"parts\": []}, {\"pos\": 1, \"ref\": \"M3-1\", \"name\": \"I-Ching System\", \"device\": \"quaternal-logic:deck\", \"where\": \"I Ching, Hexagram\", \"ledger\": [true, true, false], \"parts\": [{\"ref\": \"M3-1-0\", \"name\": \"Qian\", \"ledger\": [true, true, true]}, {\"ref\": \"M3-1-1\", \"name\": \"Kun\", \"ledger\": [true, true, true]}, {\"ref\": \"M3-1-2\", \"name\": \"Zhen\", \"ledger\": [true, true, true]}, {\"ref\": \"M3-1-3\", \"name\": \"Xun\", \"ledger\": [true, true, true]}, {\"ref\": \"M3-1-4\", \"name\": \"Kan\", \"ledger\": [true, true, true]}, {\"ref\": \"M3-1-5\", \"name\": \"Li\", \"ledger\": [true, true, true]}]}, {\"pos\": 2, \"ref\": \"M3-2\", \"name\": \"Genetic Code Architecture\", \"device\": \"quaternal-logic:m-prime-matrices\", \"where\": \"Form matrix, Binding\", \"ledger\": [true, true, true], \"parts\": [{\"ref\": \"M3-2-1\", \"name\": \"Adenine\", \"ledger\": [true, true, true]}, {\"ref\": \"M3-2-2\", \"name\": \"Thymine\", \"ledger\": [true, true, true]}, {\"ref\": \"M3-2-3\", \"name\": \"Cytosine\", \"ledger\": [true, true, true]}, {\"ref\": \"M3-2-4\", \"name\": \"Guanine\", \"ledger\": [true, true, true]}]}, {\"pos\": 3, \"ref\": \"M3-3\", \"name\": \"Mahamaya Universal Transcription Engine\", \"device\": \"quaternal-logic:m3-clock\", \"where\": \"Law and Generation\", \"ledger\": [true, true, true], \"parts\": [{\"ref\": \"M3-3-0\", \"name\": \"Non-Dual Codon Relations\", \"ledger\": [true, true, false]}, {\"ref\": \"M3-3-1\", \"name\": \"Dual Codon Relations\", \"ledger\": [true, true, false]}, {\"ref\": \"M3-3-2\", \"name\": \"Matrix Operators\", \"ledger\": [true, true, false]}, {\"ref\": \"M3-3-3\", \"name\": \"RNA Transcription Family\", \"ledger\": [true, true, false]}, {\"ref\": \"M3-3-4\", \"name\": \"Amino Acid Architecture\", \"ledger\": [true, true, false]}, {\"ref\": \"M3-3-5\", \"name\": \"Human Karyotype\", \"ledger\": [true, true, false]}]}, {\"pos\": 4, \"ref\": \"M3-4\", \"name\": \"Minor Arcana\", \"device\": \"quaternal-logic:deck\", \"where\": \"The Tarot\", \"ledger\": [true, true, false], \"parts\": [{\"ref\": \"M3-4-1\", \"name\": \"Wands\", \"ledger\": [true, true, false]}, {\"ref\": \"M3-4-2\", \"name\": \"Cups\", \"ledger\": [true, true, false]}, {\"ref\": \"M3-4-3\", \"name\": \"Swords\", \"ledger\": [true, true, false]}, {\"ref\": \"M3-4-4\", \"name\": \"Pentacles\", \"ledger\": [true, true, false]}, {\"ref\": \"M3-4-5/0\", \"name\": \"Major Arcana\", \"ledger\": [true, true, false]}, {\"ref\": \"M3-4.0\", \"name\": \"DNA/RNA Superposition Phase Space\", \"ledger\": [true, true, false]}]}, {\"pos\": 5, \"ref\": \"M3-5\", \"name\": \"The 360° Mythic Synthesis Wheel\", \"device\": \"quaternal-logic:m3-clock\", \"where\": \"The wheel, Resonator bank\", \"ledger\": [true, true, true], \"parts\": [{\"ref\": \"M3-5-1\", \"name\": \"North Cardinal Anchor\", \"ledger\": [true, true, false]}, {\"ref\": \"M3-5-2\", \"name\": \"South Cardinal Anchor\", \"ledger\": [true, true, false]}, {\"ref\": \"M3-5-3\", \"name\": \"East Cardinal Anchor\", \"ledger\": [true, true, false]}, {\"ref\": \"M3-5-4\", \"name\": \"West Cardinal Anchor\", \"ledger\": [true, true, false]}, {\"ref\": \"M3-5-5/0\", \"name\": \"Axis Mundi - Central Unity Origin\", \"ledger\": [true, true, false]}]}]}"
export const RACK_M4 = "{\"instrument\": \"M4′\", \"coordinate\": \"M4\", \"name\": \"Nara\", \"face\": null, \"registry\": \"c211a781094d\", \"positions\": [{\"pos\": 0, \"ref\": \"M4.0\", \"name\": \"Mahamaya Identity Matrix\", \"device\": null, \"where\": \"Your Being page\", \"ledger\": [true, true, false], \"parts\": [{\"ref\": \"M4.0-0\", \"name\": \"Birthdate Encoding\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.0-1\", \"name\": \"Astrological Chart\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.0-2\", \"name\": \"Jungian Assessment\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.0-3\", \"name\": \"Gene Keys Profile\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.0-4\", \"name\": \"Human Design Profile\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.0-5\", \"name\": \"Archetypal Quintessence\", \"ledger\": [true, true, false]}]}, {\"pos\": 1, \"ref\": \"M4.1\", \"name\": \"Sympathetic Medicine\", \"device\": \"quaternal-logic:chakra\", \"where\": \"The Chakra, Sitting\", \"ledger\": [true, false, false], \"parts\": [{\"ref\": \"M4.1-0\", \"name\": \"Elemental Ground\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.1-1\", \"name\": \"Energy-Body Architecture\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.1-2\", \"name\": \"Materia & Reagents\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.1-3\", \"name\": \"Operations & Techne\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.1-4\", \"name\": \"Temporal Astrological Intelligence\", \"ledger\": [true, true, false]}, {\"ref\": \"M4.1-5\", \"name\": \"Integration, Safety & Feedback\", \"ledger\": [true, true, false]}]}, {\"pos\": 2, \"ref\": \"M4.2\", \"name\": \"Divinatory Frameworks\", \"device\": \"quaternal-logic:deck\", \"where\": \"Drawing and casting\", \"ledger\": [true, false, false], \"parts\": [{\"ref\": \"M4.2-0\", \"name\": \"Common Substrate\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.2-1\", \"name\": \"Tarot Engines\", \"ledger\": [true, true, false]}, {\"ref\": \"M4.2-2\", \"name\": \"I-Ching Integration\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.2-3\", \"name\": \"Casting & Randomness Layer\", \"ledger\": [true, true, false]}, {\"ref\": \"M4.2-4\", \"name\": \"Interpretation Layer\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.2-5\", \"name\": \"Divinatory Hygiene & Pedagogy\", \"ledger\": [true, false, false]}]}, {\"pos\": 3, \"ref\": \"M4.3\", \"name\": \"Mediating Transformation\", \"device\": null, \"where\": \"A flow's Container\", \"ledger\": [true, true, false], \"parts\": [{\"ref\": \"M4.3-0\", \"name\": \"Cycle Engine\", \"ledger\": [true, true, false]}, {\"ref\": \"M4.3-1\", \"name\": \"Operational Grammar (Alchemy)\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.3-2\", \"name\": \"Dialogical & Inquiry Containers\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.3-3\", \"name\": \"Control/Chaos & Safety\", \"ledger\": [true, true, false]}, {\"ref\": \"M4.3-4\", \"name\": \"Protocol Library (Storey Packets)\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.3-5\", \"name\": \"Telemetry & Phase History\", \"ledger\": [true, false, false]}]}, {\"pos\": 4, \"ref\": \"M4.4\", \"name\": \"Context & Lenses\", \"device\": null, \"where\": \"Lenses on a practice page\", \"ledger\": [true, false, false], \"parts\": [{\"ref\": \"M4.4.0\", \"name\": \"Gebser Lens\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.4.1\", \"name\": \"Ontological Lens\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.4.2\", \"name\": \"Epistemological Lens\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.4.3\", \"name\": \"Jungian Depth Psychology Lens\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.4.4\", \"name\": \"Phenomenological Lens\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.4.5\", \"name\": \"Trika/Kashmir Śaivism Lens\", \"ledger\": [true, false, false]}]}, {\"pos\": 5, \"ref\": \"M4.5\", \"name\": \"Epii Integration\", \"device\": null, \"where\": \"Returns to the Day\", \"ledger\": [true, false, false], \"parts\": [{\"ref\": \"M4.5-0\", \"name\": \"Curriculum Map\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.5-1\", \"name\": \"Core Epi-Logos Voice\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.5-2\", \"name\": \"Method Transparency Lab\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.5-3\", \"name\": \"Integration Lab\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.5-4\", \"name\": \"Pedagogy Lab\", \"ledger\": [true, false, false]}, {\"ref\": \"M4.5-5\", \"name\": \"Logos Cycle Engine\", \"ledger\": [true, true, false]}]}]}"

export const design: DesignedDevice = {
  id: 'quaternal-logic:map-rack',
  title: 'Rack',
  kind: 'rack',
  // M4′, of Nara: its rack, read from the M registry at revision c211a781 with the ledger's rungs; the parts carried as §16.16 and §24 name them.
  defaults: {rack: RACK_M4, 'rack.part': '1'},
  fixtures: {
    'M4′, of Nara': {},
    'M1′, the Torus': {rack: RACK_M1, 'rack.part': '1'},
    'M2′, the Sky': {rack: RACK_M2, 'rack.part': '3'},
    'M3′, the M3 clock': {rack: RACK_M3, 'rack.part': '4'},
    'No readings': {rack: undefined, 'rack.part': undefined},
  },

  folded: p => <Folded title={titleOf(p.v)} light="unknown" readings={[rackOf(p.v)?.name ?? NONE, rackCount(p.v) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => { const rack = rackOf(p.v), chosen = chosenOf(p.v, rack)
    return <Panel {...head(p, titleOf(p.v))} view="compact" onSelect={p.nav.select}>
      <Section width={152}><Display w={140} h={146} label="The rack" does={RACK_DOES} corner={rackCount(p.v) ?? NONE}><RackWell p={p} w={140} h={146} labels={false} handles /></Display></Section>
      <Section label="Part" width={124}>
        <Readout big label={chosen ? `${chosen.pos} · ${chosen.ref}` : 'part'} does="The part you chose." value={chosen ? short(chosen.name, 14) : undefined} tone="value" />
        <Readout label="carried by" does="The device that carries the part, or dark where nothing does." value={chosen ? deviceWord(chosen.device) ?? (lit(chosen) ? 'a page' : 'dark') : undefined} />
      </Section>
    </Panel> },

  whole: p => <Panel {...head(p, titleOf(p.v))} view="whole"><RackBands p={p} /></Panel>,

  full: p => { const rack = rackOf(p.v)
    return <div className="ref-pane-body mrk-full">
      <header className="mrk-full-head"><span className="dp-lamp" data-light="unknown" title={LIGHT_WHY} /><b>{titleOf(p.v)}</b>
        <span>{rack ? `${rack.name} · ${rack.coordinate} · ${rackCount(p.v)} carried · registry ${rack.registry ?? NONE}` : 'No reading of the rack'}</span></header>
      <div className="mrk-full-body">
        {(rack?.positions ?? []).map(x => { const drawn = x.device && p.member ? p.member(x.device) : null
          return <section key={x.pos} className="mrk-chain" data-frame={x.pos === 0 || x.pos === 5 ? 'true' : undefined} data-dark={lit(x) ? undefined : 'true'}>
            <h3><span className="mrk-pos">{x.pos}</span>{x.name}<small>{x.ref}</small><em>{x.where ?? 'Nothing carries it yet'}</em></h3>
            {drawn ?? <ul className="mrk-own" style={{'--n': Math.max(1, x.parts.length)} as CSSProperties}>{x.parts.length ? x.parts.map(k => <li key={k.ref}><b>{short(k.name, 30)}</b><small>{k.ref}</small>
              {k.ledger && <Ladder rungs={k.ledger} labels={RUNGS} label={k.ref} />}</li>) : <li><small>The map holds no positions under it.</small></li>}</ul>}
          </section> })}
      </div>
    </div> },

  widget: p => { const rack = rackOf(p.v)
    return <Tile title={titleOf(p.v)} light="unknown" onFull={p.nav.full}>
      <Display w={70} h={100} label="The rack" does="The rack, a dashed part dark. Press ▦ to open it in the pane that has focus."><RackWell p={p} w={70} h={100} labels={false} handles={false} /></Display>
      <div className="ref-tile-side">
        <Readout label="carried" value={rackCount(p.v)} tone="value" />
        <Readout label="dark" value={rack ? rack.positions.filter(x => !lit(x)).length : undefined} tone="accent" />
      </div>
    </Tile> },
}
