// The encounter bridge — the linkable address of "what you are looking at".
//
// Design: WORLD-SHELL-DESIGN.md §1/§2/§3. Three orthogonal axes —
// arrangement (the mode's own panes) × projection (per pane) × device (the
// rack) — over one World; switching any one keeps the encounter.
// `encounter()` is the only transition; the Trail keeps every encounter.
// Encounters are linkable: the Atlas's hash-router law (every state is
// linkable and Back works) at the shell's grammar
// (?arr=…&projection=…&subject=…&ap=…&as=…&occasion=…).
//
// This module is the contract only: pure types and pure functions, no
// store, no React. The workspace book (tripartite spine, mode/world/epoch)
// stays the owner of the live value; this is what the spine carries.

export type Arrangement = 'base' | 'factory' | 'expressions' | 'techne' | 'epi-logos' | 'settings';

export type Projection = 'earth' | 'timeline' | 'constellation' | 'expressions';

/** Aperture: which shared field the search/admission admits
 * (World · Local · Shared · Federated). Results beyond the aperture are
 * counted and offered, never silently dropped. */
export type Aperture = 'world' | 'local' | 'shared' | 'federated';

/** View as: me · field · public — the disclosure ladder (design §1). */
export type ViewAs = 'me' | 'field' | 'public';

export interface EncounterSubject {
  /** The native identity — never a copy of content. */
  ref: string;
  kind: string;
  project?: string;
  title?: string;
}

export interface EncounterAddress {
  arrangement: Arrangement;
  projection: Projection;
  subject?: EncounterSubject;
  aperture: Aperture;
  viewAs: ViewAs;
  /** A retained occasion (design §15.5): standing in a saved moment
   * without lying about now. */
  occasion?: string;
}

export interface TrailEntry {
  address: EncounterAddress;
  /** The unix second of the transition into this encounter. */
  at: number;
}

/** The Trail keeps every encounter (the design's Trail tile). Bounded by
 * the caller's retention law, not by this module. */
export type Trail = readonly TrailEntry[];

export interface EncounterTransition {
  address: EncounterAddress;
  trail: Trail;
}

/** The only transition. Any axis may change; the subject is kept unless
 * explicitly replaced — switching arrangement or projection never loses
 * what you were looking at. The trail grows by one on every transition,
 * including subject changes (the Trail tile keeps every encounter). */
export function encounter(
  current: EncounterAddress,
  trail: Trail,
  change: Partial<Pick<EncounterAddress, 'arrangement' | 'projection' | 'aperture' | 'viewAs' | 'occasion'>> &
    {subject?: EncounterSubject | undefined},
  now: number = Math.floor(Date.now() / 1000),
): EncounterTransition {
  const address: EncounterAddress = {
    arrangement: change.arrangement ?? current.arrangement,
    projection: change.projection ?? current.projection,
    subject: change.subject === undefined ? current.subject : change.subject,
    aperture: change.aperture ?? current.aperture,
    viewAs: change.viewAs ?? current.viewAs,
    occasion: change.occasion === undefined ? current.occasion : change.occasion,
  };
  return {address, trail: [...trail, {address, at: now}]};
}

/** Return to a trail entry: the address is restored exactly; the trail
 * keeps its history (return appends, it does not rewind). */
export function returnTo(trail: Trail, index: number, now: number = Math.floor(Date.now() / 1000)): EncounterTransition {
  const entry = trail[index];
  if (!entry) throw Error(`No trail encounter at ${index}`);
  return {address: entry.address, trail: [...trail, {address: entry.address, at: now}]};
}

// ---- linkable encoding ----------------------------------------------------
// The mockup's grammar: ?arr=techne&projection=surface→earth… the mockup
// uses `scale=` for the Earth scale; the shell generalises the query to the
// projection name and keeps the mockup's short keys as aliases.

const ARRANGEMENTS: readonly Arrangement[] = ['base', 'factory', 'expressions', 'techne', 'epi-logos', 'settings'];
const PROJECTIONS: readonly Projection[] = ['earth', 'timeline', 'constellation', 'expressions'];
const APERTURES: readonly Aperture[] = ['world', 'local', 'shared', 'federated'];
const VIEW_AS: readonly ViewAs[] = ['me', 'field', 'public'];

export function encodeEncounter(address: EncounterAddress): string {
  const params = new URLSearchParams();
  params.set('arr', address.arrangement);
  params.set('projection', address.projection);
  if (address.subject) {
    params.set('subject', address.subject.ref);
    if (address.subject.kind) params.set('kind', address.subject.kind);
    if (address.subject.project) params.set('project', address.subject.project);
  }
  params.set('ap', String(APERTURES.indexOf(address.aperture)));
  params.set('as', address.viewAs);
  if (address.occasion) params.set('occasion', address.occasion);
  return params.toString();
}

export function decodeEncounter(query: string): EncounterAddress {
  const params = new URLSearchParams(query);
  const arr = params.get('arr') as Arrangement | null;
  const projection = params.get('projection') as Projection | null;
  const ap = params.get('ap');
  const as = params.get('as') as ViewAs | null;
  const subjectRef = params.get('subject');
  return {
    arrangement: arr && ARRANGEMENTS.includes(arr) ? arr : 'base',
    projection: projection && PROJECTIONS.includes(projection) ? projection : 'earth',
    subject: subjectRef
      ? {ref: subjectRef, kind: params.get('kind') ?? '', project: params.get('project') ?? undefined}
      : undefined,
    aperture: ap !== null && APERTURES[Number(ap)] ? APERTURES[Number(ap)] : 'world',
    viewAs: as && VIEW_AS.includes(as) ? as : 'me',
    occasion: params.get('occasion') ?? undefined,
  };
}
