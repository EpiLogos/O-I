// The Clip side for a World subject in hand [the ticket N; DLW manual §3 "Clip view shows the thing itself, with everything you can
// do to it"; world-shell-mockup.html clipDetail() :1653 — Technē's head `<b>subject</b> — what is in focus`].
//
// When THE selection is a World subject (a Location, an Earth place — worldRows.ts `worldSubjectOf`), Technē's Clip side shows it:
// what it is and where its ref comes from, and the Scenes that carry it as the subject door answered (subjectOpenings.ts) — the one
// asked for, and the others, each a row that opens that Scene instead (the door's `openChosenScene`). Before the door is asked it
// says how to ask; an absence is the owner's words. It reads nothing else and writes only through the door.
//
// Drawn through the shared Clip view (frame/detail/ClipView.tsx). Mounted by Technē's detail registration (shell/modeDetails.tsx).

import {ClipLine, ClipNone, ClipView, type ClipRow} from '../../frame/detail/ClipView'
import {chooseHeldScene, useSubjectOpenings, type SubjectOpening} from './subjectOpenings'
import {sceneRowsOf, type SceneRow} from './worldRows'

/** A World subject as THE selection holds it. */
export interface HeldWorldSubject {
  kind: string
  ref: string
  title: string
}

const KIND_WORDS: Readonly<Record<string, string>> = {location: 'location · a project space on your planet', place: 'Earth place · declared by its owner'}

/** The door's answer in a word, for the props column. */
function doorWord(opening: SubjectOpening | undefined): string {
  if (!opening) return 'not opened yet'
  if (opening.state === 'opening') return 'opening…'
  return opening.state === 'asked' ? `asked · ${opening.opened.scene_title}` : 'stands in no Scene'
}

export function WorldSubjectClip({subject}: {subject: HeldWorldSubject}) {
  const openings = useSubjectOpenings()
  return <WorldSubjectClipView subject={subject} opening={openings.get(subject.ref)}
    onChoose={scene => { chooseHeldScene(subject.ref, scene.scene, subject.title) }} />
}

/** The Clip view of a World subject, drawn from the door's answer (a fixture may feed it). */
export function WorldSubjectClipView({subject, opening, onChoose}: {subject: HeldWorldSubject; opening: SubjectOpening | undefined; onChoose: (scene: SceneRow) => void}) {
  const scenes = sceneRowsOf(opening, subject.title)
  const asked = opening?.state === 'asked' ? opening.opened : null
  const rows: ClipRow[] = [
    {key: 'kind', value: KIND_WORDS[subject.kind] ?? subject.kind, title: 'What it is, as the suite reading names it'},
    {key: 'door', value: doorWord(opening), title: opening?.state === 'absent' ? opening.reason : 'The subject door: the owner\'s reverse query, and the Scene asked for'},
    {key: 'register', value: asked?.registerKey ?? null, title: 'The wiki register whose Scene carries it'},
    {key: 'source', value: <span className="mono">{subject.ref}</span>, title: 'The owner\'s ref of the subject'},
  ]
  const body = scenes.length
    ? scenes.map(scene => <ClipLine key={scene.key} chip={scene.asked ? 'asked' : undefined} right={scene.standing} title={scene.hover}
      onPress={scene.asked ? undefined : () => onChoose(scene)}>{scene.name}</ClipLine>)
    : <ClipNone>{!opening ? 'Double-click its row in the browser, or press Enter there, to find the Scenes that carry it.'
      : opening.state === 'opening' ? 'Asking the owner where it stands in the wiki…' : 'No Scene carries it.'}</ClipNone>
  return <div className="mode-detail" data-mode-detail="techne-world-subject">
    <ClipView kind="techne-world-subject" name={subject.title} rows={rows}
      note={opening?.state === 'absent' ? opening.reason : undefined}
      columns={[{name: 'Scenes · that carry it', width: 360, body}]} />
  </div>
}
