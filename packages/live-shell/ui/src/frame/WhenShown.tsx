import {useRef, type ReactNode} from 'react'

/** Children that mount the first time `shown` is true and stay mounted after (state retained when hidden again). Until then they
 * are not rendered, so a residence nobody has opened reads nothing at start-up. */
export function WhenShown({shown, children}: {shown: boolean; children: ReactNode}) {
  const seen = useRef(false)
  if (shown) seen.current = true
  return seen.current ? <>{children}</> : null
}
