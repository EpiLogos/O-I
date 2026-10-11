/** The inhabitant device card — the rack chain's anatomy, one component
 * (WORLD-SHELL-DESIGN §5, widget guide §1/§3.7, icon-cut §5 device
 * anatomy): a header of power light, kind mark, name, owner line and the
 * fold/pop-out marks; an honest reason line; the body a face docks.
 *
 * The light is a READING, never decoration: `light` names the reading's
 * state — `on` (the owner reports it), `pending` (uncommitted work — the
 * pulsing hollow ring), or off/undefined (unknown: no illumination at all).
 *
 * Fold is the honest way to keep a device present without space: folded is
 * a title-only vertical card, as in Live. Pop-out is declared only where
 * the face's dock lifecycle names it; the mark renders only then, and the
 * press rides the host's detach door (onPopOut), never a new windowing
 * mechanism.
 *
 * Pure presentation: no store, no reads, no owner operations. */

import {type CSSProperties, type ReactNode} from 'react'
import {Icon, type IconName} from './sdk/Icon.tsx'
import {KindMark, PopOut, ChevronFold, isKindShape, type KindShapeName} from './sdk/marks.tsx'
import './inhabitantDevices.css'

/** The card light's reading. */
export type CardLight =
  | {readonly state: 'on'; readonly title: string}
  | {readonly state: 'pending'; readonly title: string}
  | {readonly state: 'admitted'; readonly title: string}
  | {readonly state: 'off'; readonly title: string}
  | {readonly state: 'none'; readonly title?: string}

export interface InhabitantCardProps {
  /** The face id (data-face-id — the capture walks bind to it). */
  readonly faceId: string
  readonly kind: string
  /** `admitted` (default) or `waiting` — the honesty standing §16 names. */
  readonly admission?: 'admitted' | 'waiting'
  /** Extra data hooks (data-document-device, data-standing, …). */
  readonly data?: Readonly<Record<string, string | number | undefined>>
  readonly light: CardLight
  /** The card's kind mark: a named mark of the cut, or a kind-shape name. */
  readonly mark?: IconName | KindShapeName
  readonly title: string
  /** The owner/context line (the `.own` slot) — identity, basis, standing. */
  readonly owner?: string
  /** The honest reason line under the header (one line, full text on hover). */
  readonly note?: ReactNode
  /** Status slot at the header's right, before the marks (save outcome
   * chips, standing chips — the readings a strip carries). */
  readonly status?: ReactNode
  readonly expanded?: boolean
  readonly onToggle?: (() => void) | null
  /** Pop-out is declared: render the mark; the press is the host's door. */
  readonly popOut?: boolean
  readonly onPopOut?: (() => void) | null
  /** Body content (none for waiting faces — declared, waiting, bodyless). */
  readonly children?: ReactNode
  /** Fixed chain width (the guide's card density); default by kind. */
  readonly width?: number | string
  readonly className?: string
  readonly style?: CSSProperties
}

export function InhabitantCard({
  faceId, kind, admission = 'admitted', data, light, mark, title, owner, note,
  status, expanded = false, onToggle, popOut = false, onPopOut, children,
  width, className, style,
}: InhabitantCardProps) {
  const classes = [
    'inhabitant-device',
    admission === 'waiting' ? 'is-waiting' : '',
    expanded ? 'is-expanded' : '',
    onToggle && !expanded ? 'can-expand' : '',
    className ?? '',
  ].filter(Boolean).join(' ')
  const hooks = Object.fromEntries(
    Object.entries(data ?? {}).filter(([, value]) => value !== undefined).map(([key, value]) => [`data-${key}`, String(value)]),
  )
  return (
    <article
      className={classes}
      data-face-id={faceId}
      data-face-kind={kind}
      data-admission={admission}
      data-expanded={expanded ? 'true' : 'false'}
      {...hooks}
      style={{...(width !== undefined ? {width: typeof width === 'number' ? `${width}px` : width} : {}), ...style}}
    >
      <header className="inhabitant-device-head">
        <span
          className={`inhabitant-light${light.state === 'on' ? ' is-engaged' : light.state === 'pending' ? ' is-pending' : light.state === 'admitted' ? ' is-admitted' : ''}`}
          title={light.title}
          data-light-state={light.state}
        />
        {mark !== undefined && (
          <span className="inhabitant-device-mark">
            {isKindShape(mark) ? <KindMark kind={mark} size={12} title={`${title} kind`} /> : <Icon name={mark} size={12} />}
          </span>
        )}
        {onToggle
          ? <button type="button" className="inhabitant-device-title" data-action="expand" aria-expanded={expanded} title={`${title} — click to ${expanded ? 'fold the body' : 'dock the body'}`} onClick={onToggle}>{title}</button>
          : <strong className="inhabitant-device-title">{title}</strong>}
        {owner && <span className="inhabitant-device-sub">{owner}</span>}
        <span className="inhabitant-device-x">
          {status}
          {popOut && (
            <button type="button" className="inhabitant-device-mark-btn" data-action="pop-out" title={`${title} pops out through the pane engine's detach door`} disabled={!onPopOut} onClick={onPopOut ?? undefined}>
              <PopOut size={10} />
            </button>
          )}
          {onToggle && (
            <button type="button" className="inhabitant-device-fold" data-action="fold" aria-expanded={expanded}
              title={expanded ? 'Fold to the strip' : 'Dock the body under the strip'} onClick={onToggle}>
              <ChevronFold size={10} className={expanded ? 'is-open' : undefined} />
            </button>
          )}
        </span>
      </header>
      {note !== undefined && <p className="inhabitant-device-note" title={typeof note === 'string' ? note : undefined}>{note}</p>}
      {children}
    </article>
  )
}

/** The save router's five named outcomes, each with its own visual — the
 * document device's warp markers (WORLD-SHELL-DESIGN §12). Rendered from
 * the router's actual outcome; before any attempt the strip carries no chip
 * at all (no claim is not a state to decorate). */
export const OUTCOME_TITLES: Readonly<Record<string, string>> = Object.freeze({
  saved: 'saved — the native save was acknowledged',
  unchanged: 'unchanged — nothing was staged, so nothing was sent',
  stale: 'stale — the native source moved; review before saving',
  conflict: 'conflict — the acknowledgement contradicted the write',
  refused: 'refused — the owner declined or is unavailable',
})

export function SaveOutcomeChip({outcome, detail}: {readonly outcome: string; readonly detail?: string}) {
  return (
    <span
      className="inhabitant-outcome-chip"
      data-outcome={outcome}
      role="status"
      aria-live="polite"
      title={`${OUTCOME_TITLES[outcome] ?? outcome}${detail ? ` — ${detail}` : ''}`}
    >
      {outcome}
    </span>
  )
}
