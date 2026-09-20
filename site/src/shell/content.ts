import { getPage, getSection, getChild, getTitle, getBody } from '../lib/public-content';
export type Media = { media:'a'|'b'|'c'|'d'; poster?:1|2|3; zoom?:number };
export type Item = { name:string; detail?:string };
export type Layout = 'statement'|'split'|'feature'|'grid'|'index'|'band';
export type Section = {eyebrow?:string;title:string;sub?:string;body?:string;items?:Item[];layout:Layout;tone?:'light'|'dark';figure?:1|2|3;flip?:boolean;media?:Media};
export type Page = {id:string;label:string;index:string;hint:string;intro:{eyebrow:string;title:string;body:string};sections:Section[]};
const ids=['central','actuation','aikit','factory','workcell','ql'];
export const PRODUCTS=ids.map(id=>{const p=getSection('products',id);return {
 id,name:p.title,office:getChild(p,'lede').title,repo:getBody(p,'repo'),what:getBody(p,'what'),change:getBody(p,'change')
};});
function homeSection(id:string,layout:Layout,tone:'light'|'dark',extra:Partial<Section>={}):Section {
 const n=getSection('home',id); return {eyebrow:n.title,title:getTitle(n),body:getBody(n,'title'),layout,tone,...extra};
}
export const PAGES:Page[]=[{
 id:'home',label:'Home',index:'00',hint:'World and Life',
 intro:{eyebrow:'O:I',title:getTitle(getSection('home','hero')),body:''},
 sections:[
 homeSection('what','statement','dark'),
 homeSection('existing-world','split','light'),
 homeSection('means','feature','dark',{figure:1}),
 homeSection('return','split','light'),
 homeSection('centres','index','dark',{items:PRODUCTS.map(p=>({name:p.name,detail:p.office}))}),
 // The existing video-band component, carried from the former O:I page.
 homeSection('shared','band','dark',{media:{media:'c',poster:3,zoom:1.3}}),
 homeSection('build','statement','light')
 ]
}];
export const PUBLIC_PAGE_IDS=getPage('products').children.filter(n=>ids.includes(n.id)).map(n=>n.id);
