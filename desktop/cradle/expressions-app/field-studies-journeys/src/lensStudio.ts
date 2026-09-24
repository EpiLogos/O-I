/** One chooser inside the Expressions application. Selecting an instrument
 * changes tools over the current native work; it never asks the cradle to
 * replace this application with another renderer. */
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

function studioBody(lens: LensDef): string {
  const actions: Partial<Record<LensId, string>> = {
    project: '<button class="oi-action" data-action="native-library">Library</button><button class="oi-action" data-action="native-work">Save and reopen</button>',
    journey: '<button class="oi-action" data-action="timeline">Scenes</button><button class="oi-action" data-action="lens-op" data-op="commit">Commit Scenes</button>',
    palace: '<button class="oi-action" data-action="native-work">Composition</button><button class="oi-action" data-action="timeline">Scenes</button><button class="oi-action" data-action="lens-op" data-op="commit">Commit composition</button>',
  };
  return `<header class="lens-studio-head"><h2>${esc(lens.label)}</h2><button type="button" class="lens-studio-close" data-action="lens-close" aria-label="Close instrument tools">${icon('close')}</button></header><div class="lens-studio-controls">${actions[lens.id] ?? ''}</div>`;
}

export function installLensStudio(host: LensStudioHost): LensStudioApi {
  // No `chrome`/`hud-panel` class: those carry the `body.studio-open` visibility
  // toggle, and the chooser must stand while a routed surface (the Scene Studio)
  // is open so lenses can still be switched. Styled with the root theme vars.
  const chooser = document.createElement('nav');
  chooser.id = 'lens-chooser';
  chooser.className = 'lens-chooser';
  chooser.setAttribute('role', 'tablist');
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

  // Build the chooser buttons ONCE; selection updates their state in place so
  // the just-activated button keeps keyboard focus (never a full innerHTML
  // rebuild on select).
  const buildChooser = () => {
    chooser.innerHTML = LENSES.map((lens, index) =>
      `<button type="button" class="lens-choice" data-action="lens" data-lens="${lens.id}" role="tab" id="lens-tab-${lens.id}" aria-controls="lens-studio" aria-selected="${lens.id === active}" tabindex="${lens.id === active ? 0 : -1}" aria-label="${esc(`${lens.office} ${lens.label}`)}" title="${esc(`${lens.office} — ${lens.label}`)}" data-index="${index}"><span class="lens-office" aria-hidden="true">${lens.office}</span>${icon(lens.icon)}</button>`,
    ).join('') + `<button type="button" class="lens-hide" data-action="lens-bar" aria-label="Hide instruments" title="Hide instruments">${icon('collapse')}</button>`;
    built = true;
  };

  const markActive = () => {
    for (const button of chooser.querySelectorAll<HTMLButtonElement>('.lens-choice')) {
      const on = button.dataset.lens === active;
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
    }
    studio.setAttribute('aria-labelledby', `lens-tab-${active}`);
  };

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
      active = id; studioOpen = false;
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

  // Arrow-key roving across the tablist (§13 keyboard-reachable controls).
  // Pointer and keyboard selection share the same in-application operation.
  chooser.addEventListener('keydown', event => {
    const keys: Record<string, number> = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1};
    const delta = keys[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const at = LENSES.findIndex(lens => lens.id === active);
    const next = LENSES[(at + delta + LENSES.length) % LENSES.length];
    api.select(next.id);
    chooser.querySelector<HTMLButtonElement>(`.lens-choice[data-lens="${next.id}"]`)?.focus();
  });

  return api;
}
