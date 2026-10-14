// The knowledge graph family's three faces as devices of the runtime (T-DEVICES-TECHNE; lock §8.1: the wiki constellation is its own
// standalone instrument). Each device is read from the open graph's handle (desktop/cradle/src/knowledge/knowledgeGraphHandle.ts,
// published by the surface) and written through the owner's armed setters (agent/shellSetterBridge.ts
// `registerKnowledgeShellSetters`), which call the same acts the face bodies call. With no graph open, or before its reading has
// loaded, a control the owner cannot take has no write path and says why in the body's words. Nothing is a default.
//
// The rows are the family's declared rows, restated from inhabitants/agentNativeP0.ts:295-373 (the shell never loads that batch;
// see atlasDevices.ts, and tests/techne-devices.test.mjs, which fails on any drift).
import type {SdkParamRow} from '../../sdk/define'
import type {InhabitantFaceDeclaration} from '../../manifest'
import type {DeviceInstance, ParamValue} from '../../../frame/devices/deviceRuntime'
import type {KnowledgeGraphSurface} from '../../../../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle'
import {
  DEPTH_RANGE, KNOWLEDGE_CONTEXTS, KNOWLEDGE_DIRECTIONS, KNOWLEDGE_KINDS, KNOWLEDGE_LABELS, KNOWLEDGE_RELATIONS, KNOWLEDGE_SCOPES, ZOOM_RANGE,
} from '../../knowledgeGraphFaceActions'
import {techneFaceDeclaration, techneDeviceId} from './faces'
import {memberKey, memberRows, type SetMember} from './rowSets'
import {submitThroughOwner} from './ownerWrite'

export const KNOWLEDGE_FAMILY = 'knowledge-graph'

const decl = (deviceInstance: string, key: string, title: string, type: string, rest: Partial<SdkParamRow> = {}): SdkParamRow =>
  ({family: KNOWLEDGE_FAMILY, deviceInstance, key, title, type, ...rest}) as SdkParamRow

/** The knowledge graph family's declared rows, agentNativeP0.ts:295-373. */
export const KNOWLEDGE_DECLARED_ROWS: readonly SdkParamRow[] = [
  decl('knowledge-scope', 'scope', 'Scope', 'enumerated', {values: [...KNOWLEDGE_SCOPES], writePath: 'shell.setKnowledgeScope'}),
  decl('knowledge-scope', 'depth', 'Depth', 'number', {range: {min: DEPTH_RANGE.min, max: DEPTH_RANGE.max, unit: 'steps'}, writePath: 'shell.setKnowledgeDepth'}),
  decl('knowledge-scope', 'direction', 'Follow relations', 'enumerated', {values: [...KNOWLEDGE_DIRECTIONS], writePath: 'shell.setKnowledgeDirection'}),
  decl('knowledge-scope', 'shared', 'Shared Field', 'boolean', {writePath: 'shell.setKnowledgeShared'}),
  decl('knowledge-scope', 'ghosts', 'Unresolved link markers', 'boolean', {writePath: 'shell.setKnowledgeGhosts'}),
  decl('knowledge-filters', 'text', 'Find', 'string', {writePath: 'shell.setKnowledgeText'}),
  decl('knowledge-filters', 'kinds', 'Subject kinds', 'enumerated', {values: [...KNOWLEDGE_KINDS], writePath: 'shell.setKnowledgeKinds'}),
  decl('knowledge-filters', 'relations', 'Relation types', 'enumerated', {values: [...KNOWLEDGE_RELATIONS], writePath: 'shell.setKnowledgeRelations'}),
  decl('knowledge-filters', 'isolated', 'Subjects with no relations', 'boolean', {writePath: 'shell.setKnowledgeIsolated'}),
  decl('knowledge-filters', 'context', 'Constellation context', 'enumerated', {values: [...KNOWLEDGE_CONTEXTS], writePath: 'shell.setKnowledgeContext'}),
  decl('knowledge-display', 'labels', 'Labels', 'enumerated', {values: [...KNOWLEDGE_LABELS], writePath: 'shell.setKnowledgeLabels'}),
  decl('knowledge-display', 'arrows', 'Relation arrows', 'boolean', {writePath: 'shell.setKnowledgeArrows'}),
  decl('knowledge-display', 'zoom', 'Zoom', 'number', {range: {min: ZOOM_RANGE.min, max: ZOOM_RANGE.max, unit: '×'}, writePath: 'shell.setKnowledgeZoom'}),
]

