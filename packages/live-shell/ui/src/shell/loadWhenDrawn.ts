// A part of the shell whose code loads when it first draws, not with the window's first script (MAP, the build lane's
// loading item: "the shell loads as one 6.2 MB script before it draws anything — split it by mode and device";
// scripts/load-census.mjs counts what each window fetches before it draws). Until its module arrives the part draws
// nothing; once it has arrived every later mount draws it at once, with no wait and no fallback. `load()` fetches it ahead
// — a server render (the suites' renderToStaticMarkup) calls `loadEveryPart()` first, since it cannot wait for a module.
import {createElement, useEffect, useState, type ComponentType, type FunctionComponent} from 'react'

export interface LoadedWhenDrawn<P> extends FunctionComponent<P> {
  /** Fetch the part's module now; resolves to the component it draws. */
  load(): Promise<ComponentType<P>>
}

const parts = new Set<() => Promise<unknown>>()

export function loadWhenDrawn<P extends object>(name: string, load: () => Promise<ComponentType<P>>): LoadedWhenDrawn<P> {
  let loaded: ComponentType<P> | null = null
  let pending: Promise<ComponentType<P>> | null = null
  const start = (): Promise<ComponentType<P>> => pending ??= load().then(component => (loaded = component), (error: unknown) => {
    // A module that did not arrive (a missing chunk) is tried again by the next draw rather than remembered as failed.
    pending = null
    console.error(`[live-shell] ${name} could not be loaded`, error)
    throw error
  })
  const Part = (props: P) => {
    const [, arrived] = useState(0)
    useEffect(() => {
      if (loaded) return
      let live = true
      start().then(() => { if (live) arrived(count => count + 1) }, () => {})
      return () => { live = false }
    }, [])
    return loaded ? createElement(loaded, props) : null
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
