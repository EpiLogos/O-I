import {paintPaper} from './paper';
import {Scene,TextLayer} from './model.js';
/** A transition frame. `painted` (E11) marks a canvas that already holds the whole blend for its kind (dip to colour,
 * wipe): it composites at full alpha with no crossfade fill, so the capture honours the kind shown on screen. */
export interface CaptureTransition {canvas:HTMLCanvasElement;alpha:number;background:string;painted?:boolean}
export interface CaptureSettings {includeText:boolean;transparent:boolean;width:number;aspect:'stage'|'16:9'|'1:1'|'9:16';fps:number}
export const defaultCapture=():CaptureSettings=>({includeText:true,transparent:false,width:1440,aspect:'stage',fps:30});
export function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
export function slug(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'field-study';}
export function textLayout(t:TextLayer,w:number,h:number){const mobile=w<761;const width=Math.min(t.width,w*(mobile?.65:w<1051?.32:.45));const size=mobile?Math.min(36,t.size):w<1051?Math.min(38,t.size):t.size;return {x:t.x*w,y:t.y*h,width,size,kicker:mobile?7:8,kickerGap:mobile?18:25,titleGap:mobile?18:26,body:mobile?10:11};}
function wrap(ctx:CanvasRenderingContext2D,value:string,width:number){const lines:string[]=[];for(const para of value.split('\n')){let line='';for(const word of para.split(' ')){const test=line?line+' '+word:word;if(line&&ctx.measureText(test).width>width){lines.push(line);line=word;}else line=test;}lines.push(line);}return lines;}
export function paintText(ctx:CanvasRenderingContext2D,s:Scene,w:number,h:number){const col=s.field.palette[0];for(const t of s.text){if(!t.visible)continue;const l=textLayout(t,w,h);let y=l.y;const align=t.align,anchor=align==='center'?l.x+l.width/2:align==='right'?l.x+l.width:l.x;ctx.save();ctx.fillStyle=col;ctx.textBaseline='top';ctx.textAlign=align;
 ctx.globalAlpha=.65;ctx.font=`${l.kicker}px Arial`;if(align==='left'){ctx.fillRect(l.x,y+5,18,1);ctx.fillText(t.kicker,anchor+27,y);}else ctx.fillText(t.kicker,anchor,y);y+=l.kicker*1.5+l.kickerGap;
 ctx.globalAlpha=1;ctx.font=`${l.size}px Georgia`;if('letterSpacing'in ctx)ctx.letterSpacing=`${-l.size*.054}px`;
 for(const line of wrap(ctx,t.title,l.width)){ctx.fillText(line,anchor,y);y+=l.size*1.08;}ctx.font=`italic ${l.size}px Georgia`;for(const line of wrap(ctx,t.italic,l.width)){if(line){ctx.fillText(line,anchor,y);y+=l.size*1.08;}}
 y+=l.titleGap;if('letterSpacing'in ctx)ctx.letterSpacing='0px';ctx.font=`${l.body}px Arial`;ctx.globalAlpha=.65;for(const line of wrap(ctx,t.body,Math.min(l.width,230))){ctx.fillText(line,anchor,y);y+=l.body*1.85;}ctx.restore();}}
