/** The icon law, as a component: every mark a face renders comes from the
 * cut (icons.ts, generated from icon-cut.html). A face never inlines SVG.
 *
 * The component renders the specimen's exact wrapper attributes (see
 * renderIcon) so a mark on a device face is pixel-identical to the mark in
 * the specimen sheet. Colour rides `currentColor`; states are styled by the
 * plate, never baked into a mark. */

import type {CSSProperties} from 'react'
import {ICON_MARKS, type IconName} from './icons.ts'

export {renderIcon, isIconName, ICON_NAMES, ICON_MARKS} from './icons.ts'
export type {IconName} from './icons.ts'

export interface IconProps {
  readonly name: IconName
  readonly size?: number
  /** Accessible name when the icon stands alone; decorative when absent. */
  readonly title?: string
  readonly className?: string
  readonly style?: CSSProperties
}

export function Icon({name, size = 16, title, className, style}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{__html: ICON_MARKS[name]}}
    />
  )
}
