/** One chooser inside the Expressions application. Selecting an instrument
 * changes tools over the current native work; it never asks the cradle to
 * replace this application with another renderer. */
import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {IconTab, IconTabStrip} from '../../../src/workspace/primitives/IconTabStrip';
import './lensChooser.css';
import {icon} from './icons.js';

export type LensId = 'project' | 'canvas' | 'timeline' | 'journey' | 'place' | 'palace';

interface LensDef {id: LensId; office: string; label: string; name: string; icon: string}

/** The six instruments in canonical M′ order, with the wayfinder's suggested
 * icon families (§13): M0′ library/web, M1′ grid/formation, M2′ branch, M3′
 * sequence, M4′ globe, M5′ frame/layers. */
export const LENSES: LensDef[] = [
  {id: 'project', office: 'M0′', label: 'Web · Project · Wiki', name: 'Web', icon: 'library'},
  {id: 'canvas', office: 'M1′', label: 'Canvas · Constellation', name: 'Constellation', icon: 'formation'},
  {id: 'timeline', office: 'M2′', label: 'Relation field · Timeline', name: 'Relations', icon: 'branch'},
  {id: 'journey', office: 'M3′', label: 'Journey · Scenes', name: 'Journey', icon: 'sequence'},
  {id: 'place', office: 'M4′', label: 'World · Places', name: 'Places', icon: 'globe'},
  {id: 'palace', office: 'M5′', label: 'Palace · Integral whole', name: 'Palace', icon: 'frame'},
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
