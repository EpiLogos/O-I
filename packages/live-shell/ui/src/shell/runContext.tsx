import {useEffect, useState} from 'react'
import {nativeHost, readShellConfig, shellTransport, type ShellConfig} from '../native/application'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'

/**
 * The run-context reading (P0-R5 A): which world this shell runs in, stated
 * from what the host supplies and nothing else. A native host discloses its
 * build basis (live_shell_config: source_revision, source_tree_sha256,
 * source_dirty); the development browser discloses none, and the reading says
 * so rather than guessing. A screenshot must never again be mistakable for the
 * product: the reading is rendered in the status region in every mode.
 */
export type RunContextKind = 'native' | 'development' | 'pending'

export interface RunContextReading {
  kind: RunContextKind
  /** The plain name of the world, with its disclosed revision when there is one. */
  label: string
  /** A full commit the host disclosed; null when none was disclosed. */
  revision: string | null
  /** The tree digest the host disclosed; null when none was disclosed. */
  tree: string | null
  /** true when the host disclosed uncommitted changes; null when undisclosed. */
  dirty: boolean | null
  /** The owner carrier that serves this world, in the existing readers' words. */
  carrier: string
  /** One full sentence for the title and for assistive technology. */
  line: string
}

export interface RunContextInput {
  native: boolean
  config: Pick<ShellConfig, 'source_revision' | 'source_tree_sha256' | 'source_dirty'> | null
  /** The owner configuration could not be read; the owner's own words. */
  error: string | null
  carrier: string
}

const COMMIT = /^[0-9a-f]{40}$/
const DIGEST = /^[0-9a-f]{64}$/

/** The reading as a pure function of what the host disclosed. */
export function runContextOf({native, config, error, carrier}: RunContextInput): RunContextReading {
  const world = native ? 'Native host' : 'Development browser'
  if (!config && !error) {
    return {kind: 'pending', label: 'Reading run context', revision: null, tree: null, dirty: null, carrier,
      line: 'The shell is reading its run context from the host.'}
  }
  const revision = config && typeof config.source_revision === 'string' && COMMIT.test(config.source_revision) ? config.source_revision : null
  const tree = config && typeof config.source_tree_sha256 === 'string' && DIGEST.test(config.source_tree_sha256) ? config.source_tree_sha256 : null
  const dirty = config && typeof config.source_dirty === 'boolean' ? config.source_dirty : null
  const kind: RunContextKind = native ? 'native' : 'development'
  if (error) {
    return {kind, label: `${world} · configuration not disclosed`, revision: null, tree: null, dirty: null, carrier,
      line: `${world}: the owner configuration could not be read (${error}). No revision is stated.`}
  }
  const where = revision ? `revision ${revision.slice(0, 12)}` : 'no revision disclosed'
  const changes = dirty === true ? ' · uncommitted changes' : ''
  const detail = [
    revision ? `Revision ${revision}.` : `${world} discloses no revision.`,
    tree ? `Tree ${tree}.` : null,
    dirty === true ? 'The tree carried uncommitted changes.' : dirty === false ? 'The tree was clean.' : null,
    `Carrier: ${carrier}.`,
  ].filter(Boolean).join(' ')
  return {kind, label: `${world} · ${where}${changes}`, revision, tree, dirty, carrier, line: `${world}. ${detail}`}
}

/** The carrier's name as configuration.ts's adapter already words it. */
export function carrierOf(transport: KernelTransportStatus): string {
  if (transport.kind === 'tauri') return 'Native owner configuration'
  if (transport.kind === 'bridge') return 'Development native bridge'
  return transport.reason
}

/** The status-region reading: reads the host's configuration once and states it. */
export function RunContextReading() {
  const [read, setRead] = useState<{config: ShellConfig | null; error: string | null}>({config: null, error: null})
  useEffect(() => {
    let live = true
    readShellConfig().then(
      config => {if (live) setRead({config, error: null})},
      cause => {if (live) setRead({config: null, error: cause instanceof Error ? cause.message : String(cause)})},
    )
    return () => {live = false}
  }, [])
  const reading = runContextOf({
    native: nativeHost(),
    config: read.config,
    error: read.error,
    carrier: read.config ? carrierOf(shellTransport(read.config)) : 'not yet read',
  })
  return <span className="statusbar-counts run-context" data-region="run-context" data-run-context={reading.kind}
    title={reading.line}>{reading.label}</span>
}
