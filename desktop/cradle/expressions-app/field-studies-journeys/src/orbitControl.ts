import {Camera, basis} from './camera.js';
import {clamp} from './model.js';
import {icon} from './icons.js';
export type ViewAxis = 'X'|'-X'|'Y'|'-Y'|'Z'|'-Z';
/** Orient the view only. Never modify the working plane, confinement or document. */
export function axisView(camera: Camera, axis: ViewAxis): void {
  const angles: Record<ViewAxis,[number,number]> = {X:[-Math.PI/2,0],'-X':[Math.PI/2,0],Y:[0,Math.PI/2],'-Y':[0,-Math.PI/2],Z:[0,0],'-Z':[Math.PI,0]};
  [camera.yaw,camera.pitch] = angles[axis];
  camera.mode = axis === 'Z' ? '2d' : '3d';
}
export function orbitBy(camera: Camera, yaw: number, pitch: number): void {
  camera.yaw = ((yaw + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
  camera.pitch = clamp(pitch, -Math.PI/2, Math.PI/2);
  camera.mode = '3d';
}
const axes: {name:ViewAxis;vector:number[]}[] = [
  {name:'X',vector:[1,0,0]},{name:'-X',vector:[-1,0,0]},
  {name:'Y',vector:[0,1,0]},{name:'-Y',vector:[0,-1,0]},
  {name:'Z',vector:[0,0,1]},{name:'-Z',vector:[0,0,-1]},
];
/** A passive camera instrument: it has no simulation loop and never owns field input. */
export class OrbitControl {
  private abort = new AbortController();
  private drag: {id:number;x:number;y:number;camera:Camera;pan:boolean;moved:boolean}|null = null;
  private suppressClick = false;
  private signature = '';
  private pad: HTMLElement;
  constructor(private root:HTMLElement,private camera:()=>Camera,private changed:()=>void,private releaseField:()=>void) {
    root.innerHTML = `<div class="orbit-pad" tabindex="0" role="group" aria-label="Orbit camera: drag to rotate, Shift-drag to pan, scroll to zoom. Arrow keys rotate; plus and minus zoom; Home resets." title="Drag to orbit · Shift-drag to pan · scroll to zoom">
      <svg viewBox="0 0 128 128" aria-hidden="true"><circle class="orbit-rim" cx="64" cy="64" r="46"/><g class="orbit-wires"></g></svg>
      ${axes.map(a=>`<button type="button" class="orbit-axis" data-axis="${a.name}" title="View from ${a.name}" aria-label="View from ${a.name}">${a.name.replace('-','−')}</button>`).join('')}
    </div><div class="orbit-actions">
      <button type="button" data-orbit="reset" title="Reset camera framing" aria-label="Reset camera framing">${icon('fit')}</button>
      <button type="button" data-orbit="out" title="Zoom out" aria-label="Zoom out">${icon('minus')}</button>
      <button type="button" data-orbit="in" title="Zoom in" aria-label="Zoom in">${icon('plus')}</button>
      <button type="button" data-orbit="view" title="Switch between front and oblique view" aria-label="Switch between front and oblique view"><span class="orbit-view">2D</span></button>
    </div>`;
    this.pad = root.querySelector<HTMLElement>('.orbit-pad')!;
    const opts = {signal:this.abort.signal};
    root.addEventListener('pointerdown',event=>{
      this.releaseField();
      event.stopPropagation();
      if (!this.pad.contains(event.target as Node) || ![0,2].includes(event.button) || this.drag) return;
      this.drag={id:event.pointerId,x:event.clientX,y:event.clientY,camera:{...this.camera()},pan:event.shiftKey||event.button===2,moved:false};
      this.suppressClick=false;
      this.pad.setPointerCapture(event.pointerId);
      event.preventDefault();
    },opts);
    this.pad.addEventListener('pointermove',event=>{
      const d=this.drag;if(!d||d.id!==event.pointerId)return;
      const dx=event.clientX-d.x,dy=event.clientY-d.y;if(Math.hypot(dx,dy)>3)d.moved=true;
      if(!d.moved)return;
      const c=this.camera();
      if(d.pan){c.panX=d.camera.panX+dx;c.panY=d.camera.panY+dy;}
      else orbitBy(c,d.camera.yaw+dx*.013,d.camera.pitch+dy*.013);
      this.changed();this.render();event.stopPropagation();
    },opts);
    const end=(event:PointerEvent)=>{
      if(this.drag?.id!==event.pointerId)return;
      this.suppressClick=this.drag.moved;
      // Pointer capture retargets clicks to the pad. Resolve a tap explicitly.
      const axis=!this.drag.moved&&document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-axis]');
      this.drag=null;
      if(this.pad.hasPointerCapture(event.pointerId))this.pad.releasePointerCapture(event.pointerId);
      if(axis&&event.type==='pointerup'){axisView(this.camera(),axis.dataset.axis as ViewAxis);this.changed();this.render();this.suppressClick=true;}
      event.stopPropagation();
    };
    this.pad.addEventListener('pointerup',end,opts);this.pad.addEventListener('pointercancel',end,opts);
    this.pad.addEventListener('lostpointercapture',()=>{this.drag=null;},opts);
    root.addEventListener('click',event=>{
      event.stopPropagation();
      const target=(event.target as Element).closest<HTMLElement>('button');if(!target)return;
      if(target.dataset.axis){if(this.suppressClick&&event.detail!==0){this.suppressClick=false;return;}axisView(this.camera(),target.dataset.axis as ViewAxis);}
      else this.command(target.dataset.orbit!);
      this.changed();this.render();
    },opts);
    root.addEventListener('wheel',event=>{event.preventDefault();event.stopPropagation();this.releaseField();this.camera().zoom=clamp(this.camera().zoom*Math.exp(-event.deltaY*.002),.2,4);this.changed();this.render();},{...opts,passive:false});
    root.addEventListener('contextmenu',event=>event.preventDefault(),opts);
    root.addEventListener('keydown',event=>{
      const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'];if(!keys.includes(event.key))return;
      event.preventDefault();event.stopPropagation();this.releaseField();const c=this.camera(),n=event.shiftKey?12:.12;
      if(event.key==='Home')this.command('reset');else if(event.key==='+'||event.key==='=')this.command('in');else if(event.key==='-')this.command('out');
      else if(event.shiftKey){if(event.key==='ArrowLeft')c.panX-=n;if(event.key==='ArrowRight')c.panX+=n;if(event.key==='ArrowUp')c.panY-=n;if(event.key==='ArrowDown')c.panY+=n;}
      else orbitBy(c,c.yaw+(event.key==='ArrowLeft'?-n:event.key==='ArrowRight'?n:0),c.pitch+(event.key==='ArrowUp'?-n:event.key==='ArrowDown'?n:0));
      this.changed();this.render();
    },opts);
    this.render();
  }
  private command(command:string){const c=this.camera();if(command==='reset'){axisView(c,'Z');c.zoom=1;c.panX=c.panY=0;}
    if(command==='in')c.zoom=clamp(c.zoom*1.15,.2,4);if(command==='out')c.zoom=clamp(c.zoom/1.15,.2,4);
    if(command==='view'){if(c.mode==='2d')orbitBy(c,-.42,.25);else axisView(c,'Z');}}
  render(){
    const c=this.camera(),signature=[c.yaw,c.pitch,c.zoom,c.mode].join(':');if(this.signature===signature)return;this.signature=signature;
    const {a,b}=basis(c),normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const dot=(v:number[],w:number[])=>v.reduce((sum,n,i)=>sum+n*w[i],0);
    const point=(v:number[])=>[64+dot(a,v)*43,64-dot(b,v)*43];
    this.root.querySelector('.orbit-wires')!.innerHTML=[0,1,2].map(axis=>{
      const points=Array.from({length:65},(_,i)=>{const t=i/64*Math.PI*2,v=[0,0,0];v[(axis+1)%3]=Math.cos(t);v[(axis+2)%3]=Math.sin(t);return point(v).join(',');});
      return `<polyline points="${points.join(' ')}"/>`;
    }).join('')+axes.filter(x=>!x.name.startsWith('-')).map(x=>{const [px,py]=point(x.vector);return `<line x1="64" y1="64" x2="${px}" y2="${py}"/>`;}).join('');
    for(const axis of axes){const el=this.root.querySelector<HTMLElement>(`[data-axis="${axis.name}"]`)!,[x,y]=point(axis.vector),depth=dot(normal,axis.vector);el.style.left=x/128*100+'%';el.style.top=y/128*100+'%';el.style.zIndex=String(Math.round(depth*10)+20);el.classList.toggle('behind',depth<-.01);el.classList.toggle('negative',axis.name.startsWith('-'));}
    this.root.querySelector('.orbit-view')!.textContent=c.mode==='2d'?'2D':'3D';
  }
  dispose(){this.abort.abort();}
}
