import {decodeApplicationView} from '../../../../../desktop/cradle/src/surface/persist'
import type {ApplicationViewEnvelope} from '../../../../../desktop/cradle/src/surface/types'

export const CANDIDATE_APP_ID = 'org.epilogos.oi.live-shell'
export interface CandidateApplicationView {
  alsPath?: string | null
  tab?: 'session' | 'arrangement'
  selection?: {track: number; scene: number | null; clip?: number}
  browser?: boolean
  detail?: boolean
  dock?: boolean
  browserWidth?: number | null
  detailHeight?: number | null
  centerPanel?: string
  detailMode?: 'clip' | 'device'
  settingsPresented?: boolean
  settingsReturn?: 'audio' | 'expressions' | 'techne'
}
const fieldNames = ['alsPath','tab','selection','browser','detail','dock','browserWidth','detailHeight','centerPanel','detailMode','settingsPresented','settingsReturn'] as const
const fields = new Set<string>(fieldNames)
const index = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 1_000_000
/** The native core carries an envelope; only this application decides which
 * frame fields can be acted on. No contents, dirty flags or owner identities. */
export function validateCandidateApplicationView(raw: unknown): CandidateApplicationView | null {
  if (!raw || typeof raw !== 'object' || Object.getPrototypeOf(raw) !== Object.prototype) return null
  const value = raw as Record<string, unknown>
  if (Object.keys(value).some(key => !fields.has(key))) return null
  for (const [key, field] of Object.entries(value)) {
    if (field === undefined) continue
    if (['browser','detail','dock','settingsPresented'].includes(key)) {if (typeof field !== 'boolean') return null}
    else if (key === 'alsPath') {if (field !== null && (typeof field !== 'string' || !field.trim() || field.length > 4096 || !field.toLowerCase().endsWith('.als'))) return null}
    else if (key === 'tab') {if (field !== 'session' && field !== 'arrangement') return null}
    else if (key === 'detailMode') {if (field !== 'clip' && field !== 'device') return null}
    else if (key === 'settingsReturn') {if (!['audio','expressions','techne'].includes(field as string)) return null}
    else if (key === 'centerPanel') {if (typeof field !== 'string' || (field !== 'native.workbench' && field !== 'native.agent' && field !== 'native.session' && field !== 'native.arrangement' && !/^world\.[a-z0-9.-]{1,128}$/.test(field))) return null}
    else if (key === 'browserWidth' || key === 'detailHeight') {if (field !== null && (typeof field !== 'number' || !Number.isFinite(field) || field < 120 || field > 16384)) return null}
    else if (key === 'selection') {
      if (!field || typeof field !== 'object' || Object.getPrototypeOf(field) !== Object.prototype) return null
      const selected = field as Record<string, unknown>
      if (Object.keys(selected).some(key => !['track','scene','clip'].includes(key)) || !index(selected.track) || (selected.scene !== null && !index(selected.scene)) || (selected.clip !== undefined && !index(selected.clip))) return null
    }
  }
  // A fixed field order makes an identical snapshot a no-op even when a
  // caller constructed its object in a different order.
  const snapshot = Object.fromEntries(fieldNames.filter(key => value[key] !== undefined).map(key => {
    if (key !== 'selection') return [key,value[key]]
    const selected = value.selection as Record<string, unknown>
    return [key,{track:selected.track,scene:selected.scene,...(selected.clip === undefined ? {} : {clip:selected.clip})}]
  }))
  try {return JSON.parse(JSON.stringify(snapshot)) as CandidateApplicationView} catch {return null}
}
export function candidateApplicationEnvelope(raw: unknown): ApplicationViewEnvelope | undefined {
  const payload = validateCandidateApplicationView(raw)
  return payload ? decodeApplicationView({schema:'oi.application-view/v1',version:1,app_id:CANDIDATE_APP_ID,payload}) : undefined
}
export function readCandidateApplicationView(raw: unknown): CandidateApplicationView | null {
  const envelope = decodeApplicationView(raw)
  return envelope?.app_id === CANDIDATE_APP_ID ? validateCandidateApplicationView(envelope.payload) : null
}
