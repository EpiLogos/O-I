// The last export, as the native host received it (ticket P, G1). Every export the Studio's Capture and Edition… offer — and the
// frame's own canvas, frame PNG, quarantine and natal-chart saves — is an `<a download>` the main window's download receiver
// takes (desktop/cradle/src-tauri/src/downloads.rs, browser.rs's `.on_download` shape ported): it lands where the platform puts
// downloads, and the host says where on `oi:native-download`. This module only reads that notice — strictly, a notice it does
// not read is named, never shown as a plausible save — and keeps the last one for the Studio's Capture section. The development
// browser has no native host: it downloads on its own and says nothing here.
import {useSyncExternalStore} from 'react'
import {nativeHost} from '../../../native/application'

export const NATIVE_DOWNLOAD_EVENT = 'oi:native-download'

/** One notice: a download leaving (saving), landed (saved) or not (failed, with the host's fault and its words). */
export interface ExportNotice {
  readonly state: 'saving' | 'saved' | 'failed'
  readonly file: string | null
  /** The folder, whole (the hover words). */
  readonly folder: string | null
  /** The folder as the person reads it (`~/Downloads`). */
  readonly place: string | null
  readonly fault: 'no_destination' | 'not_saved' | null
  readonly reason: string | null
}

const STATES = ['saving', 'saved', 'failed'] as const
const FAULTS = ['no_destination', 'not_saved'] as const
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 4096
const optional = (value: unknown): value is string | null | undefined => value === null || value === undefined || text(value)

/** The host's notice exactly (downloads.rs DownloadNotice), or null. */
export function readExportNotice(raw: unknown): ExportNotice | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (!STATES.includes(row.state as never)) return null
  if (!optional(row.file) || !optional(row.folder) || !optional(row.place) || !optional(row.reason)) return null
  if (row.fault !== null && row.fault !== undefined && !FAULTS.includes(row.fault as never)) return null
  if (row.state === 'failed' ? !row.fault || !row.reason : row.fault) return null
  return {state: row.state as ExportNotice['state'], file: (row.file as string | null | undefined) ?? null, folder: (row.folder as string | null | undefined) ?? null,
    place: (row.place as string | null | undefined) ?? null, fault: (row.fault as ExportNotice['fault'] | undefined) ?? null, reason: (row.reason as string | null | undefined) ?? null}
}

/** The notice in the person's words: the file's name and the folder it is in — or what did not happen, and why. */
export function exportWords(notice: ExportNotice): string {
  const file = notice.file ? `“${notice.file}”` : 'The export'
  if (notice.state === 'failed') return `${notice.file ? `${file} was not saved` : 'The export was not saved'}: ${notice.reason}.`
  if (notice.state === 'saving') return `Saving ${file}${notice.place ? ` to ${notice.place}` : ''}…`
  return notice.place ? `Saved ${file} in ${notice.place}.` : `Saved ${file}; the host did not say where.`
}

// The one listener: attached once, in the native host only, for the life of the page (exports happen from the frame and the
// shell while the Studio is folded away or unmounted, and its last notice must still be there when it shows).
type Listen = (event: string, handler: (event: {readonly payload: unknown}) => void) => Promise<() => void>
let last: ExportNotice | null = null
const subscribers = new Set<() => void>()
let attached: Promise<void> | null = null

/** Take one notice from the host: a notice this module does not read is named as such, never dropped silently. */
export function receiveExportNotice(payload: unknown): void {
  last = readExportNotice(payload) ?? {state: 'failed', file: null, folder: null, place: null, fault: 'not_saved',
    reason: 'the native host sent a download notice this shell does not read'}
  for (const notify of subscribers) notify()
}

/** Attach the listener (idempotent). `listen` is the Tauri event API, loaded only in the native host. */
export function listenForExports(listen?: Listen): Promise<void> {
  attached ??= (async () => {
    const on: Listen = listen ?? (async (event, handler) => (await import('@tauri-apps/api/event')).listen<unknown>(event, handler))
    await on(NATIVE_DOWNLOAD_EVENT, event => receiveExportNotice(event.payload))
  })().catch(() => { attached = null })
  return attached
}

/** The last export the host received, or null while none has been. */
export function useLastExport(): ExportNotice | null {
  return useSyncExternalStore(notify => { subscribers.add(notify); return () => { subscribers.delete(notify) } }, () => last, () => last)
}

if (nativeHost()) void listenForExports()
