// The World Model's slices as the kernel composes them (kernel world_model.rs `load`), over a fixture kernel's own owner answers: the
// worlds (`worlds`, `worlds_of`: Central's root from its world browse, each world's pages from its page listing), and what Central's
// chain reads (O-I ticket 1005) — today's Day (`day`), the packets (`packet`), your world's scope (`scope`) and its roster (`roster`),
// each part asked of the owner as the kernel asks it, and each refusal the owner's words in its part. For the fixture kernels of tests
// that drive the shell's real modules; the composition itself is the kernel's, and is tested there (world_model.rs).

/** The worlds of Central's root, as the kernel names them: yours first, then each project whose ProjectCentral keeps a human ground and
 * a wiki. */
export function worldsOfRoot(root) {
  const yours = {ref: root?.control?.agent_wiki?.wiki?.space_ref ?? 'central:wiki:root', name: 'Your world', kind: 'yours', folder: 'Control/user/flows', project: null}
  const projects = (root?.work?.projects ?? []).flatMap(project => {
    const ground = project.projectcentral
    const ref = ground?.agent_wiki?.wiki?.space_ref
    if (!ref || ground?.user?.exists !== true || typeof ground.user.path !== 'string') return []
    const name = (typeof project.world_name === 'string' && project.world_name.trim()) || project.name
    return [{ref, name, kind: 'project', folder: ground.user.path, project: project.name, ...(project.manifest_revision ? {revision: project.manifest_revision} : {})}]
  })
  return [yours, ...projects]
}

/** The kernel's answer to `model_subscribe {slice: 'worlds'}`, composed by asking `ask` (the fixture's own answerer: an op's body →
 * `{ok: true, outcome}` or `{ok: false, error}`) for Central's world browse and each world's page listing, as the kernel asks its own. */
export async function worldsSliceOver(ask, version = 1) {
  const browse = await ask({op: 'world_browse'})
  if (!browse.ok) return {ok: false, error: browse.error}
  const navigator = browse.outcome?.snapshot?.navigator
  if (!navigator?.root) return {ok: false, error: navigator?.error ?? 'Central returned no root disclosure'}
  const root = navigator.root
  const worlds = worldsOfRoot(root)
  const pages = []
  for (const world of worlds) {
    const listed = await ask({op: 'page', request: {operation: 'list', path: world.folder}})
    if (listed.ok) pages.push({folder: world.folder, state: 'read', listing: listed.outcome.data})
    else if (/No such file or directory/i.test(listed.error ?? '')) pages.push({folder: world.folder, state: 'read', listing: {schema: 'oi.page-list/v1', path: world.folder, pages: [], not_pages: [], more: false}})
    else pages.push({folder: world.folder, state: 'refused', why: listed.error})
  }
  return worldsSliceOf(root, pages, version)
}

/** The kernel's answer for the worlds slice of `root`, with `pages` (each `{folder, state: 'read', listing}` or `{folder, state:
 * 'refused', why}`; by default each world's folder holds none). */
export function worldsSliceOf(root, pages = null, version = 1) {
  const worlds = worldsOfRoot(root)
  const held = pages ?? worlds.map(world => ({folder: world.folder, state: 'read', listing: {schema: 'oi.page-list/v1', path: world.folder, pages: [], not_pages: [], more: false}}))
  return {ok: true, outcome: {result: 'model_slice', data: {schema: 'oi.world-model-slice/v1', slice: 'worlds', owner: 'Central', scopes: ['root', 'work'],
    version, state: 'read', value: {root, worlds, pages: held}, error: null, read_at_unix_ms: 1}}}
}

// ── what Central's chain reads (O-I ticket 1005) ──────────────────────────────────────────────────────────────────────────────

const SLICE = {day: {owner: 'Central', scopes: ['root', 'clock']}, packet: {owner: 'AIKit', scopes: ['aikit', 'root']},
  scope: {owner: 'Central', scopes: ['root', 'aikit']}, roster: {owner: 'Central', scopes: ['root']}}
const isObject = value => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The kernel's answer for `slice`, read (`value`) or refused in the owner's words (`why`), as world_model.rs `answer` gives it. */
function sliceAnswer(slice, read, version) {
  const {owner, scopes} = SLICE[slice]
  return {ok: true, outcome: {result: 'model_slice', data: {schema: 'oi.world-model-slice/v1', slice, owner, scopes, version,
    state: read.ok ? 'read' : 'refused', value: read.ok ? read.value : null, error: read.ok ? null : read.why, read_at_unix_ms: 1}}}
}
/** A part of a slice (world_model.rs `part`): what the owner gave, or its words why it gave none. */
const part = read => (read.ok ? {state: 'read', reading: read.value} : {state: 'refused', why: read.why})
/** An outcome's payload (world_model.rs `payload`): its `data` when that is all it carries, else every field but the result's name. */
function payloadOf(answer) {
  if (!answer.ok) return {ok: false, why: answer.error}
  const {result: _result, ...rest} = answer.outcome ?? {}
  const keys = Object.keys(rest)
  return {ok: true, value: keys.length === 1 && keys[0] === 'data' ? rest.data : rest}
}
/** One owner's reading Action, asked by the kernel's one act path (world_model.rs `act`): its data, or the owner's words. */
async function actOver(ask, action, input) {
  const answer = await ask({op: 'act', action, input})
  if (!answer.ok) return {ok: false, why: answer.error}
  const dispatch = answer.outcome?.dispatch ?? {}
  if (dispatch.state === 'invoked') return {ok: true, value: dispatch.data}
  return {ok: false, why: dispatch.message ?? dispatch.detail ?? `${action} answered ${JSON.stringify(dispatch)}`}
}
/** The agent sessions of your world's root register (world_model.rs `root_sessions`: `agency_read` `spaces[].agent_sessions`), each once. */
async function rootSessionsOver(ask) {
  const agency = payloadOf(await ask({op: 'agency_read', project: ''}))
  if (!agency.ok) return agency
  const spaces = Array.isArray(agency.value?.spaces) ? agency.value.spaces : []
  return {ok: true, value: [...new Set(spaces.flatMap(space => (isObject(space.agent_sessions) ? Object.keys(space.agent_sessions) : [])))].sort()}
}

