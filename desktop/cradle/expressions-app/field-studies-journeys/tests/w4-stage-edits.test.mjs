// Lane W4 (Expressions, Live and Quaternal Logic, item 5): the walk's pace and seams, the Timeline's camera, saved views, relation links and
// card categories, and the Canvas's line connector as stage commands (stageCommands.ts), each the frame's own act (app.ts journeyEdit and
// runStageCommand; researchInstruments.tsx timelineAct and setCanvasConnector), and the chronology's links and hidden categories in the
// research announcement (researchReading.ts). Run after `npm run build:journeys` (this suite imports the bundled build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readStageRequest,STAGE_COMMANDS,STAGE_JOURNEY_EDITS,STAGE_TIMELINE_ACTIONS,STAGE_TIMELINE_CAMERA} from '../build/stageCommands.js';
import {timelineReadingOf,readFrameResearch} from '../build/researchReading.js';
import {TIMELINE_CENTER_YEAR_LIMIT,TIMELINE_PIXELS_PER_YEAR_RANGE} from '../build/researchMaterial.js';

const ask=(command,extra={})=>readStageRequest({v:1,kind:'host-command',req:7,command,...extra});
const app=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const instruments=readFileSync(new URL('../src/researchInstruments.tsx',import.meta.url),'utf8');
const bodyOf=(source,head)=>{const at=source.indexOf(head);assert.ok(at>=0,head);let depth=0;for(let i=source.indexOf('){',at)+1;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0)return source.slice(at,i+1);}return source.slice(at);};

test('the walk\'s pace and seams are closed commands: each stop by index, each value in its own vocabulary', () => {
 assert.ok(STAGE_COMMANDS.includes('timeline'));
 assert.deepEqual([...STAGE_JOURNEY_EDITS],['pace','seam','switch','curve','loop']);
 assert.deepEqual(ask('journey',{action:'pace',index:2,seconds:24}).command,{command:'journey',action:'pace',index:2,seconds:24});
 assert.deepEqual(ask('journey',{action:'seam',index:1,transition:'wipe',direction:'up'}).command,{command:'journey',action:'seam',index:1,transition:'wipe',direction:'up'});
 assert.deepEqual(ask('journey',{action:'seam',index:0,seconds:2.5}).command,{command:'journey',action:'seam',index:0,seconds:2.5});
 assert.deepEqual(ask('journey',{action:'seam',index:0,at:.5}).command,{command:'journey',action:'seam',index:0,at:.5});
 assert.deepEqual(ask('journey',{action:'switch',index:3,mode:'at-end'}).command,{command:'journey',action:'switch',index:3,mode:'at-end'});
 assert.deepEqual(ask('journey',{action:'curve',index:3,type:'smooth'}).command,{command:'journey',action:'curve',index:3,type:'smooth'});
 assert.deepEqual(ask('journey',{action:'loop',on:true}).command,{command:'journey',action:'loop',on:true});
 for(const bad of [{action:'seam',index:0},{action:'seam',index:0,transition:'iris'},{action:'seam',index:0,at:2},{action:'pace',index:-1,seconds:3},{action:'pace',index:0,seconds:-1},
  {action:'switch',index:0,mode:'later'},{action:'curve',index:0,type:'spline'},{action:'loop',on:'yes'},{action:'pace',index:0,seconds:3,label:'x'}])
  assert.equal(ask('journey',bad),null,JSON.stringify(bad));
});

test('the Timeline\'s acts and the Canvas\'s connector are closed commands; the camera keeps the view record\'s own bounds', () => {
 assert.deepEqual([...STAGE_TIMELINE_ACTIONS],['camera','view','save-view','links','categories']);
 assert.equal(STAGE_TIMELINE_CAMERA.centreLimit,TIMELINE_CENTER_YEAR_LIMIT,'the centre bound is researchMaterial.ts\'s');
 assert.deepEqual([STAGE_TIMELINE_CAMERA.zoom.min,STAGE_TIMELINE_CAMERA.zoom.max],[...TIMELINE_PIXELS_PER_YEAR_RANGE],'the zoom range is researchMaterial.ts\'s');
 assert.deepEqual(ask('timeline',{action:'camera',centre:1650,zoom:6}).command,{command:'timeline',action:'camera',centre:1650,zoom:6});
 assert.deepEqual(ask('timeline',{action:'view',name:'War'}).command,{command:'timeline',action:'view',name:'War'});
 assert.deepEqual(ask('timeline',{action:'save-view',name:'War'}).command,{command:'timeline',action:'save-view',name:'War'});
 assert.deepEqual(ask('timeline',{action:'links',on:false}).command,{command:'timeline',action:'links',on:false});
 assert.deepEqual(ask('timeline',{action:'categories',hidden:['myth','claim']}).command,{command:'timeline',action:'categories',hidden:['myth','claim']});
 for(const bad of [{action:'camera',centre:1e11,zoom:1},{action:'camera',centre:0,zoom:0},{action:'view',name:''},{action:'categories',hidden:['dream']},
  {action:'categories',hidden:['myth','myth']},{action:'filters'}])
  assert.equal(ask('timeline',bad),null,JSON.stringify(bad));
 assert.deepEqual(ask('canvas',{action:'connector',line:'b:2',lineKind:'elbow',toSide:'auto'}).command,{command:'canvas',action:'connector',line:'b:2',lineKind:'elbow',toSide:'auto'});
 for(const bad of [{action:'connector',line:'b:2'},{action:'connector',line:'b:2',fromSide:'middle'},{action:'view',name:'Mine'}])
  assert.equal(ask('canvas',bad),null,JSON.stringify(bad));
});

