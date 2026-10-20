// What agents have made (T-PROCEDURAL-BODY §6 item 1; manual §17.2 "Your system": "What an agent has just made rides the outer ring"). A pure
// reading of one register's change horizon, Central's `projectcentral.change.horizon` (`central.source-change-horizon/v1`), which the kernel's
// `central` op carries inside the ground it inspects for any register (desktop/cradle/kernel/src/central.rs:200; desktop/cradle/src/central/
// client.ts readGround): the root's is the ground the window already holds (central/devices/useCentralReadings.ts useCentralGroundAnswer), a
// project's is read for its own project. Each change row is a `central.source-change/v1`: change_ref, cursor, source_ref, source_path, kind
// (added | modified | removed), observed_at_unix_seconds, actor, actor_kind and agent_session_ref (central/devices/contextWorldBinding.ts
// SourceChange). Nothing is stored and nothing is guessed: a change that cannot be keyed or dated is left out.
//
// An artefact is a change an agent made: its actor kind is `agent`, or it names an agent session. That is the Ledger's own rule for "what an
// agent did" (agent/devices/receiptBindings.ts receiptRows). A removal made nothing, so it is none. One file is one artefact, at its newest
// change, so a file an agent worked on all morning stands in one place on the ring.
import type {SystemArtifact} from './systemModel'

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null)
/** A file's name as the ring says it: the end of its path, without its extension. */
const nameOf = (path: string): string => (path.split('/').filter(Boolean).pop() ?? path).replace(/\.[a-z0-9]+$/i, '')

/** The artefacts agents made in one register, newest first (ties by ref). `horizon` is the change horizon as the owner answered it (a
 * reading that is not one gives none); `project` is the register's project, null for the root's, carried on each artefact. */
export function artifactsOf(horizon: unknown, project: string | null): SystemArtifact[] {
  const changes = isObject(horizon) && Array.isArray(horizon.changes) ? horizon.changes : []
  const newest = new Map<string, {readonly artifact: SystemArtifact; readonly cursor: number}>()
  for (const change of changes) {
    if (!isObject(change)) continue
    const session = text(change.agent_session_ref)
    if (change.actor_kind !== 'agent' && !session) continue
    if (change.kind === 'removed') continue
    const ref = text(change.source_ref), at = change.observed_at_unix_seconds
    if (!ref || typeof at !== 'number' || !Number.isFinite(at)) continue
    const path = text(change.source_path) ?? ref
    const cursor = typeof change.cursor === 'number' ? change.cursor : 0
    const held = newest.get(ref)
    if (held && (held.artifact.atMs > at * 1000 || (held.artifact.atMs === at * 1000 && held.cursor > cursor))) continue
    newest.set(ref, {cursor, artifact: {ref, name: nameOf(path), path, atMs: at * 1000, project, sessionRef: session, actor: text(change.actor)}})
  }
  return [...newest.values()].map(({artifact}) => artifact).sort((a, b) => b.atMs - a.atMs || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0))
}
