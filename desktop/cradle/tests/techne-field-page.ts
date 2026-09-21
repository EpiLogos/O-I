/** Controlled engine aperture, not a replacement app. Production converter,
 * Global Stage runtime and imported engine are the subjects under test. */
import {EngineSurface} from '../src/stage/engineSurface';
import {expressionConfig} from '../src/expression/engineProjection';
import type {ExpressionDocument} from '../src/expression/types';
const host=document.getElementById('field')!;
const errors:string[]=[];
const surface=EngineSurface.forElement(host,error=>errors.push(error));
const id='test-constructive-field';
let source:ExpressionDocument;
const api={
 errors,
 async open(document:ExpressionDocument){source=document;surface.presentConfig(id,expressionConfig(document),document.selection.scene_ref,[],"host");surface.setPaused(true);await surface.whenReady(id);},
 async disconnect(){const config=expressionConfig(source);(config.oiExpressionBindings as any).relations=[];surface.presentConfig(id,config,source.selection.scene_ref,[],"host");await surface.whenReady(id);},
 async select(ref:string){surface.updateSelection(id,[ref]);await surface.whenReady(id);},
 hit(x:number,y:number){const rect=host.getBoundingClientRect();return surface.hitTest(id,x+rect.left,y+rect.top);},
 inspect(){
  // Test-only observation of the REAL renderer/geometry/simulator. No
  // production code consumes this shape or turns a fixture into a receipt.
  const adapter=(surface as any).adapter,engine=adapter.engine;
  const layer=adapter.connectionLayer;
  return {bindings:adapter.expressionBindingSnapshot(),canvasCount:host.querySelectorAll('canvas').length,
   calls:engine?.renderer.info.render.calls,clock:engine?.time,
   lines:layer?.paths.map((path:any)=>({ref:path.binding.binding_ref,point:engine.projectWorldToScreen(path.points[12].x,path.points[12].y,path.points[12].z),
    vertices:Array.from(layer.objects.get(path.binding.binding_ref).geometry.getAttribute('position').array)})) ?? [],
   entities:engine?.lastPoses.map((p:any)=>({ref:p.entityId,point:engine.projectWorldToScreen(p.x,p.y,p.z)})) ?? []};
 },
 dispose(){surface.dispose();}
};
(window as any).fieldProof=api;
