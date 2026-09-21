/** Deterministic production-converter / actual Three geometry contract tests.
 * These are U evidence, not a substitute for the WebGL/native-storage walk. */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
const ENGINE='../../packages/oi-design-system/expressions-engine';
let assertions=0;
const eq=(a,b,message)=>{assert.deepEqual(a,b,message);assertions++;};
const ok=(value,message)=>{assert.ok(value,message);assertions++;};
try{
 const {expressionConfig,expressionWindow}=await server.ssrLoadModule('/src/expression/engineProjection.ts');
 const {connectionPaths,hitConnection,ExpressionConnectionLayer}=await server.ssrLoadModule(`${ENGINE}/oi/expressionBindings.mjs`);
 const {nativeExport,nativeSnapshotToJourney}=await server.ssrLoadModule(`${ENGINE}/shell/nativeBridge.mjs`);
 const {Group}=await import('three');
 const prefix='expression:proof',scene=`${prefix}:scene:main`;
 const refs=Array.from({length:18},(_,i)=>`${prefix}:entity:n${i}`);
 const parameter=value=>({value,automation:null});
 const d={schema:'oi.expression/v1',expression_ref:prefix,revision:1,title:'Eighteen occurrences',
  scenes:[{scene_ref:scene,title:'Main',revision:1,entity_refs:refs,
   body:{carrier:'text_source',subject_ref:'wiki:source:essay',reading:{ref:'central:essay.md',revision:'r1',availability:'available'},native_owner:'central',provenance:[],actions:[],presentation:'inline',capability:{state:'renderable'},span:{start:4,end:16}}}],
  entities:Object.fromEntries(refs.map((ref,i)=>[ref,{entity_ref:ref,revision:1,title:`Member ${i}`,subject:{subject_ref:`wiki:node:${i%2}`,native_owner:'ai-kit',sources:[],readings:[],actions:[],presentation_role:'thing'},parameters:{glyph:parameter(`Member ${i}`),x:parameter(i===0?-180:i===1?180:0),y:parameter(i<2?0:150),z:parameter(i===1?50:0),scale:parameter(.25)}}])),
  relations:{},selection:{scene_ref:scene,entity_ref:null},provenance:[],representations:[],refinements:[]};
 const relation=(name,from=refs[0],to=refs[1])=>({binding_ref:`${prefix}:relation:${name}`,native_owner:'ai-kit',relation:{ref:`wiki:edge:${name}`,revision:'r3',availability:'available'},from_entity_ref:from,to_entity_ref:to,provenance:[]});
 d.relations={a:relation('a'),b:relation('b'),outside:relation('outside',refs[16],refs[17])};
 const original=JSON.stringify(d),config=expressionConfig(d);
 eq(config.entities.length,10);eq(config.oiExpressionBindings.total_entities,18);eq(config.oiExpressionBindings.hidden_entity_refs,refs.slice(10));
 eq(config.oiExpressionBindings.relations.map(r=>r.relation.ref),['wiki:edge:a','wiki:edge:b']);
 eq(config.oiExpressionBindings.body,d.scenes[0].body,'a Scene carrier must not disappear in a glyph projection');
 eq(JSON.stringify(d),original,'render budget must never mutate the native whole');
 eq(expressionWindow(d,999).visible,refs.slice(10),'clamp a progressive page to the last real page');
 d.selection.entity_ref=refs[17];eq(expressionWindow(d).visible.at(-1),refs[17]);eq(d.scenes[0].entity_refs.length,18);
 d.selection.entity_ref=null;
 d.selection.relation_ref='outside';
 ok(expressionWindow(d).visible.includes(refs[16]) && expressionWindow(d).visible.includes(refs[17]),'selecting an off-window relation discloses its exact endpoints');
 d.selection.relation_ref=null;
 d.entities[refs[0]].parameters.ascii=parameter('A\nB');
 d.entities[refs[1]].parameters.image=parameter('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1S8AAAAASUVORK5CYII=');
 d.entities[refs[2]].parameters.shape=parameter('cymatic');d.entities[refs[2]].parameters.frequency=parameter(396);
 d.entities[refs[3]].parameters.shape=parameter('yantra');d.entities[refs[3]].parameters.yantra=parameter('anahata');
 d.entities[refs[4]].parameters.kind=parameter('pin');
 const media=expressionConfig(d),roundtrip=nativeExport(nativeSnapshotToJourney({config:media}).scenes[0]).config;
 eq(roundtrip.entities.find(e=>e.id===refs[0]).authoringSource.ascii.text,'A\nB');
 eq(roundtrip.entities.find(e=>e.id===refs[1]).authoringSource.image.dataUrl,d.entities[refs[1]].parameters.image.value);
 eq(roundtrip.entities.find(e=>e.id===refs[2]).shape.dimension,'2D');
 eq(roundtrip.entities.find(e=>e.id===refs[3]).shape.yantraId,'anahata');
 eq(roundtrip.entities.find(e=>e.id===refs[4]).kind,'pin');
 const poses=[{entityId:refs[0],x:-180,y:0,z:0},{entityId:refs[1],x:180,y:0,z:50},
  {entityId:refs[16],x:500,y:500,z:0}];
 const rows=Object.values(d.relations),paths=connectionPaths(rows,poses);
 eq(paths.paths.length,2);eq(paths.unavailable,[`${prefix}:relation:outside`]);
 ok(paths.paths[0].points[12].y!==paths.paths[1].points[12].y,'parallel sourced relations remain separate selectable curves');
 eq(paths.paths[0].points[12].z,25,'relations follow actual 3D poses');
 const project=p=>({...p,visible:true});
 for(const path of paths.paths){const p=path.points[12];eq(hitConnection(paths.paths,p.x,p.y,project,3)?.binding_ref,path.binding.binding_ref);}
 eq(hitConnection(paths.paths,0,0,p=>({...p,visible:false})),null);
 eq(hitConnection(connectionPaths([],poses).paths,0,-11,project),null,'disconnecting renderer correspondence must break selection proof');
 const engine={scene:new Group(),lastPoses:poses,isLightScene:()=>true,projectWorldToScreen:(x,y,z)=>({x,y,z,visible:true})};
 const before=engine.scene.onBeforeRender,layer=new ExpressionConnectionLayer(engine);
 layer.configure(rows);engine.scene.onBeforeRender();eq(layer.group.children.length,2);
 const line=layer.group.children[0];eq(line.userData.binding_ref,rows[0].binding_ref);
 eq(line.geometry.getAttribute('position').count,25);eq(layer.hitTest(0,-11)?.relation.ref,'wiki:edge:a');
 poses[0].x=-250;engine.scene.onBeforeRender();eq(line.geometry.getAttribute('position').getX(0),-250);
 layer.configure([]);engine.scene.onBeforeRender();eq(layer.group.children.length,0);eq(layer.hitTest(0,-11),null);
 layer.dispose();eq(engine.scene.children.length,0);eq(engine.scene.onBeforeRender,before);
 console.log(`Technē field bindings: ${assertions} production conversion/geometry/negative-control assertions passed`);
} finally {await server.close();}
