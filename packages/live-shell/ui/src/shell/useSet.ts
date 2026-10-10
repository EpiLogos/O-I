import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {readSet, readShellConfig, subscribeSet, type ShellConfig} from '../native/application'
export type {ShellConfig} from '../native/application'
// Foundation publishes the actual host reading. Its retry/resync updates every
// mounted consumer without replacing the application or its input drafts.
export const ShellConfigContext = createContext<ShellConfig | null | undefined>(undefined)

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

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
export function readSetSummary(value: unknown): SetSummary {
  if (!object(value) || typeof value.path !== 'string' || !value.path || typeof value.tempo_bpm !== 'number' || !Number.isFinite(value.tempo_bpm) || value.tempo_bpm <= 0 || !count(value.scene_count) || !count(value.arrangement_clips) || !Array.isArray(value.tracks) || value.tracks.some(track => !object(track) || !['audio', 'midi', 'return', 'master'].includes(String(track.kind)) || typeof track.name !== 'string' || !Array.isArray(track.devices) || track.devices.some(device => typeof device !== 'string'))) throw Error('Invalid summary reading from the document owner')
  return value as unknown as SetSummary
}
export async function fetchSetSummary(path: string, signal?: AbortSignal): Promise<SetSummary> {
  return readSetSummary((await readSet(path, signal)).summary)
}

export async function fetchShellConfig(): Promise<ShellConfig> {
  return readShellConfig()
}

/** The server's command-line set, fetched once. Null while loading. */
export function useShellConfig(): ShellConfig | null {
  const supplied = useContext(ShellConfigContext)
  const [config, setConfig] = useState<ShellConfig | null>(null)
  useEffect(() => {
    if (supplied !== undefined) return
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
  }, [supplied])
  return supplied === undefined ? config : supplied
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
export function useSetSummary(defaultSet?: string, workspaceId?: string): UseSet {
  const [set, setSet] = useState<SetSummary | null>(null)
  const [path, setPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const request = useRef<AbortController | null>(null)
  const subject = useRef<string | null>(null)
  const workspace = useRef(workspaceId)
  workspace.current = workspaceId

  const open = useCallback((next: string) => {
    const trimmed = next.trim()
    if (!trimmed) return
    const id = ++requestId.current
    const origin = workspace.current
    subject.current = trimmed
    request.current?.abort()
    request.current = new AbortController()
    setPath(trimmed)
    setSet(previous => previous?.path === trimmed ? previous : null)
    setLoading(true)
    setError(null)
    fetchSetSummary(trimmed, request.current.signal)
      .then((s) => {
        if (requestId.current !== id || workspace.current !== origin || subject.current !== trimmed) return
        setSet(s)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (requestId.current !== id || workspace.current !== origin || subject.current !== trimmed) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (defaultSet) open(defaultSet)
    else {subject.current = null; setSet(null); setPath(null); setLoading(false); setError(null)}
    return () => { ++requestId.current; request.current?.abort() }
  }, [defaultSet, workspaceId, open])
  useEffect(() => {
    if (!path) return
    const origin = workspaceId
    return subscribeSet(path, () => {if (subject.current === path && workspace.current === origin) open(path)})
  }, [path, workspaceId, open])

  return { set, loading, error, path, open }
}
