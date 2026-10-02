import test from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const modulePath=name=>JSON.stringify(path.join(root,'packages/oi-design-system/expressions-engine/shell',name+'.mjs'));

test('actual emitted modules preserve source states and the native owner blueprint contract',async()=>{
 const temporary=mkdtempSync(path.join(tmpdir(),'oi-emitted-formation-'));
 try {
  const output=path.join(temporary,'check.mjs');
  await build({absWorkingDir:root,nodePaths:[path.join(root,'desktop/cradle/node_modules'),path.join(root,'desktop/cradle/expressions-app/node_modules')],
   stdin:{contents:`
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankJourney,entity,clone,validateJourney} from ${modulePath('model')};
import {toNativeConfig,nativeSnapshotToJourney} from ${modulePath('nativeBridge')};
import {captureObjectState} from ${modulePath('sourceState')};
import {blueprintPosition} from ${modulePath('blueprintGeometry')};
const j=blankJourney(),e=entity('Formation module replay','O');j.scenes[0].entities=[e];
e.sequence.manual=true;
e.sequence.steps[0].layers=[{id:'original-layer',text:'O',z:.25,source:{kind:'ascii',ascii:{text:'###'}}}];
e.sequence.steps[0].objectState={...captureObjectState(e).objectState,normalized:false};
e.sequence.steps.push({...clone(e.sequence.steps[0]),id:'ordinary-state',text:'WW',layers:[],objectState:{...captureObjectState(e).objectState,normalized:true}});
validateJourney(JSON.parse(JSON.stringify(j)));
const native=toNativeConfig(j.scenes[0]),reopened=nativeSnapshotToJourney(native).scenes[0].entities[0];
assert.equal(native.entities[0].sequence.advance,'off');
assert.equal(native.entities[0].sequence.links.length,2);
assert.deepEqual(reopened.sequence.steps[1].layers,[]);
assert.equal(reopened.sequence.steps[0].layers[0].source.ascii.text,'###');
assert.equal(native.entities[0].sequence.links[0].state.extent.normalized,false);
assert.equal(native.entities[0].sequence.links[1].state.extent.normalized,true);
const owner=JSON.parse(readFileSync(${JSON.stringify(path.join(root,'desktop/cradle/kernel/src/expression_blueprint_sixfold.json'))},'utf8'));
for(const site of owner.sites){
 const binding={transform:{translation:[11,-7,3],rotation:[0,0,0],scale:.75}};
 assert.deepEqual(blueprintPosition(binding,site.address.coordinate.position),site.xyz.map((v,i)=>v*.75+binding.transform.translation[i]));
}
`,resolveDir:root,sourcefile:'emitted-formation-check.mjs',loader:'js'},bundle:true,format:'esm',platform:'node',target:'es2022',outfile:output});
  execFileSync(process.execPath,[output],{stdio:'pipe'});
 }finally{rmSync(temporary,{recursive:true,force:true});}
});
