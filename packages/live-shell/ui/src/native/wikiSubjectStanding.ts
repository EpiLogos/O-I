/**
 * lane-3 E21: the frame's "where does this subject stand in the wiki" request, answered by the owner that carries the
 * wiki. The owner is the one projection state (desktop/cradle/src/techne/wikiProjectionStore.ts, `wikiSubjectStandings`);
 * this module reads it, it does not keep a second index. The frame never reads that state itself.
 *
 * The answer is for one exact basis: the Expression and revision the host holds for the frame's Scene. Any other basis is
 * refused by name, as is a shell with no wiki register loaded to read. Nothing partial or guessed is returned.
 */
import {getWikiProjectionState, wikiSubjectStandings, type ProjectedSubjectStanding} from '../../../../../desktop/cradle/src/techne/wikiProjectionStore'
import {WIKI_SUBJECT_STANDING_CHANNEL, type ChannelContext, type ExpressionsOwners, type WikiSubjectStandingReply, type WikiSubjectStandingRequest} from '@epilogos/expressions-boundary'

/** The owner's reading, as this answerer needs it. Injectable for tests; the live source is the one projection state. */
export interface WikiStandingSource {
  registersLoaded(): boolean
  revision(): number
  standingsOf(subjectRef: string): readonly ProjectedSubjectStanding[]
}

export const liveWikiStandingSource: WikiStandingSource = {
  registersLoaded: () => getWikiProjectionState().registers.length > 0,
  revision: () => getWikiProjectionState().revision,
  standingsOf: subjectRef => wikiSubjectStandings(subjectRef),
}

/** The bound on rows one reply carries; a larger standing is refused by name, never truncated. */
export const WIKI_STANDING_ROW_LIMIT = 512

/** The basis the host holds for the frame's Scene (the frame's own announced nativeScene), or nothing when none is held. */
export interface HeldBasis {expression_ref: string; revision: number}

/** Answer one exact request. Every refusal is a named Error; the boundary replies it to the frame as the refusal. */
export function answerWikiSubjectStanding(
  request: WikiSubjectStandingRequest,
  held: HeldBasis | null | undefined,
  source: WikiStandingSource = liveWikiStandingSource,
): WikiSubjectStandingReply {
  if (!held || held.expression_ref !== request.expression_ref || held.revision !== request.revision) {
    throw new Error('The open Expression moved before its wiki standing was read; reopen the Library to read where this subject stands now.')
  }
  if (!source.registersLoaded()) {
    throw new Error('No wiki register is loaded in this shell, so where this subject stands in the wiki is not read yet. Open the Technē register, then reopen the Library.')
  }
  const standings = source.standingsOf(request.subject_ref)
  if (standings.length > WIKI_STANDING_ROW_LIMIT) {
    throw new Error(`This subject stands in ${standings.length} wiki scenes, more than the Library shows; no standing is shown.`)
  }
  return {
    subject_ref: request.subject_ref,
    expression_ref: request.expression_ref,
    revision: request.revision,
    standing_revision: source.revision(),
    rows: standings.map(row => ({
      register_key: row.registerKey,
      expression_ref: row.expression_ref,
      scene_ref: row.scene_ref,
      scene_title: row.scene_title,
      entity_ref: row.entity_ref,
      entity_title: row.entity_title,
      subject_ref: row.subject_ref,
    })),
  }
}

/** The channel owner. The boundary has already read the request exactly; the basis is the one the host announced for the frame. */
export function wikiStandingChannel(source: WikiStandingSource = liveWikiStandingSource) {
  return async (request: unknown, context: ChannelContext): Promise<WikiSubjectStandingReply> =>
    answerWikiSubjectStanding(request as WikiSubjectStandingRequest, context.state?.nativeScene, source)
}

/** The Expressions pane's owners with this one channel added. Every other channel is the qualified owner's, unchanged. */
export function withWikiSubjectStanding(owners: ExpressionsOwners, source: WikiStandingSource = liveWikiStandingSource): ExpressionsOwners {
  return {...owners, channels: {...owners.channels, [WIKI_SUBJECT_STANDING_CHANNEL]: wikiStandingChannel(source)}}
}
