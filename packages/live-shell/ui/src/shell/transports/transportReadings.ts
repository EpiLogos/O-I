// What the transport's readouts and its title line show, as pure functions of the owners' own readings (manual §10.5: "What
// each control does follows the work in front of you"; DEVICE-SEMANTICS-LOCK §0.4: owners write, faces read). Nothing here
// reads the wall clock, a store or a carrier: every value is the owner's, formatted, and a reading the owner does not give
// is null — the slot then stays drawn with its meaning and waits. The readers that hand these their inputs are named where
// the hooks call them (useCentralTransport.tsx, useFactoryTransport.tsx, useExpressionsTransport.tsx, modeTransports.tsx).
//
// Pure TypeScript. No React, no transport, no timers.
import type {CentralGroundReading} from '../../../../../../desktop/cradle/src/central/client'
import {validateDocumentBasis} from '../../../../../../desktop/cradle/src/central/dayForm'
import {NO_CIVIL_TIME, wantsCivilTime} from '../../central/devices/dayBinding'
import type {PreparedContext} from '../../../../../../desktop/cradle/src/context/nativeContext'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import type {ShellConfig} from '../../native/application'
import type {TransportBindings} from '../../frame/transport/slots'
import {civilDateOfDayRef} from '../../central/centralVertical'
import {DIE_POSITIONS, dieFaceLabel, dieFaceOf} from '../../central/devices/dayDie'
import {revisionShort} from '../../central/documents/documentDoor'

export interface Readout {value: string; title: string}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A civil date (`2026-10-08`) as the mockup's title and position write it, `08 Oct` — the date's own fields, never a clock. */
export function civilDayLabel(civilDate: string | null | undefined): string | null {
  const match = civilDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined
  return match && month ? `${match[3]} ${month}` : null
}

/** An instant the owner gives (unix seconds) on the owner's civil clock: HH:MM in the policy's timezone. Null when either is
 * missing or the timezone is not one the platform knows. */
export function civilClock(unixSeconds: unknown, timezone: string | null | undefined): string | null {
  if (typeof unixSeconds !== 'number' || !Number.isFinite(unixSeconds) || !timezone) return null
  try {
    return new Intl.DateTimeFormat('en-GB', {hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timezone}).format(new Date(unixSeconds * 1000))
  } catch { return null }
}

/** The civil-time policy's day boundary (minutes after civil midnight) as HH:MM; null outside the policy's own range. */
export function boundaryClock(minutes: unknown): string | null {
  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 0 || minutes >= 1440) return null
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** A count as the mockup's readouts write it (`500`, `1.2k`, `142k`). A value that is not a whole number stays as given. */
export function compactCount(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const number = typeof value === 'number' ? value : /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN
  if (!Number.isFinite(number)) return String(value)
  if (number < 1000) return String(number)
  return number < 10_000 ? `${(number / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${Math.round(number / 1000)}k`
}

// ————————————————————————————————————————————————————————————————————————
// The title line: THE selection — the world · the day (the mockup's `#title`), or the set's name in Live.

/** The worlds the book names (desktop/cradle/src/workspace/store.ts `WorldRef`) and the host's world owner, in plain words. */
const WORLD_NAMES: Readonly<Record<string, string>> = {central: 'Central', 'epi-logos': 'Epi-Logos'}

/** The world's name: the book's WorldContext.world, else the World the host discloses (live_shell_config world_scope.owner). */
export function worldName(bookWorld: string | null | undefined, config: Pick<ShellConfig, 'world_scope'> | null | undefined): string | null {
  return WORLD_NAMES[bookWorld ?? ''] ?? WORLD_NAMES[config?.world_scope?.owner ?? ''] ?? null
}

export interface TitleLine {
  /** The selection's (or the set's) own title; null when none stands. */
  readonly lead: string | null
  /** What the line says in its place when nothing stands. */
  readonly absent: string | null
  /** The world · the day, or `Live set`; null when no reading names either. */
  readonly context: string | null
}

/** The title line the bar reads in a mode: `set` (Live: the open set's name) or `selection` (THE selection, its world and the
 * civil day the World cut stands in — the day the spine's civil reading names). */
export function titleLine(input: {line: 'set' | 'selection'; setName?: string | null; selection?: {title: string} | null; world?: string | null; civilDayRef?: string | null}): TitleLine {
  if (input.line === 'set') {
    const lead = input.setName?.trim() || null
    return {lead, absent: lead ? null : 'No set open', context: 'Live set'}
  }
  const lead = input.selection?.title?.trim() || null
  const day = civilDayLabel(civilDateOfDayRef(input.civilDayRef))
  const context = [input.world ?? null, day].filter(Boolean).join(' · ') || null
  return {lead, absent: lead ? null : 'Nothing selected', context}
}

