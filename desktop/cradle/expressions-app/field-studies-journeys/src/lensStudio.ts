/** The M0′–M5′ Lens Studio — the compact instrument chooser and the floating
 * Studio that presents the ACTIVE lens's operating controls over the ONE field,
 * DISCLOSED by the actual construction (owner wayfinder §§2, 13–21, 28, 36).
 *
 * One environment, one renderer. Each lens is a differentiated way of working
 * the SAME native construction — not a separate application, a second store or
 * a facts panel. A lens discloses its own material from the OPEN kernel
 * Expression (its members, typed relations and real Scenes, read through
 * `construction()`, never hardcoded) and offers the operations that act on that
 * material through the native owner: the Library and source gathering (M0′), the
 * native composition and its commit (M1′), the relation/timeline field (M2′),
 * the scene sequence and native Scene persistence (M3′). Where the construction
 * discloses no facet an instrument needs — a source-backed place (M4′), or a
 * native Palace owner (M5′) — the lens names the honest state, the eligible
 * material derived from the real construction, and the exact unsurfaced native
 * seam, inventing no control or coordinate (§§18–21).
 *
 * Selecting a lens re-presents the Studio only; the field, camera and selection
 * stand (§28 lens continuity). This is the current-app instrument surface; the
 * native operations behind the controls are proven separately by the native
 * composition/application walks.
 */
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
  refresh(): void;
  active(): LensId;
}

export interface LensStudioHost {
  /** The exact open native work (or null) — the construction's identity. */
  subject(): NativeSubject | null;
  /** The open construction's real facets (members, relations, Scenes) — the
   * disclosure each lens stands on. Null when no native work is open. */
  construction(): ConstructionFacets | null;
}

const shortRef = (ref: string) => {
  const tail = ref.split(':').pop() ?? ref;
  return tail.length > 24 ? `${tail.slice(0, 22)}…` : tail;
};

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** An operative control that opens one of the application's own surfaces. */
const control = (action: string, iconName: string, label: string, note: string) =>
  `<button type="button" class="lens-control oi-action" data-action="${esc(action)}"><span class="lens-control-icon">${icon(iconName)}</span><span class="lens-control-text"><strong>${esc(label)}</strong><small>${esc(note)}</small></span></button>`;

/** An operative control that runs a NATIVE operation through the owner (a
 * `lens-op`), not a browser-local save. */
const nativeOp = (opName: string, iconName: string, label: string, note: string) =>
  `<button type="button" class="lens-control lens-control-native oi-action" data-action="lens-op" data-op="${esc(opName)}"><span class="lens-control-icon">${icon(iconName)}</span><span class="lens-control-text"><strong>${esc(label)}</strong><small>${esc(note)}</small></span></button>`;

/** The material a lens discloses from the real construction — never session
 * statistics, always the actual structure the lens operates on (§36). */
const material = (line: string) => `<p class="lens-material" role="note">${line}</p>`;

/** An honest facet state (§§18–21) derived from the real construction: the
 * instrument's purpose, the eligible material named from actual refs, and the
 * exact unsurfaced native seam — no invented control, no fabricated coordinate. */
const honestFacet = (facet: 'place' | 'palace', purpose: string, standing: string) =>
  `<div class="lens-facet" data-lens-facet="${facet}" role="note"><p class="lens-facet-purpose">${esc(purpose)}</p><p class="lens-facet-standing">${standing}</p></div>`;

function lensControls(lens: LensDef, c: ConstructionFacets | null): string {
  switch (lens.id) {
    case 'project':
      return material('Find, read and gather connected sources; establish an inquiry and enter or create a constellation.') +
        control('native-construct', 'edit', 'Gather sources & construct', 'Open your connected world — read sources, select passages and author a constellation that opens in this field.') +
        control('native-library', 'library', 'Library — My World / O:I Web', 'Connected sources across your world.') +
        control('native-work', 'save', c ? 'Open the native construction' : 'Native composition', c ? 'Continue the open native work.' : 'Commit, save and reopen native work in place.');
    case 'canvas':
      return material(c ? `${plural(c.members, 'member')} · ${plural(c.relations, 'typed relation')} in this construction.` : 'No construction is open — the constellation composes real members, never an empty whole.') +
        (c ? '' : control('native-construct', 'edit', 'Gather sources & construct', 'Author a constellation from connected sources in the Wiki, then compose it in this field.')) +
        control('native-work', 'formation', 'Native composition', 'Members, contextual roles and typed relations in the real Expression medium.') +
        nativeOp('commit', 'save', 'Commit the constellation', 'Persist members and typed relations to the native Expression through the owner.');
    case 'timeline':
      return material(c ? `${plural(c.relations, 'relation')} to operate — chronology, dependence, recurrence — with evidence and direction.` : 'No construction is open — relations are read and authored from real members.') +
        control('open-timeline', 'branch', 'Relations in time', 'Temporal relations and automation over the field.') +
        control('native-work', 'formation', 'Typed relation authoring', 'Author non-temporal typed relations through the native composition.');
    case 'journey':
      return material(c ? (c.scenes.length ? `${plural(c.scenes.length, 'native Scene')}: ${c.scenes.map(s => `<code title="${esc(s.scene_ref)}">${esc(s.title)}</code>`).join(', ')}` : 'This construction has no Scenes yet — author one and commit it natively.') : 'No construction is open — a Journey orders real Expression Scenes.') +
        control('sequence-panel', 'sequence', 'Author & order Scenes', 'Order, pace and branch the scene sequence.') +
        nativeOp('commit', 'save', 'Commit Scenes to the Expression', 'Persist the Scenes as native Expression Scenes through the owner — not a browser save.');
    case 'place':
      // Derived, not hardcoded: the kernel Expression carries no place facet, so
      // it is honestly absent — a place is read from a source that carries one,
      // never manufactured. The native place owner operation is the named seam.
      return honestFacet('place',
        'Situate this work in source-backed places, occasions and reference frames.',
        c
          ? `This construction (<code>${esc(shortRef(c.ref))}</code>) discloses no source-backed place facet across its ${plural(c.members, 'member')}. A place enters only from a source that carries one; the native place owner operation is not surfaced in this application, so no coordinate is invented.`
          : 'Open or create a construction first. A place is read from a source that carries one; none is manufactured.');
    case 'palace': {
      // Derived from the real construction: the eligible material is named from
      // actual refs and Scene count, and creation is honestly gated on the
      // native Palace owner operation, which this application does not surface.
      const eligible = c
        ? `The eligible material is this construction (<code>${esc(shortRef(c.ref))}</code>) with its ${plural(c.scenes.length, 'Scene')} and ${plural(c.members, 'member')}. Durable Palace composition and portals are the native Palace owner operation, not surfaced in this application — nothing here is presented as a saved Palace that is only session state.`
        : 'Open or create a construction first. A Palace composes real refs into a whole, never an empty one.';
      return honestFacet('palace', 'Compose constellations, Expressions, Journeys and sources into an inhabitable whole with regions and portals.', eligible);
    }
  }
}