export function createOutput(settings:CaptureSettings,w:number,h:number){const c=document.createElement('canvas');const aspect=settings.aspect==='stage'?w/h:settings.aspect==='16:9'?16/9:settings.aspect==='1:1'?1:9/16;const width=settings.aspect==='9:16'?Math.round(settings.width*9/16):settings.width;c.width=Math.round(width);c.height=Math.round(width/aspect);return c;}
/** A fixed output frame. The editor, guides, selection and cursor never enter this path. */
export function paintCapture(out:HTMLCanvasElement,field:HTMLCanvasElement,s:Scene,settings:CaptureSettings,w:number,h:number,transition?:CaptureTransition){const ctx=out.getContext('2d')!;ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.clearRect(0,0,out.width,out.height);if(!settings.transparent){const sc=Math.max(out.width/w,out.height/h);ctx.save();ctx.translate((out.width-w*sc)/2,(out.height-h*sc)/2);ctx.scale(sc,sc);paintPaper(ctx,s,w,h);ctx.restore();}const scale=Math.max(out.width/w,out.height/h),dx=(out.width-w*scale)/2,dy=(out.height-h*scale)/2;ctx.save();ctx.translate(dx,dy);ctx.scale(scale,scale);if(transition&&settings.transparent&&!transition.painted)ctx.globalAlpha=1-transition.alpha;ctx.drawImage(field,0,0,w,h);if(transition){ctx.globalAlpha=transition.alpha;if(!settings.transparent&&!transition.painted){ctx.fillStyle=transition.background;ctx.fillRect(0,0,w,h);}ctx.drawImage(transition.canvas,0,0,w,h);}ctx.globalAlpha=1;if(settings.includeText)paintText(ctx,s,w,h);ctx.restore();}
/** The native engine has already rendered the field at this exact output resolution. */
export function paintNativeCapture(out:HTMLCanvasElement,pixels:HTMLCanvasElement,s:Scene,settings:CaptureSettings,w:number,h:number){
 const ctx=out.getContext('2d')!;ctx.clearRect(0,0,out.width,out.height);const scale=Math.max(out.width/w,out.height/h),dx=(out.width-w*scale)/2,dy=(out.height-h*scale)/2;
 if(!settings.transparent){ctx.save();ctx.translate(dx,dy);ctx.scale(scale,scale);paintPaper(ctx,s,w,h);ctx.restore();}
 ctx.drawImage(pixels,0,0);if(settings.includeText){ctx.save();ctx.translate(dx,dy);ctx.scale(scale,scale);paintText(ctx,s,w,h);ctx.restore();}
}
/** What a render was made from (manual §20.1 Export: "A picture or a film is a render: it names the Expression it was made from and can be
 * remade from it"; O-I #747 XT13): the Expression and the scene by name, and — where the Expression is native — their refs at the revision
 * the render was taken from, which a Remake reads again. */
export interface RenderSource {schema:'oi.render-source/v1';expression:string;scene:string;expression_ref?:string;revision?:number;scene_ref?:string;
 /** A film's: how long it plays, which a Remake records again from its scene (O-I #747 round 891). */
 seconds?:number}
