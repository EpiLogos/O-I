// Type (manual §19.4 Identity page, §19.1 Agent types in the browser, §25.6): the preset an agent was given, as a band of the Agent's
// Identity page. A type is a pattern from six families, and the animal that does it is its face. Choosing one loads its preset: the
// settings of the devices an agent already has that the pattern's eight fields name. A field with no setting is shown named and dark.
//   well      the creature, in the posture of the agent's run state, and what its thread does
//   family    Sense, Coordinate, Settle, Keep, Carry, Change
//   pattern   the family's patterns, each with its creature at rest; a creature not drawn yet is dark
//   lands     the pattern's eight fields: where each lands, or why it has no setting
import {useMemo, useState} from 'react'
import {Band, Display, Radio, Rows, Section, type Option, type RowItem} from '../../sdk/panel'
import {FAMILIES, PATTERNS, countOf, isCrew, presetCounts, presetRows, type Pattern, type RunState} from './agency'
import {built, faceOf} from './figures'
import {CreatureFace, FigureThumb} from './CreatureFace'
import {CrewFace} from './CrewFace'
import {SCENES} from './scene'

export const NO_TYPE = 'No type: the profile names none, and nothing has loaded one.'

const SAYS = {
  family: 'The family of the type: what the thread does. Sense reads, Coordinate works with others, Settle agrees, Keep tends, Carry hands on, Change alters its own scope.',
  pattern: 'A type is a pattern, and its creature is its face. A creature that is not drawn yet shows its sign, dark. Press a name to load its preset.',
  lands: 'The pattern\'s eight fields, and where each lands: a lit row has a setting, a dark one has none yet. Press a row to read it.',
}

/** What a field's lands say, in a line. */
function landsText(row: ReturnType<typeof presetRows>[number]): string {
  if (row.lands.length) return row.lands.map(l => `${l.device} · ${l.setting} ${l.value}`).join('; ') + (row.dark ? `. ${row.dark}` : '')
  return row.dark ?? (row.field === 'Failure' ? row.value : 'Asks nothing of a setting.')
}

export interface TypeBandProps {
  /** The pattern the agent was given; undefined when nothing names one. */
  readonly pattern: string | undefined
  /** The agent's run state: the face takes its posture. */
  readonly state: RunState
  /** Press a pattern: load its preset. Absent, the chooser cannot act (the host stands it disabled). */
  readonly onChoose?: (pattern: string) => void
  /** Whether the Agent's own setting a pattern writes already stands as the preset has it; absent for a setting that is another device's. */
  readonly stands?: (key: string, to: boolean | string | number) => boolean | undefined
  readonly reduced?: boolean
}

/** The type's well: the face, the pattern's name and what its thread does, the eight run states with the current one lit. */
export function TypeWell({pattern, state, w = 194, h = 146, reduced}: {pattern: string | undefined; state: RunState; w?: number; h?: number; reduced?: boolean}) {
  const p = pattern ? PATTERNS[pattern] : undefined
  const figure = p ? faceOf(p.id) : undefined
  const faceW = Math.min(w - 12, Math.round((h - 52) / 0.78))
  return <Display w={w} h={h} raw label="Type" does={p ? `${p.name}: it ${p.does}. Its face is the ${figure!.name}${built(figure!) ? '' : ', which is not drawn yet'}.` : NO_TYPE}
    corner={p ? `${p.family} · ${isCrew(p) ? countOf(p).toLowerCase() : 'one'}` : undefined}>
    {p && figure ? (SCENES[p.id]
      /* a pattern the face rig performs as a crew: the pane fills the well, and the name stands over it */
      ? <div className="fx-well fx-well--scene">
        <CrewFace pattern={p.id} state={state} width={Math.min(w - 4, Math.round(h / 0.95))} reduced={reduced} />
        <div className="fx-well-name"><b>{p.name}</b><span>{figure.name}</span></div>
      </div>
      : <div className="fx-well">
        <div className="fx-well-face"><CreatureFace figure={figure.id} state={state} size={faceW} reduced={reduced} /></div>
        <div className="fx-well-name"><b>{p.name}</b><span>{figure.name}{built(figure) ? '' : ' · not drawn'}</span></div>
        <div className="fx-well-does">{p.does}</div>
      </div>) : <div className="fx-well fx-well--none"><span>{NO_TYPE}</span></div>}
  </Display>
}

