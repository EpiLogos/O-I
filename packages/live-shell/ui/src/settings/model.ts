import type { ConfigResolution, ScopeAddress, SettingSpec } from './adapter.ts'
import type { ValueSchema } from '../../../../../desktop/cradle/src/configuration/contracts'

export type TableRepresentation = 'map' | 'rows' | 'record'
export interface Draft { raw: unknown; value: unknown; error: string | null; basis: string | null; version: number; representation?: TableRepresentation; ownerEpoch?: string }
export interface SettingEntry { spec: SettingSpec; owner: string; available: boolean; reason: string | null }
export const categories = [
  { id: 'agents', title: 'Harnesses & models', purpose: 'Defaults for new conversations. Choose the current harness and model beside the conversation.' },
  { id: 'skills', title: 'Skills & methods', purpose: 'Capabilities and skill sets composed into a working context.' },
  { id: 'profiles', title: 'Profiles', purpose: 'The native profile used when composing new work.' },
  { id: 'permissions', title: 'Permissions', purpose: 'Harness modes for new sessions and the owner’s access policy.' },
  { id: 'connections', title: 'Credentials', purpose: 'Provider references and connection status. Secret material belongs to the credential owner.' },
  { id: 'execution', title: 'Machines & services', purpose: 'Service declarations and execution environments.' },
  { id: 'automations', title: 'Automations', purpose: 'Manage verified Methods that run on a schedule or in response to events.' },
  { id: 'telemetry', title: 'Search & telemetry', purpose: 'Search limits and observation intervals for Factory telemetry.' },
  { id: 'library', title: 'Sources & libraries', purpose: 'Native source locations and knowledge defaults.' },
  { id: 'appearance', title: 'Appearance & interaction', purpose: 'Presentation preferences. Editor parameters stay beside the instrument.' },
  { id: 'products', title: 'Products & updates', purpose: 'Manage installations, updates and service availability.' },
  { id: 'inspection', title: 'Advanced', purpose: 'Inspect native configuration when diagnosing a problem.' },
] as const
export type CategoryId = typeof categories[number]['id']

/** Task explanations derived from the native descriptors; exact owner prose stays in Details. */
export function settingHelp(spec: SettingSpec): string {
  return ({
    'ai-kit:resolution:resolution.profiles': 'Choose the AIKit profile used when composing new work. Running sessions keep their existing composition.',
    'ai-kit:skills:skills.capabilities': 'Choose which capabilities are available when composing work at this scope. Running sessions keep their existing capabilities.',
    'ai-kit:resolution:skill-sets.default': 'Choose the skill sets offered by default on this machine.',
    'ai-kit:models:models.default': 'Choose the model each harness requests for new conversations. Existing conversations keep their model.',
    'ai-kit:permissions:permissions.default-mode': 'Choose the permission mode each harness requests for new sessions. Modes come from that harness.',
    'ai-kit:models:models.credentials': 'Manage the credential references used to connect model providers.',
    'central:skills:central.skills': 'Keep a method active or retire it at this scope.',
    'software-factory:telemetry:search-limit-default': 'Set the number of results returned when a telemetry search has no explicit limit.',
    'software-factory:telemetry:search-timeout-seconds': 'Set how long a delegated knowledge search may run before it returns a timeout.',
    'software-factory:telemetry:watch-interval-seconds': 'Set the interval between telemetry watch updates, in seconds.',
    'workcell:processes-services:services.declared': 'Choose which services this Workcell offers and how they become ready. A service starts only when work demands it.',
  } as Record<string, string>)[spec.setting_ref] ?? spec.description
}

