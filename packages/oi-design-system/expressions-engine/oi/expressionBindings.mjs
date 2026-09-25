/** O:I Expression correspondence on the EXISTING production field.
 * Refs identify native occurrences; this layer neither authors knowledge nor
 * owns a renderer/clock. Geometry follows evaluated 3D poses before each draw.
 */
export {connectionPaths} from './connectionRuntime.mjs';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const point = pose => pose && [pose.x,pose.y,pose.z??0].every(finite) ? {x:pose.x,y:pose.y,z:pose.z??0} : null;

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
  constructor(engine) { this.engine=engine; }
  paths=[]; unavailable=[];
  configure(bindings=[],selected=[]) { this.engine.setNativeConnections(bindings,selected); }
  update() {
    const runtime=this.engine.nativeConnectionRuntime();
    this.paths=runtime.paths;this.unavailable=runtime.unavailable;
  }
  hitTest(x,y,radius=7) {
    this.update();
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
  inspect() {this.update();return this.engine.nativeConnectionRuntime().inspect();}
  dispose() {this.engine.setNativeConnections([],[]);}
}