const SHOWN = 5
/** The family's patterns, each a creature at rest and a name: the rack of presets in Factory's browser (§19.1), a page at a time. */
function PatternList({patterns, selected, page, onPage, onChoose}: {patterns: readonly Pattern[]; selected: string | undefined; page: number; onPage: (page: number) => void; onChoose?: (id: string) => void}) {
  const pages = Math.max(1, Math.ceil(patterns.length / SHOWN)), at = Math.min(page, pages - 1)
  return <div className="dp-cell fx-patterns" data-i={`Pattern|${SAYS.pattern}`}>
    {pages > 1 && <div className="dp-rows-head"><span className="dp-label">{patterns.length} patterns</span><span className="dp-pager">
      <button type="button" aria-label="Previous page" disabled={at === 0} onClick={() => onPage(at - 1)}>‹</button><span>{at + 1}/{pages}</span>
      <button type="button" aria-label="Next page" disabled={at === pages - 1} onClick={() => onPage(at + 1)}>›</button></span></div>}
    <ul>
      {patterns.slice(at * SHOWN, at * SHOWN + SHOWN).map(x => {
        const figure = faceOf(x.id), dark = !built(figure)
        return <li key={x.id}><button type="button" className="fx-pat" aria-pressed={x.id === selected} data-dark={dark ? 'true' : undefined} disabled={!onChoose} onClick={() => onChoose?.(x.id)}
          data-i={`${x.name}|It ${x.does}. Its face is the ${figure.name}${dark ? ', not drawn yet' : ''}. Press to load its preset.`}>
          <FigureThumb figure={figure} size={26} dim={dark} /><b>{x.name}</b><span>{figure.name.split(' ')[0]}</span>
        </button></li>
      })}
    </ul>
  </div>
}

export function TypeBand({pattern, state, onChoose, stands, reduced}: TypeBandProps) {
  const [family, setFamily] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(0)
  const chosen = pattern ? PATTERNS[pattern] : undefined
  const shown = family ?? chosen?.family ?? FAMILIES[0]!.id
  const fam = FAMILIES.find(f => f.id === shown) ?? FAMILIES[0]!
  const options: Option<string>[] = FAMILIES.map(f => ({value: f.id, label: f.name, does: `${f.patterns.length} patterns: ${f.patterns.map(x => x.name).join(', ')}.`}))
  const spec = useMemo(() => (chosen ? presetRows(chosen) : []), [chosen])
  const landRows: RowItem[] = spec.map(r => {
    const settled = r.lands.length > 0 && !r.dark
    const own = r.lands.filter(l => l.key !== undefined)
    const standing = own.length ? own.every(l => stands?.(l.key!, l.to!) === true) : undefined
    return {id: r.field, name: r.field, light: r.dark ? 'dark' : settled ? (standing === false ? 'unknown' : 'lit') : r.field === 'Failure' ? 'unknown' : 'dark',
      tone: 'accent', note: r.field === 'Failure' ? '' : r.value.length > 15 ? r.value.slice(0, 14) + '…' : r.value, does: landsText(r),
      why: r.dark}
  })
  return <Band>
    <Section width={206}><TypeWell pattern={pattern} state={state} reduced={reduced} /></Section>
    <Section label="Family" width={92}>
      <Radio label={undefined} does={SAYS.family} value={fam.id} options={options} stack onChange={id => { setFamily(id); setPage(0) }} />
    </Section>
    <Section label={`Pattern · ${fam.name}`} width={172}>
      <PatternList patterns={fam.patterns} selected={pattern} page={page} onPage={setPage} onChoose={onChoose} />
    </Section>
    <Section label={chosen ? `Lands · ${(() => { const n = presetCounts(chosen); return `${n.set} set, ${n.dark} dark` })()}` : 'Lands'} grow>
      <Rows does={SAYS.lands} items={landRows} size={8} />
    </Section>
  </Band>
}