// ————————————————————————————————————————————————————————————————————————
// Central: the Day, its die, its bounds, the packet and the machine serving the ground.

export type DayDie =
  | {readonly state: 'ready'; readonly face: number; readonly revision: string; readonly civilDate: string
    readonly aperture: {readonly project: null; readonly sourceRef: string; readonly documentId: string}}
  | {readonly state: 'waiting'; readonly reason: string}

/** Today's Day die, from the owner's ground reading (`central` inspect: the Day reading and its native document). Ready only
 * when the owner holds a native Day document: its open face (`meta.face`, the form's own state) and the aperture the die's
 * write route turns (central/devices/centralDeviceWrites.ts `turnDieFace`). */
export function dayDieOf(ground: CentralGroundReading | null, error: string | null): DayDie {
  if (!ground) return {state: 'waiting', reason: error ? `Central's ground read refused: ${error}` : 'Reading Central\'s ground — the owner\'s Day and civil-time readings.'}
  const day = ground.day
  // A ground with no time zone for its days has no Day: the way on is Setup's Ground step, not Central's raw denial (O-I #740).
  if ((day.state !== 'ready' || !day.data) && wantsCivilTime(ground)) return {state: 'waiting', reason: NO_CIVIL_TIME}
  if (day.state !== 'ready' || !day.data) return {state: 'waiting', reason: `Central's Day reading is ${day.state}${day.error?.message ? `: ${day.error.message}` : '.'}`}
  const reading = day.data
  if (reading.document_state !== 'ready' || !reading.document) {
    return {state: 'waiting', reason: `Today's Day (${reading.temporal.civil_date}) has no native document yet. The owner's explicit initialisation writes it; the die turns on it then.`}
  }
  try {
    const documentId = String((reading.document as {document_id?: unknown}).document_id)
    const basis = validateDocumentBasis(reading.document, reading.source.ref, documentId)
    return {state: 'ready', face: dieFaceOf(basis.payload), revision: basis.revision, civilDate: reading.temporal.civil_date,
      aperture: {project: null, sourceRef: reading.source.ref, documentId}}
  } catch (cause) {
    return {state: 'waiting', reason: cause instanceof Error ? cause.message : String(cause)}
  }
}

/** The die's face as the tempo slot shows it (`face 3`), and its shape on the signature slot (`4 + 2`: four working faces
 * between the two poles — the form's own positions, central/devices/dayDie.ts DIE_POSITIONS). */
export function dieReadouts(die: DayDie): {tempo?: Readout; signature?: Readout} {
  if (die.state !== 'ready') return {}
  const working = DIE_POSITIONS.length - 2
  return {
    tempo: {value: `face ${die.face}`, title: `Die face — the Day die is open at ${dieFaceLabel(die.face)} (the owner's Day document, ${die.civilDate}, revision ${die.revision}). ‹ › turn it through the die's own write route.`},
    signature: {value: `${working} + 2`, title: `4 + 2 — the Day's shape: ${working} working faces (${DIE_POSITIONS.slice(1, -1).map(position => position.name).join(', ')}) between the two poles, ${DIE_POSITIONS[0].name} and ${DIE_POSITIONS[DIE_POSITIONS.length - 1].name} (the die's own positions).`},
  }
}

/** The day's opening (punch-in) and its close (punch-out): when the owner opened today's Day record, and the boundary the
 * civil-time policy closes it at — both on the owner's clock. The day opens and closes by itself; no hour is set here. */
export function dayBounds(ground: CentralGroundReading | null): {opened?: Readout; closes?: Readout} {
  const time = ground?.time.state === 'ready' ? ground.time.data ?? null : null
  const day = ground?.day.state === 'ready' ? ground.day.data ?? null : null
  const timezone = time?.policy.timezone ?? (typeof day?.temporal.timezone === 'string' ? day.temporal.timezone : null)
  const out: {opened?: Readout; closes?: Readout} = {}
  const opened = civilClock(day?.temporal.created_at_unix_seconds, timezone)
  if (day && opened) {
    out.opened = {value: opened, title: `Day opened — the Day ${day.temporal.civil_date} opened by itself at ${opened} ${timezone} (Central's Day reading: its record's creation; lifecycle ${day.temporal.lifecycle ?? 'not disclosed'}). No hour is set in the instrument.`}
  }
  const closes = boundaryClock(time?.policy.day_boundary_minutes)
  if (time && closes) {
    out.closes = {value: closes, title: `Day close — the day closes by itself at the civil-time policy's boundary, ${closes} ${time.policy.timezone} (day_boundary_minutes ${time.policy.day_boundary_minutes}; automatic rollover ${time.policy.automatic_day_rollover ? 'on' : 'off'}; ${time.source_ref}). No hour is set in the instrument.`}
  }
  return out
}

