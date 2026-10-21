// The kernel `graph` op's reading of the root register's wiki, for the Knowledge graph's design (graphBinding.ts). The read is the one
// the open surface itself makes (desktop/cradle/src/knowledge/graphProgress.ts loadGraph → graph.ts readGraph → kernel/src/graph.rs):
// its local inputs first, the Shared Field's only while Shared stands; the kernel keeps its owner reads in its OwnerReadCache, so a
// second reader asks the same owners nothing new. One read stands at a time, keyed by its bound and whether Shared is asked; it is
// asked only while the device stands (a chain that shows the Knowledge graph), and never polled.
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {loadGraph, type GraphProgress} from '../../../../../../desktop/cradle/src/knowledge/graphProgress'
import type {GraphRead} from './graphBinding'

/** How the reading is fetched: the kernel's graph op through the cradle's progressive read; the tests hand their own. */
export type GraphLoader = (publish: (progress: GraphProgress) => void, options: {shared: boolean; maxNodes: number; signal: AbortSignal}) => Promise<void>
const kernelLoader: GraphLoader = (publish, options) => loadGraph(detectTransport(), undefined, '', publish, options)
let loader: GraphLoader = kernelLoader

let read: GraphRead | null = null
let key = ''
let controller: AbortController | null = null
const listeners = new Set<() => void>()
const notify = () => { for (const listener of [...listeners]) listener() }

/** Ask for the reading at this bound (once per bound and Shared). A refusal stands in the owner's words; the inputs that failed are the
 * reading's own `inputs` (graphProgress.ts names each one unavailable with its detail). */
export function requestGraphRead(nodes: number, shared: boolean): void {
  const next = JSON.stringify([nodes, shared])
  if (next === key) return
  key = next
  controller?.abort()
  const mine = new AbortController()
  controller = mine
  read = {status: 'reading', reading: read?.reading ?? null, error: null, pending: [], nodes}
  notify()
  loader(progress => {
    if (mine.signal.aborted) return
    read = {status: progress.pending.length ? 'reading' : 'answered', reading: progress.reading, error: null, pending: progress.pending, nodes}
    notify()
  }, {shared, maxNodes: nodes, signal: mine.signal}).catch(cause => {
    if (mine.signal.aborted) return
    read = {status: 'refused', reading: null, error: cause instanceof Error ? cause.message : String(cause), pending: [], nodes}
    notify()
  })
}

export const graphRead = (): GraphRead | null => read
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The reading while `active`, asked at `nodes` with Shared as the open graph stands it. */
export function useGraphRead(active: boolean, nodes: number, shared: boolean): GraphRead | null {
  const now = useSyncExternalStore(subscribe, graphRead, graphRead)
  useEffect(() => { if (active) requestGraphRead(nodes, shared) }, [active, nodes, shared])
  return active ? now : null
}

/** For the tests: a loader of their own, and a fresh store. */
export function setGraphLoaderForTest(next: GraphLoader | null): void {
  controller?.abort()
  loader = next ?? kernelLoader
  read = null
  key = ''
  controller = null
  notify()
}
