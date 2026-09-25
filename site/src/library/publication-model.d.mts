import type { Edition, NativeScene } from './model.mjs';
export type PublicationRoute=Record<'ref'|'collection_ref'|'projection'|'revision'|'expression'|'expression_revision'|'expression_projection'|'expression_projection_revision'|'scene'|'depth'|'q'|'at'|'offset'|'page'|'focus_ref',string>;
export interface PublicProjection {projection_ref:string;projection_revision:number;state:string;audience:{visibility:string};subject:{kind:string;ref:string};source:{ref:string;revision:string;system:string};published_at:string}
export interface PublicBinding {binding_ref:string;subject_ref?:string;portable_renderer?:string;component_ref:string;props:Record<string,any>;fallback:Record<string,any>}
export interface PublicPresentation {title:string;summary?:string;presentation_ref:string;revision:number;regions:{bindings:PublicBinding[]}[]}
export interface PublicResource {ref:string;kind:string;world_ref:string;label:string;summary?:string;revision?:string;locators?:{surface:string;locator:string}[]}
export interface PublicManifest {schema:string;projection_ref:string;projection_revision:number;source:{revision:string};page:string;projection_file:string;digest:{value:string};native_body?:import('./model.mjs').NativeBodyDescriptor}
export interface PublicRecord {projection:PublicProjection;presentation:PublicPresentation}
export interface PublicForm extends PublicRecord {binding:PublicBinding}
export interface PublicSubject extends PublicRecord {resource:PublicResource;readings:PublicBinding[];manifest?:PublicManifest;relations:{relation_ref?:string;from:string;to:string;relation:string}[];forms:unknown}
export interface PublicStage {admission:{state:string;reason?:string;fallback?:{kind:string;href?:string;html?:string}};scene?:NativeScene;edition?:Edition}
export interface PublicModel {model:{open:(ref:string)=>any};records:PublicRecord[];select:(ref:string,projection?:string,revision?:string)=>PublicSubject;expressions:(ref:string)=>PublicForm[];stage:(form:PublicForm,scene?:string)=>PublicStage;collections:()=>PublicResource[];search:(q?:string,collection?:string)=>PublicResource[];searchPage:(q?:string,collection?:string,page?:number)=>{items:PublicResource[];total:number;page:number;pages:number;size:number};manifestFor:(p:PublicProjection)=>PublicManifest|undefined}
export function publicationRoute(hash:string):PublicationRoute;
export function publicationHref(route?:Partial<PublicationRoute>):string;
export function isPublicationRoute(hash:string):boolean;
export function publicAssetUrl(value:unknown):string|null;
export function openPublication(seed:unknown,manifests?:PublicManifest[]):PublicModel;