/** The moment of the day (the position slot): the civil day, the die's open face, and — with no die — the civil Now the
 * World cut reads. The paragraph of the focused document has no reading yet, so it is not drawn. */
export function centralPosition(ground: CentralGroundReading | null, die: DayDie, now: Readout | undefined): Readout | null {
  const civilDate = ground?.time.state === 'ready' ? ground.time.data?.civil_date : ground?.day.data?.temporal.civil_date
  const day = civilDayLabel(civilDate)
  if (!day) return null
  const nowValue = now && /\d/.test(now.value) ? now.value : null
  const second = die.state === 'ready' ? `p${die.face}` : nowValue
  return {
    value: [day, second].filter(Boolean).join(' · '),
    title: `The moment of the day — ${civilDate} (Central's civil-time reading)${die.state === 'ready' ? `, the Day die open at ${dieFaceLabel(die.face)}` : ''}${!second || die.state === 'ready' ? '' : `, Now ${nowValue}`}. The paragraph of the focused document has no reading yet.`,
  }
}

/** The packet's size and scope (the key and scale slots) from AIKit's prepared context — the read the packet widget makes
 * (widgets/PacketWidget.tsx). The owner discloses no token count: the size is the selections' own characters, named so. */
export function packetReadouts(packet: {context?: PreparedContext; error?: string} | null): {key?: Readout; scale?: Readout; refused?: string} {
  if (!packet) return {}
  if (!packet.context) return packet.error ? {refused: `The prepared-context owner refused: ${packet.error}`} : {}
  const items = packet.context.items
  const text = items.filter(item => item.selection.anchor.kind === 'text')
  const characters = text.reduce((sum, item) => sum + item.selection.text.length, 0)
  const pages = items.length - text.length
  const scope = packet.context.scope
  return {
    key: {value: `Σ ${compactCount(characters)}`, title: `Packet — exactly what the agent will read: ${items.length} selection${items.length === 1 ? '' : 's'}, ${characters} characters of selected text${pages ? ` and ${pages} page element${pages === 1 ? '' : 's'}` : ''}. AIKit's prepared context discloses no token count, so the size is characters (aikit.prepared-context/v1, revision ${packet.context.revision}).`},
    scale: {value: scope.agent_session ? 'session' : scope.project, title: scope.agent_session
      ? `Scope — the packet is prepared for the conversation ${scope.agent_session} in ${scope.project}.`
      : `Scope — the packet is prepared for the ${scope.project} project; no conversation receives it yet.`},
  }
}

/** Which machine serves the ground (Central's rate slot): the World's workcell and the carrier, from the host's own
 * configuration (live_shell_config world_scope.workcell_ref and its kernel transport). Null with no carrier. */
export function groundCarrier(config: Pick<ShellConfig, 'world_scope'> | null | undefined, transport: KernelTransportStatus): Readout | null {
  if (transport.kind === 'unavailable') return null
  const workcell = config?.world_scope?.workcell_ref ?? null
  const machine = workcell ? workcell.replace(/^workcell:/, '') : 'ground'
  const local = transport.kind === 'tauri'
  return {
    value: `${machine} · ${local ? 'local' : 'bridge'}`,
    title: `Carrier — which machine serves your ground: ${workcell ? `the World's workcell ${workcell}` : 'the host names no workcell'}, ${local ? 'through the native host\'s own kernel transport on this machine' : `through the development owner bridge (${transport.kind === 'bridge' ? transport.url : 'its address'})`}. Read from the host's configuration.`,
  }
}

/** Central's bindings over the owners' readings (the hook, useCentralTransport.tsx, reads them; this words them). `turn` is the
 * die's write route when today's Day document stands; `turned` is the owner's last answer to a turn. */
