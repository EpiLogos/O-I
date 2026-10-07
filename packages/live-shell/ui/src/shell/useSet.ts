import { useCallback, useEffect, useRef, useState } from 'react'

// Typed mirror of GET /api/summary?path=<abs .als> — the stable M2 contract
// (packages/live-shell/src/api.rs). The server answers { error } on failure;
// that surfaces as a thrown Error here.

export type TrackKind = 'audio' | 'midi' | 'return' | 'master'

export interface TrackSummary {
  kind: TrackKind
  name: string
  devices: string[]
}

export interface SetSummary {
  path: string
  tempo_bpm: number
  scene_count: number
  arrangement_clips: number
  tracks: TrackSummary[]
}

export interface ShellConfig {
  /** The set passed on the server command line; empty string when none. */
  default_set: string
}

export async function fetchSetSummary(path: string): Promise<SetSummary> {
  const res = await fetch(`/api/summary?path=${encodeURIComponent(path)}`)
  const body: unknown = await res.json()
  if (body && typeof body === 'object' && 'error' in body) {
    throw new Error(String((body as { error: unknown }).error))
  }
  return body as SetSummary
}

export async function fetchShellConfig(): Promise<ShellConfig> {
  const res = await fetch('/api/config')
  return (await res.json()) as ShellConfig
}

/** The server's command-line set, fetched once. Null while loading. */
export function useShellConfig(): ShellConfig | null {
  const [config, setConfig] = useState<ShellConfig | null>(null)
  useEffect(() => {
    let live = true
    fetchShellConfig()
      .then((c) => {
        if (live) setConfig(c)
      })
      .catch(() => {
        /* server unreachable — frame stays empty, error shows on open() */
      })
    return () => {
      live = false
    }
  }, [])
  return config
}

export interface UseSet {
  set: SetSummary | null
  loading: boolean
  error: string | null
  path: string | null
  open: (path: string) => void
}

/**
 * Opened-set state for the shell frame. Pass the server's default set to
 * auto-load it on start (mirrors the legacy inspector's __DEFAULT_SET__).
 */
export function useSetSummary(defaultSet?: string): UseSet {
  const [set, setSet] = useState<SetSummary | null>(null)
  const [path, setPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const open = useCallback((next: string) => {
    const id = ++requestId.current
    const trimmed = next.trim()
    if (!trimmed) return
    setPath(trimmed)
    setLoading(true)
    setError(null)
    fetchSetSummary(trimmed)
      .then((s) => {
        if (requestId.current !== id) return
        setSet(s)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (requestId.current !== id) return
        setSet(null)
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })
  }, [])

  const bootstrapped = useRef(false)
  useEffect(() => {
    if (bootstrapped.current) return
    if (defaultSet) {
      bootstrapped.current = true
      open(defaultSet)
    }
  }, [defaultSet, open])

  return { set, loading, error, path, open }
}
