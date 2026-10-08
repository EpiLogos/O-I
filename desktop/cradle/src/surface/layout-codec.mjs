/**
 * The layout codec (U0.3b) — the pure, language-neutral validation half of
 * surface persistence: what a serialised binding and pane tree may be
 * restored as. A foreign or partial payload drops the offending part rather
 * than guessing at it (law 7); nothing here touches storage.
 *
 * Plain functions over plain objects so the desktop can unit-test the codec
 * outside a browser (`tests/workspace-continuity.test.mjs`); `persist.ts`
 * wraps them in the typed, storage-bound API.
 *
 * Workspace/state continuity (SHARED-FIELD-STATE-DISCOVERY §2.2, SF1): a
 * restored binding carries the stable refs and compact view state its kind
 * writes — presentation refs/revisions, the encounter plane, the knowledge
 * page/graph plane with its origin graph — never a cloned payload.
 */

// Hosted kinds come from the same reviewed source generation as the mounts.
// Their state stays with their owners, never copied into the arrangement.
import {hostedSurfaceDescriptors} from '../contributions/registered-kinds.mjs';
import {validateNativeKnowledgeContext} from '../knowledge/nativeContext.mjs';
const SURFACE_KINDS = ['source', 'sources', 'knowledge', 'file', 'encounter', 'browser', 'terminal', 'flow', 'draft', 'blank', 'instrument', 'explore', 'presentation', 'agency', 'object', ...hostedSurfaceDescriptors.map(descriptor => descriptor.kind)];
const ENCOUNTER_PLANES = ['Conversation', 'Activity', 'Context', 'Inspect'];
const KNOWLEDGE_PLANES = ['graph', 'page'];

/** Core preserves compact application presentation without interpreting it.
 * Owning applications validate their own payload fields before use. */
