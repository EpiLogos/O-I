/** The M0′–M5′ Lens Studio — the compact instrument chooser and the floating
 * Studio that presents the ACTIVE lens's real operating controls over the ONE
 * field (owner wayfinder §§2, 13–19, 20, 28).
 *
 * There is one Expressions environment and one renderer. Each lens is a
 * differentiated way of working the SAME native construction, not a separate
 * application or a second store: selecting a lens re-presents the Studio, it
 * never resets the field, regenerates scenes or reloads the source — the
 * camera, selection and simulation stand across lens changes (§28 lens
 * continuity). The Studio's controls are the current application's own
 * operating surfaces for that instrument — the Library and source gathering
 * (M0′), the native composition (M1′), the relation/timeline field (M2′) and
 * the scene sequence (M3′) — so the instruments WORK here without a second
 * renderer, six separate tabs or a metadata-only panel.
 *
 * Where the current construction discloses no facet for an instrument (a
 * source-backed place, an inhabitable Palace), the Studio names that honest
 * state and the eligible material rather than faking a control or inventing a
 * coordinate (§§18–19, 21): the native place/palace owner operation is a named
 * remaining seam, not a dead button.
 */
import {icon, esc} from './icons.js';
import type {NativeSubject} from './nativeWorkspace.js';

export type LensId = 'project' | 'canvas' | 'timeline' | 'journey' | 'place' | 'palace';

interface LensDef {id: LensId; office: string; label: string; name: string; icon: string}

/** The six instruments in their canonical M′ order, with the wayfinder's
 * suggested icon families (§13): M0′ library/web, M1′ grid/formation, M2′
 * branch, M3′ sequence, M4′ globe, M5′ frame/layers. */
export const LENSES: LensDef[] = [
  {id: 'project', office: 'M0′', label: 'Web · Project · Wiki', name: 'Web', icon: 'library'},
  {id: 'canvas', office: 'M1′', label: 'Canvas · Constellation', name: 'Constellation', icon: 'formation'},
  {id: 'timeline', office: 'M2′', label: 'Relation field · Timeline', name: 'Relations', icon: 'branch'},
  {id: 'journey', office: 'M3′', label: 'Journey · Scenes', name: 'Journey', icon: 'sequence'},
  {id: 'place', office: 'M4′', label: 'World · Places', name: 'Places', icon: 'globe'},
  {id: 'palace', office: 'M5′', label: 'Palace · Integral whole', name: 'Palace', icon: 'frame'},
];

export interface LensStudioApi {
  /** Reflect the workspace mode: the chooser and Studio stand only in the
   * Technē (4:2 deep) cut; the Expressions cut hides them without disturbing
   * the field. */
  setMode(mode: 'expressions' | 'techne'): void;
  /** Make one instrument active and open its Studio. The field is untouched —
   * only the Studio re-presents. */
  select(id: LensId): void;
  /** Close the floating Studio; the chooser and the active lens remain. */
  closeStudio(): void;
  /** Re-render the chooser and Studio against the current construction (call
   * when the native subject or its facets change). */
  refresh(): void;
  /** The active instrument id — surfaced to the app's own test/inspection API. */
  active(): LensId;
}

const shortRef = (ref: string) => {
  const tail = ref.split(':').pop() ?? ref;
  return tail.length > 22 ? `${tail.slice(0, 20)}…` : tail;
};

/** One operative control: a button carrying the application's own data-action,
 * so the delegated handler opens the real surface. Never a fake success. */
const control = (action: string, iconName: string, label: string, note: string) =>
  `<button type="button" class="lens-control oi-action" data-action="${esc(action)}"><span class="lens-control-icon">${icon(iconName)}</span><span class="lens-control-text"><strong>${esc(label)}</strong><small>${esc(note)}</small></span></button>`;

/** An honest facet state (§21): the instrument's purpose, the eligible native
 * material, and the exact unsurfaced owner seam — no invented control. */
const honestFacet = (facet: 'place' | 'palace', purpose: string, standing: string) =>
  `<div class="lens-facet" data-lens-facet="${facet}" role="note"><p class="lens-facet-purpose">${esc(purpose)}</p><p class="lens-facet-standing">${esc(standing)}</p></div>`;