/** The panel's own names for its choices, as the face bodies draw them (inhabitants/knowledgeGraphFaceBodies.tsx:55-64). The
 * owner takes the id; the device shows the name and turns it back. */
const NAMES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  scope: {field: 'Available field', local: 'Selected subject'},
  direction: {both: 'Both directions', outgoing: 'Outgoing', incoming: 'Incoming / backlinks'},
  context: {structure: 'Keep disclosed structure', matches: 'Matches only (partial formations)'},
  labels: {automatic: 'At useful zoom', all: 'All visible subjects', focus: 'Focused subjects'},
}

const nameOf = (rowKey: string, id: string): string => NAMES[rowKey]?.[id] ?? id

const idOf = (rowKey: string, name: string): string => Object.entries(NAMES[rowKey] ?? {}).find(([, label]) => label === name)?.[0] ?? name

// The owner's words for the states in which it cannot take a write: NOT_OPEN and NOT_LOADED are the body's, verbatim
// (inhabitants/knowledgeGraphFaceBodies.tsx:42-44, :104); NOT_LOCAL restates the writer's refusal (agent/shellSetterBridge.ts:428).
const NOT_OPEN = 'The knowledge graph is not open in this session. Open a graph in the centre and its controls stand here; nothing is held.'
const NOT_LOADED = 'The graph is still reading its subjects; the kinds and relations stand once it has.'
const NOT_LOCAL = 'Depth applies in a local view; the scope is the available field, so set the scope to the selected subject first.'
const TYPED_ABOVE = 'Empty. Find is typed in the field above.'

const declared = (faceId: string, key: string): SdkParamRow => {
  const found = KNOWLEDGE_DECLARED_ROWS.find(row => row.deviceInstance === faceId && row.key === key)
  if (!found) throw new Error(`the knowledge graph family declares no row ${faceId}/${key}`)
  return found
}

const readingOf = (row: SdkParamRow, why: string): SdkParamRow => {
  const {writePath: _writePath, ...rest} = row
  return {...rest, disclosure: why} as SdkParamRow
}

const placed = (row: SdkParamRow, group: string, compact = false): SdkParamRow => ({...row, group, ...(compact ? {compact: true} : {})}) as SdkParamRow

/** A named choice, drawn by its name: the row's values are the names. */
const named = (row: SdkParamRow): SdkParamRow => ({...row, values: (row.values ?? []).map(id => nameOf(row.key, id))}) as SdkParamRow

/** An integer domain drawn as a stepper over its choices (the controls' fader would draw fractions the owner refuses). */
const stepper = (row: SdkParamRow): SdkParamRow => {
  const min = row.range?.min ?? 0, max = row.range?.max ?? 0
  return {...row, type: 'enumerated', values: Array.from({length: max - min + 1}, (_, i) => String(min + i))} as SdkParamRow
}

const decode = (key: string, value: number | string | boolean): unknown => {
  if (key === 'depth') return Number(value)
  if (typeof value === 'string' && NAMES[key]) return idOf(key, value)
  return value
}