const synonyms: Record<string, string> = {
  'ai-kit:resolution:resolution.profiles': 'agent setup context methods methodology practices profile composition',
  'ai-kit:skills:skills.capabilities': 'agent context skills tools methods methodologies enable disable',
  'ai-kit:resolution:skill-sets.default': 'new project context inherited skills packs',
  'ai-kit:models:models.default': 'chat conversation agent harness language model llm default',
  'ai-kit:permissions:permissions.default-mode': 'agent harness session approval access permission safety',
  'ai-kit:models:models.credentials': 'api key credential provider account connection authentication',
  'software-factory:telemetry:search-limit-default': 'find results search count limit telemetry',
  'software-factory:telemetry:search-timeout-seconds': 'wait timeout search telemetry seconds',
  'software-factory:telemetry:watch-interval-seconds': 'refresh polling frequency watch telemetry seconds',
}
export function categoryOf(entry: SettingEntry): CategoryId {
  const ref = `${entry.spec.setting_ref} ${entry.spec.section_ref}`.toLowerCase()
  if (/software-factory:binding:central-project/.test(ref)) return 'library'
  if (/ai-kit:local-services:|workcell:processes-services:/.test(ref)) return 'execution'
  if (entry.spec.sensitive || /credentials|connector|provider|connection/.test(ref)) return 'connections'
  if (/permission|trust_level|guardrail|authority|placement/.test(ref)) return 'permissions'
  if (/skills|skill-sets/.test(ref)) return 'skills'
  if (/profiles/.test(ref)) return 'profiles'
  if (/ai-kit.*models|harness/.test(ref)) return 'agents'
  if (/software-factory.*telemetry/.test(ref)) return 'telemetry'
  if (/workcell|execution|environment|services.declared/.test(ref)) return 'execution'
  if (/library|source|knowledge|wiki/.test(ref)) return 'library'
  if (/appearance|visual|keyboard|accessibility|theme/.test(ref)) return 'appearance'
  if (/^oi:|storage|recovery|saving|installation|update/.test(ref)) return 'products'
  return 'inspection'
}
export function searchSettings(entries: SettingEntry[], query: string): SettingEntry[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  return entries.filter(({ spec, owner }) => {
    const text = `${spec.title} ${spec.description} ${spec.setting_ref} ${spec.native_ref} ${owner} ${synonyms[spec.setting_ref] ?? ''}`.toLowerCase()
    return words.every(word => text.includes(word))
  }).sort((a, b) => {
    const q = query.toLowerCase().trim()
    return Number(!a.spec.title.toLowerCase().includes(q)) - Number(!b.spec.title.toLowerCase().includes(q))
  })
}
export const scopeKey = (scope: ScopeAddress): string => JSON.stringify([scope.scope_kind, scope.scope_ref])
export const settingKey = (ref: string, scope: ScopeAddress): string => JSON.stringify([ref, scope.scope_kind, scope.scope_ref])
export function allowedScope(spec: SettingSpec, scope: ScopeAddress): boolean {
  if (!['world', 'ground', 'machine'].includes(scope.scope_kind) && !scope.scope_ref?.trim()) return false
  return spec.allowed_scopes.some(s => s.scope_kind === scope.scope_kind && (s.scope_ref === null || s.scope_ref === scope.scope_ref))
}
export function initialScope(spec: SettingSpec, choices: { address: ScopeAddress }[]): ScopeAddress | null {
  for (const allowed of spec.allowed_scopes) {
    const choice = choices.find(c => allowedScope(spec, c.address) && c.address.scope_kind === allowed.scope_kind)
    if (choice) return choice.address
    if (allowed.scope_ref !== null) return { scope_kind: allowed.scope_kind, scope_ref: allowed.scope_ref }
    if (['world', 'ground', 'machine'].includes(allowed.scope_kind)) return { scope_kind: allowed.scope_kind, scope_ref: null }
  }
  return null
}
export function editableValue(resolution?: ConfigResolution): unknown {
  return resolution?.desired?.value ?? resolution?.native?.declared?.value ?? resolution?.native?.effective?.value
}
export function displayValue(value: unknown, sensitive = false): string {
  if (sensitive) return 'Secret reference · material hidden'
  if (value === undefined || value === null) return 'Not reported'
  if (typeof value === 'boolean') return value ? 'On' : 'Off'
  if (Array.isArray(value)) return value.length ? value.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ') : 'None'
  if (typeof value === 'object') return Object.entries(value).map(([k,v]) => `${k}: ${displayValue(v)}`).join(' · ') || 'No overrides'
  return String(value)
}
export const isSensitiveSetting=(spec:Pick<SettingSpec,'sensitive'|'value_schema'>)=>spec.sensitive||spec.value_schema.type==='secret'
export function rawValue(spec: SettingSpec, value: unknown): unknown {
  const schema = spec.value_schema
  if (schema.type === 'table') {
    if (Array.isArray(value)) return value
    if (value && typeof value === 'object' && tableRepresentation(spec, value) === 'record') return [value]
    return value && typeof value === 'object' ? Object.entries(value).map(([key, v]) => ({ [schema.columns[0]?.name ?? 'key']: key, [schema.columns[1]?.name ?? 'value']: v })) : []
  }
  if (schema.type === 'list') return Array.isArray(value) ? value : []
  if (schema.type === 'boolean') return typeof value === 'boolean' ? value : false
  return value === undefined || value === null ? '' : String(value)
}
export function tableRepresentation(spec: SettingSpec, value: unknown): TableRepresentation {
  if (Array.isArray(value)) return 'rows'
  if (spec.value_schema.type === 'table' && value && typeof value === 'object') {
    if (spec.value_schema.columns.every(c => Object.hasOwn(value, c.name))) return 'record'
    return 'map'
  }
  // When no owner value/default tells us otherwise, preserve typed row arrays.
  return 'rows'
}

