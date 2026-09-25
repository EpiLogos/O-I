/** One chooser inside the Expressions application. Selecting an instrument
 * changes tools over the current native work; it never asks the cradle to
 * replace this application with another renderer. */
import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {IconTab, IconTabStrip} from '../../../src/workspace/primitives/IconTabStrip';
import './lensChooser.css';
import {icon, esc} from './icons.js';
import type {NativeSubject, ConstructionFacets} from './nativeWorkspace.js';

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
  closeStudio(): void;
  toggleChooser(): void;
  refresh(): void;
  active(): LensId;
}

export interface LensStudioHost {
  /** The exact open native work (or null) — the construction's identity. */
  subject(): NativeSubject | null;
  /** The open construction's real facets (members, relations, Scenes) — the
   * disclosure each lens stands on. Null when no native work is open. */
  construction(): ConstructionFacets | null;
  /** Activate tools in this application while retaining its native field. */
  activate(lens: LensId): void;
}

// Only these instruments carry real Studio controls (§ studioBody's own
// `actions` map). The rest (canvas/timeline/place) are honestly unavailable
// facets, surfaced through the separate research-instrument status, never a
// blank Studio panel — `select()` below gates opening the panel on this
// same set so the two never disagree.
const STUDIO_LENSES = new Set<LensId>(['project', 'journey', 'palace']);

function studioBody(lens: LensDef): string {
  // Same operations, icon-led: 24×24 thin-stroke glyph, accessible label
  // (aria-label + title), never a bare text action for a committing act.
  const commitIcon = (op: 'commit', label: string) =>
    `<button class="oi-action oi-action-icon" data-action="lens-op" data-op="${op}" aria-label="${esc(label)}" title="${esc(label)}">${icon('check')}</button>`;
  const actions: Partial<Record<LensId, string>> = {
    project: '<button class="oi-action" data-action="native-library">Library</button><button class="oi-action" data-action="native-work">Save and reopen</button>',
    journey: `<button class="oi-action" data-action="timeline">Scenes</button>${commitIcon('commit', 'Commit Scenes')}`,
    palace: `<button class="oi-action" data-action="native-work">Composition</button><button class="oi-action" data-action="timeline">Scenes</button>${commitIcon('commit', 'Commit composition')}`,
  };
  return `<header class="lens-studio-head"><h2>${esc(lens.label)}</h2><button type="button" class="lens-studio-close" data-action="lens-close" aria-label="Close instrument tools">${icon('close')}</button></header><div class="lens-studio-controls">${actions[lens.id] ?? ''}</div>`;
}

/** Presentation only: native engine state and document-level actions stay in
 * installLensStudio/app. Keyed tabs preserve focus across native selection. */
export function LensChooser({active}: {active: LensId}) {
  return createElement('div', {className: 'lens-chooser-row'},
    createElement(IconTabStrip, {'aria-label': 'Instruments — M0′ to M5′', crossAxisArrows: true},
      LENSES.map(lens => createElement(IconTab, {
        key: lens.id, label: `${lens.office} ${lens.label}`, selected: lens.id === active,
        title: `${lens.office} — ${lens.label}`, className: 'lens-choice',
        id: `lens-tab-${lens.id}`, 'aria-controls': 'lens-studio',
        ...{'data-action': 'lens', 'data-lens': lens.id},
        iconContent: createElement('span', {className: 'lens-glyph', 'aria-hidden': true,
          dangerouslySetInnerHTML: {__html: icon(lens.icon)}}),
      }, createElement('span', {className: 'lens-office', 'aria-hidden': true}, lens.office)))),
    createElement('button', {type: 'button', className: 'lens-hide', 'aria-label': 'Hide instruments',
      title: 'Hide instruments', ...{'data-action': 'lens-bar'},
      dangerouslySetInnerHTML: {__html: icon('collapse')}}));
}

export function installLensStudio(host: LensStudioHost): LensStudioApi {
  // No `chrome`/`hud-panel` class: those carry the `body.studio-open` visibility
  // toggle, and the chooser must stand while a routed surface (the Scene Studio)
  // is open so lenses can still be switched. Styled with the root theme vars.
  const chooser = document.createElement('nav');
  chooser.id = 'lens-chooser';
  chooser.className = 'lens-chooser';
  chooser.setAttribute('aria-label', 'Instruments — M0′ to M5′');
  chooser.hidden = true;

  const studio = document.createElement('aside');
  studio.id = 'lens-studio';
  studio.className = 'lens-studio';
  studio.setAttribute('role', 'tabpanel');
  studio.setAttribute('aria-label', 'Lens Studio');
  studio.hidden = true;

  document.body.append(chooser, studio);

  let active: LensId = 'project';
  let studioOpen = false;
  let chooserCollapsed = false;
  let mode: 'expressions' | 'techne' = 'expressions';
  let built = false;

  // One React root, stable keys, and the shared tab primitive. The engine's
  // delegated data-action handler remains the sole selection operation.
  const chooserRoot = createRoot(chooser);
  const buildChooser = () => {
    flushSync(() => chooserRoot.render(createElement(LensChooser, {active})));
    built = true;
    studio.setAttribute('aria-labelledby', `lens-tab-${active}`);
  };
  const markActive = buildChooser;

  const renderStudio = () => {
    const lens = LENSES.find(candidate => candidate.id === active)!;
    studio.innerHTML = studioBody(lens);
    studio.dataset.lens = active;
  };

  const apply = () => {
    const techne = mode === 'techne';
    chooser.hidden = !techne || chooserCollapsed;
    for (const toggle of document.querySelectorAll<HTMLButtonElement>('[data-action="lens-bar"]')) {
      toggle.setAttribute('aria-controls', chooser.id);
      toggle.setAttribute('aria-expanded', String(!chooser.hidden));
    }
    studio.hidden = !techne || !studioOpen;
    if (techne) {
      if (!built) buildChooser(); else markActive();
      if (studioOpen) renderStudio();
    }
  };

  const api: LensStudioApi = {
    setMode(next) { mode = next; if (next === 'techne' && !built) buildChooser(); apply(); },
    select(id) {
      active = id; studioOpen = STUDIO_LENSES.has(id);
      if (built) markActive(); else buildChooser();
      if (studio.hidden) studio.hidden = false;
      renderStudio();
      apply();
      host.activate(id);
    },
    closeStudio() { studioOpen = false; studio.hidden = true; },
    toggleChooser() {
      const containedFocus=chooser.contains(document.activeElement);
      chooserCollapsed=!chooserCollapsed;apply();
      if(chooserCollapsed&&containedFocus)Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="lens-bar"]')).find(button=>!chooser.contains(button)&&button.getClientRects().length>0)?.focus();
    },
    refresh() { if (mode === 'techne') { if (!built) buildChooser(); else markActive(); if (studioOpen) renderStudio(); } },
    active() { return active; },
  };

  return api;
}
