// AIKit's readings for the Agent's Context page, the Skillset rack's upkeep pages and its member's Why and History (lane W8; D5), through
// the kernel's aikit_read (lane W3 round 3, desktop/cradle/kernel/src/owner_routes.rs AikitRead), each answering AIKit's envelope `data`.
// Real shapes in desktop/cradle/kernel/tests/fixtures/owner-routes/aikit-continuity-history-2026-10-21.json and
// tests/fixtures/aikit-explain-history-2026-10-21.json (read-only captures):
//   continuity-pressure  {brackets {fresh_max, moderate_max, depleted_max, critical_above, prompt_budget}, reading: null | {source,
//                        consumed, pressure, allowance}, composed}            → the Agent's ctx.pressure
//   continuity-commands  {armed: string[], packs, known_packs, composed}     → ctx.armed
//   unused               {count, unused [{capability, name, kind, active, failed_runs}]} → the rack's `unused`
//   collate              {clusters [{name, conflict, copies, where [{root, path, version}]}]} → the rack's `roots`
//   bypass-list          {bypasses [...]}                                    → `bypasses`
//   procedure-list       {count, procedures: string[]}                       → `procedures` (each by its id: the kind, subject, state and
//                        edits are `procedure diff`'s, asked one procedure at a time, and not read for the list)
//   explain <capability> {active, render (its State, Trust and Maturity lines), selected_by, required_by, dependencies, unavailable}
//                                                                            → the member's `why`
//   history <capability> {entries [{kind, occurred_at_unix_ms, summary, recoverability, …}]} → the member's `history`
// Nothing is invented: a field the answer does not carry is left out of its row. Pure (the read hook is workcellReads.ts useAikitRead).

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)
const words = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])

/** An AIKit reading as the window holds it: its `data`, or AIKit's refusal in its words. */
export interface AikitAnswer {
  readonly status: 'reading' | 'answered' | 'refused'
  readonly value: unknown
  readonly error: string | null
}

/** `aikit work continuity pressure` as the Context page's pressure (actuation__harness-model.tsx PressureReading): the prompt budget and
 * the brackets in effect, and — when AIKit reads a session's prompts — what it has consumed and the pressure it names. Null when the
 * answer carries no brackets. Pure. */
export function contextPressureOf(pressure: unknown): Record<string, unknown> | null {
  if (!isObj(pressure) || !isObj(pressure.brackets)) return null
  const brackets = pressure.brackets, reading = isObj(pressure.reading) ? pressure.reading : null
  const kept = Object.fromEntries((['fresh_max', 'moderate_max', 'depleted_max'] as const).flatMap(key => (num(brackets[key]) !== undefined ? [[key, num(brackets[key])]] : [])))
  return {...(num(brackets.prompt_budget) !== undefined ? {budget: num(brackets.prompt_budget)} : {}), brackets: kept,
    ...(reading && num(reading.consumed) !== undefined ? {consumed: num(reading.consumed)} : {}), ...(reading && str(reading.pressure) ? {pressure: reading.pressure} : {})}
}

/** `aikit work continuity commands`'s armed star commands. Null when the answer names no `armed` list. Pure. */
export const armedOf = (commands: unknown): string[] | null => (isObj(commands) && Array.isArray(commands.armed) ? words(commands.armed) : null)

/** `aikit unused`'s capabilities, never seen used. Null when the answer is not the list. Pure. */
export const unusedOf = (unused: unknown): string[] | null => (isObj(unused) && Array.isArray(unused.unused)
  ? unused.unused.flatMap(row => (isObj(row) && str(row.capability) ? [String(row.capability)] : [])) : null)

/** `aikit collate`'s clusters as the rack's roots (skills.tsx `roots`): each root AIKit does not own, the folder its copies stand in, how
 * many skills stand there, and how many of those are copies that differ (`conflict`). Null when the answer has no clusters. Pure. */
export function rootsOf(collate: unknown): Record<string, unknown>[] | null {
  if (!isObj(collate) || !Array.isArray(collate.clusters)) return null
  const roots = new Map<string, {path?: string; skills: number; decide: number}>()
  for (const cluster of collate.clusters) {
    if (!isObj(cluster) || !Array.isArray(cluster.where)) continue
    for (const where of cluster.where) {
      if (!isObj(where) || !str(where.root)) continue
      const root = String(where.root), seen = roots.get(root) ?? {skills: 0, decide: 0}
      const folder = str(where.path)?.replace(/\/[^/]+\/?$/, '')
      roots.set(root, {path: seen.path ?? folder, skills: seen.skills + 1, decide: seen.decide + (cluster.conflict === true ? 1 : 0)})
    }
  }
  return [...roots].map(([root, seen]) => ({root, ...(seen.path ? {path: seen.path} : {}), skills: seen.skills, decide: seen.decide}))
}

/** `aikit bypass list`'s bypasses (skills.tsx `bypasses` {id, scope, reason, capability?, at, state}), each field where AIKit names it.
 * Null when the answer is not the list. Pure. */
export function bypassesOf(list: unknown): Record<string, unknown>[] | null {
  if (!isObj(list) || !Array.isArray(list.bypasses)) return null
  return list.bypasses.flatMap(row => {
    if (!isObj(row)) return []
    const id = str(row.id) ?? str(row.bypass_id)
    return id ? [{id, ...Object.fromEntries((['scope', 'reason', 'capability', 'at', 'state'] as const).flatMap(key => (str(row[key]) ? [[key, row[key]]] : [])))}] : []
  })
}

