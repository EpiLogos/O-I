/** One chooser inside the Expressions application. Selecting an instrument
 * changes tools over the current native work; it never asks the cradle to
 * replace this application with another renderer. */
import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {IconTab, IconTabStrip} from '../../../src/workspace/primitives/IconTabStrip';
import './lensChooser.css';
import {icon} from './icons.js';

/** 'place' and 'palace' stay ids while the app (app.ts) and the host protocol still name them; the chooser offers neither: Places is the
 * shell's Earth atlas, alone (T-PLACES-ONTO-ATLAS; owner, 14 Oct; FOUNDATION §4), and palaces live in the atlas, with no separate palace
 * surface (T-PALACES-ONTO-ATLAS; FOUNDATION §3 N4). */
export type LensId = 'project' | 'canvas' | 'timeline' | 'journey' | 'place' | 'palace';

/** What the Palace lens says when it is asked for (a host lens command still naming it): where the palace went. */
export const PALACE_MOVED = 'Palaces live in the Earth atlas now: open Earth from the browser\'s Instruments and press M5′ Palace on the rack. A palace stands where its rooms\' subjects are placed; enter it there.';

interface LensDef {id: LensId; office: string; label: string; name: string; icon: string}

/** The instruments in canonical M′ order, with the wayfinder's suggested
 * icon families (§13): M0′ library/web, M1′ grid/formation, M2′ branch, M3′
 * sequence. M4′ World · Places and M5′ Palace · Integral whole are not the
 * frame's: they are the shell's Earth atlas (T-PLACES-ONTO-ATLAS,
 * T-PALACES-ONTO-ATLAS), so the chooser offers neither. */
export const LENSES: LensDef[] = [
  {id: 'project', office: 'M0′', label: 'Web · Project · Wiki', name: 'Web', icon: 'library'},
  {id: 'canvas', office: 'M1′', label: 'Canvas · Constellation', name: 'Constellation', icon: 'formation'},
  {id: 'timeline', office: 'M2′', label: 'Relation field · Timeline', name: 'Relations', icon: 'branch'},
  {id: 'journey', office: 'M3′', label: 'Journey · Scenes', name: 'Journey', icon: 'sequence'},
];

export interface LensStudioApi {
  setMode(mode: 'expressions' | 'techne'): void;
  select(id: LensId): void;
  refresh(): void;
  active(): LensId;
}

export interface LensStudioHost {
  /** Activate tools in this application while retaining its native field. */
  activate(lens: LensId): void;
}

/** Presentation only: the engine's delegated data-action handler remains the
 * sole selection operation. Keyed tabs preserve focus across native selection. */
export function LensChooser({active}: {active: LensId}) {
  return createElement(IconTabStrip, {'aria-label': 'Instruments — M0′ to M5′', crossAxisArrows: true},
    LENSES.map(lens => createElement(IconTab, {
      key: lens.id, label: `${lens.office} ${lens.label}`, selected: lens.id === active,
      title: `${lens.office} — ${lens.label}`, className: 'lens-choice',
      id: `lens-tab-${lens.id}`,
      ...{'data-action': 'lens', 'data-lens': lens.id},
      iconContent: createElement('span', {className: 'lens-glyph', 'aria-hidden': true,
        dangerouslySetInnerHTML: {__html: icon(lens.icon)}}),
    })));
}

/** The M0′–M5′ chooser is one icon group inside the Expressions masthead —
 * no floating bar, no separate instrument panel. Each instrument's working
 * controls live in the app's own Studio, rail and context panel. */
export function installLensStudio(host: LensStudioHost, mount: HTMLElement): LensStudioApi {
  const chooser = document.createElement('div');
  chooser.id = 'lens-chooser';
  chooser.className = 'header-cluster lens-cluster';
  chooser.hidden = true;
  mount.append(chooser);

  let active: LensId = 'project';
  let mode: 'expressions' | 'techne' = 'expressions';
  const root = createRoot(chooser);
  const render = () => { flushSync(() => root.render(createElement(LensChooser, {active}))); };

  return {
    setMode(next) { mode = next; chooser.hidden = mode !== 'techne'; if (mode === 'techne') render(); },
    select(id) { active = id; if (mode === 'techne') render(); host.activate(id); },
    refresh() { if (mode === 'techne') render(); },
    active() { return active; },
  };
}
