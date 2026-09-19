import {paintPaper} from './paper';
import {Scene,TextLayer} from './model.js';
export interface CaptureTransition {canvas:HTMLCanvasElement;alpha:number;background:string}
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
export function paintCapture(out:HTMLCanvasElement,field:HTMLCanvasElement,s:Scene,settings:CaptureSettings,w:number,h:number,transition?:CaptureTransition){const ctx=out.getContext('2d')!;ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.clearRect(0,0,out.width,out.height);if(!settings.transparent){const sc=Math.max(out.width/w,out.height/h);ctx.save();ctx.translate((out.width-w*sc)/2,(out.height-h*sc)/2);ctx.scale(sc,sc);paintPaper(ctx,s,w,h);ctx.restore();}const scale=Math.max(out.width/w,out.height/h),dx=(out.width-w*scale)/2,dy=(out.height-h*scale)/2;ctx.save();ctx.translate(dx,dy);ctx.scale(scale,scale);if(transition&&settings.transparent)ctx.globalAlpha=1-transition.alpha;ctx.drawImage(field,0,0,w,h);if(transition){ctx.globalAlpha=transition.alpha;if(!settings.transparent){ctx.fillStyle=transition.background;ctx.fillRect(0,0,w,h);}ctx.drawImage(transition.canvas,0,0,w,h);}ctx.globalAlpha=1;if(settings.includeText)paintText(ctx,s,w,h);ctx.restore();}
/** The native engine has already rendered the field at this exact output resolution. */
export function paintNativeCapture(out:HTMLCanvasElement,pixels:HTMLCanvasElement,s:Scene,settings:CaptureSettings,w:number,h:number){
 const ctx=out.getContext('2d')!;ctx.clearRect(0,0,out.width,out.height);const scale=Math.max(out.width/w,out.height/h),dx=(out.width-w*scale)/2,dy=(out.height-h*scale)/2;
 if(!settings.transparent){ctx.save();ctx.translate(dx,dy);ctx.scale(scale,scale);paintPaper(ctx,s,w,h);ctx.restore();}
 ctx.drawImage(pixels,0,0);if(settings.includeText){ctx.save();ctx.translate(dx,dy);ctx.scale(scale,scale);paintText(ctx,s,w,h);ctx.restore();}
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
