import { useEffect, useState } from 'react'
import type { SetSummary, TrackKind } from './useSet'
import {readSet} from '../native/application'
/** Mirror of the document owner's /api/document, consumed without re-parsing ALS. */
export interface SetParameter { id: string; value: string; min?: string; max?: string }
export interface SetDevice { name: string; params: SetParameter[] }
export interface SetClip { name: string; kind: 'audio' | 'midi'; start: number; end: number }
export interface SetTrack { kind: TrackKind; name: string; devices: SetDevice[]; arrangementClips: SetClip[]; sessionSlots: Record<string, string | null> }
export interface SetDocument { path: string; tempo: number; scenes: number; tracks: SetTrack[] }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
export function readSetDocument(value: unknown): SetDocument {
  if (!object(value) || typeof value.path !== 'string' || !value.path || !finite(value.tempo) || !Number.isSafeInteger(value.scenes) || Number(value.scenes) < 0 || !Array.isArray(value.tracks) || value.tracks.some(track => {
    if (!object(track) || !['audio', 'midi', 'return', 'master'].includes(String(track.kind)) || typeof track.name !== 'string' || !Array.isArray(track.devices) || !Array.isArray(track.arrangementClips) || !object(track.sessionSlots)) return true
    if (Object.values(track.sessionSlots).some(slot => slot !== null && typeof slot !== 'string')) return true
    if (track.arrangementClips.some(clip => !object(clip) || typeof clip.name !== 'string' || !['audio', 'midi'].includes(String(clip.kind)) || !finite(clip.start) || !finite(clip.end) || Number(clip.end) < Number(clip.start))) return true
    return track.devices.some(device => !object(device) || typeof device.name !== 'string' || !Array.isArray(device.params) || device.params.some(parameter => !object(parameter) || typeof parameter.id !== 'string' || typeof parameter.value !== 'string' || (parameter.min !== undefined && typeof parameter.min !== 'string') || (parameter.max !== undefined && typeof parameter.max !== 'string')))
  })) throw Error('Invalid deep document reading from its owner')
  return value as unknown as SetDocument
}
export function useSetDocument(set: SetSummary | null) {
  const [reading, read] = useState<{ document: SetDocument | null; error: string | null }>({ document: null, error: null })
  useEffect(() => {
    read(previous => ({document: previous.document?.path === set?.path ? previous.document : null, error: null}))
    if (!set) return
    const controller = new AbortController()
    void readSet(set.path, controller.signal).then(value => {
      const document = readSetDocument(value.document)
      if (document.path !== set.path || document.scenes !== set.scene_count || document.tracks.length !== set.tracks.length || document.tracks.some((track, i) => track.name !== set.tracks[i].name || track.kind !== set.tracks[i].kind)) throw Error('Summary and deep document changed; reopen this set')
      if (!controller.signal.aborted) read({ document, error: null })
    }).catch((cause: unknown) => { if (!controller.signal.aborted) read(previous => ({ document: previous.document, error: cause instanceof Error ? cause.message : String(cause) })) })
    return () => controller.abort()
  }, [set])
  return reading
}
/** Values stay lossless; device editing is attached only when its owner lands. */
export const displayDeviceName = (name: string) => ({ Eq8: 'EQ Eight', AutoFilter: 'Auto Filter', PluginDevice: 'Plug-in', Compressor2: 'Compressor', GlueCompressor: 'Glue Compressor', StereoGain: 'Utility' }[name] ?? name.replace(/([a-z])([A-Z])/g, '$1 $2'))