function exactInteger(text: string): boolean {
  const match = text.match(/^[+-]?(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/)
  if (!match) return false
  const exponent = Number(match[3] ?? 0)
  const fraction = match[2] ?? ''
  const digits = `${match[1]}${fraction}`.replace(/^0+/, '') || '0'
  if (digits === '0') return true
  const scale = exponent - fraction.length
  return scale >= 0 || (Number.isFinite(scale) && -scale <= digits.length && /^0*$/.test(digits.slice(scale)))
}

function validateScalar(schema: ValueSchema, raw: unknown): { value: unknown; error: string | null } {
  if (schema.type === 'number' || schema.type === 'integer') {
    const text = String(raw).trim()
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return { value: undefined, error: 'Enter a complete number.' }
    const value = Number(text)
    if (!Number.isFinite(value)) return { value: undefined, error: 'Enter a finite number.' }
    if (schema.type === 'integer' && (!exactInteger(text) || !Number.isSafeInteger(value))) return { value, error: 'Enter an exact whole number.' }
    if (schema.minimum !== undefined && value < schema.minimum) return { value, error: `Minimum ${schema.minimum}.` }
    if (schema.maximum !== undefined && value > schema.maximum) return { value, error: `Maximum ${schema.maximum}.` }
    return { value, error: null }
  }
  if (schema.type === 'boolean') return { value: raw, error: typeof raw === 'boolean' ? null : 'Choose On or Off.' }
  if (schema.type === 'enum') return { value: raw, error: !schema.options?.length ? 'The owner has not supplied the allowed values.' : schema.options.some(o => o.value === raw) ? null : 'Choose an available value.' }
  if (schema.type === 'list' || schema.type === 'table') {
    let value: unknown = raw
    if (typeof raw === 'string') { try { value = JSON.parse(raw) } catch { return { value: undefined, error: 'Enter a complete collection.' } } }
    const valid = schema.type === 'list' ? Array.isArray(value) : !!value && typeof value === 'object'
    return { value, error: valid ? null : schema.type === 'list' ? 'Enter a list.' : 'Enter a table or record.' }
  }
  if (schema.type === 'secret') return { value: undefined, error: 'Use the native credential editor.' }
  const value = String(raw ?? '')
  if (!value.trim()) return { value, error: 'Enter a value.' }
  if ('pattern' in schema && schema.pattern) {
    try { if (!new RegExp(schema.pattern).test(value)) return { value, error: 'This value does not match the owner’s required format.' } }
    catch { return { value, error: 'The owner supplied an invalid validation pattern.' } }
  }
  return { value, error: null }
}
export function validateDraft(spec: SettingSpec, raw: unknown, representation: TableRepresentation = 'rows'): { value: unknown; error: string | null } {
  if(isSensitiveSetting(spec))return {value:undefined,error:'Use the native credential editor.'}
  const schema = spec.value_schema
  if (schema.type === 'table') {
    if (!Array.isArray(raw)) return { value: undefined, error: 'Invalid table.' }
    const rows = raw as Record<string, unknown>[]
    const normalised: Record<string, unknown>[] = []
    const object: Record<string, unknown> = Object.create(null)
    for (let i = 0; i < rows.length; i++) {
      const next: Record<string, unknown> = {}
      for (const col of schema.columns) {
        // Central's contribution declares an enum column without enumerating
        // it. Reuse its native validator's active/retired standing vocabulary.
        const columnSchema = spec.setting_ref === 'central:skills:central.skills' && col.name === 'standing' ? { type: 'enum', options: [{value:'active'},{value:'retired'}] } : col
        const cell = validateScalar(columnSchema as ValueSchema, rows[i][col.name])
        if (cell.error) return { value: undefined, error: `Row ${i + 1}, ${col.name}: ${cell.error}` }
        next[col.name] = cell.value
      }
      const key = String(rows[i][schema.columns[0]?.name ?? 'key'])
      if (representation === 'map' && Object.hasOwn(object, key)) return { value: undefined, error: `Duplicate entry “${key}”.` }
      object[key] = next[schema.columns[1]?.name ?? 'value']
      normalised.push(next)
    }
    if (representation === 'record' && normalised.length !== 1) return { value: undefined, error: 'This native record requires one entry.' }
    return { value: representation === 'map' ? object : representation === 'record' ? normalised[0] : normalised, error: null }
  }
  if (schema.type === 'list') {
    if (!Array.isArray(raw)) return { value: undefined, error: 'Invalid list.' }
    const values: unknown[] = []
    for (let i = 0; i < raw.length; i++) {
      const cell = validateScalar((schema.items ?? { type: 'scalar' }) as ValueSchema, raw[i])
      if (cell.error) return { value: undefined, error: `Item ${i + 1}: ${cell.error}` }
      values.push(cell.value)
    }
    return { value: values, error: null }
  }
  return validateScalar(schema, raw)
}
export function createDraft(spec: SettingSpec, raw: unknown, resolution: ConfigResolution | undefined, previous?: Draft): Draft {
  const representation = previous?.representation ?? tableRepresentation(spec, editableValue(resolution) ?? spec.default)
  return { raw, ...validateDraft(spec, raw, representation), representation, basis: previous ? previous.basis : resolution?.native_reading?.reading_digest ?? null, version: (previous?.version ?? 0) + 1 }
}
export function basisChanged(draft: Draft, reading?: ConfigResolution): boolean {
  return draft.basis !== (reading?.native_reading?.reading_digest ?? null)
}
export function draftOwnerChanged(draft: Draft, ownerEpoch?: string): boolean { return draft.ownerEpoch !== ownerEpoch }
export function acknowledgeDrafts(drafts: Record<string, Draft>, submitted: Record<string, Draft>, successfulKeys: string[]): Record<string, Draft> {
  const next = { ...drafts }
  for (const key of successfulKeys) if (next[key]?.version === submitted[key]?.version) delete next[key]
  return next
}
