/**
 * The encounter link (WORLD-SHELL-DESIGN §10 seam 3): the URL is a PROJECTION
 * of the spine's encounter, never a second store.
 *
 * The encounter lives in the workspace book's WorldContext (and the mode the
 * book stands in). This module reads it through the spine bridge and writes it
 * to the location with the grammar `?arr=…&projection=…&subject=…&ap=…&as=…`
 * (desktop/cradle/src/workspace/encounter.ts). On `popstate` (and on load) it
 * reads the location back and applies the address through the store's own
 * actions (`switchMode`, `setContext`) — the one writer. Back therefore walks
 * the history the sync wrote, and each history entry is one encounter.
 *
 * Push or replace, decided by the store:
 *   - a trail append, an arrangement change, or a subject change is a new
 *     encounter → pushState;
 *   - an occasion (the reading ref) change is a refinement → replaceState;
 *   - an encounter the URL already names is not written at all.
 *
 * No loops: an inbound address is applied with a `pending`/`expected` guard,
 * so the render that follows the apply cannot write its own pre-apply state
 * back over the address it was asked to show.
 *
 * What the store does not carry (projection, aperture, view-as) is preserved
 * from the location; it is never invented from the store.
 *
 * Detached windows (`window.__OI_DETACHED__`) keep their own query and are
 * left entirely untouched.
 */
import {decodeEncounter, encodeEncounter, type Arrangement, type EncounterAddress, type EncounterSubject} from '../../../../../desktop/cradle/src/workspace/encounter.ts';
import type {EncounterSnapshot} from '../../../../../desktop/cradle/src/surface/projectionModules';
import type {WorldContext} from '../../../../../desktop/cradle/src/workspace/store';
import type {WorkspaceMode} from '../../../../../desktop/cradle/src/workspace/mode';

/** The encounter the store carries, in the link's grammar. */
export interface CarriedEncounter {
  arrangement: Arrangement;
  subject?: EncounterSubject;
  /** The reading the spine opened (WorldContext.reading.ref). */
  occasion?: string;
}

/** Keys the sync owns in the query; every other key is left as it was. */
const LINK_KEYS = ['arr', 'projection', 'subject', 'kind', 'project', 'ap', 'as', 'occasion'] as const;
const ARRANGEMENT_MODES: readonly string[] = ['factory', 'expressions', 'techne', 'settings'];
/** A linked ref is bounded text: no control characters, at most 512 characters. */
const LINK_REF = /^[^\u0000-\u001f\u007f]{1,512}$/;

/** The default subject resolver: a native ref with a kind the spine can
 * classify. The link cannot read the native owner itself; a host with a
 * kernel reader injects a richer resolver. */
export type SubjectResolver = (subject: EncounterSubject) => {title: string} | undefined;
export const resolveLinkedSubject: SubjectResolver = subject =>
  subject.kind && LINK_REF.test(subject.ref) ? {title: subject.ref} : undefined;

/** The arrangement the spine stands in. Live (audio) and Base·Central are one
 * arrangement in the link; Epi-Logos is the world the spine selects. */
export function arrangementOfSnapshot(snapshot: EncounterSnapshot): Arrangement {
  if (snapshot.world === 'epi-logos') return 'epi-logos';
  if (ARRANGEMENT_MODES.includes(snapshot.mode)) return snapshot.mode as Arrangement;
  return 'base';
}

/** What the store carries of the encounter (the bridge snapshot, read-only). */
export function carriedOfSnapshot(snapshot: EncounterSnapshot): CarriedEncounter {
  const subject = snapshot.subject as {ref?: unknown; kind?: string; project?: string; title?: string} | undefined;
  const ref = typeof subject?.ref === 'string' && subject.ref.length > 0 ? subject.ref : undefined;
  return {
    arrangement: arrangementOfSnapshot(snapshot),
    subject: ref ? {ref, kind: subject?.kind ?? '', project: subject?.project, title: subject?.title} : undefined,
    occasion: snapshot.reading?.ref || undefined,
  };
}

const subjectKey = (carried: CarriedEncounter) => JSON.stringify([carried.subject?.ref ?? null, carried.subject?.kind ?? '', carried.subject?.project ?? null]);
/** Equal keys name the same encounter; the URL is written only when the key changes. */
export function carriedKey(carried: CarriedEncounter): string {
  return JSON.stringify([carried.arrangement, subjectKey(carried), carried.occasion ?? null]);
}

/** The trail's shape, bounded: its length and its last stop. */
const trailSignature = (trail: EncounterSnapshot['trail']) => JSON.stringify([trail?.length ?? 0, trail?.[trail.length - 1] ?? null]);

/** Whether the location names an encounter at all. A bare location names none,
 * so the store's own state is written to it instead of being replaced. */
export function hasEncounterAddress(search: string): boolean {
  const params = new URLSearchParams(search);
  return LINK_KEYS.some(key => params.has(key));
}

export interface InboundPlan {
  /** What the store should hold after the apply. */
  carried: CarriedEncounter;
  /** The subject the link named and the spine could not resolve, named. */
  unresolved?: string;
  /** The full address as the location names it (projection, ap, as kept). */
  address: EncounterAddress;
}

/** The apply plan for a location: `null` when the location names no encounter. */
export function inboundPlan(search: string, resolve: SubjectResolver = resolveLinkedSubject): InboundPlan | null {
  if (!hasEncounterAddress(search)) return null;
  const address = decodeEncounter(search);
  let subject: EncounterSubject | undefined;
  let unresolved: string | undefined;
  if (address.subject) {
    const resolved = resolve(address.subject);
    if (resolved) subject = {...address.subject, title: resolved.title};
    else unresolved = address.subject.ref;
  }
  const carried: CarriedEncounter = {arrangement: address.arrangement, subject, occasion: address.occasion};
  return {carried, unresolved, address: {...address, subject}};
}

