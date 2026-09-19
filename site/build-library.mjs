/** Public edition producer. No repo crawl, local-world read, or hosted publication.
 * Only the explicitly authored public-site source enters these native bundles.
 * The Library index is a derived address book, never a semantic Web database. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parsePublicContent } from './src/lib/public-parser.mjs';
import { projectExpression } from '../shared-field/expression-projection.mjs';

export const PRODUCT_IDS = ['central','actuation','aikit','factory','workcell','ql'];
const hash = value => createHash('sha256').update(value).digest('hex');
const plain = text => text.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*`]/g,'').trim();
const content = node => [node.body,...node.children.flatMap(n=>['## '+n.title,n.body,...n.children.flatMap(c=>['### '+c.title,c.body])])].filter(Boolean).join('\n\n');
const refFor = path => `source:oi:public-site:${path}`;
const material = (glyph,x=0,y=0,scale=1)=>Object.fromEntries(Object.entries({glyph,x,y,z:0,scale,share:1}).map(([k,value])=>[k,{value,automation:null}]));

export function compileLibrary(source, commit='source-snapshot') {
 const pages=parsePublicContent(source), page=id=>pages.find(n=>n.id===id);
 const sourceRevision='sha256:'+hash(source);
 const sourceUrl=/^[a-f0-9]{40}$/.test(commit)?`https://github.com/EpiLogos/O-I/blob/${commit}/site/content/public-site.md`:null;
 const products=page('products');
 if(!products)throw new Error('Public products source is missing');
 const chosen=[...PRODUCT_IDS.map(id=>({id,node:products.children.find(n=>n.id===id),path:'products/'+id,collection:id})),
 ...['oi','research','shared-field','build'].map(id=>({id,node:page(id),path:id,collection:'whole'}))];
 const editions=[];
 for(const {id,node,path,collection} of chosen){
  if(!node)throw new Error(`Missing public source: ${path}`);
  const expressionRef=`expression:oi:site:${id}`;
  const revision=parseInt(hash(JSON.stringify(node)+sourceRevision+'site-edition-v1').slice(0,12),16)+1;
  const parts=PRODUCT_IDS.includes(id)?node.children.filter(n=>['what','why','change','capabilities'].includes(n.id)):node.children;
  const lede=node.children.find(n=>n.id==='lede')?.title;
  const summary=lede??plain(content(parts[0]??node)).split(/\n/)[0].slice(0,190);
  const reads={},entities={},scenes=[];
  const sourceRef=refFor(path);
  reads[sourceRef]={subject_ref:sourceRef,title:node.title,body:content(node),source_ref:sourceRef,source_revision:sourceRevision,source_url:sourceUrl,source_path:'site/content/public-site.md',source_heading:path};
  parts.forEach((part,i)=>{
   const subject=refFor(path+'/'+part.id), entity=`${expressionRef}:entity:${part.id}`;
   const readingTitle=part.children.find(n=>n.id==='title')?.title??part.title;
   reads[subject]={...reads[sourceRef],subject_ref:subject,source_ref:subject,title:readingTitle,body:content(part),source_heading:path+'/'+part.id};
   // A typographic placement of source sections, not a QL ShapeBinding or inferred edge.
   const angle=i/parts.length*Math.PI*2-Math.PI/2;
   entities[entity]={entity_ref:entity,revision,title:part.title,subject:{subject_ref:subject,native_owner:'EpiLogos/O-I',presentation_role:'thing',sources:[{ref:subject,revision:sourceRevision,availability:'available'}],readings:[],actions:[]},parameters:material(String(i+1).padStart(2,'0'),Math.cos(angle)*360,Math.sin(angle)*280,.28)};
  });
  const centre=`${expressionRef}:entity:overview`;
  entities[centre]={entity_ref:centre,revision,title:node.title,subject:{subject_ref:sourceRef,native_owner:'EpiLogos/O-I',presentation_role:'thing',sources:[{ref:sourceRef,revision:sourceRevision,availability:'available'}],readings:[],actions:[]},parameters:material(PRODUCT_IDS.includes(id)?String(PRODUCT_IDS.indexOf(id)+1).padStart(2,'0'):'O:I',0,0,.5)};
  scenes.push({scene_ref:`${expressionRef}:scene:overview`,revision,title:'Overview',entity_refs:[centre,...parts.map(p=>`${expressionRef}:entity:${p.id}`)]});
  for(const part of parts)scenes.push({scene_ref:`${expressionRef}:scene:${part.id}`,revision,title:part.title,entity_refs:[`${expressionRef}:entity:${part.id}`]});
  const document={schema:'oi.expression/v1',expression_ref:expressionRef,revision,title:node.title,scenes,entities,relations:Object.fromEntries(parts.map(part=>{const binding=`${expressionRef}:contains:${part.id}`;return [binding,{binding_ref:binding,relation:{ref:`${sourceRef}/heading-contains/${part.id}`,revision:sourceRevision,availability:'available'},from_entity_ref:centre,to_entity_ref:`${expressionRef}:entity:${part.id}`,provenance:[{ref:sourceRef,revision:sourceRevision,availability:'available'}]}];})),selection:{scene_ref:scenes[0].scene_ref,entity_ref:null},provenance:[{ref:sourceRef,revision:sourceRevision,availability:'available'}],representations:[],refinements:[]};
  const {omissions,...publication}=projectExpression({document,selection:{summary},publisher:{identity_ref:'https://github.com/EpiLogos',chosen_name:'EpiLogos'},audience:{visibility:'public'},world_ref:'world:oi:public-site',field_ref:'oi:field:public-site',projection_ref:`projection:oi:site:${id}`,published_at:'2026-09-19T00:00:00Z',projection_revision:revision,fallback:{html:false}});
  // Count/address view uses the exact native refs from this publication.
  const entry={id,title:node.title,summary,collection,kind:'expression',standing:'Site edition',expression_ref:expressionRef,revision,source_revision:sourceRevision,source_ref:sourceRef,source_location:`O:I / ${node.title}`,url:`./data/library/${id}.json`,scenes:scenes.map(s=>({ref:s.scene_ref,title:s.title,subject_ref:entities[s.entity_refs[0]].subject.subject_ref})),cover:Object.values(entities).map(e=>({glyph:e.parameters.glyph.value,x:e.parameters.x.value,y:e.parameters.y.value,scale:e.parameters.scale.value})),search:plain(content(node)).toLowerCase()};
  editions.push({entry,publication,readings:reads,source_basis:{commit,revision:sourceRevision,path:'site/content/public-site.md'},standing:'Public-site edition compiled from authored public source; not the complete essay/Wiki corpus or proof of a hosted SharedField.'});
 }
 return {index:{schema:'oi.site-library-index/v1',source_revision:sourceRevision,entries:editions.map(e=>e.entry)},editions};
}

export async function buildLibrary(){
 const root=fileURLToPath(new URL('.',import.meta.url));
 const source=await readFile(resolve(root,'content/public-site.md'),'utf8');
 let commit=process.env.GITHUB_SHA??'source-snapshot';
 try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{/* A copied source build still has its exact content hash. */}
 const built=compileLibrary(source,commit);
 const destination=resolve(root,'public/data/library');
 await mkdir(destination,{recursive:true});
 // Only producer-owned outputs are replaced; this is not a personal Library.
 await Promise.all(built.editions.map(e=>writeFile(resolve(destination,e.entry.id+'.json'),JSON.stringify(e))));
 await writeFile(resolve(destination,'index.json'),JSON.stringify(built.index));
 await writeFile(resolve(destination,'public-site.md'),source);
 console.log(`Library: ${built.editions.length} native site editions, ${built.editions.reduce((n,e)=>n+e.entry.scenes.length,0)} exact Scenes; ${built.index.source_revision}`);
 return built;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await buildLibrary();
