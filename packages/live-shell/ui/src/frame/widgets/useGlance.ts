// A body hands the rail what it read (widgets.ts WidgetGlance) whenever the reading changes, and takes it back when the
// body leaves (the widget closed): the rail then draws the widget's designed mark again, never a stale reading.
import {useEffect} from 'react'
import type {WidgetGlance} from './widgets'

export function useGlance(hand: ((glance: WidgetGlance | null) => void) | undefined, glance: WidgetGlance | null): void {
  const key = JSON.stringify(glance)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the reading
  useEffect(() => { hand?.(glance) }, [hand, key])
  useEffect(() => () => hand?.(null), [hand])
}
