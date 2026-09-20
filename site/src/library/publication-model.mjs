/** Browser-only receiving adapter. Identity, search and relations stay in Explore.
 * No local world, catalogue, scene persistence, auth or daemon is consulted. */
import { createExploreSurfaceModel } from '../../../shared-field/explore-surface.mjs';
import { worldPresentationFromProjection } from '../../../shared-field/presentation-projection.mjs';
import { validateExpressionComposition } from '../../../shared-field/expression-projection.mjs';
import { resolveExpressionPresentation } from '../../../shared-field/expression-presentation.mjs';

const fields = ['ref','collection_ref','projection','revision','expression','expression_revision','expression_projection','expression_projection_revision','scene','depth','q','at','offset'];
export function publicationRoute(hash) {
 const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
 const p = new URLSearchParams(query), result = {};
 for (const key of fields) result[key] = (p.get(key) || '').slice(0, 2048);
 result.depth = ['read','expression','relations','source'].includes(result.depth) ? result.depth : 'read';
 result.at = String(Math.max(0, Math.min(100000, Number.parseInt(result.at, 10) || 0)));
 result.offset = String(Math.max(0, Math.min(1, Number(result.offset) || 0)));
 return result;
}
export function publicationHref(route = {}) {
 const p = new URLSearchParams({published:'1'});
 for (const key of fields) if (route[key] && !((key === 'depth' && route[key] === 'read') || (['at','offset'].includes(key) && String(route[key]) === '0'))) p.set(key, String(route[key]));
 return '#/library?' + p;
}
export function isPublicationRoute(hash) {
 const p = new URLSearchParams(hash.split('?')[1] || '');
 return /^#\/?library(?:\?|$)/.test(hash) && ['published','ref','collection_ref'].some(key => p.has(key));
}
export function publicAssetUrl(value) {
 if (typeof value !== 'string') return null;
 if (value.length <= 262144 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value;
 if (value.length > 4096) return null;
 try {
  const u = new URL(value);
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  // DNS names only. IP literals and local/single-label names are not public assets.
  if (u.protocol !== 'https:' || u.username || u.password || !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid)$/.test(host)) return null;
  return u.href;
 } catch { return null; }
}
export function openPublication(seed, manifests = []) {
 if (seed?.schema !== 'oi.explore-browser-seed/v1') throw new Error('The published Library has an unsupported format.');
 const projections = seed.presentation_projections || [];
 if (projections.some(p => p.state !== 'published' || p.audience?.visibility !== 'public')) throw new Error('The Library did not supply a public edition.');
 const model = createExploreSurfaceModel(seed);
 const records = projections.map(projection => ({projection, presentation:worldPresentationFromProjection(projection)}));
 const bindings = record => record.presentation.regions.flatMap(region => region.bindings || []);
 const matches = (record, ref) => record.projection.subject.ref === ref || bindings(record).some(b => b.subject_ref === ref || Object.values(b.props?.composition?.entities || {}).some(e => e.subject?.subject_ref === ref));
 const manifestFor = p => manifests.find(m => m.schema === 'oi.world-edition-manifest/v1' && m.projection_ref === p.projection_ref && m.projection_revision === p.projection_revision && m.source?.revision === p.source.revision);
 function select(ref, projectionRef = '', revision = '') {
  const opened = model.open(ref);
  if (!opened) throw new Error('This subject is not in the published edition. Nothing else has been substituted.');
  const actualRef = opened.resource.ref;
  let candidates = records.filter(r => matches(r, actualRef));
  if (projectionRef) candidates = candidates.filter(r => r.projection.projection_ref === projectionRef);
  if (revision) candidates = candidates.filter(r => String(r.projection.projection_revision) === String(revision));
  if (!candidates.length) throw new Error('This exact published revision is unavailable. Return to the Library to choose another edition explicitly.');
  // Prefer the subject's own source publication over Expressions that present it.
  const direct=candidates.filter(r=>r.projection.subject.ref===actualRef);
  const own = direct.length?direct:candidates.filter(r => r.projection.subject.kind !== 'expression' && bindings(r).some(b => b.subject_ref === actualRef && b.portable_renderer !== 'oi.presentation/expression/v1'));
  if (own.length) candidates = own;
  if (candidates.length !== 1) throw new Error('Several editions present this subject. Choose a particular publication from its edition links.');
  const record = candidates[0];
  const readings = bindings(record).filter(b => b.subject_ref === actualRef && b.portable_renderer !== 'oi.presentation/expression/v1');
  return {...record, resource:opened.resource, readings, manifest:manifestFor(record.projection), relations:model.relationsFor(actualRef), forms:model.presentationsFor(actualRef)};
 }
 function expressions(ref) {
  return records.flatMap(record => bindings(record).filter(b => b.portable_renderer === 'oi.presentation/expression/v1' && (b.props?.composition?.expression_ref === ref || Object.values(b.props?.composition?.entities || {}).some(e => e.subject?.subject_ref === ref))).map(binding => ({...record,binding})));
 }
 function stage(form, sceneRef = '') {
  const admission = resolveExpressionPresentation(form.binding, {renderer_ref:'renderer:oi:expression-stage',available:true,focus:true,capture:false});
  if (admission.state !== 'live') return {admission};
  const composition = validateExpressionComposition(form.binding.props.composition);
  if (composition.expression_ref !== admission.expression.expression_ref || composition.revision !== admission.expression.expression_revision || form.projection.source.ref !== composition.expression_ref || String(form.projection.source.revision) !== String(composition.revision)) throw new Error('The Expression and its published revision disagree.');
  const scene = composition.scenes.find(s => s.scene_ref === (sceneRef || admission.expression.scene_ref || composition.selection.scene_ref));
  if (!scene) throw new Error('This exact Scene is not in the published Expression.');
  if (scene.entity_refs.length > 10) return {admission:{state:'unavailable',reason:'The published Scene exceeds this browser renderer’s ten-formation capacity. Reading and source depth remain available.'}};
  // An ephemeral props adapter for the already accepted NativeStage, not a store.
  const entry = {id:composition.expression_ref,title:composition.title,summary:form.presentation.summary || '',collection:'',kind:'expression',standing:'Published edition',expression_ref:composition.expression_ref,revision:composition.revision,source_revision:form.projection.source.revision,source_ref:form.projection.source.ref,source_location:form.presentation.title,url:'',scenes:composition.scenes.map(s => ({ref:s.scene_ref,title:s.title,subject_ref:composition.entities[s.entity_refs[0]]?.subject?.subject_ref || ''})),cover:[],search:''};
  return {admission,scene,edition:{entry,publication:{schema:'oi.expression-publication/v1',expression_ref:composition.expression_ref,expression_revision:composition.revision,composition,expression:admission.expression,presentation:form.presentation,projection:form.projection},readings:{},source_basis:{commit:'',revision:form.projection.source.revision,path:''},standing:'Deliberately published revision; not a live subscription.'}};
 }
 function collections() {
  return model.search('', {limit:1000}).filter(e => e.kind === 'wiki-space');
 }
 function search(query = '', collectionRef = '') {
  const results = model.search(query, {limit:1000});
  if (!collectionRef) return results;
  if (!model.open(collectionRef)) throw new Error('This collection is not in the published edition.');
  // Native Wiki membership only; no title/tag inference, and never copied subjects.
  const members = new Set((seed.relations || []).filter(r => r.from === collectionRef && r.relation === 'wiki.contains').map(r => r.to));
  for (const record of records) for (const b of bindings(record)) if (b.subject_ref === collectionRef && b.portable_renderer === 'oi.presentation/wiki-reading/v1') for (const ref of b.props.refs || []) members.add(ref);
  return results.filter(e => members.has(e.ref));
 }
 return {model,records,select,expressions,stage,collections,search,manifestFor};
}
