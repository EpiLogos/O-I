/** O:I Expression correspondence on the EXISTING production field.
 * Refs identify native occurrences; this layer neither authors knowledge nor
 * owns a renderer/clock. Geometry follows evaluated 3D poses before each draw.
 */
import {BufferGeometry, Float32BufferAttribute, Group, Line, LineBasicMaterial} from 'three';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const point = pose => pose && [pose.x, pose.y, pose.z ?? 0].every(finite)
  ? {x: pose.x, y: pose.y, z: pose.z ?? 0} : null;
const key = row => JSON.stringify([row.from_entity_ref, row.to_entity_ref].sort());

/** No subject-name matching: a binding addresses exact entity occurrences.
 * Parallel relations remain separate curves; absent/off-window endpoints are
 * named, never redirected to another occurrence of the same source. */
export function connectionPaths(bindings, poses) {
  const byId = new Map(poses.map(p => [p.entityId ?? p.id, point(p)]));
  const groups = new Map();
  for (const b of bindings) {
    const group = groups.get(key(b)) ?? [];
    group.push(b); groups.set(key(b), group);
  }
  const paths = [], unavailable = [];
  for (const group of groups.values()) {
    group.sort((a,b) => a.binding_ref.localeCompare(b.binding_ref));
    group.forEach((binding, index) => {
      const from = byId.get(binding.from_entity_ref), to = byId.get(binding.to_entity_ref);
      if (!from || !to) { unavailable.push(binding.binding_ref); return; }
      // Stable side for reverse-directed edges as well as same-direction ones.
      const sign = binding.from_entity_ref <= binding.to_entity_ref ? 1 : -1;
      const dx = (to.x-from.x)*sign, dy = (to.y-from.y)*sign;
      const length = Math.hypot(dx,dy) || 1;
      const offset = (index-(group.length-1)/2)*22;
      const self = binding.from_entity_ref === binding.to_entity_ref;
      const points = Array.from({length: 25}, (_,i) => {
        const t=i/24, bend=4*t*(1-t)*offset;
        return self ? {x:from.x+(24+index*12)*Math.sin(2*Math.PI*t), y:from.y+(24+index*12)*(1-Math.cos(2*Math.PI*t)), z:from.z}
          : {x:from.x+(to.x-from.x)*t-dy/length*bend,
             y:from.y+(to.y-from.y)*t+dx/length*bend,
             z:from.z+(to.z-from.z)*t};
      });
      paths.push({binding,points});
    });
  }
  return {paths,unavailable};
}

export function hitConnection(paths, x, y, project, radius=7) {
  if (![x,y,radius].every(finite) || radius<0) return null;
  let best=null, distance=radius;
  for (const path of paths) {
    const projected=path.points.map(project);
    for(let i=1;i<projected.length;i++) {
      const a=projected[i-1],b=projected[i];
      if(!a?.visible || !b?.visible) continue;
      const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
      const t=den ? Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/den)) : 0;
      const d=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);
      if(d<=distance) {distance=d;best=path.binding;}
    }
  }
  return best ? {kind:'relation', ...best, distance} : null;
}

export class ExpressionConnectionLayer {
  constructor(engine) {
    this.engine=engine; this.group=new Group();this.group.name='oi-expression-connections';
    engine.scene.add(this.group);
    this.previous=engine.scene.onBeforeRender;
    this.before=(...args)=>{this.previous?.apply(engine.scene,args);this.update();};
    engine.scene.onBeforeRender=this.before;
  }
  bindings=[]; selected=new Set(); objects=new Map(); paths=[]; unavailable=[];
  configure(bindings=[],selected=[]) {
    this.bindings=bindings;this.selected=new Set(selected);
    const live=new Set(bindings.map(b=>b.binding_ref));
    for(const [ref,line] of this.objects) if(!live.has(ref)) {
      this.group.remove(line);line.geometry.dispose();line.material.dispose();this.objects.delete(ref);
    }
  }
  update() {
    const {paths,unavailable}=connectionPaths(this.bindings,this.engine.lastPoses ?? []);
    this.paths=paths;this.unavailable=unavailable;
    const active=new Set(paths.map(p=>p.binding.binding_ref));
    for(const [ref,line] of this.objects) line.visible=active.has(ref);
    // The current field's native ink, not a new palette or theme authority.
    const color=this.engine.isLightScene?.() === false ? '#e8e6de' : '#34352f';
    for(const path of paths) {
      const ref=path.binding.binding_ref;
      let line=this.objects.get(ref);
      if(!line) {
        line=new Line(new BufferGeometry(),new LineBasicMaterial({color,transparent:true,depthTest:true}));
        line.name=ref;line.userData={kind:'relation',...path.binding};line.frustumCulled=false;
        this.group.add(line);this.objects.set(ref,line);
      }
      const values=path.points.flatMap(p=>[p.x,p.y,p.z]);
      const attr=line.geometry.getAttribute('position');
      if(attr?.array.length===values.length){attr.array.set(values);attr.needsUpdate=true;}
      else line.geometry.setAttribute('position',new Float32BufferAttribute(values,3));
      line.material.color.set(color);
      line.material.opacity=this.selected.has(ref)?1:0.62;
      line.visible=true;
    }
  }
  hitTest(x,y,radius=7) {
    return hitConnection(this.paths,x,y,p=>this.engine.projectWorldToScreen(p.x,p.y,p.z),radius);
  }
  /** Hit the same evaluated occurrence pose used by the visible connection,
   * rather than an old authored coordinate while the physical carrier moves. */
  pickEntity(x,y,radius=25) {
    let selected=null,best=radius;
    for(const pose of this.engine.lastPoses??[]) {
      const p=point(pose);if(!p)continue;
      const projected=this.engine.projectWorldToScreen(p.x,p.y,p.z);
      if(!projected?.visible)continue;
      const distance=Math.hypot(projected.x-x,projected.y-y);
      if(distance<=best){best=distance;selected=pose.entityId??pose.id;}
    }
    return selected;
  }
  inspect() {return {rendered:this.paths.map(p=>p.binding.binding_ref),unavailable:[...this.unavailable]};}
  dispose() {
    if(this.engine.scene.onBeforeRender===this.before)this.engine.scene.onBeforeRender=this.previous;
    for(const line of this.objects.values()){line.geometry.dispose();line.material.dispose();}
    this.objects.clear();this.engine.scene.remove(this.group);
  }
}