export function validApplicationView(raw) {
  if (!raw || typeof raw !== 'object' || raw.schema !== 'oi.application-view/v1' || raw.version !== 1 || typeof raw.app_id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(raw.app_id)) return undefined;
  if (!raw.payload || typeof raw.payload !== 'object' || Array.isArray(raw.payload)) return undefined;
  let nodes = 0;
  const bounded = (value, depth) => {
    if (++nodes > 512 || depth > 6) return false;
    if (value === null || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string') return value.length <= 4096;
    if (Array.isArray(value)) return value.length <= 64 && value.every(item => bounded(item,depth + 1));
    if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return false;
    const keys = Object.keys(value);
    return keys.length <= 64 && keys.every(key => key.length <= 128 && !['__proto__','constructor','prototype'].includes(key) && bounded(value[key],depth + 1));
  };
  try {
    if (!bounded(raw.payload,0)) return undefined;
    const payload = JSON.stringify(raw.payload);
    if (payload.length > 16384) return undefined;
    return {schema:'oi.application-view/v1',version:1,app_id:raw.app_id,payload:JSON.parse(payload)};
  } catch { return undefined; }
}

export function validBinding(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw;
  if (typeof o.id !== 'string' || typeof o.kind !== 'string' || typeof o.title !== 'string') return null;
  // `draft` is unplaced writing: it deliberately carries no owner ref, and it
  // must survive a relaunch — the writing lives beside it under the same
  // surface id, and dropping the binding would orphan it. `instrument` is a
  // presentation binding to an externally owned QL source; the source itself
  // is never serialised into desktop state.
  let hosted = o.hosted && typeof o.hosted === 'object' && typeof o.hosted.descriptor_ref === 'string' && o.hosted.descriptor_ref.trim() && typeof o.hosted.contribution_ref === 'string' && o.hosted.contribution_ref.trim()
    ? {descriptor_ref:o.hosted.descriptor_ref, contribution_ref:o.hosted.contribution_ref} : undefined;
  if (o.hosted !== undefined && !hosted) return null;
  // Upgrade older arrangements when this build can identify the provider.
  // The next save then survives a later build that removes that provider.
  if (!hosted) {
    const descriptor = hostedSurfaceDescriptors.find(row => row.kind === o.kind);
    if (descriptor) hosted = {descriptor_ref:descriptor.descriptor_ref, contribution_ref:descriptor.contribution_ref};
  }
  if (!SURFACE_KINDS.includes(o.kind) && !hosted) return null;
  if (o.ref !== undefined && typeof o.ref !== 'string') return null;
  if (o.kind === 'instrument' && (typeof o.ref !== 'string' || !o.ref.trim())) return null;
  // An object page (10-SIDEBARS §4.7) is identity only: its ref names the object.
  if (o.kind === 'object' && (typeof o.ref !== 'string' || !o.ref.startsWith('oi-object:'))) return null;
  if (o.project !== undefined && typeof o.project !== 'string') return null;
  const address = o.address;
  const nativeKnowledge = o.view?.nativeKnowledge === undefined ? undefined : validateNativeKnowledgeContext(o.view.nativeKnowledge);
  if (o.kind === 'knowledge') {
    if (o.view?.nativeKnowledge !== undefined && !nativeKnowledge) return null;
    if (address ? !['wiki', 'source', 'project-map'].includes(address.kind) || typeof address.value !== 'string' || address.value !== o.ref
      : o.view?.knowledgePlane !== 'graph' || !nativeKnowledge?.subject_ref || !nativeKnowledge.native_owner || nativeKnowledge.subject_ref !== o.ref) return null;
  }
  const location = o.location;
  if (o.kind === 'file' && (!location || location.schema !== 'central.path-ref/v1' || typeof location.ref !== 'string' || location.ref !== o.ref || typeof location.root !== 'string' || typeof location.path !== 'string')) return null;
  const encounter = o.encounter;
  if (o.kind === 'encounter' && (!encounter || typeof encounter.space !== 'string' || typeof o.ref !== 'string' || !o.ref.startsWith('agent-session/') || typeof o.project !== 'string')) return null;
  const flow = o.flow;
  // A flow instance is a user-section document: its identity is the file's
  // path-ref (the binding's ref) plus the in-document id — no project
  // register is involved, and the location must round-trip for the surface
  // to read the file back.
  if (o.kind === 'flow' && (!flow || typeof flow.flowRef !== 'string' || !flow.flowRef || typeof flow.path !== 'string' || !flow.path || typeof o.ref !== 'string' || !o.ref || !o.ref.startsWith('central:path:'))) return null;
  if (o.kind === 'flow' && (!location || location.schema !== 'central.path-ref/v1' || typeof location.ref !== 'string' || location.ref !== o.ref || typeof location.root !== 'string' || typeof location.path !== 'string')) return null;
  // SF1: a pinned projected subject must name its hosted ref and its world;
  // the optional exact refs/revisions ride along only when well-typed.
  const presentationRaw = o.presentation;
  if (o.kind === 'presentation' && (typeof o.ref !== 'string' || !o.ref.trim() || !presentationRaw || typeof presentationRaw !== 'object' || typeof presentationRaw.world_ref !== 'string')) return null;
  const presentation = o.kind === 'presentation' && presentationRaw ? {
    world_ref: presentationRaw.world_ref,
    ...(typeof presentationRaw.field_ref === 'string' ? { field_ref: presentationRaw.field_ref } : {}),
    ...(typeof presentationRaw.projection_ref === 'string' ? { projection_ref: presentationRaw.projection_ref } : {}),
    ...(Number.isInteger(presentationRaw.projection_revision) ? { projection_revision: presentationRaw.projection_revision } : {}),
    ...(typeof presentationRaw.presentation_ref === 'string' ? { presentation_ref: presentationRaw.presentation_ref } : {}),
    ...(Number.isInteger(presentationRaw.presentation_revision) ? { presentation_revision: presentationRaw.presentation_revision } : {}),
    ...(typeof presentationRaw.expression_ref === 'string' ? { expression_ref: presentationRaw.expression_ref } : {}),
    ...(Number.isInteger(presentationRaw.expression_revision) ? { expression_revision: presentationRaw.expression_revision } : {}),
  } : undefined;
  // Compact view state is kind-scoped: the plane an encounter Surface was
  // left on, and the knowledge page/graph plane with the graph it was opened
  // from (the page's return-to-graph origin). Every part restores only when
  // well-typed; a knowledge page losing its plane would reopen as a graph.
  const viewRaw = o.view && typeof o.view === 'object' ? o.view : {};
  const view = {};
  if (o.kind === 'encounter' && ENCOUNTER_PLANES.includes(viewRaw.encounterPlane)) view.encounterPlane = viewRaw.encounterPlane;
  if (['file','source','flow'].includes(o.kind) && typeof viewRaw.fileHistory?.open === 'boolean') {
    const pin = viewRaw.fileHistory;
    const selected = [pin.revision,pin.expectedRevision].every(value => typeof value === 'string' && value.length > 0 && value.length <= 4096);
    if ((pin.revision === undefined && pin.expectedRevision === undefined) || selected) {
      view.fileHistory = {open:pin.open,...(selected?{revision:pin.revision,expectedRevision:pin.expectedRevision}:{})};
    }
  }
  // The knowledge view is one compact unit: a plane that is not a plane
  // invalidates the whole view (drop, never guess); a well-typed origin
  // graph rides along only with a valid plane.
  if (o.kind === 'knowledge' && KNOWLEDGE_PLANES.includes(viewRaw.knowledgePlane)) {
    view.knowledgePlane = viewRaw.knowledgePlane;
    if (nativeKnowledge) view.nativeKnowledge = nativeKnowledge;
    if (typeof viewRaw.graphOrigin === 'string' && viewRaw.graphOrigin.trim()) view.graphOrigin = viewRaw.graphOrigin;
  }
  const terminal = o.kind === 'terminal' ? { cwd: typeof o.terminal?.cwd === 'string' ? o.terminal.cwd : undefined } : undefined;
  const browser = o.kind === 'browser' ? { url: typeof o.browser?.url === 'string' ? o.browser.url : '' } : undefined;
  // The hosted engine's checkpoint (MODE-ENGINE-STATE-PERSISTENCE §7.2):
  // the expression ref the hosted application last showed, written by its
  // stage slot from the application's own announcements. It rides only on
  // the hosted-application centre kinds, and only when well-typed — a REF
  // into the person's saved work, never app content, so the restart can
  // deep-link the application through its own boot grammar.
  const engineRaw = o.engine && typeof o.engine === 'object' ? o.engine : {};
  const engine = (o.kind === 'expressions' || o.kind === 'techne') && typeof engineRaw.expressionRef === 'string' && engineRaw.expressionRef.trim()
    ? {
        expressionRef: engineRaw.expressionRef,
        ...(typeof engineRaw.documentId === 'string' ? { documentId: engineRaw.documentId } : {}),
        ...(typeof engineRaw.revision === 'string' ? { revision: engineRaw.revision } : {}),
      }
    : undefined;
  return {
    ...(hosted ? {hosted} : {}),
    presentation, terminal,
    flow: o.kind === 'flow' ? flow : undefined,
    browser,
    view: Object.keys(view).length ? view : undefined,
    engine,
    encounter, location, address,
    project: o.project,
    id: o.id, kind: o.kind,
    ref: o.ref,
    title: o.title,
  };
}

export function validPane(raw, surfaces) {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw;
  if (o.type === 'group') {
    if (typeof o.id !== 'string' || !Array.isArray(o.tabs) || !Array.isArray(o.pinned)) return null;
    const tabs = o.tabs.filter((t) => typeof t === 'string' && !!surfaces[t]);
    if (tabs.length !== o.tabs.length) return null;
    const pinned = o.pinned.filter((p) => typeof p === 'string' && tabs.includes(p));
    const active = typeof o.active === 'string' && tabs.includes(o.active) ? o.active : tabs[0] ?? null;
    // The tab pin model is per pane: a pane restores unpinned / pinned-vertical
    // and the geometry an unpinned pane reveals in. Pinned-horizontal is the
    // absent default; an unknown name is dropped, never guessed.
    const tabPresentation = o.tabPresentation === 'pinned-vertical' || o.tabPresentation === 'unpinned' ? o.tabPresentation : undefined;
    const tabPinOrientation = o.tabPinOrientation === 'vertical' ? 'vertical' : undefined;
    const g = { type: 'group', id: o.id, tabs, pinned, active, emptySlot: o.emptySlot === true && tabs.length === 0 ? true : undefined, tabPresentation, tabPinOrientation };
    return g;
  }
  if (o.type === 'split' && (o.dir === 'h' || o.dir === 'v') && Array.isArray(o.children)) {
    const children = o.children.map((c) => validPane(c, surfaces)).filter((c) => c !== null);
    if (children.length === 0) return null;
    if (children.length === 1) return children[0]; // normalise degraded splits
    if (typeof o.id !== 'string') return null;
    return { type: 'split', id: o.id, dir: o.dir, children, weights: Array.isArray(o.weights) && o.weights.length === children.length && o.weights.every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0) ? o.weights : undefined };
  }
  return null;
}