/** Replace the link's keys in a query, keeping every other key in order. */
export function mergeLinkSearch(search: string, encoded: string): string {
  const kept = new URLSearchParams(search);
  for (const key of LINK_KEYS) kept.delete(key);
  const rest = kept.toString();
  return rest ? `${encoded}&${rest}` : encoded;
}

/** The narrow surface of the store the link writes through. */
export interface EncounterLinkSpine {
  snapshot(): EncounterSnapshot;
  switchMode(mode: WorkspaceMode): void;
  setContext(change: (context: WorldContext) => WorldContext): void;
}

/** The narrow surface of the window the link reads and writes. */
export interface EncounterLinkWindow {
  readonly location: {readonly pathname: string; readonly search: string; readonly hash: string};
  readonly history: {
    pushState(data: unknown, unused: string, url?: string | null): void;
    replaceState(data: unknown, unused: string, url?: string | null): void;
  };
  addEventListener(type: 'popstate', listener: () => void): void;
  removeEventListener(type: 'popstate', listener: () => void): void;
  readonly __OI_DETACHED__?: unknown;
}

export interface EncounterLinkOptions {
  resolveSubject?: SubjectResolver;
  /** Called on every inbound address with the unresolved subject ref, or undefined when none. */
  onUnresolved?: (ref: string | undefined) => void;
}

export interface EncounterLink {
  /** Attach `popstate` and apply the location's address, if it names one. */
  start(): void;
  /** Project the spine's current encounter into the location, when it changed. */
  publish(): void;
  dispose(): void;
}

const INERT: EncounterLink = {start() {}, publish() {}, dispose() {}};

/** A sync over the spine and the window. It holds only the bookkeeping of what
 * the location and the store last agreed on; the encounter itself stays in the
 * store. */
export function createEncounterLink(spine: EncounterLinkSpine, win: EncounterLinkWindow, options: EncounterLinkOptions = {}): EncounterLink {
  // Detached windows load with their own query and keep it.
  if (win.__OI_DETACHED__) return INERT;
  const resolve = options.resolveSubject ?? resolveLinkedSubject;
  // What the location and the store last agreed on (for push/replace).
  let last: CarriedEncounter | undefined;
  // The carried key the store should now hold after an inbound apply.
  let expected: string | null = null;
  // The store's key just before an inbound apply, until the store has moved.
  let pending: string | null = null;
  let trailTop = trailSignature(spine.snapshot().trail);

  const applyInbound = () => {
    const plan = inboundPlan(win.location.search, resolve);
    if (!plan) return;
    options.onUnresolved?.(plan.unresolved);
    const snapshot = spine.snapshot();
    const current = carriedOfSnapshot(snapshot);
    const targetKey = carriedKey(plan.carried);
    if (carriedKey(current) !== targetKey) {
      // Through the store's own actions: the mode tree, then the context.
      // The trail is untouched — Back does not rewind the record.
      if (plan.carried.arrangement !== 'epi-logos') spine.switchMode(plan.carried.arrangement as WorkspaceMode);
      const world = plan.carried.arrangement === 'epi-logos' ? 'epi-logos' : snapshot.world === 'epi-logos' ? undefined : snapshot.world;
      const subject = plan.carried.subject;
      const occasion = plan.carried.occasion;
      spine.setContext(context => ({
        ...context,
        world: world as WorldContext['world'],
        subject: subject ? {ref: subject.ref, kind: subject.kind, title: subject.title ?? subject.ref, project: subject.project} : undefined,
        reading: occasion ? (context.reading?.ref === occasion ? context.reading : {ref: occasion}) : undefined,
      }));
      pending = carriedKey(current);
    }
    expected = targetKey;
    last = plan.carried;
  };

  const publish = () => {
    const snapshot = spine.snapshot();
    const current = carriedOfSnapshot(snapshot);
    const key = carriedKey(current);
    const signature = trailSignature(snapshot.trail);
    const trailChanged = signature !== trailTop;
    trailTop = signature;
    // Until the store has moved past the pre-apply key, this snapshot is the
    // stale state the inbound apply is replacing. Writing it would undo the apply.
    if (pending !== null) {
      if (key === pending) return;
      pending = null;
    }
    if (key === expected) return;
    const newEncounter = last !== undefined && (trailChanged || last.arrangement !== current.arrangement || subjectKey(last) !== subjectKey(current));
    const existing = decodeEncounter(win.location.search);
    const address: EncounterAddress = {
      arrangement: current.arrangement,
      projection: existing.projection,
      subject: current.subject,
      aperture: existing.aperture,
      viewAs: existing.viewAs,
      occasion: current.occasion,
    };
    const search = mergeLinkSearch(win.location.search, encodeEncounter(address));
    const url = `${win.location.pathname}?${search}${win.location.hash}`;
    // location.search carries its leading '?' in a browser; the written URL does too.
    const here = `${win.location.pathname}${win.location.search}${win.location.hash}`;
    if (url !== here) {
      if (newEncounter) win.history.pushState(null, '', url);
      else win.history.replaceState(null, '', url);
    }
    expected = key;
    last = current;
  };

  const onPopState = () => applyInbound();
  return {
    start() {
      win.addEventListener('popstate', onPopState);
      applyInbound();
    },
    publish,
    dispose() {
      win.removeEventListener('popstate', onPopState);
    },
  };
}
