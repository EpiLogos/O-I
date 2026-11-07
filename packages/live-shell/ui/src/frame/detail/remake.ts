// The render law, one for every mode (manual §10.3 Media: "A render is made from something else: it names what it was made from, it can
// be remade, and it is never edited in place. When the source of a render has moved since it was made, the render's row in the browser
// says so, and Remake, in its menu, makes it again from the source as it now stands"; §19.1 Songs: "The clip is a render: it names its
// set, Remake makes it again, and it is never edited in place").
//
// Each owner keeps its renders and says where their sources stand: Factory a song clip's set (factory song_clip.rs, agent/songClips.ts),
// the Expression's owner a scene's body, read from its source at a revision (expression_carrier.rs SceneBody.reading; the Clip panel's
// Constellation row, components/expressions/clip/clipBinding.ts). What they share is here: where a source stands, the mark that says so,
// what Remake does and what it answers, in one set of words. Pure.

/** Where a render's source stands since it was made. */
export type SourceStanding = 'current' | 'moved' | 'missing' | 'unread'

/** Where a source read at revision `made` stands: `now` is the revision its owner reads now, null where the owner reads it as gone, and
 * undefined where nothing reads it now. Nothing read is never guessed as current. */
export function sourceStanding(made: string | null | undefined, now: string | null | undefined): SourceStanding {
  if (!made || now === undefined) return 'unread'
  if (now === null) return 'missing'
  return made === now ? 'current' : 'moved'
}

/** The mark a render carries while its source has moved or gone, in its own word for that source ("set moved", "source moved"); none
 * while the source is current or unread. */
export function standingMark(source: string, standing: SourceStanding): string | null {
  return standing === 'moved' || standing === 'missing' ? `${source} ${standing}` : null
}

export const REMAKE = 'Remake'

/** What Remake does, said where it is pressed. */
export function remakeDoes(name: string, source: string): string {
  return `Makes ${name} again from the ${source} it names, as that ${source} now stands. A render is never edited in place.`
}

/** What Remake answers once the render is made again. */
export function remadeNote(name: string, source: string, moved: boolean): string {
  return `${name} was made again from its ${source}, which had ${moved ? '' : 'not '}moved.`
}
