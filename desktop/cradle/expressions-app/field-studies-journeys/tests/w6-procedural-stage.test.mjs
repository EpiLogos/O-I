// Lane W6 (the Torus's Stage page): the procedural stage's own operations as stage commands (stageCommands.ts 'procedural-stage'), run
// by the native field's controller as the Studio's Procedural stage block runs them (nativeField.ts stage, controller.ts stageAct) and
// relayed by the instrument session to the kernel's native_expression exchange; the procedures the frame holds and the last act's
// standing ride on the stage announcement (stageReading.ts). Run after `npm run build:journeys` (this suite imports the bundled build/).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readStageRequest,STAGE_COMMANDS,STAGE_PROCEDURAL_ACTIONS,STAGE_BINDING_BUDGET} from '../build/stageCommands.js';
import {stageReadingOf,readFrameStage,STUDIO_PROCEDURE} from '../build/stageReading.js';

const ask=(command,extra={})=>readStageRequest({v:1,kind:'host-command',req:9,command,...extra});
const source=path=>readFileSync(new URL(`../src/${path}`,import.meta.url),'utf8');
const bodyOf=(text,head)=>{const at=text.indexOf(head);assert.ok(at>=0,head);let depth=0;for(let i=text.indexOf('=>{',at)+2;i<text.length;i++){if(text[i]==='{')depth++;if(text[i]==='}'&&--depth===0)return text.slice(at,i+1);}return text.slice(at);};

test('the procedural stage\'s acts are closed commands: a ref for each act, a bind\'s budget within QL\'s own bounds', () => {
 assert.ok(STAGE_COMMANDS.includes('procedural-stage'));
 assert.deepEqual([...STAGE_PROCEDURAL_ACTIONS],['state','evaluate','bind','unbind','retire']);
 assert.deepEqual([STAGE_BINDING_BUDGET.min,STAGE_BINDING_BUDGET.max],[1,1024],'QL continuous/stage.rs MAX_BINDING_BUDGET');
 assert.deepEqual(ask('procedural-stage',{action:'state'}).command,{command:'procedural-stage',action:'state'});
 for(const action of ['evaluate','unbind','retire'])
  assert.deepEqual(ask('procedural-stage',{action,procedure_ref:'p'}).command,{command:'procedural-stage',action,procedure_ref:'p'});
 assert.deepEqual(ask('procedural-stage',{action:'bind',procedure_ref:'p',max_evaluations:32}).command,{command:'procedural-stage',action:'bind',procedure_ref:'p',max_evaluations:32});
 assert.deepEqual(ask('procedural-stage',{action:'bind',procedure_ref:'p'}).command,{command:'procedural-stage',action:'bind',procedure_ref:'p'},'no budget: QL\'s own default');
 for(const bad of [{action:'evaluate'},{action:'retire',procedure_ref:''},{action:'bind',procedure_ref:'p',max_evaluations:0},{action:'bind',procedure_ref:'p',max_evaluations:1025},
  {action:'bind',procedure_ref:'p',max_evaluations:2.5},{action:'state',procedure_ref:'p'},{action:'evaluate',procedure_ref:'p',procedure:{}},{action:'replace',procedure_ref:'p'}])
  assert.equal(ask('procedural-stage',bad),null,JSON.stringify(bad));
});

test('the announcement carries the procedure the frame holds and the last act\'s standing, and the boundary admits it exactly', () => {
 const disclosure={schema:'ql.stage-state/v1',subject_ref:'ql:subject:live',generation:3,slots:{'material.damping':{owner:STUDIO_PROCEDURE.ref,revision:1}},bindings:[]};
 const applied=stageReadingOf(disclosure,false,{standing:'applied',procedure_ref:STUDIO_PROCEDURE.ref});
 assert.deepEqual(applied.procedures,[{ref:'ta-onta:studio:first-vertical',revision:1,trigger:'invocation',selector:['material.damping']}]);
 assert.deepEqual(applied.last,{standing:'applied',procedure:STUDIO_PROCEDURE.ref});
 assert.deepEqual(readFrameStage(JSON.parse(JSON.stringify(applied))),applied,'the boundary reads it back');
 const refused=stageReadingOf(disclosure,false,{standing:'refused',why:'no binding names x'});
 assert.deepEqual(refused.last,{standing:'refused',why:'no binding names x'});
 assert.equal(stageReadingOf(disclosure,false).last,undefined,'no act yet: no last standing');
 assert.equal(readFrameStage({...applied,last:{standing:'maybe'}}),null,'a standing outside applied and refused is refused');
 assert.equal(readFrameStage({...applied,procedures:[{ref:'p',revision:1,trigger:'invocation',selector:['form'],changes:[]}]}),null,'a procedure carries no document');
});

test('each act runs the controller\'s own stage operation through the one serial owner, and the stage is read back after (source reading)', () => {
 const app=source('app.ts'),field=source('nativeField.ts'),controller=source('native-field/controller.ts'),session=source('native-field/ql/instrument-session.mjs');
 assert.match(app,/case 'procedural-stage':[\s\S]*?await nativeField\.stage\(command\);/,'the frame routes the command to the native field');
 const stage=bodyOf(field,'const stage=async(command:StageProceduralCommand)');
 assert.match(stage,/controller\.stageEvaluate\(held\(command\.procedure_ref\)\)/,'Evaluate: the procedure the frame holds, by its ref');
 assert.match(stage,/controller\.stageBind\(held\(command\.procedure_ref\),command\.max_evaluations\)/);
 assert.match(stage,/controller\.stageUnbind\(command\.procedure_ref\)/);
 assert.match(stage,/controller\.stageRetire\(command\.procedure_ref\)/);
 assert.match(stage,/if\(command\.action!=='state'\)await controller\.stageState\(\);/,'read back, as the Studio\'s Evaluate button does');
 assert.match(field,/if\(op==='stage-evaluate'\)return run\(async\(\)=>\{await controller\.stageEvaluate\(exampleProcedure\(\)\);await controller\.stageState\(\);\}\);/,'the Studio\'s own Evaluate, unchanged');
 for(const [method,operation] of [['stageBind','stage-bind'],['stageUnbind','stage-unbind'],['stageRetire','stage-retire'],['stageEvaluate','stage-evaluate']])
  assert.match(controller,new RegExp(`${method}\\(.*\\)\\{\\n\\s*return this\\.stageAct\\('[^']+',\\(\\)=>\\(\\{operation:'${operation}'`),`${method} sends ${operation} through stageAct`);
 assert.match(controller,/private async stageAct\(operation:string,build:\(\)=>any\):Promise<void>\{\n\s*try\{await this\.determinant\(operation,build,false\);\}/,'through the one serial owner, as every determinant');
 assert.match(session,/const STAGE_ACTS = \['stage-evaluate', 'stage-retire', 'stage-bind', 'stage-unbind'\];/);
});