/** `aikit procedure list`'s procedures, each by its id. Null when the answer is not the list. Pure. */
export const proceduresOf = (list: unknown): Record<string, unknown>[] | null => (isObj(list) && Array.isArray(list.procedures)
  ? words(list.procedures).map(id => ({id})) : null)

/** `aikit source list`'s sources (each as `aikit source show` reads it) as the rack's sources (skills.tsx `sources` {id, kind, skills, retired,
 * active, candidate, rollback, ground, rejected}): active_skills, active_retired_skills, active_snapshot, candidate_snapshot,
 * rollback_points[0], control_ground and the count of candidate_rejected, each where AIKit names it. Null when the answer is not the list. Pure. */
export function sourcesOf(list: unknown): Record<string, unknown>[] | null {
  if (!isObj(list) || !Array.isArray(list.sources)) return null
  return list.sources.flatMap(row => {
    if (!isObj(row) || !str(row.id)) return []
    const rollback = Array.isArray(row.rollback_points) ? str(row.rollback_points[0]) : undefined
    return [{id: row.id, ...(str(row.kind) ? {kind: row.kind} : {}), ...(num(row.active_skills) !== undefined ? {skills: row.active_skills} : {}),
      ...(num(row.active_retired_skills) !== undefined ? {retired: row.active_retired_skills} : {}), ...(str(row.active_snapshot) ? {active: row.active_snapshot} : {}),
      ...(str(row.candidate_snapshot) ? {candidate: row.candidate_snapshot} : {}), ...(rollback ? {rollback} : {}), ...(typeof row.control_ground === 'boolean' ? {ground: row.control_ground} : {}),
      ...(Array.isArray(row.candidate_rejected) ? {rejected: row.candidate_rejected.length} : {})}]
  })
}

/** `aikit procedure diff <id>` as the chosen procedure's {id, kind, digest}. Null when the answer is not a diff. Pure. */
export function procedureDiffOf(diff: unknown): Record<string, unknown> | null {
  if (!isObj(diff) || !str(diff.procedure) || !str(diff.digest)) return null
  return {id: diff.procedure, ...(str(diff.kind) ? {kind: diff.kind} : {}), digest: diff.digest}
}

/** One `Name: value` line of `aikit explain`'s render, as its first word. */
const renderLine = (render: string, label: string): string | undefined => {
  const line = render.split('\n').find(text => text.startsWith(`${label}:`))
  const value = line?.slice(label.length + 1).trim()
  return value ? value.split(/\s+/)[0]!.replace(/[^\w-]/g, '') || undefined : undefined
}

/** `aikit explain <capability>` as the member's Why (member.tsx `why` {state, trust, maturity, selectedBy, requiredBy, dependencies,
 * projection, unavailable?}): its State, Trust and Maturity lines, what selects it, what requires it, its dependencies, why it is
 * unavailable. The Projection targets stand where the render names them; otherwise they are left out. Null when the answer is not an
 * explanation. Pure. */
export function whyOf(explain: unknown): Record<string, unknown> | null {
  if (!isObj(explain) || typeof explain.render !== 'string') return null
  const render = explain.render
  const state = renderLine(render, 'State') ?? (explain.active === true ? 'active' : undefined)
  const trust = renderLine(render, 'Trust'), maturity = renderLine(render, 'Maturity')
  const projectionAt = render.split('\n').findIndex(text => text.startsWith('Projection:'))
  const projection = projectionAt < 0 ? null : render.split('\n').slice(projectionAt + 1).filter(text => text.startsWith('  ')).map(text => text.trim()).filter(Boolean)
  return {...(state ? {state} : {}), ...(trust ? {trust} : {}), ...(maturity ? {maturity} : {}), selectedBy: words(explain.selected_by), requiredBy: words(explain.required_by),
    dependencies: words(explain.dependencies), ...(projection ? {projection} : {}), ...(str(explain.unavailable) ? {unavailable: explain.unavailable} : {})}
}

/** `aikit history <capability>`'s entries as the member's History (member.tsx `history` [{kind, at, summary, recoverability}]), the
 * instant in the person's clock, newest last. Null when the answer is not a history. Pure. */
export function historyOf(history: unknown, timezone?: string): Record<string, unknown>[] | null {
  if (!isObj(history) || !Array.isArray(history.entries)) return null
  const at = (ms: number | undefined) => {
    if (ms === undefined) return undefined
    try { return new Intl.DateTimeFormat('en-GB', {timeZone: timezone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(new Date(ms)).replace(',', '') } catch { return undefined }
  }
  return history.entries.flatMap(row => {
    if (!isObj(row) || !str(row.kind)) return []
    const when = at(num(row.occurred_at_unix_ms))
    return [{kind: row.kind, ...(when ? {at: when} : {}), ...(str(row.summary) ? {summary: row.summary} : {}), ...(str(row.recoverability) ? {recoverability: row.recoverability} : {}),
      ...(num(row.occurred_at_unix_ms) !== undefined ? {ms: num(row.occurred_at_unix_ms)} : {})}]
  }).sort((a, b) => Number(a.ms ?? 0) - Number(b.ms ?? 0)).map(({ms: _, ...row}) => row)
}