/** The PNG text keyword that carries a picture's RenderSource. */
export const MADE_FROM_KEY='oi:made-from';
const PNG_SIGNATURE=[137,80,78,71,13,10,26,10];
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(bytes:Uint8Array):number{let c=0xffffffff;for(const b of bytes)c=CRC_TABLE[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
/** One iTXt chunk (PNG 1.2 §11.3.4.5): an uncompressed UTF-8 text under a Latin-1 keyword, no language tag. */
function itxtChunk(keyword:string,text:string):Uint8Array{
 const enc=new TextEncoder(),key=enc.encode(keyword),body=enc.encode(text);
 const data=new Uint8Array(key.length+5+body.length);data.set(key,0);data.set(body,key.length+5);
 const chunk=new Uint8Array(12+data.length),view=new DataView(chunk.buffer);view.setUint32(0,data.length);chunk.set(enc.encode('iTXt'),4);chunk.set(data,8);
 view.setUint32(8+data.length,crc32(chunk.subarray(4,8+data.length)));return chunk;
}
/** The picture with what it was made from written into it, before its end: a Title naming the scene and the Expression, and
 * `oi:made-from`, the RenderSource as JSON. The image's own chunks are untouched. Pure; refuses bytes that are not a PNG. */
export function pngWithMadeFrom(bytes:Uint8Array,source:RenderSource):Uint8Array{
 if(bytes.length<20||PNG_SIGNATURE.some((b,i)=>bytes[i]!==b))throw new Error('The captured frame is not a PNG, so it cannot name what it was made from.');
 const end=bytes.length-12,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(end)!==0||String.fromCharCode(...bytes.subarray(end+4,end+8))!=='IEND')throw new Error('The captured frame is not a PNG, so it cannot name what it was made from.');
 const text=[itxtChunk('Title',`${source.scene} · ${source.expression}`),itxtChunk(MADE_FROM_KEY,JSON.stringify(source))];
 const out=new Uint8Array(bytes.length+text.reduce((n,c)=>n+c.length,0));out.set(bytes.subarray(0,end),0);let at=end;
 for(const c of text){out.set(c,at);at+=c.length;}out.set(bytes.subarray(end),at);return out;
}
/** The encoded picture, naming what it was made from (pngWithMadeFrom). */
export async function namedPicture(blob:Blob,source:RenderSource):Promise<Blob>{
 const named=pngWithMadeFrom(new Uint8Array(await blob.arrayBuffer()),source);
 return new Blob([named.buffer.slice(named.byteOffset,named.byteOffset+named.byteLength) as ArrayBuffer],{type:'image/png'});
}
// ── A film names what it was made from (O-I #747 round 891, XT12/XT14) ──
// Each container keeps the RenderSource in its own text, where its readers look: WebM a Matroska Tags element before the first Cluster
// (TITLE and `oi:made-from`), MP4 iTunes-style metadata in moov/udta/meta (©nam and a freeform `oi:made-from`). Nothing a player reads
// moves: every position that pointed past the insertion is moved with it, or the film is refused, never written wrong.
const enc=new TextEncoder(),dec=new TextDecoder();
const unnamed=(why:string)=>new Error(`The film cannot name what it was made from: ${why}.`);
const titleOf=(source:RenderSource)=>`${source.scene} · ${source.expression}`;
function concat(parts:Uint8Array[]):Uint8Array{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
function readUint(b:Uint8Array,at:number,len:number):number{let v=0;for(let i=0;i<len;i++)v=v*256+b[at+i];return v;}
function writeUint(b:Uint8Array,at:number,len:number,value:number){if(value>=2**(8*len))throw unnamed('a position no longer fits the width it was written in');for(let i=len-1;i>=0;i--){b[at+i]=value%256;value=Math.floor(value/256);}}
// EBML (RFC 8794): an element is its ID, its size as a variable-length integer (all ones: unknown), and its data.
const EBML={header:0x1A45DFA3,segment:0x18538067,seekHead:0x114D9B74,seek:0x4DBB,seekPosition:0x53AC,info:0x1549A966,tracks:0x1654AE6B,cluster:0x1F43B675,
 cues:0x1C53BB6B,cuePoint:0xBB,cueTrackPositions:0xB7,cueClusterPosition:0xF1,tags:0x1254C367,tag:0x7373,targets:0x63C0,simpleTag:0x67C8,tagName:0x45A3,
 tagString:0x4487,chapters:0x1043A770,attachments:0x1941A469};
const SEGMENT_CHILDREN=new Set([EBML.seekHead,EBML.info,EBML.tracks,EBML.cluster,EBML.cues,EBML.tags,EBML.chapters,EBML.attachments]);
interface EbmlElement {id:number;at:number;sizeAt:number;sizeWidth:number;size:number|null;data:number;end:number}
function ebmlAt(b:Uint8Array,at:number,limit:number):EbmlElement{
 const first=b[at],idWidth=first&0x80?1:first&0x40?2:first&0x20?3:first&0x10?4:0;if(!idWidth||at+idWidth>limit)throw unnamed('its WebM structure does not read');
 const sizeAt=at+idWidth,lead=b[sizeAt];let w=1;while(w<=8&&!(lead&(0x80>>(w-1))))w++;if(w>8||sizeAt+w>limit)throw unnamed('its WebM structure does not read');
 let size=lead&((0x80>>(w-1))-1),unknown=size===(0x80>>(w-1))-1;for(let i=1;i<w;i++){size=size*256+b[sizeAt+i];if(b[sizeAt+i]!==0xff)unknown=false;}
 const data=sizeAt+w,end=unknown?limit:data+size;if(end>limit)throw unnamed('its WebM structure does not read');
 return {id:readUint(b,at,idWidth),at,sizeAt,sizeWidth:w,size:unknown?null:size,data,end};
}
function ebmlChildren(b:Uint8Array,start:number,end:number):EbmlElement[]{const rows:EbmlElement[]=[];for(let at=start;at<end;){const row=ebmlAt(b,at,end);rows.push(row);at=row.end;}return rows;}
/** The Segment and its top-level elements; an unknown-size element (a live Cluster) ends where the next top-level element begins. */
function webmSegment(b:Uint8Array){
 const head=ebmlAt(b,0,b.length);if(head.id!==EBML.header||head.size===null)throw unnamed('it is not a WebM or MP4 file');
 const segment=ebmlAt(b,head.end,b.length);if(segment.id!==EBML.segment)throw unnamed('it is not a WebM or MP4 file');
 const rows:EbmlElement[]=[];
 for(let at=segment.data;at<segment.end;){const row=ebmlAt(b,at,segment.end);
  if(row.size===null){let c=row.data;while(c<segment.end){const child=ebmlAt(b,c,segment.end);if(SEGMENT_CHILDREN.has(child.id)||child.size===null)break;c=child.end;}row.end=c;}
  rows.push(row);at=row.end;}
 return {segment,rows};
}
function ebmlSize(n:number):Uint8Array{const w=[1,2,3,4,5,6,7,8].find(k=>n<2**(7*k)-1)!;const b=new Uint8Array(w);writeUint(b,0,w,n);b[0]|=0x80>>(w-1);return b;}
function ebmlElement(id:number,...parts:Uint8Array[]):Uint8Array{const data=concat(parts),idBytes=new Uint8Array(id>0xffffff?4:id>0xffff?3:id>0xff?2:1);writeUint(idBytes,0,idBytes.length,id);return concat([idBytes,ebmlSize(data.length),data]);}
const simpleTag=(name:string,text:string)=>ebmlElement(EBML.simpleTag,ebmlElement(EBML.tagName,enc.encode(name)),ebmlElement(EBML.tagString,enc.encode(text)));
function webmWithMadeFrom(b:Uint8Array,source:RenderSource):Uint8Array{
 const {segment,rows}=webmSegment(b);if(rows.some(row=>row.id===EBML.tags))throw unnamed('it already names what it was made from; a render is never edited in place, it is made again');
 const tags=ebmlElement(EBML.tags,ebmlElement(EBML.tag,ebmlElement(EBML.targets),simpleTag('TITLE',titleOf(source)),simpleTag(MADE_FROM_KEY,JSON.stringify(source))));
 const cluster=rows.find(row=>row.id===EBML.cluster),insert=cluster?cluster.at:segment.end,delta=tags.length,moved=insert-segment.data,out=new Uint8Array(b);
 // Positions are counted from the Segment's data: a SeekHead's and the Cues' that point past the Tags move with what they point at.
 const shift=(element:EbmlElement)=>{const value=readUint(out,element.data,element.end-element.data);if(value>=moved)writeUint(out,element.data,element.end-element.data,value+delta);};
 for(const row of rows){
  if(row.id===EBML.seekHead)for(const seek of ebmlChildren(b,row.data,row.end))if(seek.id===EBML.seek)for(const k of ebmlChildren(b,seek.data,seek.end))if(k.id===EBML.seekPosition)shift(k);
  if(row.id===EBML.cues)for(const point of ebmlChildren(b,row.data,row.end))if(point.id===EBML.cuePoint)for(const t of ebmlChildren(b,point.data,point.end))if(t.id===EBML.cueTrackPositions)for(const k of ebmlChildren(b,t.data,t.end))if(k.id===EBML.cueClusterPosition)shift(k);
 }
 if(segment.size!==null){if(segment.size+delta>=2**(7*segment.sizeWidth)-1)throw unnamed('its Segment\'s size no longer fits the width it was written in');writeUint(out,segment.sizeAt,segment.sizeWidth,segment.size+delta);out[segment.sizeAt]|=0x80>>(segment.sizeWidth-1);}
 return concat([out.subarray(0,insert),tags,out.subarray(insert)]);
}
// ISO BMFF (ISO/IEC 14496-12): a box is its size, its type and its data; a FullBox's data begins with its version and flags.
interface Mp4Box {type:string;at:number;head:number;data:number;end:number}
const MP4_CONTAINERS=new Set(['moov','trak','mdia','minf','stbl','edts','dinf','mvex','udta','moof','traf','mfra']);
function mp4Boxes(b:Uint8Array,start:number,end:number):Mp4Box[]{
 const rows:Mp4Box[]=[];
 for(let at=start;at+8<=end;){let size=readUint(b,at,4),head=8;if(size===1){size=readUint(b,at+8,8);head=16;}else if(size===0)size=end-at;
  if(size<head||at+size>end)throw unnamed('its MP4 structure does not read');rows.push({type:String.fromCharCode(...b.subarray(at+4,at+8)),at,head,data:at+head,end:at+size});at+=size;}
 return rows;
}
const latin1=(text:string)=>Uint8Array.from(text,c=>c.charCodeAt(0));
function mp4Box(type:string,...parts:Uint8Array[]):Uint8Array{const data=concat(parts),out=new Uint8Array(8+data.length);writeUint(out,0,4,out.length);out.set(latin1(type),4);out.set(data,8);return out;}
const fullBox=(type:string,...parts:Uint8Array[])=>mp4Box(type,new Uint8Array(4),...parts);
const u32=(n:number)=>{const b=new Uint8Array(4);writeUint(b,0,4,n);return b;};
const utf8Data=(text:string)=>mp4Box('data',u32(1),u32(0),enc.encode(text));
function mp4WithMadeFrom(b:Uint8Array,source:RenderSource):Uint8Array{
 const top=mp4Boxes(b,0,b.length),moov=top.find(row=>row.type==='moov');if(!moov)throw unnamed('its MP4 has no movie header');
 const udta=mp4Boxes(b,moov.data,moov.end).find(row=>row.type==='udta');
 if(udta&&mp4Boxes(b,udta.data,udta.end).some(row=>row.type==='meta'))throw unnamed('it already names what it was made from; a render is never edited in place, it is made again');
 const meta=fullBox('meta',fullBox('hdlr',u32(0),latin1('mdir'),latin1('appl'),u32(0),u32(0),new Uint8Array(1)),
  mp4Box('ilst',mp4Box('\u00a9nam',utf8Data(titleOf(source))),mp4Box('----',fullBox('mean',enc.encode('com.epilogos.oi')),fullBox('name',enc.encode(MADE_FROM_KEY)),utf8Data(JSON.stringify(source)))));
 const added=udta?meta:mp4Box('udta',meta),insert=udta?udta.end:moov.end,delta=added.length,out=new Uint8Array(b);
 const grow=(box:Mp4Box)=>{if(box.head===16)writeUint(out,box.at+8,8,box.end-box.at+delta);else writeUint(out,box.at,4,box.end-box.at+delta);};
 grow(moov);if(udta)grow(udta);
 // Offsets counted from the file's start move with what they point at: chunk offsets, a fragment's base-data-offset, a random-access entry.
 const shift=(at:number,len:number)=>{const value=readUint(out,at,len);if(value>=insert)writeUint(out,at,len,value+delta);};
 const visit=(rows:Mp4Box[])=>{for(const row of rows){
  if(MP4_CONTAINERS.has(row.type))visit(mp4Boxes(b,row.data,row.end));
  else if(row.type==='stco'||row.type==='co64'){const len=row.type==='stco'?4:8,count=readUint(b,row.data+4,4);for(let i=0;i<count;i++)shift(row.data+8+i*len,len);}
  else if(row.type==='tfhd'&&(readUint(b,row.data+1,3)&1))shift(row.data+8,8);
  else if(row.type==='tfra'){const version=b[row.data],len=version===1?8:4,sizes=readUint(b,row.data+8,4),count=readUint(b,row.data+12,4);
   const entry=2*len+((sizes>>4)&3)+1+((sizes>>2)&3)+1+(sizes&3)+1;for(let i=0;i<count;i++)shift(row.data+16+i*entry+len,len);}
 }};
 visit(top);
 return concat([out.subarray(0,insert),added,out.subarray(insert)]);
}
const isWebm=(b:Uint8Array)=>b.length>4&&readUint(b,0,4)===EBML.header;
const isMp4=(b:Uint8Array)=>b.length>12&&String.fromCharCode(...b.subarray(4,8))==='ftyp';
/** The film with what it was made from written into it (WebM or MP4, as the browser recorded it). Pure; refuses any other bytes, and a film
 * that already names its source: a render is never edited in place. */
export function filmWithMadeFrom(bytes:Uint8Array,source:RenderSource):Uint8Array{
 if(isWebm(bytes))return webmWithMadeFrom(bytes,source);
 if(isMp4(bytes))return mp4WithMadeFrom(bytes,source);
 throw unnamed('it is not a WebM or MP4 file');
}
/** The recorded film, naming what it was made from (filmWithMadeFrom). */
export async function namedFilm(blob:Blob,source:RenderSource):Promise<Blob>{
 const named=filmWithMadeFrom(new Uint8Array(await blob.arrayBuffer()),source);
 return new Blob([named.buffer.slice(named.byteOffset,named.byteOffset+named.byteLength) as ArrayBuffer],{type:blob.type});
}
function renderSourceFrom(text:string|null):RenderSource|null{
 if(text===null)return null;let v:any;try{v=JSON.parse(text);}catch{return null;}
 const optional=(key:string,type:string)=>v[key]===undefined||typeof v[key]===type;
 return v&&typeof v==='object'&&v.schema==='oi.render-source/v1'&&typeof v.expression==='string'&&typeof v.scene==='string'&&optional('expression_ref','string')
  &&optional('revision','number')&&optional('scene_ref','string')&&optional('seconds','number')?v as RenderSource:null;
}
function pngMadeFrom(b:Uint8Array):string|null{
 for(let at=8;at+12<=b.length;){const length=readUint(b,at,4),type=String.fromCharCode(...b.subarray(at+4,at+8)),data=b.subarray(at+8,at+8+length);
  if(type==='iTXt'){const nul=data.indexOf(0);if(String.fromCharCode(...data.subarray(0,nul))===MADE_FROM_KEY&&data[nul+1]===0){const lang=data.indexOf(0,nul+3),translated=data.indexOf(0,lang+1);return dec.decode(data.subarray(translated+1));}}
  at+=12+length;}
 return null;
}
function webmMadeFrom(b:Uint8Array):string|null{
 const tags=webmSegment(b).rows.find(row=>row.id===EBML.tags);if(!tags)return null;
 for(const tag of ebmlChildren(b,tags.data,tags.end))if(tag.id===EBML.tag)for(const st of ebmlChildren(b,tag.data,tag.end))if(st.id===EBML.simpleTag){
  const kids=ebmlChildren(b,st.data,st.end),text=(id:number)=>{const k=kids.find(row=>row.id===id);return k?dec.decode(b.subarray(k.data,k.end)):null;};
  if(text(EBML.tagName)===MADE_FROM_KEY)return text(EBML.tagString);}
 return null;
}
function mp4MadeFrom(b:Uint8Array):string|null{
 const child=(rows:Mp4Box[],type:string)=>rows.find(row=>row.type===type);
 const moov=child(mp4Boxes(b,0,b.length),'moov'),udta=moov&&child(mp4Boxes(b,moov.data,moov.end),'udta'),meta=udta&&child(mp4Boxes(b,udta.data,udta.end),'meta');
 const ilst=meta&&child(mp4Boxes(b,meta.data+4,meta.end),'ilst');if(!ilst)return null;
 for(const item of mp4Boxes(b,ilst.data,ilst.end))if(item.type==='----'){const parts=mp4Boxes(b,item.data,item.end),name=child(parts,'name'),data=child(parts,'data');
  if(name&&data&&dec.decode(b.subarray(name.data+4,name.end))===MADE_FROM_KEY)return dec.decode(b.subarray(data.data+8,data.end));}
 return null;
}
/** What a picture or a film says it was made from — what Remake reads again — or null for a file that names nothing (or is no render). */
export function madeFromOf(bytes:Uint8Array):{kind:'picture'|'film';source:RenderSource}|null{
 try{
  if(bytes.length>8&&PNG_SIGNATURE.every((v,i)=>bytes[i]===v)){const source=renderSourceFrom(pngMadeFrom(bytes));return source?{kind:'picture',source}:null;}
  if(isWebm(bytes)||isMp4(bytes)){const source=renderSourceFrom(isWebm(bytes)?webmMadeFrom(bytes):mp4MadeFrom(bytes));return source?{kind:'film',source}:null;}
 }catch{return null;}
 return null;
}
/** Where a render's source stands now, as the render law reads it (live-shell/ui frame/detail/remake.ts sourceStanding: one law): `now` is
 * the Expression the field holds open, with its revision and its scenes' refs, or null where none is. Only the Expression a render names
 * can say where its source stands; a working draft named none. */
export type RenderStanding='current'|'moved'|'missing'|'unread';
export function renderStandingOf(source:RenderSource,now:{expression_ref:string;revision:number;scene_refs:readonly string[]}|null):{standing:RenderStanding;why:string}{
 if(!source.expression_ref||source.revision===undefined)return {standing:'unread',why:`It was made from ${source.expression} as a working draft, which names no Expression to read again.`};
 if(!now||now.expression_ref!==source.expression_ref)return {standing:'unread',why:`It was made from ${source.expression}. Open that Expression, then choose the render again: Remake reads it there.`};
 if(source.scene_ref&&!now.scene_refs.includes(source.scene_ref))return {standing:'missing',why:`Its scene, ${source.scene}, is gone from ${source.expression}, so there is nothing to make it again from.`};
 return now.revision===source.revision
  ?{standing:'current',why:`${source.expression} stands as it did when this was made (revision ${source.revision}). Remake makes it again all the same.`}
  :{standing:'moved',why:`${source.expression} has moved since this was made: revision ${source.revision} then, ${now.revision} now. Remake makes it again from the Expression as it now stands.`};
}
/** The render law's words, for a picture or a film (frame/detail/remake.ts standingMark, remakeDoes, remadeNote). */
export const renderMark=(standing:RenderStanding)=>standing==='moved'||standing==='missing'?`source ${standing}`:null;
export const remakeRenderDoes=(kind:'picture'|'film')=>`Makes the ${kind} again from the Expression it names, as that Expression now stands. A render is never edited in place.`;
export const remadeRenderNote=(kind:'picture'|'film',moved:boolean)=>`The ${kind} was made again from its Expression, which had ${moved?'':'not '}moved.`;
/** A file Import should read as a render, not as an Expression's JSON. */
export const isRenderFile=(file:{type:string;name:string})=>/^(image\/png|video\/(webm|mp4))/.test(file.type)||/\.(png|webm|mp4)$/i.test(file.name);
export function png(canvas:HTMLCanvasElement):Promise<Blob>{return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('The browser could not encode the captured frame.')),'image/png'));}
export class LiveRecorder {
 private recorder:MediaRecorder|null=null;private output:HTMLCanvasElement|null=null;private stream:MediaStream|null=null;private chunks:Blob[]=[];private bytes=0;private lastFrame=0;private startTime=0;private settings:CaptureSettings|null=null;private sourceWidth=0;private sourceHeight=0;
 onStop:(blob:Blob,mime:string)=>void=()=>{};onError:(error:Error)=>void=()=>{};onLimit:(message:string)=>void=()=>{};
 get active(){return this.recorder?.state==='recording';}get elapsed(){return this.active?(performance.now()-this.startTime)/1000:0;}
 start(field:HTMLCanvasElement,s:Scene,settings:CaptureSettings,w:number,h:number,transition?:CaptureTransition){if(this.active)throw new Error('A recording is already running.');if(typeof MediaRecorder==='undefined'||!HTMLCanvasElement.prototype.captureStream)throw new Error('Live recording is not supported in this browser. PNG and portable journeys are still available.');
 const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4;codecs=avc1.42E01E','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw new Error('No compatible browser video encoder was found.');
 this.settings={...settings,transparent:false};this.sourceWidth=w;this.sourceHeight=h;this.output=createOutput(this.settings,w,h);paintCapture(this.output,field,s,this.settings,w,h,transition);this.stream=this.output.captureStream(settings.fps);this.chunks=[];this.bytes=0;const rec=new MediaRecorder(this.stream,{mimeType:mime,videoBitsPerSecond:Math.min(18000000,this.output.width*this.output.height*6)});this.recorder=rec;
 rec.ondataavailable=e=>{if(e.data.size){this.chunks.push(e.data);this.bytes+=e.data.size;if(this.bytes>128*1024*1024&&rec.state==='recording'){this.onLimit('Recording stopped at the 128 MB in-memory safety limit.');rec.stop();}}};
 rec.onerror=()=>{this.cleanup();this.onError(new Error('The browser video encoder failed.'));};
 rec.onstop=()=>{const blob=new Blob(this.chunks,{type:rec.mimeType||mime});this.cleanup();this.onStop(blob,rec.mimeType||mime);};
 this.startTime=performance.now();this.lastFrame=0;rec.start(1000);
 }
 frame(field:HTMLCanvasElement,s:Scene,w:number,h:number,transition?:CaptureTransition){if(!this.active||!this.output||!this.settings)return;const now=performance.now();if(now-this.startTime>=120000){this.onLimit('Recording stopped at the two-minute memory safety limit.');this.stop();return;}if(now-this.lastFrame<1000/this.settings.fps)return;this.lastFrame=now;paintCapture(this.output,field,s,this.settings,w,h,transition);}
 stop(){if(this.recorder?.state==='recording')this.recorder.stop();}
 private cleanup(){this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.recorder=null;this.output=null;this.settings=null;this.chunks=[];}
}
