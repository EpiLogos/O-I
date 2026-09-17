import assert from 'node:assert/strict';
import http from 'node:http';
import {createServer} from 'vite';
// ES1/ES4 world operations: the renderer face must put exactly the tagged
// seam on the wire — `{"op":"expression_world","request":{...}}` — with the
// documented JSON shapes the kernel deserialises (unknown fields refused).
const server = await createServer({server:{middlewareMode:true},appType:'custom'});
const captured=[];
const httpd=http.createServer((req,res)=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>{captured.push(JSON.parse(body));res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,outcome:{result:'expression_world',data:{state:'selected',selection:{subject_ref:'wiki:a'}},receipts:[]}}));});});
await new Promise(resolve=>httpd.listen(0,'127.0.0.1',resolve));
let n=0;
try{
 const {worldOp}=await server.ssrLoadModule('/src/expression/world.ts');
 const port=httpd.address().port;
 const transport={kind:'bridge',url:`http://127.0.0.1:${port}`};
 // Selection: one shared deictic context over exact refs.
 const data=await worldOp(transport,{operation:'selection_set',origin:'graph',subject_ref:'wiki:node:lesson',kind:'wiki-node',native_owner:'central',revision:'wiki-r19',expression_ref:'expression:lesson'});
 assert.equal(data.state,'selected');n++;
 assert.deepEqual(captured.at(-1),{op:'expression_world',request:{operation:'selection_set',origin:'graph',subject_ref:'wiki:node:lesson',kind:'wiki-node',native_owner:'central',revision:'wiki-r19',expression_ref:'expression:lesson'}});n++;
 // Portal open rides the Surface host with the exact target ref.
 await worldOp(transport,{operation:'portal_open',portal_ref:'portal:1',target_ref:'wiki:node:lesson',surface_kind:'source',surface_id:'s-1',placement:'overlay',title:'Lesson',actor:'agent:composer',activity_ref:'activity:caller:1'});
 assert.deepEqual(captured.at(-1).request,{operation:'portal_open',portal_ref:'portal:1',target_ref:'wiki:node:lesson',surface_kind:'source',surface_id:'s-1',placement:'overlay',title:'Lesson',actor:'agent:composer',activity_ref:'activity:caller:1'});n++;
 // ExpressiveAct perform carries the atomic change set and correlation.
 await worldOp(transport,{operation:'act_perform',act_ref:'act:1',expression_ref:'expression:lesson',expected_revision:3,summary:'Widen',actor:'agent:composer',activity_ref:null,changes:[{change:'focus',scene_ref:'expression:lesson:scene:main',entity_ref:null}]});
 assert.deepEqual(captured.at(-1).request.changes,[{change:'focus',scene_ref:'expression:lesson:scene:main',entity_ref:null}]);n++;
 await worldOp(transport,{operation:'act_interrupt',act_ref:'act:1',actor:'human:author',reason:'Let me look'});
 assert.equal(captured.at(-1).request.operation,'act_interrupt');n++;
 await worldOp(transport,{operation:'act_checkpoint',act_ref:'act:1',checkpoint_ref:'cp:1',actor:'human:author'});
 await worldOp(transport,{operation:'act_restore',act_ref:'act:1',checkpoint_ref:'cp:1',expected_revision:5,actor:'human:author',activity_ref:null});
 assert.equal(captured.at(-1).request.operation,'act_restore');n++;
 // Whole bind/rebase carry exact readings and revisions.
 await worldOp(transport,{operation:'whole_bind',whole_ref:'whole:1',basis:{ref:'wiki:node:lesson',revision:'wiki-r19',availability:'available'},locus_ref:'wiki:node:lesson',members:[{subject:{ref:'wiki:node:lesson',revision:'wiki-r19',availability:'available'},native_owner:'central'}],relations:[],expression_ref:'expression:lesson',actor:'human:author',activity_ref:null});
 assert.deepEqual(captured.at(-1).request.basis,{ref:'wiki:node:lesson',revision:'wiki-r19',availability:'available'});n++;
 await worldOp(transport,{operation:'whole_rebase',whole_ref:'whole:1',expected_basis_revision:'wiki-r19',basis:{ref:'wiki:node:lesson',revision:'wiki-r20',availability:'available'},members:[{subject:{ref:'wiki:node:lesson',revision:'wiki-r20',availability:'available'},native_owner:'central'}],relations:[],actor:'human:author',activity_ref:null});
 assert.equal(captured.at(-1).request.expected_basis_revision,'wiki-r19');n++;
 // An unavailable transport is an honest error, never a fabricated result.
 await assert.rejects(()=>worldOp({kind:'unavailable',reason:'no kernel transport'},{operation:'selection_read'}),/no kernel transport/);n++;
 console.log(`Expression world: ${n} wire-shape assertions passed`);
}finally{await server.close();httpd.close();}
