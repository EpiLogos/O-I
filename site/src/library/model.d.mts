export type Route={id:string;scene:string;edition:string;subject:string;face:'face'|'verso'|'full'|'detached';q:string;collection:string;view:'gallery'|'rows'};
export interface LibraryEntry {id:string;title:string;summary:string;collection:string;kind:string;standing:string;expression_ref:string;revision:number;source_revision:string;source_ref:string;source_location:string;url:string;scenes:{ref:string;title:string;subject_ref:string}[];cover:{glyph:string;x:number;y:number;scale:number}[];search:string}
export interface Reading {subject_ref:string;title:string;body:string;source_ref:string;source_revision:string;source_url:string|null;source_path:string;source_heading:string}
export interface NativeEntity {entity_ref:string;title:string;subject:{subject_ref:string;native_owner:string;sources:{ref:string;revision:string;availability:string}[]}|null;parameters:Record<string,{value:string|number;automation:null|{min:number;max:number;rate_hz:number;waveform:string}}>} 
export interface NativeScene {scene_ref:string;revision:number;title:string;entity_refs:string[]}
export interface NativeBodyDescriptor {schema:'oi.native-expression-body/v1';source_schema:'oi.journey';path:string;expression_ref:string;expression_revision:number;source_path:string;source_revision:string;digest:{algorithm:'sha256';value:string};scene_map:Record<string,string>;entity_map:Record<string,string>}
export interface Edition {entry:LibraryEntry;native_body?:NativeBodyDescriptor|null;publication:{schema:string;expression_ref:string;expression_revision:number;composition:{expression_ref:string;revision:number;title:string;scenes:NativeScene[];entities:Record<string,NativeEntity>;relations:Record<string,{binding_ref:string;relation:{ref:string;revision:string;availability:string};from_entity_ref:string;to_entity_ref:string;provenance:unknown[]}>;selection:{scene_ref:string;entity_ref:string|null}};expression:Record<string,unknown>;presentation:Record<string,unknown>;projection:Record<string,unknown>};readings:Record<string,Reading>;source_basis:{commit:string;revision:string;path:string};standing:string}
export const COLLECTIONS:string[];
export function parseRoute(hash:string):Route;
export function routeHref(route:Partial<Route>):string;
export function sceneCapacity(width:number,total:number):number;
export function filterEntries(entries:LibraryEntry[],q?:string,collection?:string):LibraryEntry[];
export function safeUrl(value:unknown,base?:string):string|null;
export function readIndex(value:unknown):{schema:string;source_revision:string;entries:LibraryEntry[]};
export function readEdition(value:unknown,entry:LibraryEntry):Edition;
export function exactScene(edition:Edition,ref:string):NativeScene;
export function readPosition(storage:Storage,key:string):unknown;
export function writePosition(storage:Storage,key:string,value:unknown):boolean;
