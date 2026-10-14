// The Clip view's anatomy (manual §3: "Clip view shows the thing itself"; world-shell-mockup.html clipDetail() :1651-1680 and
// its CSS :147-152, :375-378): a props column — the clip's name on its colour, then key and value rows — beside named columns,
// each a heading over its rows. Every mode's clip body draws through it. Pure presentation: it reads nothing; a value no owner
// disclosed is shown as "—" (the mockup's own grammar), never filled in, and a column whose owner discloses nothing says so in
// one line.
import type {CSSProperties, ReactNode} from 'react'

/** One key and value row of the props column (`.kvs`). A null value is undisclosed: it shows "—". */
export interface ClipRow {
  key: string
  value: ReactNode | null
  /** What the row reads, or why it is undisclosed — the hover text. */
  title?: string
}

/** One named column (`.ccol`): its heading (`h5`) over its body. */
export interface ClipColumn {
  name: string
  /** A fixed width in px (the mockup's first columns); the last column takes the rest. */
  width?: number
  body: ReactNode
}

export interface ClipViewProps {
  /** The clip's name, on the head of the props column (`.cph`). */
  name: string
  /** The head's colour — the clip's track colour when its owner gives one; absent, the shell's raised ground. */
  colour?: string | null
  rows: readonly ClipRow[]
  columns: readonly ClipColumn[]
  /** One line under the rows: the owner's own words when a read was refused or a state needs saying. */
  note?: ReactNode
  /** The kind of clip, for the hooks the checks read (`data-clip-view`). */
  kind?: string
}

export function ClipView({name, colour, rows, columns, note, kind}: ClipViewProps) {
  const head = colour ? {'--cph': colour, '--cph-ink': 'var(--bg-0)'} as CSSProperties : undefined
  return <div className="clipv" data-clip-view={kind ?? ''}>
    <div className="cprops" aria-label={`${name}: what it is`}>
      <div className="cph" style={head} title={name}>{name}</div>
      {rows.map(row => <div key={row.key} className="kvs" title={row.title} data-row={row.key}>
        <span>{row.key}</span>
        <span data-undisclosed={row.value === null ? 'true' : undefined}>{row.value ?? '—'}</span>
      </div>)}
      {note && <p className="cprops-note" role="status">{note}</p>}
    </div>
    {columns.map(column => <section key={column.name} className="ccol" aria-label={column.name} data-column={column.name}
      style={column.width ? {width: column.width, flex: 'none'} : undefined}>
      <h5>{column.name}</h5>
      {column.body}
    </section>)}
  </div>
}

/** One row of a column (`.hl2`): a small lead (a time, a mark), the row's text, and an optional faint right-hand reading. */
export function ClipLine({lead, chip, children, right, title, onPress}: {
  lead?: ReactNode
  /** A word set as a mono chip (the log's tool, the relation's type). */
  chip?: ReactNode
  children: ReactNode
  right?: ReactNode
  title?: string
  /** A row that opens its material (the mockup's rows open what they name). */
  onPress?: () => void
}) {
  const body = <>
    {lead !== undefined && <span className="hl2-lead">{lead}</span>}
    {chip !== undefined && <span className="hl2-chip">{chip}</span>}
    <span className="hl2-text">{children}</span>
    {right !== undefined && <span className="r">{right}</span>}
  </>
  return onPress
    ? <button type="button" className="hl2" title={title} onClick={onPress}>{body}</button>
    : <div className="hl2" title={title}>{body}</div>
}

/** What a column says when its owner discloses nothing: one line. */
export function ClipNone({children}: {children: ReactNode}) {
  return <p className="ccol-none">{children}</p>
}

/** What the clip side says while nothing of its mode is selected: one line, the mode's own words, no body under it. */
export function ClipWaiting({line}: {line: string}) {
  return <p className="clip-empty" role="status">{line}</p>
}
