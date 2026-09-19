/** A replaceable VISUAL PREVIEW, not a fluid simulation, resonator, or Chladni solver.
 * Authored masks are appropriate here for glyph layout. They are never called cymatics.
 * No RAF, clock, document writes, storage or input listeners live in this adapter.
 */
import {EngineFrame,FieldEngineAdapter,EngineCapabilities} from './engine.js';
import {Entity,Shape,clamp} from './model.js';
import {PARAMETERS} from './registry.js';
import {basis,stageCentre,stageScale,project} from './camera.js';
import {sequenceAt,focusAt} from './timeline.js';
const VERT=`
precision highp float;
attribute vec4 a_point;
attribute vec2 a_next;
attribute float a_edge;
uniform vec2 u_resolution;
uniform vec2 u_centre;
uniform vec2 u_size;
uniform vec3 u_position;
uniform vec3 u_basisX;
uniform vec3 u_basisY;
uniform float u_scale;
uniform float u_dpr;
uniform float u_time;
uniform float u_rotation;
uniform float u_mix;
uniform vec4 u_motion;
uniform vec4 u_density;
uniform vec4 u_mark;
uniform vec4 u_geometry;
uniform vec4 u_misc;
uniform vec4 u_pointer;
uniform vec4 u_forces[16];
uniform vec4 u_forceTypes[16];
uniform float u_forceCount;
uniform vec3 u_palette[8];
uniform float u_paletteCount;
varying vec3 v_colour;
varying float v_alpha;
varying float v_seed;
void main(){
 float seed=a_point.z;vec2 l=mix(a_point.xy,a_next,u_mix);
 float cs=cos(u_rotation),sn=sin(u_rotation);vec2 local=l*u_size;
 vec3 world=vec3(local.x*cs-local.y*sn,local.x*sn+local.y*cs,0.0)+u_position;
 float t=u_time*u_motion.x;
 float wave=sin((world.x*3.4-world.y*2.85)*u_density.y+u_density.z+6.25)+.42*sin((-world.y*6.25-world.x*1.55)*u_density.y+4.0);
 float band=.028+.972*smoothstep(-.65,.8,wave);
 float alpha=mix(1.0,band,u_density.x);
 alpha=mix(alpha,alpha*.35+a_edge*.8,u_mark.w);
 world.x+=u_density.w*.11*sin(world.y*3.15+.4);
 world.y+=u_density.w*.09*sin(world.x*2.9-.2);
 float halo=step(.90,seed)*u_geometry.x*.4;
 world.xy+=vec2(sin(seed*532.2),cos(seed*367.1))*(halo+u_motion.w*.3*seed*seed);
 world.xy+=(vec2(sin(world.y*7.0*u_misc.x+t*.35+seed*5.0),cos(world.x*6.0*u_misc.x-t*.26+seed*4.0)))*(.002+u_motion.y*.004+u_motion.z*.009);
 world.xy+=vec2(sin(t*.22+seed*10.0),cos(t*.18+seed*14.0))*u_motion.w*.07;
 world.xy+=normalize(local+vec2(.0001))*u_geometry.y*.3;
 world.z+=sin(seed*782.1+t*.1)*u_misc.y*.15;
 vec2 dp=world.xy-u_pointer.xy;float distance=length(dp);float fall=exp(-distance*distance/max(.0001,u_pointer.w*u_pointer.w));
 world.xy+=normalize(dp+vec2(.0001))*fall*u_pointer.z*.10;
 for(int i=0;i<16;i++){if(float(i)>=u_forceCount)break;vec3 d3=world-vec3(u_forces[i].xy,u_forceTypes[i].z);vec2 d=d3.xy;float f=exp(-dot(d3,d3)/max(.001,u_forces[i].z*u_forces[i].z));float strength=u_forces[i].w;
  if(u_forceTypes[i].x>1.5)world.xy+=vec2(-d.y,d.x)*f*strength*.25;else world+=d3*f*strength*.16*(u_forceTypes[i].x>.5?1.0:-1.0);
  world.xy+=vec2(-d.y,d.x)*f*u_forceTypes[i].y*.12;
 }
 vec2 pixel=u_centre+vec2(dot(world,u_basisX),-dot(world,u_basisY))*u_scale;
 gl_Position=vec4(pixel.x/u_resolution.x*2.0-1.0,1.0-pixel.y/u_resolution.y*2.0,0.0,1.0);
 float radius=.9+pow(max(.001,a_point.w),u_mark.z)*5.0;
 gl_PointSize=max(.7,radius*u_mark.x*u_dpr*(1.0+u_misc.z*.5));
 v_alpha=alpha*u_mark.y*(.8+.2*seed)*(1.0-step(.90,seed)*.35);
 v_seed=seed;
 float tone=clamp((world.y+1.0)*.5,0.0,.9999)*(u_paletteCount-1.0);float segment=floor(tone);v_colour=u_palette[0];
 for(int i=0;i<7;i++){if(float(i)==segment)v_colour=mix(u_palette[i],u_palette[i+1],fract(tone));}
}`;
const FRAG=`
precision mediump float;
varying vec3 v_colour;
uniform vec4 u_surface;
uniform float u_orientation;
varying float v_alpha;
varying float v_seed;
void main(){vec2 q=gl_PointCoord*2.0-1.0;float a=u_orientation+v_seed*u_surface.z*2.0;float cs=cos(a),sn=sin(a);q=vec2(q.x*cs-q.y*sn,q.x*sn+q.y*cs);q.y*=1.0+u_surface.w;
 float d=mix(max(abs(q.x),abs(q.y)),length(q),u_surface.x);
 float rag=1.0-u_surface.z*.10*sin(atan(q.y,q.x)*5.0+v_seed*14.0);
 float edge=1.0-smoothstep(rag-.12-u_surface.y*.35,rag,d);
 gl_FragColor=vec4(v_colour,v_alpha*edge);}
`;
function seeded(seed:number){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
function rgb(hex:string){return[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);}
function mixColor(a:number[],b:number[],t:number){return a.map((v,i)=>v+(b[i]-v)*t);}
const masks=new Map<string,Float32Array>();
function maskPoints(shape:Shape,text:string,count:number,key:string,print:boolean,jitter:number):Float32Array {
 const cacheKey=[shape,text,count,key,print,print?jitter.toFixed(2):0].join('|');const cached=masks.get(cacheKey);if(cached)return cached;
 const n=320,c=document.createElement('canvas');c.width=c.height=n;const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.fillStyle='#fff';
 if(shape==='text'){const glyph=text.trim()||'O';ctx.font=`900 240px ${glyph==='&'?'Georgia':'Arial'}`;const m=ctx.measureText(glyph);const width=m.actualBoundingBoxLeft+m.actualBoundingBoxRight,height=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;
 ctx.translate(n/2,n/2);ctx.scale((n-10)/Math.max(1,width),(n-10)/Math.max(1,height));ctx.fillText(glyph,(m.actualBoundingBoxLeft-m.actualBoundingBoxRight)/2,(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2);ctx.strokeStyle="#fff";ctx.lineWidth=8;ctx.strokeText(glyph,(m.actualBoundingBoxLeft-m.actualBoundingBoxRight)/2,(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2);
 }else if(shape==='ring'){ctx.beginPath();ctx.arc(n/2,n/2,n*.49,0,Math.PI*2);ctx.arc(n/2,n/2,n*.255,0,Math.PI*2,true);ctx.fill('evenodd');}
 else if(shape==='disc'){ctx.beginPath();ctx.arc(n/2,n/2,n*.49,0,Math.PI*2);ctx.fill();}
 else if(shape==='triangle'){ctx.beginPath();ctx.moveTo(n/2,5);ctx.lineTo(n-5,n-5);ctx.lineTo(5,n-5);ctx.closePath();ctx.fill();}
 else ctx.fillRect(1,1,n-2,n-2);
 const pixels=ctx.getImageData(0,0,n,n).data;const out=new Float32Array(count*5),r=seeded(hash(key));
 let k=0,tries=0;const max=count*50;while(k<count&&tries++<max){let x=r(),y=r();if(pixels[(Math.min(n-1,y*n|0)*n+Math.min(n-1,x*n|0))*4+3]<100)continue;
 if(print){const grid=Math.sqrt(count)*1.45;x=(Math.round(x*grid)+(r()-.5)*jitter)/grid;y=(Math.round(y*grid)+(r()-.5)*jitter)/grid;}
 out[k*5]=x-.5;out[k*5+1]=.5-y;out[k*5+2]=r();out[k*5+3]=r();
 const ix=Math.max(4,Math.min(n-5,x*n|0)),iy=Math.max(4,Math.min(n-5,y*n|0));out[k*5+4]=[[-4,0],[4,0],[0,-4],[0,4]].some(([dx,dy])=>pixels[((iy+dy)*n+ix+dx)*4+3]<100)?1:0;k++;}
 for(;k<count;k++){out[k*5]=(r()-.5)*.1;out[k*5+1]=(r()-.5)*.1;out[k*5+2]=r();out[k*5+3]=r();out[k*5+4]=0;}
 masks.set(cacheKey,out);if(masks.size>50)masks.delete(masks.keys().next().value!);return out;
}
interface BufferEntry {buffer:WebGLBuffer;count:number;signature:string;data:Float32Array}
export class PreviewAdapter implements FieldEngineAdapter {
 readonly capabilities:EngineCapabilities={name:'Layout preview',kind:'preview',parameters:PARAMETERS.filter(p=>p.preview).map(p=>p.key),physicalResonance:false,runtimeCheckpoints:false,exactSeek:false,notes:['Procedural grain and authored formations, not the production simulation.','Pins preview summed spatial deformations, not integrated particle dynamics.','Resonator controls require the production engine.']};
 private gl:WebGLRenderingContext|null;private ctx:CanvasRenderingContext2D|null=null;private program:WebGLProgram|null=null;private entries=new Map<string,BufferEntry>();private uniforms=new Map<string,WebGLUniformLocation|null>();private width=1;private height=1;private dpr=1;
 constructor(readonly canvas:HTMLCanvasElement){this.gl=canvas.getContext('webgl',{alpha:true,antialias:false,preserveDrawingBuffer:true,premultipliedAlpha:false});
 if(this.gl){const gl=this.gl;const compile=(type:number,source:string)=>{const sh=gl.createShader(type)!;gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh)||'Preview shader failed.');return sh;};
 const p=gl.createProgram()!;gl.attachShader(p,compile(gl.VERTEX_SHADER,VERT));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'Preview link failed.');this.program=p;gl.useProgram(p);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 }else this.ctx=canvas.getContext('2d');
 }
 private loc(name:string){if(!this.uniforms.has(name))this.uniforms.set(name,this.gl!.getUniformLocation(this.program!,name));return this.uniforms.get(name)!;}
 resize(width:number,height:number,pixelRatio:number){this.width=width;this.height=height;this.dpr=Math.min(pixelRatio,2);this.canvas.width=Math.round(width*this.dpr);this.canvas.height=Math.round(height*this.dpr);this.canvas.style.width=width+'px';this.canvas.style.height=height+'px';}
 render(f:EngineFrame){if(!this.gl){this.renderFallback(f);return;}const gl=this.gl;if(gl.isContextLost())return;
 const p=f.params,s=f.scene;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);
 const {a,b}=basis(f.camera),centre=stageCentre(this.width,this.height),scale=stageScale(this.width,this.height)*f.camera.zoom;
 gl.uniform2f(this.loc('u_resolution'),this.width,this.height);gl.uniform2f(this.loc('u_centre'),centre.x+f.camera.panX,centre.y+f.camera.panY);gl.uniform3fv(this.loc('u_basisX'),a);gl.uniform3fv(this.loc('u_basisY'),b);
 gl.uniform1f(this.loc('u_scale'),scale);gl.uniform1f(this.loc('u_dpr'),this.dpr);gl.uniform1f(this.loc('u_time'),f.simTime);
 gl.uniform4f(this.loc('u_motion'),p.speed,p.circulation,p.turbulence,p.dispersion);
 gl.uniform4f(this.loc('u_density'),p.contrast,p.densityScale,p.densityPhase,p.warp);
 gl.uniform4f(this.loc('u_mark'),p.size,p.opacity,p.sizeBias,p.edgeWeight);
 gl.uniform4f(this.loc('u_geometry'),p.halo,p.thickness,p.jitter,p.orientation);
 gl.uniform4f(this.loc('u_misc'),p.turbulenceScale,p.depth,p.elongation,0);
 gl.uniform4f(this.loc('u_surface'),s.field.material==='print'?Math.min(p.roundness,.3):p.roundness,p.softness,p.irregularity,p.elongation);
 gl.uniform1f(this.loc('u_orientation'),p.orientation*Math.PI/180);
 gl.uniform4f(this.loc('u_pointer'),f.pointer.world.x,f.pointer.world.y,f.pointer.active?p.pointerStrength:0,p.pointerRadius);
 const forces=s.entities.filter(e=>e.force.strength>0||e.force.spin!==0).slice(0,16);const fs=new Float32Array(64),ft=new Float32Array(64);
 forces.forEach((e,i)=>{fs.set([e.position.x,e.position.y,e.force.radius,e.force.strength],i*4);ft.set([e.force.kind==='attract'?0:e.force.kind==='repel'?1:2,e.force.spin,e.position.z,0],i*4);});
 gl.uniform4fv(this.loc('u_forces[0]'),fs);gl.uniform4fv(this.loc('u_forceTypes[0]'),ft);gl.uniform1f(this.loc('u_forceCount'),forces.length);
 const forms=s.entities.filter(e=>e.kind==='formation'),total=forms.reduce((a,e)=>a+e.share,0)||1,active=new Set<string>();const focus=focusAt(s,f.simTime);
 for(const e of forms){if(e.share===0)continue;const seq=sequenceAt(e,s,f.simTime),count=Math.max(1,Math.floor(clamp(p.count,4000,100000)*e.share/total));
 const signature=[seq.shape,seq.text,seq.nextShape,seq.nextText,count,s.field.material,s.field.material==='print'?p.jitter.toFixed(2):0].join('|');let item=this.entries.get(e.id);active.add(e.id);
 if(!item||item.signature!==signature){const from=maskPoints(seq.shape,seq.text,count,e.id,s.field.material==='print',p.jitter),to=maskPoints(seq.nextShape,seq.nextText,count,e.id,s.field.material==='print',p.jitter);const data=new Float32Array(count*7);
 for(let k=0;k<count;k++){data.set(from.subarray(k*5,k*5+4),k*7);data[k*7+4]=to[k*5];data[k*7+5]=to[k*5+1];data[k*7+6]=from[k*5+4];}
 const buffer=item?.buffer??gl.createBuffer()!;item={buffer,count,signature,data};gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);this.entries.set(e.id,item);}
 gl.bindBuffer(gl.ARRAY_BUFFER,item.buffer);const point=gl.getAttribLocation(this.program!,'a_point'),next=gl.getAttribLocation(this.program!,'a_next'),edge=gl.getAttribLocation(this.program!,'a_edge');gl.enableVertexAttribArray(point);gl.vertexAttribPointer(point,4,gl.FLOAT,false,28,0);gl.enableVertexAttribArray(next);gl.vertexAttribPointer(next,2,gl.FLOAT,false,28,16);gl.enableVertexAttribArray(edge);gl.vertexAttribPointer(edge,1,gl.FLOAT,false,28,24);
 gl.uniform2f(this.loc('u_size'),e.size.x,e.size.y);gl.uniform3f(this.loc('u_position'),seq.position.x,seq.position.y,seq.position.z);gl.uniform1f(this.loc('u_rotation'),e.rotation*Math.PI/180);gl.uniform1f(this.loc('u_mix'),seq.mix);
 let color=mixColor(rgb(s.field.palette[0]),rgb(e.tint),e.tintWeight);if(focus&&s.composition.carryTint){color=mixColor(color,rgb(focus.entity.tint),focus.entity.id===e.id?.8:.13);}
 if(f.selectedIds.length&&!f.selectedIds.includes(e.id))gl.uniform4f(this.loc('u_mark'),p.size,p.opacity*.65,p.sizeBias,p.edgeWeight);else gl.uniform4f(this.loc('u_mark'),p.size,p.opacity,p.sizeBias,p.edgeWeight);
 const palette=new Float32Array(24);s.field.palette.forEach((col,i)=>{let c=mixColor(rgb(col),rgb(e.tint),e.tintWeight);if(focus&&s.composition.carryTint)c=mixColor(c,rgb(focus.entity.tint),focus.entity.id===e.id?.8:.13);palette.set(c,i*3);});gl.uniform3fv(this.loc('u_palette[0]'),palette);gl.uniform1f(this.loc('u_paletteCount'),s.field.palette.length);gl.drawArrays(gl.POINTS,0,item.count);
 }
 for(const [id,item]of this.entries)if(!active.has(id)){gl.deleteBuffer(item.buffer);this.entries.delete(id);}
 }
 private renderFallback(f:EngineFrame){const ctx=this.ctx;if(!ctx)return;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.width,this.height);const forms=f.scene.entities.filter(e=>e.kind==='formation'),total=forms.reduce((n,e)=>n+e.share,0)||1;
 for(const e of forms){const seq=sequenceAt(e,f.scene,f.simTime),count=Math.floor(9000*e.share/total),data=maskPoints(seq.shape,seq.text,count,e.id,false,.8);ctx.fillStyle=e.tintWeight>.5?e.tint:f.scene.field.palette[0];for(let i=0;i<count;i++){const x=data[i*5]*e.size.x+seq.position.x,y=data[i*5+1]*e.size.y+seq.position.y;const pt=project({x:x+Math.sin(f.simTime*.4+i)*.004,y,z:seq.position.z},f.camera,this.width,this.height);ctx.globalAlpha=f.params.opacity*(.1+.9*(.5+.5*Math.sin(x*4+y*3)));ctx.fillRect(pt.x,pt.y,f.params.size*1.3,f.params.size*1.3);}}ctx.globalAlpha=1;
 }
 dispose(){if(this.gl){for(const item of this.entries.values())this.gl.deleteBuffer(item.buffer);if(this.program)this.gl.deleteProgram(this.program);}this.entries.clear();}
}
