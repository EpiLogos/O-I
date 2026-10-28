// What each mode makes of a constellation, at the foot of the browser (manual §10.3: "A constellation's preview is what this mode makes of
// it: in Central, the writing about it; in Factory, the work it would become; in Expressions, its symbolic form; in Technē, its reading
// through a lens; in Live, its sound"; §3: "Each mode offers the constellation in focus what that mode does"). A table, never a branch:
// the browser's Constellations rows draw the mode's entry (frame/browser/ConstellationRows.tsx). Every preview is drawn from the wiki's
// reading of the constellation alone (owners/constellations.ts) and changes nothing.
import {Fragment, type ComponentType} from 'react'
import type {SurfMode} from './modeGrammar'
import type {ConstellationPreviewProps} from '../frame/browser/ConstellationRows'
import type {Constellation} from '../owners/constellations'
import {transcribeConstellation} from '../live/constellationClip'
import {useLiveJankoWindow} from '../live/janko/jankoLayout'
import '../frame/browser/constellationPreview.css'

const gathered = (c: Constellation) => c.members.length ? c.members : null

function Head({c, line}: {c: Constellation; line: string}) {
  return <header className="cp-head"><b>{c.title}</b><span>{line} · {c.registerTitle}</span></header>
}

/** Central writes about it: the page it would open as — its title, its question as the line of introduction, a section for each thing it
 * gathers. */
function CentralPreview({constellation: c}: ConstellationPreviewProps) {
  const members = gathered(c)
  return <section className="cp" data-preview-mode="base" aria-label={`What Central makes of ${c.title}`}>
    <Head c={c} line="the writing about it" />
    <h4 className="cp-title">{c.title}</h4>
    {c.question && <p className="cp-intro">{c.question}</p>}
    {members ? <ol className="cp-sections">{members.map(member => <li key={member.ref}>{member.title}</li>)}</ol>
      : <p className="cp-said">It gathers nothing yet, so the page would open with its title alone.</p>}
  </section>
}

/** Factory brings it into agentic work: the task it would become — named after it, its question as the intent, what it gathers as the
 * material the agent reads. */
function FactoryPreview({constellation: c}: ConstellationPreviewProps) {
  const members = gathered(c)
  return <section className="cp" data-preview-mode="factory" aria-label={`What Factory makes of ${c.title}`}>
    <Head c={c} line="the work it would become" />
    <dl className="cp-facts">
      <dt>A task</dt><dd>{c.title}</dd>
      <dt>Intent</dt><dd>{c.question ?? `Bring ${c.title} into agentic work.`}</dd>
      <dt>Material</dt><dd>{members ? members.map(member => member.title).join(', ') : 'Nothing gathered yet.'}</dd>
    </dl>
  </section>
}

const RING = 44
/** Where a member stands on the form: its declared sixfold position round the ring (0 at the top), else its turn among the others. */
function placeOf(position: number | null, index: number, count: number): {x: number; y: number} {
  const turn = position !== null && position >= 0 && position <= 5 ? position / 6 : index / Math.max(1, count)
  const angle = turn * 2 * Math.PI - Math.PI / 2
  return {x: 60 + RING * Math.cos(angle), y: 56 + RING * Math.sin(angle)}
}

/** Expressions gives it an expressive symbolic form: its whole at the centre and each thing it gathers round it, at the sixfold position
 * the wiki declares for it (the form the Technē wiki projection lays out, techne/wikiExpression.ts). */
function ExpressionsPreview({constellation: c}: ConstellationPreviewProps) {
  const members = c.members
  return <section className="cp" data-preview-mode="expressions" aria-label={`What Expressions makes of ${c.title}`}>
    <Head c={c} line="its symbolic form" />
    <svg className="cp-form" viewBox="0 0 120 112" role="img" aria-label={`${c.title}: its whole and the ${members.length} things round it`}>
      <circle cx="60" cy="56" r={RING} className="cp-ring" />
      {members.map((member, i) => { const at = placeOf(member.position, i, members.length); return <g key={member.ref}>
        <line x1="60" y1="56" x2={at.x} y2={at.y} className="cp-ray" />
        <circle cx={at.x} cy={at.y} r="4" className="cp-glyph"><title>{member.title}</title></circle>
      </g> })}
      <circle cx="60" cy="56" r="6" className="cp-whole"><title>{c.title}</title></circle>
    </svg>
  </section>
}

/** Technē lenses and refines it: its reading through the six positions — what stands at each, and what the wiki places at none. */
function TechnePreview({constellation: c}: ConstellationPreviewProps) {
  const unplaced = c.members.filter(member => member.position === null)
  return <section className="cp" data-preview-mode="techne" aria-label={`What Technē makes of ${c.title}`}>
    <Head c={c} line="its reading through a lens" />
    <table className="cp-lens"><tbody>
      {[0, 1, 2, 3, 4, 5].map(position => <tr key={position}><th scope="row">Position {position}</th>
        <td>{c.members.filter(member => member.position === position).map(member => member.title).join(', ') || '—'}</td></tr>)}
      {unplaced.length > 0 && <tr><th scope="row">Unplaced</th><td>{unplaced.map(member => member.title).join(', ')}</td></tr>}
    </tbody></table>
  </section>
}

/** Live sounds it: through Live's clip of it, whose notes strike the torus as it plays (manual §21.2 What strikes the Torus). The preview is
 * the transcription Live would make of it on the Jankó surface the owner serves (live/constellationClip.ts transcribeConstellation): each
 * placed member's key, struck together, and the members that strike none. Reading the surface the keyboard holds changes nothing. */
function LivePreview({constellation: c}: ConstellationPreviewProps) {
  const surface = useLiveJankoWindow()
  const made = surface?.ok ? transcribeConstellation(c, surface.window) : null
  const said = made?.refused ?? (surface && !surface.ok ? `The Jankó surface is not served (${surface.fault}), so the keys its members strike are not named yet.`
    : 'Dropped on a part, Live transcribes it into a clip whose notes strike the keys its members stand at on the Jankó surface.')
  return <section className="cp" data-preview-mode="live" aria-label={`What Live makes of ${c.title}`}>
    <Head c={c} line="its sound" />
    {made && made.refused === undefined ? <>
      <p className="cp-said">Dropped on a part, Live transcribes it into a clip: these keys struck together, as one chord.</p>
      <dl className="cp-facts">{made.struck.map((row, i) => <Fragment key={`${row.member}-${i}`}><dt>{row.member}</dt><dd>{row.key}</dd></Fragment>)}</dl>
      {made.left.length > 0 && <p className="cp-said cp-waits">{made.left.join('; ')}.</p>}
    </> : <p className="cp-said">{said}</p>}
  </section>
}

export const MODE_CONSTELLATION_PREVIEWS: Readonly<Record<SurfMode, ComponentType<ConstellationPreviewProps>>> = {
  base: CentralPreview,
  factory: FactoryPreview,
  expressions: ExpressionsPreview,
  techne: TechnePreview,
  live: LivePreview,
}
