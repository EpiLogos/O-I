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
export interface RenderSource {schema:'oi.render-source/v1';expression:string;scene:string;expression_ref?:string;revision?:number;scene_ref?:string}
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
