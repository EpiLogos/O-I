/** Build-side receiver for already deliberately published native outputs.
 * Raw owner readings, export files, journey demos and omission reports are NOT
 * browser inputs. No crawling, source rewriting or publication decision here. */
import { readFile, writeFile, mkdir, rm, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateProjection } from '../shared-field/index.mjs';
import { worldPresentationFromProjection } from '../shared-field/presentation-projection.mjs';
import { createExploreEntry } from '../shared-field/explore.mjs';
import { createExploreSurfaceModel } from '../shared-field/explore-surface.mjs';
import { validateExpressionComposition, isProtectedRef } from '../shared-field/expression-projection.mjs';
import { validateExpressionPresentation } from '../shared-field/expression-presentation.mjs';
import { renderWorldEdition, worldEditionManifest } from '../shared-field/world-edition.mjs';
import { publicAssetUrl } from './src/library/publication-model.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const failure = () => new Error('A native publication failed public admission. No replacement or fixture publication was supplied.');
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const permittedTextProps = new Set(['title','text','refs']);
function assertPublic(value, key = '', depth = 0) {
 if (depth > 80) throw failure();
 if (typeof value === 'string') {
  if (isProtectedRef(value) || /(?:file:\/\/|(?:^|\s)(?:\/Users\/|\/home\/|~\/)|\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?\b)/i.test(value)) throw failure();
  for (const link of value.matchAll(/\[[^\]]*\]\(([^)]*)\)/g)) if (!publicAssetUrl(link[1]) && !/^\/explore\.html\?ref=[^\s]+$/.test(link[1])) throw failure();
  if (['href','url','locator'].includes(key) && !publicAssetUrl(value) && !/^\/explore\.html\?ref=[^\s]+$/.test(value)) throw failure();
  if (key === 'availability' && !['available','unavailable','stale'].includes(value)) throw failure();
 } else if (Array.isArray(value)) value.forEach(v => assertPublic(v,key,depth+1));
 else if (value && typeof value === 'object') for (const [k,v] of Object.entries(value)) {
  if (['token','api_key','credential','private','omissions','readings','actions','context'].includes(k)) throw failure();
  assertPublic(v,k,depth+1);
 }
}
function admittedProjection(raw) {
 const projection = validateProjection(raw);
 const presentation = worldPresentationFromProjection(projection);
 for (const region of presentation.regions) for (const b of region.bindings || []) {
  const renderer = b.portable_renderer || b.component_ref;
  if (renderer === 'oi.presentation/expression/v1') {
   if (Object.keys(b.props || {}).some(k => !['composition','expression','title'].includes(k))) throw failure();
   const c = validateExpressionComposition(b.props.composition);
   const e = validateExpressionPresentation(b.props.expression);
   if (c.expression_ref !== e.expression_ref || c.revision !== e.expression_revision || projection.subject.ref !== c.expression_ref || projection.source.ref !== c.expression_ref || String(projection.source.revision) !== String(c.revision)) throw failure();
  } else if (Object.keys(b.props || {}).some(k => !permittedTextProps.has(k))) {
   // Unknown native bodies need an explicitly reviewed portable renderer; never
   // copy arbitrary HTML/application props into the browser as a shortcut.
   throw failure();
  }
 }
 assertPublic(projection);
 return {projection,presentation};
}
function inputParts(value) {
 if (value?.schema === 'oi.explore-browser-seed/v1') return {projections:value.presentation_projections || [],entries:value.entries || [],relations:value.relations || [],fields:value.fields || [],entry_fields:value.entry_fields || {},relation_fields:value.relation_fields || {}};
 if (value?.schema === 'oi.world-publication/v1') return {projections:[value.projection],entries:value.entries || [],relations:value.relations || [],fields:[value.field],entry_fields:Object.fromEntries((value.entries || []).map(e=>[e.ref,value.field_ref || value.field?.field_ref])),relation_fields:{}};
 if (value?.schema === 'oi.expression-publication/v1') return {projections:[value.projection],entries:[value.entry],relations:[],fields:[value.field],entry_fields:{[value.entry?.ref]:value.field_ref},relation_fields:{}};
 throw failure();
}
/** Pure compilation: only output-bound public data survives into any artefact. */
export function compilePublications(inputs = []) {
 const records = new Map(), entryCandidates = [], relationCandidates = [], fieldMap = new Map(), entryFields = {}, relationFields = {};
 for (const value of inputs) {
  const part = inputParts(value);
  for (const f of part.fields) if (f?.field_ref) {
   if (fieldMap.has(f.field_ref) && !same(fieldMap.get(f.field_ref),f)) throw failure();
   fieldMap.set(f.field_ref, f);
  }
  for (const raw of part.projections) {
   // A private/withdrawn item is discarded without copying titles, errors,
   // source refs, metadata, omission details or previews.
   if (raw?.state !== 'published' || raw?.audience?.visibility !== 'public') continue;
   const item = admittedProjection(raw), key = item.projection.projection_ref;
   if (records.has(key) && !same(records.get(key).projection,item.projection)) throw failure();
   records.set(key,item);
  }
  entryCandidates.push(...part.entries); relationCandidates.push(...part.relations);
  Object.assign(entryFields,part.entry_fields); Object.assign(relationFields,part.relation_fields);
 }
 const bound = new Map();
 for (const record of records.values()) {
  const p = record.projection, presentation = record.presentation;
  const add = (ref,title,text='') => { if (!bound.has(ref)) bound.set(ref,[]); bound.get(ref).push({record,title,text}); };
  add(p.subject.ref,presentation.title,presentation.summary || '');
  for (const region of presentation.regions) for (const b of region.bindings || []) {
   if (b.subject_ref) add(b.subject_ref,b.props?.title || b.fallback?.title || presentation.title,b.props?.text || b.fallback?.text || '');
   for (const e of Object.values(b.props?.composition?.entities || {})) if (e.subject?.subject_ref) add(e.subject.subject_ref,e.title);
  }
 }
 const entries = new Map();
 for (const raw of entryCandidates) {
  if (!raw || !bound.has(raw.ref) || isProtectedRef(raw.ref)) continue;
  const field = fieldMap.get(entryFields[raw.ref]);
  if (field && field.visibility !== 'public') continue;
  if (raw.meta?.visibility && raw.meta.visibility !== 'public') continue;
  const possibilities = bound.get(raw.ref), selected = possibilities.find(x => x.record.projection.projection_ref === (raw.projection_ref || raw.meta?.projection_ref)) || possibilities.find(x => x.record.projection.subject.ref === raw.world_ref) || possibilities[0];
  const p = selected.record.projection;
  // Public display text is read from the actual public Projection, not from an
  // unfiltered search row accompanying it. Semantic identities remain native.
  const entry = createExploreEntry({ref:raw.ref,kind:raw.kind,world_ref:raw.world_ref,label:selected.title, ...(selected.text ? {summary:selected.text.slice(0,500)} : {}), ...(raw.revision ? {revision:raw.revision} : {}), aliases:[],provenance:p.provenance,locators:[],projection_ref:p.projection_ref});
  assertPublic(entry);
  if (entries.has(entry.ref) && !same(entries.get(entry.ref),entry)) throw failure();
  entries.set(entry.ref,entry);
 }
 const relations = new Map();
 for (const raw of relationCandidates) {
  if (!entries.has(raw.from) || !entries.has(raw.to) || (raw.visibility && raw.visibility !== 'public') || (raw.meta?.visibility && raw.meta.visibility !== 'public')) continue;
  const field = fieldMap.get(relationFields[raw.relation_ref]);
  if (field && field.visibility !== 'public') continue;
  const relation = Object.fromEntries(['relation_ref','from','to','relation','origin','direction','provenance'].filter(k=>raw[k]!==undefined).map(k=>[k,raw[k]]));
  assertPublic(relation);
  const key = relation.relation_ref || JSON.stringify([relation.from,relation.relation,relation.to]);
  if (relations.has(key) && !same(relations.get(key),relation)) throw failure();
  relations.set(key,relation);
 }
 const usedFields=new Set([...entries.keys()].map(ref=>entryFields[ref]));
 const publicFields = [...fieldMap.values()].filter(f=>f.visibility==='public'&&usedFields.has(f.field_ref)).map(f=>({field_ref:f.field_ref,kind:f.kind,visibility:'public'}));
 assertPublic(publicFields);
 const knownFields = new Set(publicFields.map(f=>f.field_ref));
 const seed = {schema:'oi.explore-browser-seed/v1',entries:[...entries.values()].sort((a,b)=>a.ref.localeCompare(b.ref)),relations:[...relations.values()],presentations:[],presentation_projections:[...records.values()].map(r=>r.projection),fields:publicFields,entry_fields:Object.fromEntries([...entries.keys()].filter(ref=>knownFields.has(entryFields[ref])).map(ref=>[ref,entryFields[ref]])),relation_fields:Object.fromEntries([...relations.values()].filter(r=>r.relation_ref&&knownFields.has(relationFields[r.relation_ref])).map(r=>[r.relation_ref,relationFields[r.relation_ref]]))};
 createExploreSurfaceModel(seed);
 const editions = [...records.values()].map(({projection}) => {
  const path = `./data/library/editions/${digest(projection.projection_ref+'@'+projection.projection_revision)}`;
  const html = renderWorldEdition(projection, {explore_base:'../../../../library.html'});
  const manifest = worldEditionManifest(projection,html,{page:path+'/index.html',projection_file:path+'/projection.json'});
  return {projection,html,manifest,directory:path.split('/').pop()};
 });
 return {seed,editions};
}
export async function buildPublications() {
 const root=fileURLToPath(new URL('.',import.meta.url));
 let paths=[];
 if (process.env.OI_LIBRARY_PUBLICATIONS) {
  paths=JSON.parse(process.env.OI_LIBRARY_PUBLICATIONS);
  if (!Array.isArray(paths)||!paths.length||paths.some(p=>typeof p!=='string')) throw failure();
 } else paths=[resolve(root,'public/data/explore-public.json')];
 // The Vite public directory is copied verbatim. Refuse a raw non-empty seed
 // there: native producer inputs belong outside public/, and only this
 // admitted projection is emitted into browser assets.
 const publicSeed=JSON.parse(await readFile(resolve(root,'public/data/explore-public.json'),'utf8'));
 if ((publicSeed.entries||[]).length || (publicSeed.presentation_projections||[]).length || (publicSeed.presentations||[]).length || (publicSeed.relations||[]).length) throw failure();
 for(const path of paths) if(resolve(root,path).startsWith(resolve(root,'public')+'/') && resolve(root,path)!==resolve(root,'public/data/explore-public.json')) throw failure();
 const inputs=await Promise.all(paths.map(path=>readFile(resolve(root,path),'utf8').then(JSON.parse)));
 const built=compilePublications(inputs);
 const destination=resolve(root,'public/data/library'),staging=resolve(root,'.publication-staging');
 await rm(staging,{recursive:true,force:true}); await mkdir(join(staging,'editions'),{recursive:true});
 for (const e of built.editions) {
  const directory=join(staging,'editions',e.directory); await mkdir(directory,{recursive:true});
  await writeFile(join(directory,'index.html'),e.html);
  await writeFile(join(directory,'projection.json'),JSON.stringify(e.projection));
  await writeFile(join(directory,'manifest.json'),JSON.stringify(e.manifest));
 }
 await mkdir(destination,{recursive:true});
 await rm(join(destination,'editions'),{recursive:true,force:true});
 await rename(join(staging,'editions'),join(destination,'editions'));
 await writeFile(join(destination,'edition-manifests.json'),JSON.stringify(built.editions.map(e=>e.manifest)));
 await writeFile(join(destination,'published.json'),JSON.stringify(built.seed));
 await rm(staging,{recursive:true,force:true});
 console.log(`Native Library: ${built.seed.entries.length} public subjects; ${built.editions.length} revisioned publications. No live subscription.`);
 return built;
}
if (process.argv[1]===fileURLToPath(import.meta.url)) {
 try { await buildPublications(); } catch { console.error(failure().message); process.exitCode=1; }
}