function lensControls(lens: LensDef, subject: NativeSubject | null): string {
  switch (lens.id) {
    case 'project':
      return control('native-library', 'library', 'Library — My World / O:I Web', 'Find, read and gather connected sources.') +
        control('native-work', 'save', 'Enter or create a construction', 'Begin a native constellation in place, or open existing work.');
    case 'canvas':
      return control('native-work', 'formation', 'Native composition', 'Members, contextual roles and typed relations in the real Expression medium.') +
        control('studio', 'options', 'Arrange the field', 'Formations, layout, appearance and 3D placement.');
    case 'timeline':
      return control('open-timeline', 'branch', 'Relations in time', 'Chronology, dependence, recurrence and automation — with evidence and direction.') +
        control('native-work', 'formation', 'Typed relation authoring', 'Author non-temporal typed relations through the native composition.');
    case 'journey':
      return control('sequence-panel', 'sequence', 'Scene sequence', 'Order, pace and branch real Expression Scenes.') +
        control('open-timeline', 'save', 'Save the current scene', 'Fix the current setup, framing and camera as a saved Scene.');
    case 'place':
      return honestFacet('place',
        'Situate this work in source-backed places, occasions and reference frames.',
        subject
          ? 'This construction discloses no source-backed place facet. A place enters only from a source that carries one — the native place owner’s operation is not surfaced in this application yet, so no coordinate is invented.'
          : 'Open or create a construction first. A place is read from a source that carries one; none is manufactured.');
    case 'palace':
      return honestFacet('palace',
        'Compose constellations, Expressions, Journeys and sources into an inhabitable whole with regions and portals.',
        subject
          ? `The eligible material is this construction (${shortRef(subject.ref)}) and its scenes. Durable Palace composition and portals are the native palace owner’s operation, not surfaced in this application yet — nothing here is presented as a saved Palace that is only session state.`
          : 'Open or create a construction first. A Palace composes real refs into a whole, never an empty one.');
  }
}

function studioBody(lens: LensDef, subject: NativeSubject | null): string {
  const basis = subject
    ? `<p class="lens-basis">Standing on <code>${esc(shortRef(subject.ref))}</code> · revision ${subject.revision}${subject.sceneRef ? ` · scene <code>${esc(shortRef(subject.sceneRef))}</code>` : ''}${subject.relationRef ? ` · relation <code>${esc(shortRef(subject.relationRef))}</code>` : subject.entityRef ? ` · member <code>${esc(shortRef(subject.entityRef))}</code>` : ''}</p>`
    : `<p class="lens-basis" data-empty="true">No native construction is open. Enter or create one from <strong>M0′ · Web</strong> or the native composition — the instruments compose real work, never an empty whole.</p>`;
  return `<header class="lens-studio-head"><div><span class="panel-kicker">${lens.office} · ${esc(lens.name)}</span><h2>${esc(lens.label)}</h2></div><button type="button" class="lens-studio-close" data-action="lens-close" aria-label="Close Lens Studio">${icon('close')}</button></header>${basis}<div class="lens-studio-controls">${lensControls(lens, subject)}</div>`;
}

export function installLensStudio(host: {subject: () => NativeSubject | null}): LensStudioApi {
  // No `chrome`/`hud-panel` class: those carry the `body.studio-open`
  // visibility toggle, and the chooser must stand while a routed surface (the
  // Scene Studio) is open, so lenses can still be switched. Styled with the
  // root theme vars instead.
  const chooser = document.createElement('nav');
  chooser.id = 'lens-chooser';
  chooser.className = 'lens-chooser';
  chooser.setAttribute('role', 'tablist');
  chooser.setAttribute('aria-label', 'Instruments — M0′ to M5′');
  chooser.hidden = true;

  const studio = document.createElement('aside');
  studio.id = 'lens-studio';
  studio.className = 'lens-studio';
  studio.setAttribute('aria-label', 'Lens Studio');
  studio.hidden = true;

  document.body.append(chooser, studio);

  let active: LensId = 'project';
  let studioOpen = false;
  let mode: 'expressions' | 'techne' = 'expressions';

  const renderChooser = () => {
    chooser.innerHTML = LENSES.map(lens =>
      `<button type="button" class="lens-choice" data-action="lens" data-lens="${lens.id}" role="tab" aria-selected="${lens.id === active}" aria-label="${esc(`${lens.office} ${lens.label}`)}" title="${esc(`${lens.office} — ${lens.label}`)}"><span class="lens-office" aria-hidden="true">${lens.office}</span>${icon(lens.icon)}</button>`,
    ).join('');
  };

  const renderStudio = () => {
    const lens = LENSES.find(candidate => candidate.id === active)!;
    studio.innerHTML = studioBody(lens, host.subject());
    studio.dataset.lens = active;
  };

  const apply = () => {
    const techne = mode === 'techne';
    chooser.hidden = !techne;
    studio.hidden = !techne || !studioOpen;
    if (techne) {
      renderChooser();
      if (studioOpen) renderStudio();
    }
  };

  return {
    setMode(next) { mode = next; apply(); },
    select(id) { active = id; studioOpen = true; apply(); },
    closeStudio() { studioOpen = false; studio.hidden = true; },
    refresh() { if (mode === 'techne') { renderChooser(); if (studioOpen) renderStudio(); } },
    active() { return active; },
  };
}
