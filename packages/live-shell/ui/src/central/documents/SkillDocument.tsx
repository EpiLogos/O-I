// A skill in the Document (manual §19.8; O-I ticket 1005), drawn in a Central document pane (CentralDocumentPane.tsx), which loads this
// module when a skill is first opened, never with the shell's first frame (O-I #740). Central keeps the skill and the one revision that
// may wait beside it (ctrl control_skills.rs); the text in use is the file owner's reading of the folder Central names; a release is
// AIKit's sync and promote of the source that reads Central's ground.
import {useEffect, useState} from 'react'
import type {CentralLocation, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {kernelRead} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {listFiles, readFile} from '../../../../../../desktop/cradle/src/files/client'
import {Refusal} from '../../../../../../desktop/cradle/src/shared/Refusal'
import {TextEditor} from '../../../../../../desktop/cradle/src/editor/lazy'
import {centralRead, centralWrite} from '../devices/centralDeviceWrites'
import {aikitReadOp, aikitWriteOp, centralRevisionWrite, DESKTOP_ACTOR, ownerRouteWrite, routeAnswerOf} from '../../agent/devices/ownerRoutes'
import {skillInput, type SkillSubject} from './centralDocuments'
import {Absence} from './CentralDocumentPane'

/** Central's reading of a skill and the revision that waits beside it (ctrl control_skills.rs `control.skills.revision.read`). */
export interface SkillRevisionReading {
  readonly path: string
  readonly in_use: {readonly digest: string}
  readonly proposal: {readonly revision_ref: string; readonly proposed_digest: string; readonly proposed_body: string; readonly reason: string
    readonly proposed_by: string; readonly proposed_at_unix_seconds: number} | null
  readonly stale: boolean
  readonly accept: {readonly available: boolean; readonly reason: string | null}
}

/** The skill as Central keeps it: its revision reading, and the text in use read by the file owner from the skill's folder as Central
 * names it (`path`, by the owner's own listing). */
export async function readSkill(transport: KernelTransportStatus, skill: SkillSubject): Promise<{reading: SkillRevisionReading; text: string; location: CentralLocation}> {
  const reading = await centralRead(transport, 'control.skills.revision.read', skillInput(skill)) as SkillRevisionReading
  if (typeof reading?.path !== 'string') throw new Error(`Central did not name where ${skill.name} is kept.`)
  const folder = await listFiles(transport, reading.path, true)
  const body = folder.entries.find(item => item.kind === 'file' && item.name === 'SKILL.md')
  if (!body?.location) throw new Error(`The owner lists no SKILL.md in ${reading.path}.`)
  return {reading, text: (await readFile(transport, body.location, true)).content, location: body.location}
}

/** The kind of AIKit source that reads a ground of Central's (`aikit source list`). */
const CENTRAL_SOURCE_KIND = 'central'

/** The AIKit source a skill's release syncs and promotes: the source of the member the open named (`skill/<source>/<name>`), else the one
 * source AIKit keeps from Central (`aikit source list`, kind `central`); refused in words when AIKit keeps none or several. */
export async function releaseSourceOf(transport: KernelTransportStatus, skill: SkillSubject): Promise<string> {
  const named = /^skill\/([^/]+)\//.exec(skill.member ?? '')
  if (named) return named[1]!
  const listed = routeAnswerOf(await kernelRead(transport, aikitReadOp({kind: 'source-list'}), {fresh: true}), '`aikit source list`').data as {sources?: {id?: unknown; kind?: unknown}[]} | null
  const central = (listed?.sources ?? []).filter(row => row.kind === CENTRAL_SOURCE_KIND && typeof row.id === 'string').map(row => row.id as string)
  if (central.length === 1) return central[0]!
  throw new Error(central.length
    ? `Release: AIKit keeps ${central.length} sources from Central (${central.join(', ')}); open ${skill.name} from its member in the Skillset rack, which names the one that carries it.`
    : `Release: AIKit keeps no source from Central (\`aikit source list\`), so no harness carries ${skill.name} through AIKit yet.`)
}

/** Release a skill Central wrote: AIKit syncs its source from Central and promotes it, recording your review of the member (`aikit source
 * sync` · `promote --trust-skill`), so every harness that carries it holds the revision you accepted. */
export async function releaseSkill(transport: KernelTransportStatus, skill: SkillSubject): Promise<string> {
  const source = await releaseSourceOf(transport, skill)
  await ownerRouteWrite(transport, aikitWriteOp({kind: 'source-sync', id: source}), '`aikit source sync`')
  await ownerRouteWrite(transport, aikitWriteOp({kind: 'source-promote', id: source, trust_skills: [skill.member ?? `skill/${source}/${skill.name}`]}),
    '`aikit source promote`')
  return source
}

/** A skill in the Document (manual §19.8, Skill: "Write it in Document, or open the one you have. Propose a revision, review it and
 * release it to every harness that carries it"; O-I ticket 1005). Central keeps the skill and the one revision that may wait beside it
 * (ctrl control_skills.rs): you write the revision over the text in use and Propose keeps it there, the skill untouched
 * (`control.skills.revision.propose`). A revision that waits shows with why and by whom, and Accept writes it as the skill in use, or
 * Discard drops it, each your own act at the digest you read (`control.skills.revision.accept` · `discard`: ownerRoutes.ts
 * centralRevisionWrite, the hand Approvals' and the Refining page's Accept use). Release then hands it to AIKit (releaseSkill). */
export function SkillDocument({transport, skill}: {transport: KernelTransportStatus; skill: SkillSubject}) {
  const [held, setHeld] = useState<{reading: SkillRevisionReading; text: string; location: CentralLocation} | {why: string} | null>(null)
  const [again, setAgain] = useState(0)
  const [draft, setDraft] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [fault, setFault] = useState<unknown>(null)
  const [note, setNote] = useState<string | null>(null)
  const [releaseAsk, setReleaseAsk] = useState(false)
  const key = JSON.stringify(skillInput(skill))
  useEffect(() => {
    let live = true
    readSkill(transport, skill).then(read => { if (live) setHeld(read) }, error => { if (live) setHeld({why: String(error instanceof Error ? error.message : error)}) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport, key, again])
  if (!held) return <Absence form="Skill" state="reading"><p>Reading {skill.name} from Central…</p></Absence>
  if ('why' in held) return <Absence form="Skill" state="refused"><p role="alert">Central could not read {skill.name}: “{held.why}”</p></Absence>
  const {reading, text, location} = held, waiting = reading.proposal, body = draft ?? text
  const act = (name: string, run: () => Promise<string | void>) => {
    if (pending) return
    setPending(name); setFault(null); setNote(null)
    void run().then(said => { if (said) setNote(said); setAgain(n => n + 1) }, setFault).finally(() => setPending(null))
  }
  const propose = () => act('propose', async () => {
    await centralWrite(transport, 'control.skills.revision.propose', {...skillInput(skill), body, reason: reason.trim(), proposed_by: DESKTOP_ACTOR})
    setDraft(null); setReason('')
    return `Your revision of ${skill.name} waits beside the skill in use. Read it, then Accept or Discard it.`
  })
  const answer = (verb: 'accept' | 'discard') => act(verb, async () => {
    const hand = centralRevisionWrite(transport)
    if (!hand || !waiting) throw new Error('No kernel carries your act to Central here.')
    await hand(verb, {...skillInput(skill), proposedDigest: waiting.proposed_digest})
    if (verb === 'discard') return `The revision of ${skill.name} was dropped; the skill in use stands as it was.`
    setReleaseAsk(true)
    return `${skill.name} now reads as the revision you accepted. Release it to the harnesses that carry it.`
  })
  const release = () => act('release', async () => {
    setReleaseAsk(false)
    const source = await releaseSkill(transport, skill)
    return `AIKit synced ${source} from Central and promoted it, with your review recorded: every harness that carries ${skill.name} holds this revision.`
  })
  const why = waiting ? 'A revision waits: Accept or Discard it before proposing another.'
    : body === text ? 'Write your revision over the text in use first.' : !reason.trim() ? 'Say why, in a line, before you propose.' : null
  return (
    <div className="central-skill-document" data-central-skill={skill.name}>
      <div className="document-pane-head" data-document-head="skill">
        <span className="document-pane-form">Skill · {skill.name}</span>
        <span className="document-pane-state" role="status" aria-live="polite">{pending ? 'waiting for the owner' : waiting ? 'a revision waits' : draft !== null && draft !== text ? 'edited since read' : 'in use'}</span>
        <span className="document-pane-acts">
          <button type="button" data-action="propose" disabled={!!pending || !!why} title={why ?? undefined} onClick={propose}>Propose</button>
          <button type="button" data-action="release" disabled={!!pending || !!waiting} title={waiting ? 'A revision waits: Accept or Discard it first.' : undefined}
            onClick={() => (releaseAsk ? release() : setReleaseAsk(true))}>{releaseAsk ? 'Confirm release' : 'Release'}</button>
        </span>
      </div>
      {waiting && <section className="central-skill-revision" data-skill-revision={reading.stale ? 'stale' : 'waiting'}>
        <p>Proposed by {waiting.proposed_by}: {waiting.reason}</p>
        <pre className="mono">{waiting.proposed_body}</pre>
        {!reading.accept.available && reading.accept.reason && <p role="alert">{reading.accept.reason}</p>}
        <button type="button" data-action="accept" disabled={!!pending || !reading.accept.available} onClick={() => answer('accept')}>Accept</button>
        <button type="button" data-action="discard" disabled={!!pending} onClick={() => answer('discard')}>Discard</button>
      </section>}
      <TextEditor value={body} onChange={setDraft} readOnly={!!pending || !!waiting} aria-label={`The text of ${skill.name}`} filename="SKILL.md"
        binding={{id: `skill:${key}`, kind: 'file', title: 'SKILL.md', ref: location.ref, location}} />
      <label className="central-skill-reason">Why <input value={reason} onChange={event => setReason(event.target.value)} disabled={!!pending || !!waiting}
        placeholder="What the revision changes, in a line" /></label>
      {note && <p role="status">{note}</p>}
      {fault != null && <Refusal className="inhabitant-device-fault" said="Central did not take that." error={fault} />}
    </div>
  )
}
