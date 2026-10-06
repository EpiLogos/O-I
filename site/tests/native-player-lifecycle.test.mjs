/** Execute the actual browser host with controlled scheduling/adapter boundaries.
 * This proves host lifecycle, not GPU pixels; the browser suite proves pixels. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { defaultCamera, project } from '../../packages/oi-design-system/expressions-engine/shell/camera.mjs';
const source=await readFile(process.env.OI_TEST_NATIVE_PLAYER_SOURCE || new URL('../src/library/native-player.mjs',import.meta.url),'utf8');
function host(initial={width:0,height:0}) {
 let rectangle=initial,observer,scheduled=0;
 const sizes=[],renders=[],positions=[];
 class Adapter {resize(...size){sizes.push(size);}render(value){renders.push(value);}needsRender(){return false;}command(){}dispose(){}}
 const context={ProductionAdapter:Adapter,blankScene:()=>({}),nativeExport:()=>({config:{}}),nativeSnapshotToJourney:()=>{},defaultCamera,project,structuredClone,devicePixelRatio:1,document:{hidden:false,addEventListener(){},removeEventListener(){}},ResizeObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){}},requestAnimationFrame:()=>++scheduled,cancelAnimationFrame(){}};
 // Only module linkage is replaced with controlled collaborators. The class
 // constructor, scheduler, camera fit, frame and resize methods execute intact.
 vm.runInNewContext(source.replace(/^import .*;\n/gm,'').replace(/^export /gm,'')+'\nglobalThis.Host=PublicField;',context);
 const field=new context.Host({getBoundingClientRect:()=>rectangle,dataset:{}},error=>{throw new Error(error);},value=>positions.push(value),()=>{});
 field.scene={id:'controlled-scene',entities:[{id:'subject',position:{x:0,y:0,z:0}}]};field.playing=false;
 return {field,sizes,renders,positions,resize:value=>{rectangle=value;observer();},scheduled:()=>scheduled};
}
test('an unmeasured public field cannot render or fit its camera',()=>{
 const h=host();h.field.fitPoint={x:0,y:0,z:0};h.field.setActive(true);h.field.frame(0);
 assert.equal(h.renders.length,0);assert.equal(h.scheduled(),0);
 assert.ok(Number.isFinite(h.field.camera.panX));assert.ok(h.field.fitPoint);
});
test('first measured frame retains finite camera and centered native selection',()=>{
 const h=host({width:800,height:500});h.field.fitPoint={x:0,y:0,z:0};h.field.setActive(true);h.field.frame(0);
 assert.equal(h.renders.length,1);const p=h.positions[0][0];
 assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>0&&p.x<800&&p.y>0&&p.y<500);
});
test('hidden retained field does not resize GPU buffers to one pixel',()=>{
 const h=host({width:800,height:500});h.field.setActive(false);h.resize({width:0,height:0});
 assert.equal(h.sizes.length,1);assert.equal(h.field.width,800);assert.equal(h.field.height,500);
});
test('reactivation uses the actual positive surface before drawing',()=>{
 const h=host();h.field.setActive(false);h.resize({width:375,height:420});h.field.setActive(true);h.field.frame(0);
 assert.equal(h.renders.length,1);assert.deepEqual(h.sizes,[[375,420,1]]);
});
