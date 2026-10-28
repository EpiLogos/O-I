// The pool (manual §10.3 The pool, §16.7 The pool; decision #709): under the browser in every mode, where Live keeps its Groove Pool,
// holding the DLW's grooves — QL frames and MEF lenses. "Drop a constellation onto the pool and its frame and its lenses stand there, the way
// a clip dropped on Live's pool gives up its groove." Each row as §16.7's table has it:
//   Name       a frame or a lens, on its colour; one that the selected clip uses is lit;
//   Hot-swap   tries this frame or lens on the selected clip;
//   Sublenses  a lens's six sublenses, its parameters ("Turn them to read the clip more finely"); a frame shows its roles;
//   Commit     writes the selected clip's reading into the wiki, through its owner, where the constellation keeps it for every mode.
// "Applying it never changes the clip's source, and nothing is written into the wiki until you press Commit." In Live the set's own grooves
// stand beside the frames and lenses (the mode's registration hands their face in: shell/modeBrowsers.tsx MODE_POOL_FACES). "The pool shows
// nothing else": a workspace's layout is kept by its set, and a reusable arrangement is a template in the browser (TemplateRows.tsx).
//
// The rows are the pool's (poolStore.ts); taking grooves out and Commit are the owners' (owners/grooveOwners.ts). The face holds only
// what it is saying now.
import {useState, type DragEvent, type ReactNode} from 'react'
import {CONSTELLATION_DRAG} from './constellationFocus'
import {constellationNamed, constellationsNow} from '../../owners/constellations'
import {commitReading, extractGroovesFrom} from '../../owners/grooveOwners'
import {addGrooves, chooseGroove, setSublens, usePool, type PoolState} from './poolStore'
import {roleAddress, type Groove} from './grooves'
import './pool.css'

/** A groove's colour, from the shell's own tokens: a frame on one, a lens on its square's (QL's registry: articulation, encounter,
 * becoming). */
const TINT: Readonly<Record<string, string>> = {frame: 'var(--sel)', articulation: 'var(--accent)', encounter: 'var(--green)', becoming: 'var(--parasakti)'}
export const grooveTint = (groove: Groove): string => (groove.kind === 'frame' ? TINT.frame! : TINT[groove.square] ?? 'var(--fizz)')

type Said = {readonly tone: 'note' | 'fault'; readonly words: string} | null

export interface GroovePoolProps {
  /** The set's grooves, where the mode registers them (Live): their caption and face, drawn beside the frames and lenses. */
  face?: {label: string; face: ReactNode} | null
}

export function GroovePool({face = null}: GroovePoolProps) {
  const pool = usePool()
  const [over, setOver] = useState(false)
  const [said, say] = useState<Said>(null)
  const clip = pool.clip
  const uses = clip ? pool.chosen[clip.id] ?? null : null
  const accepts = (event: DragEvent) => event.dataTransfer.types.includes(CONSTELLATION_DRAG)
  const drop = (event: DragEvent) => {
    setOver(false)
    const ref = event.dataTransfer.getData(CONSTELLATION_DRAG)
    if (!ref) return
    event.preventDefault()
    const constellation = constellationNamed(constellationsNow().rows, ref)
    if (!constellation) { say({tone: 'fault', words: `${ref} is no constellation the wiki's reading holds now.`}); return }
    say({tone: 'note', words: `Taking ${constellation.title}'s frame and lenses out…`})
    void extractGroovesFrom(constellation).then(answer => {
      if (!answer.ok) { say({tone: 'fault', words: answer.error}); return }
      const joined = addGrooves(answer.grooves)
      const names = answer.grooves.map(groove => groove.name).join(', ')
      say({tone: 'note', words: `${names ? `${constellation.title} gave up ${names}${joined < answer.grooves.length ? ' (the pool held some already)' : ''}.` : `${constellation.title} gave up nothing.`}${answer.said.length ? ` ${answer.said.join(' ')}` : ''}`})
    })
  }
  const commit = (groove: Groove) => {
    if (!clip) return
    const constellation = constellationNamed(constellationsNow().rows, clip.sourceRef)
    if (!constellation) { say({tone: 'fault', words: clip.sourceRef ? `${clip.sourceRef} is no constellation the wiki's reading holds now.` : 'The clip was made of no constellation, so it has no reading to commit.'}); return }
    say({tone: 'note', words: `Writing ${constellation.title}'s reading through ${groove.name} into the wiki…`})
    void commitReading({constellation, groove, sublens: pool.sublens[groove.id] ?? null}).then(answer => say(answer.ok ? {tone: 'note', words: answer.note} : {tone: 'fault', words: answer.error}))
  }
  return <section className={`ql-pool${over ? ' is-over' : ''}`} aria-label="Pool" data-pool="frames-and-lenses"
    onDragOver={event => { if (accepts(event)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setOver(true) } }}
    onDragLeave={() => setOver(false)} onDrop={drop}>
    <header className="ql-pool-head">
      <span className="ql-pool-title" data-i="Pool|QL frames and MEF lenses, the DLW's grooves. Drop a constellation here and its frame and its lenses stand here; choose one in a clip's Groove to read the clip through it.">Frames and lenses</span>
    </header>
    <div className="ql-pool-columns" role="row">
      <span role="columnheader" data-i="Name|A frame or a lens, on its colour. One that the selected clip uses is lit.">Name</span>
      <span role="columnheader" data-i="Hot-swap|Tries this frame or lens on the selected clip.">Hot-swap</span>
      <span role="columnheader" data-i="Sublenses|A lens's six sublenses, its parameters: turn them to read the clip more finely. A frame shows its roles.">Sublenses</span>
      <span role="columnheader" data-i="Commit|Writes the selected clip's reading into the wiki, through its owner, where the constellation keeps it for every mode.">Commit</span>
    </div>
    {pool.grooves.length ? <ul className="ql-pool-rows" role="rowgroup">
      {pool.grooves.map(groove => <PoolRow key={groove.id} groove={groove} pool={pool} lit={groove.id === uses} commit={() => commit(groove)} />)}
    </ul> : <p className="ql-pool-empty">Drop a constellation here: its frame and its lenses stand in the pool, ready to read a clip through.</p>}
    {said && <p className={`ql-pool-said is-${said.tone}`} role="status">{said.words}</p>}
    {face && <section className="ql-pool-set" aria-label={face.label}>
      <header className="ql-pool-head"><span className="ql-pool-title" data-i={`${face.label}|The set's own grooves, beside the frames and lenses, as Live's pool keeps them: read from the set and written into it.`}>{face.label}</span></header>
      {face.face}
    </section>}
  </section>
}

