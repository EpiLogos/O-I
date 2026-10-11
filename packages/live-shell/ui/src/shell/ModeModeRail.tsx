/**
 * The mode rail — the surf's mode icons (WORLD-SHELL-DESIGN Revision 5):
 * Live · Base · Central · Factory · Expressions · Technē, each wearing its
 * icon-cut mark, the pressed one lit. ONE rail for every transport that
 * carries the mode system: the frame's TransportBar renders it after the
 * Session|Arrangement presentations, and the agency surface's transport
 * (the Factory column) hosts the same rail so the modes stay reachable in
 * every mode — one transport wearing five meanings, provably from the
 * grammar (`modeGrammar.ts`).
 */

import {Icon} from '../inhabitants/sdk/Icon'
import {MODE_GRAMMAR, SURF_MODES, surfModeOf, type SurfMode} from './modeGrammar'

export type {SurfMode}

export function ModeModeRail({mode, chooseMode}: {mode: string; chooseMode: (mode: SurfMode) => void}) {
  const surf = surfModeOf(mode)
  return <>{SURF_MODES.map(name => {
    const grammar = MODE_GRAMMAR[name]
    return <button key={name} type="button" className="mode-rail-button" data-mode={name}
      aria-label={grammar.title} aria-pressed={surf === name}
      title={`${grammar.title} — ${grammar.hint}`} onClick={() => chooseMode(name)}>
      <Icon name={grammar.mark} size={16} />
    </button>
  })}</>
}
