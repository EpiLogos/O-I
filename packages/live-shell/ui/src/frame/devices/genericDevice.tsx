// The generic plate (manual §16.12, §11: "The panel kit draws the head, the sections and the controls of every plate, generic plates
// included"): a designed device built from a device's declared rows, drawn only with the kit (inhabitants/sdk/panel.tsx). It is
// what DeviceView drew before, moved onto the kit (ported from frame/devices/DeviceView.tsx:30-108 — the compact rows, the grouped
// whole, the light as a reading, the holder's hand-back — and deviceRuntime.ts compactRows/groupRows):
//   folded  — the activator, the name and up to two readings, read downward;
//   compact — the device's picture in a 140 × 146 well beside up to four controls, macros first;
//   whole   — the picture in a 194 × 146 well, then every row by its declared group, in declared order, in bands; pages in the head
//             when two bands do not hold them (genericLayout.ts planWhole) — nothing scrolls;
//   full    — the device's material at pane size, no controls (DLW §16.1: "Its controls stay out of the pane");
//   widget  — a 136 × 136 tile: the picture small and up to three controls or readings.
import type {ReactNode} from 'react'
import {Band, Chooser, Dial, Display, Folded, Panel, Radio, Readout, Section, TextField, Tile, Toggle, ValueBox, type LightState, type Standing} from '../../inhabitants/sdk/panel'
import type {SdkParamRow} from '../../inhabitants/sdk/define'
import type {DesignedDevice, HostedViewProps, ViewProps} from './designed'
import {lightOfBinding, activatorChange} from './designed'
import {cellOf, compactCells, controlOf, formatValue, MEASURE, planCompact, planWhole, type Cell, type Place} from './genericLayout'

export interface GenericSource {
  /** `<family>:<face>`. */
  readonly id: string
  readonly title: string
  readonly rows: readonly SdkParamRow[]
  /** The row whose reading is the activator. */
  readonly enabledKey?: string
  /** The device's own live picture at the size it is shown (the torus, the die, the field). */
  readonly picture?: (size: 'compact' | 'whole' | 'full') => ReactNode
  /** The place's own wrap for a control (Live maps a macro to a key or a MIDI control through it). */
  readonly wrapRow?: (row: SdkParamRow, control: ReactNode) => ReactNode
  /** The plate the pool shows (its head tinted, manual §16.8). */
  readonly selected?: boolean
  /** The place's own words for ⤢ and for the press on the plate. */
  readonly fullLabel?: string
  readonly hint?: string
  readonly kind?: DesignedDevice['kind']
}

const hosted = (p: ViewProps) => p as HostedViewProps

/** What a row does, for the status bar (§5.1 "Point at it: the status bar says its name and what it does"). */
export function doesOf(row: SdkParamRow): string {
  const said = row.writePath ? `Sets the owner's ${row.title.toLowerCase()}; it moves when the owner answers.` : `The owner's ${row.title.toLowerCase()}, as the owner reports it.`
  return row.disclosure ? `${said} ${row.disclosure}` : said
}

/** One row's kit control, its value read from the view's values and its standing from the host. */
export function rowControl(cell: Cell, p: HostedViewProps, place: Place): ReactNode {
  const {row} = cell, key = row.key, value = p.v[key]
  const standing: Standing = p.standing?.[key] ?? {}
  const does = doesOf(row)
  const set = (next: string | number | boolean) => p.set(key, next)
  const kind = controlOf(row, place)
  const options = (row.values ?? []).map(choice => ({value: choice, label: choice}))
  const scale = {min: row.range?.min ?? 0, max: row.range?.max ?? 1}
  const number = typeof value === 'number' ? value : NaN
  switch (kind) {
    case 'dial': return <Dial label={row.title} does={does} value={number} scale={scale} format={x => formatValue(row, x)} onChange={set} {...standing} />
    case 'box': return <ValueBox label={row.title} does={does} value={number} scale={scale} format={x => formatValue(row, x)} onChange={set} wide={place === 'widget'} {...standing} />
    case 'toggle': return <Toggle label={row.title} does={does} on={value === true} unknown={typeof value !== 'boolean'} onChange={set} {...standing} />
    case 'radio': case 'radio-stack': return <Radio label={row.title} does={does} value={typeof value === 'string' ? value : ''} options={options} stack={kind === 'radio-stack'} onChange={set} {...standing} />
    case 'chooser': return <Chooser label={row.title} does={does} value={typeof value === 'string' ? value : ''} options={options} onChange={set} wide {...standing} />
    // A text the owner takes (a name, a number it gives no range): the kit's text field, sent on Enter or on leaving it.
    case 'field': return <TextField label={row.title} does={does} value={value === undefined || value === null ? '' : String(value)} placeholder="—" wide
      onChange={text => {
        const typed = row.type === 'number' || row.type === 'duration' ? Number(text) : text
        if (typeof typed === 'number' && (!text.trim() || !Number.isFinite(typed))) return
        set(typed)
      }} {...standing} />
    case 'readout': return <Readout label={row.title} does={does} value={value === undefined ? undefined : formatValue(row, value)} />
  }
}

/** A row's control in its place: carrying its key (data-param), its holder, and the columns it spans in its section. */
function Param({cell, p, place, wrapRow}: {cell: Cell; p: HostedViewProps; place: Place; wrapRow?: GenericSource['wrapRow']}) {
  const control = rowControl(cell, p, place)
  return <div className="dv-param" data-param={cell.row.key} data-held-by={p.standing?.[cell.row.key]?.heldBy} data-span={cell.span} data-control={cell.kind}>
    {wrapRow ? wrapRow(cell.row, control) : control}
  </div>
}

