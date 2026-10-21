// Lane W4-Technē: the research instruments' state as the frame announces it to its host (researchReading.ts) — the walk from the open
// Journey document, the board the Canvas draws, the ruler the Timeline draws — and the walk's and the camera's own acts as stage
// commands (stageCommands.ts journey · canvas). Each builder copies what the frame holds; the reader the host boundary uses refuses a
// malformed announcement whole. Run after `npm run build:journeys` (this suite imports the bundled build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyReadingOf,canvasReadingOf,timelineReadingOf,viewportOf,readFrameResearch,yearOf,RESEARCH_LIMITS} from '../build/researchReading.js';
import {readStageRequest,stageRequestMessage,STAGE_COMMANDS} from '../build/stageCommands.js';
import {fieldStudies} from '../build/model.js';

test('the walk is the Journey document: each Scene its stop, its character the narration, the transition it is entered by', () => {
 const doc=fieldStudies();
 doc.scenes[2].transitionSpec={kind:'dip-to-colour',at:.35,switchMode:'sync',curve:{type:'hold'}};doc.scenes[2].transition=4;
 doc.scenes[4].transitionSpec={kind:'wipe',direction:'right'};
 doc.scenes.at(-1).breakAtEnd=true;
 const walk=journeyReadingOf(doc,{index:2,local:1.1,playing:true,entered:false});
 assert.equal(walk.name,'Field studies');
 assert.equal(walk.loops,true);
 assert.equal(walk.stopAtEnd,true,'the last Scene\'s loop exit');
 assert.equal(walk.stops.length,8);
 assert.deepEqual(walk.stops[0],{name:'Ink',words:'Fine, irregular stippling. Form on the edge of dissolution.',hold:14,seconds:1.5,kind:'crossfade',curve:'linear',switch:'immediate'},
  'an absent spec is the frame\'s own default crossfade, linear and immediate (transitions.ts transitionKindOf, switchModeOf)');
 assert.deepEqual(walk.stops[2],{name:'Gather',words:'Rounded grains find a shared current.',hold:14,seconds:4,kind:'dip-to-colour',curve:'hold',switch:'sync',at:.35});
 assert.equal(walk.stops[4].direction,'right');
 assert.equal(walk.stops[1].direction,undefined,'only a wipe names a direction');
 assert.deepEqual([walk.at,walk.local,walk.playing,walk.entered],[2,1.1,true,false]);
 assert.deepEqual(readFrameResearch({journey:walk}).journey,walk,'the host reads it back exactly');
});

test('the board is the Canvas the frame draws: its cards by their research kind, its lines with their connector records, its frames, its camera over the pane', () => {
 const canvas={nodes:[
   {id:'e:root',title:'Root',position:{x:60,y:240},size:{width:94,height:94}},
   {id:'e:q',title:'Which centre speaks first?',position:{x:-250,y:20},size:{width:220,height:180}},
   {id:'e:sacral',title:'Sacral',position:{x:230,y:160}},
  ],
  edges:[{id:'b:1',sourceNodeId:'e:root',targetNodeId:'e:sacral',directionality:'forward'},{id:'b:2',sourceNodeId:'e:q',targetNodeId:'e:root',directionality:'none'},{id:'b:3',sourceNodeId:'e:root',targetNodeId:'e:gone'}]};
 const material={frames:{f1:{label:'frame-1',title:'Lower three',memberRefs:['e:root','e:sacral','e:gone'],z:0}},connectors:{'b:1':{kind:'elbow',label:'rises to',fromSide:'right',toSide:'left'}}};
 const board=canvasReadingOf(canvas,material,{viewport:{x:380,y:210,zoom:1},pane:{width:760,height:420},selected:['e:q','e:gone'],selectedLine:'b:1',drawing:false,erasing:true,lasso:false,snap:true},
  id=>({'e:q':'sticky'})[id]);
 assert.deepEqual(board.items.map(item=>[item.id,item.kind,item.w,item.h]),[['e:root','card',94,94],['e:q','sticky',220,180],['e:sacral','card',240,160]],'a node with no size takes the canvas\'s own card size');
 assert.deepEqual(board.lines,[{id:'b:1',from:'e:root',to:'e:sacral',kind:'elbow',label:'rises to',fromSide:'right',toSide:'left',direction:'directed'},{id:'b:2',from:'e:q',to:'e:root',direction:'undirected'}],
  'a line to a node off the board is not drawn; a line with no connector record keeps the frame\'s own routing');
 assert.deepEqual(board.frames,[{title:'Lower three',members:['e:root','e:sacral']}]);
 assert.deepEqual(board.camera,{cx:0,cy:0,zoom:100},'the board point at the pane\'s centre');
 assert.deepEqual(board.selected,['e:q']);
 assert.equal(board.selectedLine,'b:1');
 assert.deepEqual([board.drawing,board.erasing,board.lasso,board.snap],[false,true,false,true]);
 assert.deepEqual(viewportOf({cx:0,cy:0,zoom:100},{width:760,height:420}),{x:380,y:210,zoom:1},'the camera command is the inverse of the reading');
 assert.deepEqual(viewportOf({cx:100,cy:-50,zoom:50},{width:760,height:420}),{x:330,y:235,zoom:.5});
 assert.equal(canvasReadingOf(canvas,material,{selected:[]},()=>undefined).camera,undefined,'no viewport, no pane: no camera');
 assert.deepEqual(readFrameResearch({canvas:board}).canvas,board);
});