function studioBody(lens: LensDef, subject: NativeSubject | null, c: ConstructionFacets | null): string {
  const basis = subject
    ? `<p class="lens-basis">Standing on <code>${esc(shortRef(subject.ref))}</code> · revision ${subject.revision}${subject.sceneRef ? ` · scene <code>${esc(shortRef(subject.sceneRef))}</code>` : ''}${subject.relationRef ? ` · relation <code>${esc(shortRef(subject.relationRef))}</code>` : subject.entityRef ? ` · member <code>${esc(shortRef(subject.entityRef))}</code>` : ''}</p>`
    : `<p class="lens-basis" data-empty="true">No native construction is open. Enter or create one from <strong>M0′ · Web</strong> or the native composition — the instruments compose real work, never an empty whole.</p>`;
  return `<header class="lens-studio-head"><div><span class="panel-kicker">${lens.office} · ${esc(lens.name)}</span><h2>${esc(lens.label)}</h2></div><button type="button" class="lens-studio-close" data-action="lens-close" aria-label="Close Lens Studio">${icon('close')}</button></header>${basis}<div class="lens-studio-controls">${lensControls(lens, c)}</div>`;
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
  let mode: 'expressions' | 'techne' = 'expressions';
  let built = false;

  // Build the chooser buttons ONCE; selection updates their state in place so
  // the just-activated button keeps keyboard focus (never a full innerHTML
  // rebuild on select).
  const buildChooser = () => {
    chooser.innerHTML = LENSES.map((lens, index) =>
      `<button type="button" class="lens-choice" data-action="lens" data-lens="${lens.id}" role="tab" id="lens-tab-${lens.id}" aria-controls="lens-studio" aria-selected="${lens.id === active}" tabindex="${lens.id === active ? 0 : -1}" aria-label="${esc(`${lens.office} ${lens.label}`)}" title="${esc(`${lens.office} — ${lens.label}`)}" data-index="${index}"><span class="lens-office" aria-hidden="true">${lens.office}</span>${icon(lens.icon)}</button>`,
    ).join('');
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
    studio.innerHTML = studioBody(lens, host.subject(), host.construction());
    studio.dataset.lens = active;
  };

  const apply = () => {
    const techne = mode === 'techne';
    chooser.hidden = !techne;
    studio.hidden = !techne || !studioOpen;
    if (techne) {
      if (!built) buildChooser(); else markActive();
      if (studioOpen) renderStudio();
    }
  };

  // Arrow-key roving across the tablist (§13 keyboard-reachable controls).
  chooser.addEventListener('keydown', event => {
    const keys: Record<string, number> = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1};
    const delta = keys[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const at = LENSES.findIndex(lens => lens.id === active);
    const next = LENSES[(at + delta + LENSES.length) % LENSES.length];
    active = next.id; studioOpen = true; markActive();
    if (studio.hidden) studio.hidden = false;
    renderStudio();
    chooser.querySelector<HTMLButtonElement>(`.lens-choice[data-lens="${next.id}"]`)?.focus();
  });

  return {
    setMode(next) { mode = next; if (next === 'techne' && !built) buildChooser(); apply(); },
    select(id) { active = id; studioOpen = true; if (built) markActive(); else buildChooser(); if (studio.hidden) studio.hidden = false; renderStudio(); },
    closeStudio() { studioOpen = false; studio.hidden = true; },
    refresh() { if (mode === 'techne') { if (!built) buildChooser(); else markActive(); if (studioOpen) renderStudio(); } },
    active() { return active; },
  };
}