function PoolRow({groove, pool, lit, commit}: {groove: Groove; pool: PoolState; lit: boolean; commit: () => void}) {
  const clip = pool.clip
  const from = `Taken out of ${groove.from.title}.`
  const swapWhy = clip ? undefined : 'Select a clip to try this on it.'
  const commitWhy = !clip ? 'Select a clip whose reading to commit.' : !lit ? `The selected clip is not read through ${groove.name}: choose it in the clip's Groove, or press Hot-swap, first.` : undefined
  const sublens = groove.kind === 'lens' ? pool.sublens[groove.id] ?? null : null
  return <li className={`ql-pool-row${lit ? ' is-lit' : ''}`} role="row" data-groove={groove.id} data-groove-kind={groove.kind}>
    <span className="ql-pool-name" role="cell" style={{['--groove-tint' as string]: grooveTint(groove)}}
      data-i={`${groove.name}|${groove.kind === 'frame' ? 'A QL frame: the form of a whole and the roles round it.' : `An MEF lens, its ${groove.face} face, of the ${groove.square} square.`} ${from}${lit ? ' The selected clip is read through it.' : ''}`}>{groove.name}</span>
    <span role="cell"><button type="button" className="ql-pool-act" data-action="hot-swap" aria-label={`Hot-swap ${groove.name}`} disabled={!clip} title={swapWhy}
      data-i={`Hot-swap|${swapWhy ?? `Reads the selected clip through ${groove.name}. Its source stays as it is.`}`}
      onClick={() => clip && chooseGroove(clip.id, groove.id)}>⇆</button></span>
    <span role="cell" className="ql-pool-sublenses">{groove.kind === 'lens'
      ? groove.sublenses.length
        ? <select aria-label={`Sublens of ${groove.name}`} value={sublens === null ? '' : String(sublens)} onChange={event => setSublens(groove.id, event.target.value === '' ? null : Number(event.target.value))}
            data-i={`Sublens|Reads through the whole of ${groove.name}, or through one of its six sublenses.`}>
            <option value="">Whole lens</option>
            {groove.sublenses.map((item, index) => <option key={item.ref} value={String(index)}>{item.label}</option>)}
          </select>
        : <span data-i={`Sublenses|Quaternal Logic's registry names no sublenses for ${groove.name}, so it reads whole.`}>Whole</span>
      : <span data-i={`Roles|The roles of ${groove.name}, each at its position.`}>{groove.frame.roles.map(role => { const at = roleAddress(role); return at.position === null ? role.label : `${at.position}${at.conjugate ? '′' : ''}` }).join(' ')}</span>}</span>
    <span role="cell"><button type="button" className="ql-pool-act" data-action="commit" aria-label={`Commit the reading through ${groove.name}`} disabled={!!commitWhy} title={commitWhy}
      data-i={`Commit|${commitWhy ?? `Writes the selected clip's reading through ${groove.name} into the wiki, where its constellation keeps it for every mode.`}`}
      onClick={commit}>Commit</button></span>
  </li>
}