test('the ruler is the reading the Timeline draws: its dated nodes, the relations between them, the years they span, its projection and camera', () => {
 const bundle={nodes:[
   {graphNodeId:'t:1',title:'Valentinus',isTemporal:true,validFrom:'1595-01-01T00:00:00Z',validTo:'1625-01-01T00:00:00Z',entityType:'event',historicity:'historical'},
   {graphNodeId:'t:2',title:'Kabbala denudata',isTemporal:true,validFrom:'1677'},
   {graphNodeId:'t:3',title:'Undated',isTemporal:true},
   {graphNodeId:'s:1',title:'A source',isTemporal:false,validFrom:'1500'},
   {graphNodeId:'t:4',title:'Naassene psalm',isTemporal:true,validFrom:'-000222-01-01T00:00:00Z'},
  ],relationships:[{id:'r:1',sourceGraphNodeId:'t:1',targetGraphNodeId:'t:2',relType:'echo',properties:{standing:'derived'}},{id:'r:2',sourceGraphNodeId:'t:1',targetGraphNodeId:'s:1',relType:'cites',properties:{}}]};
 const ruler=timelineReadingOf(bundle,{projection:'field',camera:{centerYear:1700,pixelsPerYear:2},views:['Late antiquity']});
 assert.deepEqual(ruler.events.map(event=>[event.id,event.from,event.to]),[['t:1',1595,1625],['t:2',1677,1677],['t:4',-222,-222]],'an undated node is not on the ruler; a source is not an event');
 assert.equal(ruler.events[0].family,'event');
 assert.deepEqual(ruler.edges,[{id:'r:1',from:'t:1',to:'t:2',kind:'echo',standing:'derived'}],'only relations between dated events');
 assert.deepEqual(ruler.domain,{from:-222,to:1677});
 assert.deepEqual([ruler.projection,ruler.centre,ruler.zoom],['field',1700,2]);
 assert.deepEqual(ruler.views,[{id:'Late antiquity',label:'Late antiquity'}]);
 assert.equal(yearOf('12th c.'),undefined,'a year is read only where the source dates it');
 assert.deepEqual(readFrameResearch({timeline:ruler}).timeline,ruler);
 assert.equal(timelineReadingOf({nodes:[],relationships:[]},{views:[]}).domain,undefined,'no dated event, no domain');
});

test('the host reads the announcement exactly or refuses it whole', () => {
 assert.deepEqual(readFrameResearch({}),{});
 for (const bad of [null,[],{other:1},{journey:{name:'x'}},{canvas:{items:[{id:'a',kind:'blob',x:0,y:0,w:1,h:1,name:''}],lines:[],frames:[],selected:[],drawing:false,erasing:false,lasso:false,snap:false}},
  {timeline:{projection:'spiral',events:[],edges:[],views:[]}},{journey:{name:'x',loops:true,stopAtEnd:false,at:0,local:0,playing:false,entered:false,stops:[{name:'a',words:'',hold:1,seconds:0,kind:'cut',curve:'linear',switch:'immediate',extra:1}]}}])
  assert.equal(readFrameResearch(bad),null,JSON.stringify(bad));
 const many=Array.from({length:RESEARCH_LIMITS.stops+1},()=>({name:'a',words:'',hold:1,seconds:0,kind:'cut',curve:'linear',switch:'immediate'}));
 assert.equal(readFrameResearch({journey:{name:'x',loops:true,stopAtEnd:false,at:0,local:0,playing:false,entered:false,stops:many}}),null,'past the bound: refused');
 const doc=fieldStudies();doc.scenes=Array.from({length:RESEARCH_LIMITS.stops+5},()=>doc.scenes[0]);
 assert.equal(journeyReadingOf(doc,{index:0,local:0,playing:false,entered:false}).stops.length,RESEARCH_LIMITS.stops,'the builder announces a long walk in part');
});

