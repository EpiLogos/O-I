// A part of the shell whose code loads when it first draws, not with the window's first script (MAP, the build lane's
// loading item: "the shell loads as one 6.2 MB script before it draws anything — split it by mode and device"; O-I #740:
// a mode loads when first entered, a device when first placed or shown; tests/first-load-budget.test.mjs holds the window's
// first load to its limit). Until its module arrives the place shows the shell's waiting line for it, in words — never a
// blank; a module that did not arrive says so, with the reason, and offers to try again. Once it has arrived every later
// mount draws it at once, with no wait and no waiting line. `load()` fetches it ahead — a server render (the suites'
// renderToStaticMarkup) calls `loadEveryPart()` first, since it cannot wait for a module.
import {Fragment, createElement, useEffect, useState, type ComponentType, type CSSProperties, type FunctionComponent} from 'react'

export interface LoadedWhenDrawn<P> extends FunctionComponent<P> {
  /** Fetch the part's module now; resolves to the component it draws. */
  load(): Promise<ComponentType<P>>
}

const parts = new Set<() => Promise<unknown>>()

/** The waiting line's own look: quiet, in the place's own type, so a part that arrives in a moment does not flash a panel. */
const LINE: CSSProperties = {display: 'block', padding: '6px 10px', font: 'inherit', fontSize: '12px', lineHeight: 1.4, opacity: 0.72}

/** The shell's waiting state for a place whose part has not arrived: what it waits for, or — when its module did not load —
 * that it did not, why, and a way to try again. */
export function PartWaiting({name, failure = null, retry}: {name: string; failure?: string | null; retry?: () => void}) {
  if (failure === null) return createElement('span', {className: 'part-waiting', role: 'status', 'data-part-loading': name, style: LINE}, `${name} — loading…`)
  return createElement('span', {className: 'part-waiting', role: 'alert', 'data-part-failed': name, style: LINE},
    `${name} did not load: ${failure}. `,
    retry ? createElement('button', {type: 'button', className: 'native-control', onClick: retry}, 'Try again') : null)
}

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error)).replace(/\.$/, '') || 'no reason was given'

/** `waiting` is the place's own waiting state when it has one (the transport stands unbound, each slot waiting with its meaning);
 * absent, the place shows the shell's waiting line. A load that failed says so in words either way. */
export function loadWhenDrawn<P extends object>(name: string, load: () => Promise<ComponentType<P>>, waiting?: ComponentType<P>): LoadedWhenDrawn<P> {
  let loaded: ComponentType<P> | null = null
  let pending: Promise<ComponentType<P>> | null = null
  const start = (): Promise<ComponentType<P>> => pending ??= load().then(component => (loaded = component), (error: unknown) => {
    // A load that failed is asked again by the next draw (or Try again) rather than remembered as failed here. A browser keeps a
    // module whose fetch failed failed for the document's life (its module map), so a missing chunk answers the same until a reload.
    pending = null
    console.error(`[live-shell] ${name} could not be loaded`, error)
    throw error
  })
  const Part = (props: P) => {
    const [, arrived] = useState(0)
    const [failure, setFailure] = useState<string | null>(null)
    const [attempt, setAttempt] = useState(0)
    useEffect(() => {
      if (loaded) return
      let live = true
      start().then(() => { if (live) arrived(count => count + 1) }, (error: unknown) => { if (live) setFailure(reasonOf(error)) })
      return () => { live = false }
    }, [attempt])
    if (loaded) return createElement(loaded, props)
    const line = failure !== null || !waiting ? createElement(PartWaiting, {name, failure, retry: () => { setFailure(null); setAttempt(count => count + 1) }}) : null
    return waiting ? createElement(Fragment, null, createElement(waiting, props), line) : line
  }
  Part.displayName = name
  Part.load = start
  parts.add(start)
  return Part
}

/** Fetch every part now (a server render, which draws only what has arrived). */
export async function loadEveryPart(): Promise<void> {
  await Promise.all([...parts].map(start => start()))
}

/** A pane whose module loads when a pane of its kind first opens (the projection door's `create` may be async, desktop/cradle/src/
 * surface/projectionModules.ts; O-I #740). Until the module arrives the pane says what it waits for, in words; the line leaves before
 * the module mounts, and a load that fails leaves the element clean so the host names the failure as the pane's body. */
export function mountWhenOpened<C extends {element: HTMLElement}, H>(name: string, load: () => Promise<(context: C) => H | Promise<H>>): (context: C) => Promise<H> {
  return async context => {
    const document = (context.element as Partial<HTMLElement>).ownerDocument
    const line = document && typeof context.element.appendChild === 'function' ? context.element.appendChild(document.createElement('span')) : null
    if (line) { line.className = 'part-waiting'; line.setAttribute('role', 'status'); line.dataset.partLoading = name; line.textContent = `${name} — loading…`; Object.assign(line.style, LINE) }
    try {
      const create = await load()
      line?.remove()
      return await create(context)
    } catch (error) {
      line?.remove()
      throw error
    }
  }
}
