/** lane-1 A10 — embed and media cards on the Research Canvas. An embed card
 * stores the https address it was given, never a fetched copy. A media card
 * stores a reference to a possessed Central file (a path reference); its bytes
 * stay with the owner and are read only through the native material protocol.
 * Both are presentation records in `oi.research-scene/v1`; the kernel
 * validates the same closed rules (expression_scene.rs). Pure rules and
 * geometry; the instrument draws the cards. */

export const EMBED_URL_MAX=2048;
export const MEDIA_FIELD_MAX=1024;
export const CENTRAL_PATH_REF_SCHEMA='central.path-ref/v1';
const PATH_REF_KEYS=['schema','ref','root','path'];
/** The Central file a media card names (the same shape the native location carries). */
export interface CentralPathRef {schema:'central.path-ref/v1';ref:string;root:string;path:string}
/** Card sizes given at creation, in canvas display units (the card's `size`). */
export const EMBED_CARD_SIZE={width:320,height:200};
export const MEDIA_CARD_SIZE={width:280,height:200};
/** An https address with a host, no userinfo, and no whitespace or control characters. */
const HTTPS_LINK=/^https:\/\/[^\s\/?#@\x00-\x1f\x7f-\x9f\u0085]+(?:[\/?#][^\s\x00-\x1f\x7f-\x9f\u0085]*)?$/;

/** The stored form of an embed address: trimmed, bounded, https only. Null when refused. */
export function embedUrlRecord(input:unknown):string|null{
 if(typeof input!=='string')return null;
 const trimmed=input.trim();
 return trimmed.length<=EMBED_URL_MAX&&HTTPS_LINK.test(trimmed)?trimmed:null;
}

/** The host an embed address names, for its label. Empty when the address does not parse. */
export function embedHost(url:string):string{
 try{return new URL(url).host;}catch{return '';}
}

/** A closed path reference: exactly the four keys, the schema literal, and bounded non-empty text fields. */
export function isCentralPathRef(value:unknown):value is CentralPathRef{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const record=value as Record<string,unknown>;
 if(Object.keys(record).length!==PATH_REF_KEYS.length||!PATH_REF_KEYS.every(key=>Object.prototype.hasOwnProperty.call(record,key)))return false;
 if(record.schema!==CENTRAL_PATH_REF_SCHEMA)return false;
 return ['ref','root','path'].every(key=>typeof record[key]==='string'&&(record[key] as string).length>0&&(record[key] as string).length<=MEDIA_FIELD_MAX);
}

/** The material protocol address of a possessed file: the same form the native material surface reads. */
export function mediaSourceUrl(location:CentralPathRef):string{
 return `oi-material://localhost/${encodeURIComponent(JSON.stringify(location))}/`;
}

/** The file's own name (its last path segment), the media card's default title. */
export function mediaFileName(location:CentralPathRef):string{
 const segments=location.path.split('/').filter(Boolean);
 return segments[segments.length-1]??location.path;
}

/** Where a canvas card's overlay sits, in screen pixels, from its flow-unit box and the viewport. */
export function cardOverlayBox(box:{x:number;y:number;width:number;height:number},viewport:{x:number;y:number;zoom:number}):{left:number;top:number;width:number;height:number}{
 return {left:box.x*viewport.zoom+viewport.x,top:box.y*viewport.zoom+viewport.y,width:box.width*viewport.zoom,height:box.height*viewport.zoom};
}

/** The minimal card fields the canvas reads: the kind, the link, the file and the owner's caption. */
export interface EmbedCardView {type?:string;url?:unknown;media?:unknown;caption?:unknown}
/** Only embed and media cards are drawn as link or file cards; every other card passes through. */
export function isEmbedCardType(card:EmbedCardView|undefined):card is EmbedCardView&{type:'embed'|'media'}{
 return card?.type==='embed'||card?.type==='media';
}

/** The label an embed or media card shows: the owner's caption; with none, the occurrence's own name. */
export function embedCardLabel(card:EmbedCardView,fallback:string):string{
 const caption=typeof card.caption==='string'?card.caption.trim():'';
 return caption||fallback;
}

/** An embed or media card's node: a label-only text node, so the stage's own editor never opens over the link card. The card's overlay draws the rest. */
export function canvasEmbedNodes<T extends {id:string;title?:string;type?:string}>(nodes:readonly T[],cardOf:(id:string)=>EmbedCardView|undefined):T[]{
 return nodes.map(node=>{
  const card=cardOf(node.id);
  if(!isEmbedCardType(card))return node;
  return {...node,type:'text',title:embedCardLabel(card,node.title??'')} as T;
 });
}

/** The glyph of the Link tool, drawn in the 24×24 stroke grammar (a quiet chain link). */
export const EMBED_GLYPH='M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1';
