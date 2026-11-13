// The World Model's worlds slice as the kernel composes it (kernel world_model.rs `worlds`, `worlds_of`), over a fixture kernel's own
// owner answers: Central's root from its world browse, each world's pages from its page listing. For the fixture kernels of tests that
// drive the shell's real modules; the composition itself is the kernel's, and is tested there (world_model.rs).

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

/** A fetch-style fixture kernel (`globalThis.fetch`, answering `{json}` documents) that also answers the World Model's worlds slice,
 * composed over its own answers. The composition's own asks are not the shell's: `quiet` tells the fixture so (its third argument). */
export function withWorldModel(fetch) {
  return async (url, init) => {
    const body = JSON.parse(init.body)
    if (body.op !== 'model_subscribe' || body.slice !== 'worlds') return fetch(url, init)
    const ask = async op => (await fetch(url, {...init, body: JSON.stringify(op)}, {quiet: true})).json()
    const answered = await worldsSliceOver(ask)
    return {json: async () => answered}
  }
}