/** One knowledge face as a device over the open graph (null while none is open). */
export function knowledgeDevice(face: InhabitantFaceDeclaration, surface: KnowledgeGraphSurface | null): DeviceInstance {
  const faceId = face.id
  const values: Record<string, ParamValue> = {}
  const filters = surface?.filters ?? null
  const domains = surface?.domains ?? null
  const gate = (row: SdkParamRow): SdkParamRow => (surface ? row : readingOf(row, NOT_OPEN))
  let rows: SdkParamRow[] = []
  const sets: Record<string, {order: readonly string[]; on: readonly string[]}> = {}
  // A set written empty means every member shows; a set that names every member is that same state (shellSetterBridge.ts knowledgeSet).
  const encodeSet = (_rowKey: string, on: string[], order: readonly string[]): unknown => (on.length === order.length ? [] : on)

  if (faceId === 'knowledge-scope') {
    const depth = !surface ? readingOf(declared(faceId, 'depth'), NOT_OPEN) : filters!.scope !== 'local' ? readingOf(declared(faceId, 'depth'), NOT_LOCAL) : declared(faceId, 'depth')
    rows = [
      placed(named(gate(declared(faceId, 'scope'))), 'Scope', true),
      placed(stepper(depth), 'Scope', true),
      placed(named(gate(declared(faceId, 'direction'))), 'Scope', true),
      placed(gate(declared(faceId, 'shared')), 'Reading', true),
      placed(gate(declared(faceId, 'ghosts')), 'Reading'),
    ]
    if (filters) {
      values.scope = nameOf('scope', filters.scope)
      values.depth = String(filters.depth)
      values.direction = nameOf('direction', filters.direction)
      values.shared = filters.shared
      values.ghosts = filters.unresolved
    }
  } else if (faceId === 'knowledge-filters') {
    // The graph's Find is typed text; the runtime's controls draw no text field, so the device reads it and the body above takes it.
    const text = readingOf(declared(faceId, 'text'), filters ? TYPED_ABOVE : NOT_OPEN)
    const setRows = (key: 'kinds' | 'relations', held: readonly string[] | null, declaredNames: readonly string[], group: string): SdkParamRow[] => {
      const row = declared(faceId, key)
      if (!surface) return [placed(readingOf(row, NOT_OPEN), group)]
      if (held === null) return [placed(readingOf(row, NOT_LOADED), group)]
      const members: SetMember[] = declaredNames.filter(name => held.includes(name)).map(name => ({id: name, label: name}))
      const standing = filters![key].length ? filters![key] : members.map(member => member.id)
      for (const member of members) values[memberKey(key, member.id)] = standing.includes(member.id)
      sets[key] = {order: members.map(member => member.id), on: standing.filter(name => members.some(member => member.id === name))}
      return memberRows(row, members, group)
    }
    rows = [
      placed(text, 'Find', true),
      ...setRows('kinds', domains?.kinds ?? null, KNOWLEDGE_KINDS, 'Subject kinds'),
      ...setRows('relations', domains?.relations ?? null, KNOWLEDGE_RELATIONS, 'Relation types'),
      placed(gate(declared(faceId, 'isolated')), 'Show', true),
      placed(named(gate(declared(faceId, 'context'))), 'Show', true),
    ]
    if (filters) {
      values.text = filters.text
      values.isolated = filters.isolated
      values.context = nameOf('context', filters.context)
    }
  } else if (faceId === 'knowledge-display') {
    rows = [
      placed(named(gate(declared(faceId, 'labels'))), 'Display', true),
      placed(gate(declared(faceId, 'arrows')), 'Display', true),
      placed(gate(declared(faceId, 'zoom')), 'Display', true),
    ]
    if (surface && filters) {
      values.labels = nameOf('labels', filters.labels)
      values.arrows = filters.arrows
      values.zoom = Math.round(surface.zoom * 100) / 100
    }
  } else {
    throw new Error(`${faceId} is not a knowledge graph face`)
  }
  values.open = surface !== null

  const writes = {declared: KNOWLEDGE_DECLARED_ROWS.filter(row => row.deviceInstance === faceId), sets, decode, encodeSet}
  return {
    id: techneDeviceId(KNOWLEDGE_FAMILY, faceId), family: KNOWLEDGE_FAMILY, face: techneFaceDeclaration(face), rows, values, enabledKey: 'open',
    submit: changes => submitThroughOwner(writes, changes),
  }
}
