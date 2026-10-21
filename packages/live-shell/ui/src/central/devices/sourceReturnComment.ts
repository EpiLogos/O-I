// Approvals' Changes (manual §19.14, software-factory:approvals `changes`: "Ask for a different result. Say what to change in the thread"):
// a reviewer's comment on a pending returned-work proposal through Central's `projectcentral.source.return_comment` (ctrl/src/source_return.rs,
// EpiLogos/Central#290). The Return stays pending — Approve and Reject remain the person's — no source changes, and the agent reads the
// comment back through return_read. `commented_by_ref` is declared attribution (the person Central's personal anchor names), never human
// source authority, so Central admits the comment without the person's native grant. The comment's words are the person's, written in the
// thread (the Agent's composer); this module only carries them.
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import type {DesignBinding, Standing, ValueChange} from '../../frame/devices/designed'
import {centralWrite} from './centralDeviceWrites'
import type {SourceReturnRow} from './sourceReturnAccept'

export const RETURN_COMMENT_ACTION = 'projectcentral.source.return_comment'
/** Central's bound on one comment (source_return.rs return_comment). */
export const RETURN_COMMENT_MAX_BYTES = 16384

/** The input projectcentral.source.return_comment takes for one pending return; or why it cannot be asked now, in words. Pure. */
export function returnCommentInput(project: string | null, row: SourceReturnRow | null, comment: string | null | undefined, commentedByRef: string | null):
  {readonly input: Record<string, string>} | {readonly refused: string} {
  if (!project) return {refused: 'Changes: a return belongs to a project, and none is named here.'}
  if (!row || typeof row.return_ref !== 'string' || !row.return_ref) return {refused: 'Changes: choose a returned proposal first.'}
  if (row.status !== 'pending') return {refused: `Changes: ${row.return_ref} is ${String(row.status ?? 'not pending')}, so it takes no comment.`}
  const words = (comment ?? '').trim()
  if (!words) return {refused: 'Changes: say what to change in the thread first; the comment is what you write there.'}
  if (new TextEncoder().encode(words).length > RETURN_COMMENT_MAX_BYTES || words.includes('\0')) {
    return {refused: `Changes: Central keeps a comment of at most ${RETURN_COMMENT_MAX_BYTES} bytes of text.`}
  }
  if (!commentedByRef) return {refused: 'Changes: Central\'s personal anchor has not named the person (central.personal.anchor.inspect), and a comment names who asks.'}
  return {input: {project, return_ref: row.return_ref, comment: words, commented_by_ref: commentedByRef}}
}

/** Comment on the return through Central. Resolves with Central's reading of the return (its comments, still pending); throws the refusal, or
 * Central's words. */
export async function commentSourceReturn(transport: KernelTransportStatus, project: string | null, row: SourceReturnRow | null, comment: string | null | undefined,
  commentedByRef: string | null): Promise<unknown> {
  const asked = returnCommentInput(project, row, comment, commentedByRef)
  if ('refused' in asked) throw new Error(asked.refused)
  return centralWrite(transport, RETURN_COMMENT_ACTION, asked.input, project ?? undefined)
}

/** Approvals' binding with Changes carried (receiptBindings.ts approvalsBinding stands `changes` disabled until a chain hands it a comment):
 * a press of `changes` set to a return's ref comments on that return with the words written in the thread, read at the press; every other
 * key is the binding's own. Where the returns have not answered, or nothing is written yet, Changes stands disabled saying so. After Central
 * keeps the comment, `hands.after` clears what was written. Pure. */
export function withReturnComments(binding: DesignBinding, input: {readonly returns: {readonly entries: readonly SourceReturnRow[]} | null; readonly comment: string | null},
  hands: {readonly send: (row: SourceReturnRow, comment: string) => Promise<unknown>; readonly after?: () => void}): DesignBinding {
  const words = (input.comment ?? '').trim()
  const why = !input.returns ? 'Changes: Central\'s source returns have not answered, so no proposal stands to comment on.'
    : !words ? 'Changes: say what to change in the thread first; the comment is what you write there.' : null
  const standing: Record<string, Standing> = {...(binding.standing ?? {})}
  if (why) standing.changes = {disabled: why}
  else delete standing.changes
  return {
    ...binding,
    standing,
    writes: key => key === 'changes' || (binding.writes ? binding.writes(key) : true),
    write: async (changes: readonly ValueChange[]) => {
      const rest: ValueChange[] = []
      for (const change of changes) {
        if (change.key !== 'changes') { rest.push(change); continue }
        if (why) throw new Error(why)
        const row = input.returns!.entries.find(entry => entry.return_ref === change.value)
        if (!row) throw new Error('Changes: that proposal is not among the returns Central lists now.')
        await hands.send(row, words)
        hands.after?.()
      }
      if (rest.length) {
        if (!binding.write) throw new Error(`${rest[0].key}: nothing here writes it.`)
        await binding.write(rest)
      }
    },
  }
}