/** Today's Day (world_model.rs `day`): `day_read`, and beside it the root's ground (`central` inspect), the Day's settings and today's
 * moves and field, each its own part. Today's Day refused leaves the other parts and says why (`refused`); only when the ground refuses
 * too is the slice refused. */
export async function daySliceOver(ask, version = 1) {
  const read = payloadOf(await ask({op: 'day_read'}))
  const ground = payloadOf(await ask({op: 'central', project: null, request: {kind: 'inspect'}}))
  let day
  if (read.ok && isObject(read.value)) day = {...read.value}
  else if (read.ok) day = {refused: `Central's reading of today's Day is no object: ${JSON.stringify(read.value)}`}
  else if (!ground.ok) return sliceAnswer('day', {ok: false, why: `${read.why}; ${ground.why}`}, version)
  else day = {refused: read.why}
  const today = typeof day.day_ref === 'string' ? day.day_ref : null
  const settings = await actOver(ask, 'central.day.settings.read', {project: null})
  const ofToday = action => (today ? actOver(ask, action, {project: null, day_ref: today}) : {ok: false, why: 'Central\'s reading of today\'s Day names no day_ref'})
  const moves = await ofToday('central.day.moves.read')
  const field = await ofToday('central.day.field.read')
  return sliceAnswer('day', {ok: true, value: {...day, ground: part(ground), settings: part(settings), moves: part(moves), field: part(field)}}, version)
}

/** AIKit's prepared context (world_model.rs `packet`): the root register's own, and each of its sessions', each its own part. */
export async function packetSliceOver(ask, version = 1) {
  const context = async session => payloadOf(await ask({op: 'encounter', project: '', request: {action: 'context', agent_session: session, request: {operation: 'read'}}}))
  const sessions = await rootSessionsOver(ask)
  if (!sessions.ok) return sliceAnswer('packet', sessions, version)
  const bySession = {}
  for (const session of sessions.value) bySession[session] = part(await context(session))
  return sliceAnswer('packet', {ok: true, value: {register: part(await context(null)), sessions: bySession}}, version)
}

/** What Scope reads of your world (world_model.rs `scope`): its effective sources and its authored relations as Central resolves them,
 * and each root session's own settings in AIKit, by session. */
export async function scopeSliceOver(ask, version = 1) {
  const effective = await actOver(ask, 'central.world.effective-sources', {scope: 'root', world_ref: 'control:root'})
  const relations = await actOver(ask, 'central.world-relations.read', {scope: 'root', ref: 'control:root'})
  const sessions = await rootSessionsOver(ask)
  let settings = sessions
  if (sessions.ok) {
    const bySession = {}
    for (const session of sessions.value) bySession[session] = part(payloadOf(await ask({op: 'encounter_session_settings', project: '', agent_session: session})))
    settings = {ok: true, value: bySession}
  }
  return sliceAnswer('scope', {ok: true, value: {effective: part(effective), relations: part(relations), settings: part(settings)}}, version)
}

/** Your world's roster (world_model.rs `roster`, `cards`): Central's agent profiles of the root register, and the card of each agent you
 * accepted in its home World and in each World it ratifies, by agent, then by World (`home`). */
export async function rosterSliceOver(ask, version = 1) {
  const roster = payloadOf(await ask({op: 'agent_definition', project: null, request: {action: 'roster'}}))
  if (!roster.ok) return sliceAnswer('roster', roster, version)
  const cards = {}
  for (const entry of Array.isArray(roster.value?.profiles) ? roster.value.profiles : []) {
    const agent = entry?.accepted === true ? entry.profile?.agent_ref : null
    if (typeof agent !== 'string') continue
    const worlds = [null, ...(Array.isArray(entry.profile.ratified_world_refs) ? entry.profile.ratified_world_refs.filter(world => typeof world === 'string') : [])]
    for (const world of worlds) {
      cards[agent] ??= {}
      cards[agent][world ?? 'home'] = part(payloadOf(await ask({op: 'agent_card', agent_ref: agent, world_ref: world})))
    }
  }
  return sliceAnswer('roster', {ok: true, value: {roster: roster.value, cards}}, version)
}

const COMPOSED = {worlds: worldsSliceOver, day: daySliceOver, packet: packetSliceOver, scope: scopeSliceOver, roster: rosterSliceOver}

/** A fetch-style fixture kernel (`globalThis.fetch`, answering `{json}` documents) that also answers the World Model's slices the kernel
 * composes over owner answers — the worlds, and what Central's chain reads — composed over its own answers, as fresh on every ask. The
 * composition's own asks are not the shell's: `quiet` tells the fixture so (its third argument). */
export function withWorldModel(fetch) {
  return async (url, init) => {
    const body = JSON.parse(init.body)
    const compose = body.op === 'model_subscribe' ? COMPOSED[body.slice] : undefined
    if (!compose) return fetch(url, init)
    const ask = async op => (await fetch(url, {...init, body: JSON.stringify(op)}, {quiet: true})).json()
    const answered = await compose(ask)
    return {json: async () => answered}
  }
}
