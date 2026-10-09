/** The icon law, as components for the marks beyond the 24×24 dictionary:
 * the device header's fold chevron and pop-out mark, the filled kind marks,
 * and the woodcut practice marks. Each renders the exact string
 * icons.ts carries (resolved from icon-cut.html by the sync) — a face never
 * inlines SVG, and a mark's bytes are the specimen's bytes.
 *
 * Colour rides currentColor (and the marks' own fills); states are styled
 * by the plate, never baked into a mark. */

import type {CSSProperties, ReactElement} from 'react'
import {
  CHEVRON_FOLD,
  CHEVRON_POP,
  KIND_SHAPES,
  WOOD_MARKS,
  isKindShape,
  isWoodKind,
  type KindShapeName,
  type WoodKind,
  type WoodMark,
  type WoodSet,
  type WoodState,
} from './icons.ts'

export {isKindShape, isWoodKind}
export type {KindShapeName, WoodKind, WoodSet, WoodState}

export interface MarkProps {
  readonly size?: number
  /** Accessible name when the mark stands alone; decorative when absent. */
  readonly title?: string
  readonly className?: string
  readonly style?: CSSProperties
}

function markSvg(html: string, size: number, title: string | undefined, className: string | undefined, style: CSSProperties | undefined): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{__html: html}}
    />
  )
}

/** The device header's fold chevron (the specimen's FOLD, 10×10). Rotate it
 * with a class when the expanded state wants the chevron flipped. */
export function ChevronFold({size = 10, title, className, style}: MarkProps) {
  return markSvg(CHEVRON_FOLD, size, title, className, style)
}

/** The pop-out mark (the specimen's POP, 10×10) — the ↗ affordance for a
 * device that detaches through the pane engine's door. */
export function PopOut({size = 10, title, className, style}: MarkProps) {
  return markSvg(CHEVRON_POP, size, title, className, style)
}

/** A filled kind mark — the specimen's kindShape drawings (day, doc,
 * source, world, agent, ghost, …). Refuses an unknown kind loudly in
 * development by rendering nothing: a face asks for a NAMED mark. */
export function KindMark({kind, size = 14, title, className, style}: MarkProps & {readonly kind: KindShapeName}) {
  return markSvg(KIND_SHAPES[kind], size, title, className, style)
}

/** A woodcut practice mark — skill / skillset / method / methodology, in
 * either set, with the specimen's size/state rule (small drawing at 20px
 * and below, hatching from 28px up, warn draws the line in stall colour,
 * denied dims via the specimen's own `wood dim` class). */
export function WoodMark({kind, size = 14, state = 'whole', set = 'blade', title, className, style}: MarkProps & {
  readonly kind: WoodKind
  readonly state?: WoodState
  readonly set?: WoodSet
}) {
  const g: WoodMark = WOOD_MARKS[set][kind]
  const small = size <= 20
  const sw = size >= 64 ? 1.35 : size >= 32 ? 1.15 : small ? 1.2 : 1.1
  const col = state === 'warn' ? 'var(--stall)' : 'currentColor'
  const body = small ? g.small : g.line + (size >= 28 ? `<g stroke-width="${(sw * .72).toFixed(2)}">${g.hatch}</g>` : '')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke={col}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={state === 'outline' ? `wood dim${className ? ` ${className}` : ''}` : className}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{__html: `<g${g.tf ? ` transform="${g.tf}"` : ''}>${body}</g>`}}
    />
  )
}

/** Named-mark guard for faces that take a mark name from data. */
export function knownKindShape(candidate: string): candidate is KindShapeName {
  return isKindShape(candidate)
}

export function knownWoodKind(candidate: string): candidate is WoodKind {
  return isWoodKind(candidate)
}