test('each edit is the frame\'s own: the Pace save\'s retime, the seam chooser\'s transition write, its edge plan; refusals thrown in their words', () => {
 const edit=bodyOf(app,'function journeyEdit(');
 assert.match(edit,/changed\(\(\)=>\{retimeScene\(store\.document,target\.id,\{duration:command\.seconds\}\);\},true,`Trim scene \$\{target\.name\}`\)/,'one labelled retime, as the trim and the Pace save make it');
 assert.match(edit,/transitionSpecFor\(kind,params\)/);
 assert.match(edit,/changed\(\(\)=>\{applyTimelineMove\(store\.document,list=>writeSeamTransition\(list,target\.id,spec,seconds\)\);\},true,transitionLabel\(kind\)\)/,'the seam chooser\'s own write');
 assert.match(edit,/kind==='wipe'\?\{direction:command\.direction\?\?prior\?\.direction\}:kind==='dip-to-colour'\?\{at:command\.at\?\?prior\?\.at\}:\{\}/,'a kind keeps only the parameters it takes (setSeamKind)');
 assert.match(edit,/A transition lasts \$\{SCENE_TRANSITION_MIN\}–\$\{SCENE_TRANSITION_MAX\} seconds\./,'the chooser\'s refusal, thrown');
 const edge=bodyOf(app,'function journeyEdge(');
 assert.match(edge,/edgeEditRefusal\(/);
 assert.match(edge,/journeyInstrument\?\.editEdge\(edit,text=>toast\(text\)\)/,'the path panel\'s own edit is taken first when hosted, as editSeamEdge does');
 assert.match(edge,/planEdgeEdit\(store\.document,edit\)/);
 assert.match(edge,/changed\(\(\)=>applyTimelineMove\(store\.document,list=>applyEdgeWrite\(list,write\)\),true,label\)/);
 const run=bodyOf(app,'async function runStageCommand(');
 assert.match(run,/case 'timeline':if\(!researchInstruments\)throw new Error\('This application has no Timeline\.'\);await researchInstruments\.timelineAct\(command\);break;/);
 assert.match(run,/await researchInstruments\.setCanvasConnector\(command\.line,/);
});

test('the Timeline\'s and the Canvas\'s acts are the instruments\' own: Go to, Save view, the lens\'s presentation, the connector controls\' write', () => {
 assert.match(instruments,/goTo:name=>\{if\(!savedTimelineViews\(\)\[name\]\)throw new Error\(`No timeline view named "\$\{name\}"`\);applyTimelineView\(name\);\}/);
 assert.match(instruments,/save:name=>\{const refused=saveTimelineViewNamed\(name\);if\(refused\)throw new Error\(refused\);\}/);
 assert.match(instruments,/saveTimelineViewNamed\(entered\);/,'the prompt\'s Save view runs the same save');
 assert.match(instruments,/state\.timelinePending=\{name:'',presentation:\{\.\.\.held,camera:\{centerYear:centre,pixelsPerYear:zoom\}\},quiet:true\};/,'a camera keeps the lens\'s filters, frame and stack');
 assert.match(instruments,/await handle\.restore\(\{\.\.\.handle\.capture\(\),\.\.\.patch\}\)/,'links and categories through the lens\'s own presentation');
 assert.match(instruments,/const next=connectorRecord\(\{kind:patch\.kind\?\?record\?\.kind\?\?'curved',label:record\?\.label,/,'the record the connector controls write: the label kept');
 assert.match(instruments,/return apply\(\(\)=>host\.connector!\(canvas\.sceneId!,line,next\)\);/);
});

test('the chronology\'s relation links and hidden card categories travel in the announcement, read back exact or refused', () => {
 const bundle={nodes:[{graphNodeId:'t:1',title:'An event',isTemporal:true,validFrom:'1595'}],relationships:[]};
 const ruler=timelineReadingOf(bundle,{projection:'chronology',camera:{centerYear:1600,pixelsPerYear:2},views:[],links:false,hidden:['myth']});
 assert.equal(ruler.links,false);
 assert.deepEqual(ruler.hiddenCategories,['myth']);
 assert.deepEqual(readFrameResearch({timeline:ruler}).timeline,ruler);
 const unmounted=timelineReadingOf(bundle,{projection:'field',views:[]});
 assert.equal(unmounted.links,undefined,'not drawn: nothing claimed');
 assert.equal(readFrameResearch({timeline:{...ruler,links:'no'}}),null);
 assert.equal(readFrameResearch({timeline:{...ruler,hiddenCategories:[3]}}),null);
});