/** The generic plate of a device: its five views from its rows. */
export function genericDevice(src: GenericSource): DesignedDevice {
  const rows = src.rows.filter(row => row.key !== src.enabledKey)
  const light = (p: ViewProps): LightState => {
    const owner = hosted(p).owner
    return lightOfBinding({enabledKey: src.enabledKey, values: owner ?? p.v})
  }
  const onLight = (p: ViewProps) => {
    const owner = hosted(p).owner
    if (!src.enabledKey || !owner) return undefined
    const turn = activatorChange({id: src.id, values: owner, enabledKey: src.enabledKey, write: async () => {},
      writes: key => src.rows.some(row => row.key === key && !!row.writePath)})
    return turn ? () => p.set(turn.key, turn.value) : undefined
  }
  const holders = (p: ViewProps) => {
    const names = [...new Set(Object.values(hosted(p).standing ?? {}).map(standing => standing.heldBy).filter((name): name is string => !!name))]
    return names.length ? names.join(', ') : undefined
  }
  const readings = (p: ViewProps, count: number) => [...compactCells(rows, src.enabledKey).map(cell => cell.row), ...rows.filter(row => !row.writePath)]
    .filter(row => p.v[row.key] !== undefined).slice(0, count).map(row => formatValue(row, p.v[row.key]).slice(0, 14))
  // The place's marks and the rail mark come through the navigation, as a design's head receives them (deviceHost.tsx withPlaceMarks).
  const head = (p: ViewProps) => ({title: src.title, light: light(p), onLight: onLight(p), heldBy: holders(p), marks: hosted(p).nav.marks, onRail: hosted(p).nav.rail,
    onFull: hosted(p).nav.full, fullLabel: src.fullLabel})
  // Standing in for a design's view that did not draw, the plate says why where its head would say what a press does.
  const hint = (p: ViewProps, does: string | undefined) => hosted(p).fault ?? does
  const params = (cells: readonly Cell[], p: ViewProps, place: Place) => cells.map(cell => <Param key={cell.row.key} cell={cell} p={hosted(p)} place={place} wrapRow={src.wrapRow} />)

  return {
    id: src.id,
    title: src.title,
    kind: src.kind ?? 'effect',
    defaults: {},
    firstPage: 'p1',

    folded: p => <Folded title={src.title} light={light(p)} readings={readings(p, 2)} onUnfold={p.nav.unfold} />,

    compact: p => {
      // The display and up to four macros (§2); a reading is no macro, so a device with neither stands as its head and an empty band.
      const cells = compactCells(rows, src.enabledKey)
      const plan = planCompact(cells)
      const macros = cells.length > 0 && cells.every(cell => (cell.row.macro?.maps.length ?? 0) > 0)
      return <Panel view="compact" {...head(p)} onFold={p.nav.fold} onSelect={p.nav.select} selected={src.selected} hint={hint(p, p.nav.select ? src.hint ?? 'Show every setting in the pool.' : undefined)}>
        {src.picture && <Section width={MEASURE.compactDisplay[0] + 12}>
          <Display raw w={MEASURE.compactDisplay[0]} h={MEASURE.compactDisplay[1]} label={src.title} does={`${src.title}: its live picture. Press the plate to see every setting in the pool.`}>
            <div className="dv-picture">{src.picture('compact')}</div>
          </Display>
        </Section>}
        {plan && <Section label={macros ? 'Macros' : undefined} cols={plan.cols}>{params(plan.cells, p, 'compact')}</Section>}
        {!plan && !src.picture && <Section width={MEASURE.column * 2}>{null}</Section>}
      </Panel>
    },

    whole: p => {
      const pages = planWhole(rows, src.title, {picture: !!src.picture, values: row => formatValue(row, p.v[row.key])})
      const page = pages.find(candidate => candidate.id === p.page) ?? pages[0]!
      return <Panel view="whole" {...head(p)} hint={hint(p, undefined)} pages={pages.length > 1 ? pages.map(({id, label}) => ({id, label})) : undefined} page={page.id} onPage={p.setPage}>
        {page.bands.map((band, index) => <Band key={index}>
          {band.picture && src.picture && <Section width={MEASURE.wholeDisplay[0] + 12}>
            <Display raw w={MEASURE.wholeDisplay[0]} h={MEASURE.wholeDisplay[1]} label={src.title} does={`${src.title}: its live picture.`}>
              <div className="dv-picture">{src.picture('whole')}</div>
            </Display>
          </Section>}
          {band.sections.map((section, at) => <Section key={`${section.label}:${at}`} label={section.label} cols={section.cols} grow={at === band.sections.length - 1}>
            {params(section.cells, p, 'whole')}
          </Section>)}
          {!band.sections.length && !band.picture && <Section grow><span className="dv-empty">No settings</span></Section>}
        </Band>)}
      </Panel>
    },

    full: p => <div className="dv-full" data-i={`${src.title}|${hint(p, 'The device at pane size. Its controls stay in Device view.')}`}>
      {src.picture ? src.picture('full') : <p className="dv-full-none">{src.title} draws no material of its own. Its settings are in Device view.</p>}
    </div>,

    widget: p => {
      const cells = [...compactCells(rows, src.enabledKey), ...rows.filter(row => !row.writePath).map(row => cellOf(row, 'widget'))].slice(0, 3)
      return <Tile title={src.title} light={light(p)} onFull={p.nav.full} onClose={hosted(p).nav.close}>
        {src.picture && <Display raw w={58} h={104} label={src.title}><div className="dv-picture dv-picture--mini">{src.picture('compact')}</div></Display>}
        <div className="dv-tile-controls">{params(cells, p, 'widget')}</div>
      </Tile>
    },
  }
}
