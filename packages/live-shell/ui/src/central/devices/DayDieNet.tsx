// The Day die's net — the device's picture: icon-cut's Day-die drawing, four faces across, one above, one below, fold
// dashes between, the open face inked. A reading of the die's own face position from the payload (`meta.face`), never a
// state of its own. Ported from inhabitants/DocumentDayDieFace.tsx:260-281, geometry unchanged; the two raw greys of the
// original are the shell's --inh-dim / --inh-faint tokens here (shell tokens only). With no Day standing, no face is inked.
import {DIE_POSITIONS, dieFaceLabel} from './dayDie'

export function DayDieNet({face, caption = false}: {face: number | null; caption?: boolean}) {
  const label = face === null ? 'no Day stands, so no face is open' : dieFaceLabel(face)
  return <div className="central-die-net" data-die-face={face ?? ''} title={face === null ? label : `The die's own face position, read from the payload: ${label}. The die turns inside its own form.`}>
    <svg viewBox="0 0 140 72" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Day die — six positions${face === null ? '' : ', the open face inked'}`}>
      <path d="M55 22V26M38 36H42M68 36H72M98 36H102M55 46V50" stroke="var(--inh-faint)" strokeWidth="1" strokeDasharray="1.5 1.5"/>
      {DIE_POSITIONS.map(pos => {
        const x = pos.n === 0 ? 42 : pos.n === 5 ? 42 : [12, 42, 72, 102][pos.n - 1]
        const y = pos.n === 0 ? 2 : pos.n === 5 ? 50 : 26
        const isOpen = pos.n === face
        return <g key={pos.n}>
          <rect x={x} y={y} width={26} height={20} rx={1.5} fill={isOpen ? 'var(--inh-ink)' : 'var(--inh-paper)'} stroke={isOpen ? 'var(--inh-ink)' : 'var(--inh-dim)'}/>
          <text x={x + 13} y={y + 13} textAnchor="middle" fontSize="8.5" fill={isOpen ? 'var(--inh-paper)' : 'var(--inh-faint)'} fontFamily="var(--inh-mono)">#{pos.n}</text>
        </g>
      })}
    </svg>
    {caption && <span className="central-die-net-caption" data-die-face-label>{label}</span>}
  </div>
}