export function centralBindings(input: {
  ground: CentralGroundReading | null
  groundError: string | null
  packet: {context?: PreparedContext; error?: string} | null
  config: Pick<ShellConfig, 'world_scope'> | null | undefined
  transport: KernelTransportStatus
  /** The frame's civil readouts (the carrier on Link, Now), shown where nothing nearer the owner answers. */
  readouts?: Partial<Record<string, Readout>>
  turn?: (direction: 1 | -1) => void
  turned?: string | null
  /** The document the hand last reached in a pane (central/documents/documentDoor.ts): its save standing is the Load slot. */
  document?: {form: string; title: string; state: string; revision?: string} | null
  /** The face the Day shows where a pane holds it open (documentDoor.ts useDayInPane), which the owner holds at its next Save. */
  face?: number
}): TransportBindings {
  const read = dayDieOf(input.ground, input.groundError)
  const die = read.state === 'ready' && input.face !== undefined ? {...read, face: input.face} : read
  const faces = dieReadouts(die)
  const bounds = dayBounds(input.ground)
  const sized = packetReadouts(input.packet)
  const carrier = groundCarrier(input.config, input.transport)
  const position = centralPosition(input.ground, die, input.readouts?.position)
  const waits = die.state === 'waiting' ? die.reason : null
  const refused = input.groundError ? `Central's ground read refused: ${input.groundError}` : null
  const readout = (value: Readout | null | undefined) => value ? {readout: value} : {}
  return {
    ...Object.fromEntries(Object.entries(input.readouts ?? {}).map(([id, value]) => [id, {readout: value}])),
    tempo: {...readout(faces.tempo), ...(faces.tempo && input.turn ? {step: input.turn} : {}),
      title: [faces.tempo?.title ?? `Die face — the Day die's open face; ‹ › turn it. ${waits ?? ''}`.trim(), input.turned].filter(Boolean).join(' ')},
    signature: {...readout(faces.signature), ...(faces.signature ? {} : {title: `4 + 2 — the Day's shape: four working faces between two poles. ${waits ?? ''}`.trim()})},
    'punch-in': {...readout(bounds.opened), ...(bounds.opened ? {} : {title: `Day opened — read from Central's Day reading. ${refused ?? 'Reading the Day.'}`})},
    'punch-out': {...readout(bounds.closes), ...(bounds.closes ? {} : {title: `Day close — read from the civil-time policy. ${refused ?? 'Reading the policy.'}`})},
    ...(position ? {position: {readout: position}} : {}),
    ...(sized.key ? {key: {readout: sized.key}} : sized.refused ? {key: {title: `Packet tokens — the packet's size. ${sized.refused}`}} : {}),
    ...(sized.scale ? {scale: {readout: sized.scale}} : {}),
    ...(carrier ? {rate: {readout: carrier}} : {}),
    ...(input.document ? {cpu: {readout: documentLoad(input.document)}} : {}),
  }
}

/** Whether the document is saved (Central's Load slot, the mockup's `edited`): the reached document's standing in one word,
 * its full words and revision in the title. */
export function documentLoad(document: {form: string; title: string; state: string; revision?: string}): Readout {
  const word = document.state.startsWith('edited') ? 'edited' : document.state.startsWith('waiting') ? 'saving…'
    : document.state.startsWith('saved') ? 'saved' : document.state.startsWith('unchanged') ? 'saved'
    : document.state.startsWith('as read') ? 'as read' : document.state.split(' — ')[0]
  return {value: word, title: `Save state — the ${document.form} ${document.title}${document.revision ? ` at r${revisionShort(document.revision)}` : ''}: ${document.state}`}
}

// ————————————————————————————————————————————————————————————————————————
// Factory and Expressions.

/** Tokens in · out (Factory's key slot, the mockup's `Σ 142k · 38k`), from the encounter task reading the bar reads. */
export function tokenReadout(tokensIn: string, tokensOut: string, scope: string): Readout {
  return {value: `Σ ${compactCount(tokensIn)} · ${compactCount(tokensOut)}`,
    title: `Tokens in · out — ${tokensIn} read and ${tokensOut} written in the ${scope} scope (the encounter task reading). Press to change the scope: session · group · everything open.`}
}

/** The scene's ratio of hold to change (Expressions' signature, the mockup's `5 : 3`) from the field's morph hold share — the
 * fraction of each cycle the field holds (`toroidalMorph.holdRatio`, the morph dwell readNativeGlyphTiming reads). The
 * simplest whole ratio within half a percent, else the shares in percent. Null outside (0, 1). */
export function holdRatio(share: number | null | undefined): string | null {
  if (typeof share !== 'number' || !(share > 0 && share < 1)) return null
  for (let total = 2; total <= 16; total += 1) {
    for (let hold = 1; hold < total; hold += 1) if (Math.abs(hold / total - share) < 0.005) return `${hold} : ${total - hold}`
  }
  const percent = Math.round(share * 100)
  return `${percent} : ${100 - percent}`
}
