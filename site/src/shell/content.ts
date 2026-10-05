import { getPage, getSection, getChild, getTitle, getBody } from '../lib/public-content';
export type Item = { name:string; detail?:string };
export type Layout = 'statement'|'split'|'feature'|'grid'|'index';
export type ReadingLink = { label:string; href:string; accessibleName?:string; title?:string; caption?:string };
/** One facet of an agent's world and the product that holds it. */
export type Facet = { id:string; role:string; line:string; product:string; cli:string; repo:string };
export type FacetSet = { label:string; note:string; readme:ReadingLink; facets:Facet[] };
export type Section = {eyebrow?:string;title:string;sub?:string;body?:string;items?:Item[];readingLinks?:ReadingLink[];facetSet?:FacetSet;layout:Layout;tone?:'light'|'dark';figure?:1|2|3;flip?:boolean};
export type Page = {id:string;label:string;index:string;hint:string;intro:{eyebrow:string;title:string;body:string};sections:Section[]};
const ids=['central','actuation','aikit','factory','workcell','ql'];
const reading=getSection('home','reading');
export const ESSAY_HREF='./essay/';
const essay:ReadingLink={label:getChild(reading,'essay').title,href:ESSAY_HREF,accessibleName:`Essay, ${getTitle(reading,'essay-title')}`};
/** The essay is the one reading route; the Library keeps its own address. */
export const READING_LINKS:ReadingLink[]=[essay];
export const ESSAY_ENTRANCE:ReadingLink={...essay,title:getTitle(reading,'essay-title').replace(/\.$/,''),caption:getBody(reading,'essay')};
export const GITHUB={label:getChild(reading,'github').title,href:getBody(reading,'github')};
const what=getSection('home','what');
const readme:ReadingLink={label:getChild(what,'readme').title,href:getBody(what,'readme')};
export const PRODUCTS=ids.map(id=>{const p=getSection('products',id);return {
 id,name:p.title,office:getChild(p,'lede').title,role:getChild(p,'role').title,facet:getBody(p,'role'),cli:getChild(p,'cli').title,repo:getBody(p,'repo'),what:getBody(p,'what'),change:getBody(p,'change')
};});
/** Facet and product are one entry: the role and its line, then the product, its CLI and repository. */
export const FACETS:FacetSet={label:getTitle(what,'facets'),note:getBody(what,'facets'),readme,
 facets:PRODUCTS.map(p=>({id:p.id,role:p.role,line:p.facet,product:p.name,cli:p.cli,repo:p.repo}))};
function homeSection(id:string,layout:Layout,tone:'light'|'dark',extra:Partial<Section>={}):Section {
 const n=getSection('home',id); return {eyebrow:n.title,title:getTitle(n),body:getBody(n,'title'),layout,tone,...extra};
}
export const PAGES:Page[]=[{
 id:'home',label:'Home',index:'00',hint:'World and Life',
 intro:{eyebrow:'O:I',title:getTitle(getSection('home','hero')),body:''},
 sections:[
 // Objective Internality with its six facets and their products, the Cradle, the essay, its authorship.
 homeSection('what','statement','dark',{facetSet:FACETS}),
 homeSection('cradle','feature','light',{figure:1}),
 homeSection('essay','split','dark',{readingLinks:[ESSAY_ENTRANCE]}),
 homeSection('return','split','light')
 ]
}];
export const PUBLIC_PAGE_IDS=getPage('products').children.filter(n=>ids.includes(n.id)).map(n=>n.id);