test('the walk\'s and the camera\'s acts are commands of the one closed vocabulary', () => {
 assert.ok(STAGE_COMMANDS.includes('journey')&&STAGE_COMMANDS.includes('canvas'));
 const read=command=>readStageRequest(stageRequestMessage(1,command)??{v:1,kind:'host-command',req:1,...command})?.command??null;
 assert.deepEqual(read({command:'journey',action:'stand',index:3,seconds:2.5}),{command:'journey',action:'stand',index:3,seconds:2.5});
 assert.deepEqual(read({command:'journey',action:'stand',index:0}),{command:'journey',action:'stand',index:0});
 for (const action of ['play','stop','enter','return']) assert.deepEqual(read({command:'journey',action}),{command:'journey',action});
 assert.deepEqual(read({command:'canvas',action:'camera',cx:10,cy:-4,zoom:55}),{command:'canvas',action:'camera',cx:10,cy:-4,zoom:55});
 for (const bad of [{command:'journey',action:'stand',index:-1},{command:'journey',action:'stand',index:1.5},{command:'journey',action:'stand',index:1,seconds:-1},{command:'journey',action:'walk'},
  {command:'journey',action:'play',index:1},{command:'canvas',action:'camera',cx:0,cy:0,zoom:400},{command:'canvas',action:'camera',cx:0,cy:0},{command:'canvas',action:'pan',cx:0,cy:0,zoom:100}])
  assert.equal(readStageRequest({v:1,kind:'host-command',req:1,...bad}),null,JSON.stringify(bad));
});

test('the procedural stage the field last disclosed: its four slots with their owners, its bindings with their trigger and budget, never read for the announcement', async () => {
 const {stageReadingOf,readFrameStage,STAGE_SLOT_NAMES}=await import('../build/stageReading.js');
 // ql.stage-state/v1 as the native field keeps it (controller.ts instrument.stage; nativeField.ts renderStage reads the same rows)
 const disclosure={schema:'ql.stage-state/v1',subject_ref:'ql:subject:live',event_ref:'ql:event:1',generation:7,form:{address:'M1',clock_steps:3},
  slots:{form:{owner:'ta-onta:stage:cli-fold',revision:1},'material.damping':{}},
  bindings:[{procedure_ref:'ta-onta:stage:cli-bound',revision:2,determinant:'m1-advance',evaluations:5,max_evaluations:16,standing:'active'},{procedure_ref:'ta-onta:stage:once',evaluations:1,max_evaluations:1,standing:'exhausted'},{broken:true}]};
 const stage=stageReadingOf(disclosure,true);
 assert.deepEqual(stage.slots,[{slot:'form',owner:'ta-onta:stage:cli-fold',revision:1},{slot:'material.damping'},{slot:'clock.inscription'},{slot:'clock.lensing'}],'every slot, the unheld ones authored');
 assert.deepEqual(stage.bindings,[{procedure:'ta-onta:stage:cli-bound',revision:2,trigger:'m1-advance',evaluations:5,max:16,standing:'active'},{procedure:'ta-onta:stage:once',trigger:'invocation',evaluations:1,max:1,standing:'exhausted'}],
  'a binding with no determinant fires on invocation; a row the field does not write is not read');
 assert.deepEqual([stage.subject,stage.generation,stage.stale],['ql:subject:live',7,true]);
 assert.deepEqual(STAGE_SLOT_NAMES,['form','material.damping','clock.inscription','clock.lensing']);
 assert.equal(stageReadingOf(null,false),undefined,'no disclosure read: nothing announced');
 assert.deepEqual(readFrameStage(stage),stage,'the host reads it back exactly');
 assert.equal(readFrameStage({...stage,extra:1}),null);
 assert.equal(readFrameStage({...stage,bindings:[{procedure:'x',trigger:'m1-advance',evaluations:-1,max:1,standing:'active'}]}),null);
});
