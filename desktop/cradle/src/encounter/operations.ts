/**
 * Readable operations: the owner's transcript blocks that are working material
 * rather than conversation — thinking, tool calls, consent requests, stops,
 * failures, provider notices and turn boundaries. Pure: every row is one
 * owner block, named by its kind, with the block's own text as its detail.
 * Nothing is summarised into a claim the block does not make.
 */
import type {EncounterReading} from "./client";

export type EncounterBlock=EncounterReading["blocks"][number];
export interface EncounterOperation {
 id:number;
 kind:string;
 /** What this kind of block is, in plain words. */
 label:string;
 /** A row title, not a summary: the payload's own named fields when the block
  * is a structured provider update, else the block's first non-empty line. */
 line:string;
 /** The block's verbatim text. */
 text:string;
 /** The same text laid out for reading when it is JSON; verbatim otherwise. */
 detail:string;
 /** A failure or a stop: a row the person may need to act on. */
 attention:boolean;
}

const CONVERSATIONAL=new Set(["user","assistant"]);
const LABEL:Record<string,string>={
 thinking:"Thinking",
 tool:"Tool activity",
 permission:"Provider consent",
 "provider-notice":"Provider notice",
 error:"Provider turn failed",
 cancelled:"Stopped",
 completed:"Turn completed",
};
export const operationLabel=(kind:string)=>LABEL[kind]??"Provider report";
export const isOperation=(block:EncounterBlock)=>!CONVERSATIONAL.has(block.kind);

function firstLine(text:string):string {
 const line=text.split("\n").map(part=>part.trim()).find(Boolean)??"";
 return line.length>96?`${line.slice(0,95)}…`:line;
}
const clip=(line:string)=>line.length>96?`${line.slice(0,95)}…`:line;
const text=(value:unknown)=>typeof value==="string"&&value.trim()?value.trim():undefined;
/** A structured provider update (an ACP `sessionUpdate` object) read through
 * the fields it actually carries — title, kind, first location, status, call
 * id. Nothing is inferred: a payload with none of them keeps its first line. */
function readable(raw:string):{line?:string;detail:string} {
 const trimmed=raw.trim();
 if(!trimmed.startsWith("{")&&!trimmed.startsWith("["))return {detail:raw};
 let value:unknown;try{value=JSON.parse(trimmed);}catch{return {detail:raw};}
 const detail=JSON.stringify(value,null,2);
 if(!value||typeof value!=="object"||Array.isArray(value))return {detail};
 const fields=value as Record<string,unknown>;
 const locations=Array.isArray(fields.locations)?fields.locations:[];
 const path=text((locations[0] as {path?:unknown}|undefined)?.path);
 const title=text(fields.title);
 const parts=[title,!title?text(fields.kind):undefined,path&&!title?.includes(path)?path:undefined,text(fields.status),!title&&!path?text(fields.toolCallId):undefined].filter((part):part is string=>!!part);
 return {line:parts.length?clip(parts.join(" · ")):undefined,detail};
}
/** The page's operations, newest first. */
export function operationsOf(blocks:EncounterBlock[]|undefined):EncounterOperation[] {
 if(!blocks)return [];
 return blocks.filter(isOperation).map(block=>{const read=readable(block.text);return {id:block.id,kind:block.kind,label:operationLabel(block.kind),line:read.line??firstLine(block.text),text:block.text,detail:read.detail,attention:block.kind==="error"||block.kind==="cancelled"};}).reverse();
}
