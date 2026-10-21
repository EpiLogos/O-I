// W6: the frame announces what it holds of the live scene and its field. The live scene's M2 condition (instrumentCondition.ts) from the
// sources the native field inspected rides the hosted state; the engine's morph phases and the plate's stations ride the editor reading's
// observation (hostEditor.ts), from the engine's own telemetry and stations(). Run after `npm run build:journeys` (build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conditionReadingOf,readFrameCondition,MATERIAL_FIBRES} from '../build/instrumentCondition.js';

const source=path=>readFileSync(new URL(`../src/${path}`,import.meta.url),'utf8');

test('the condition is the inspected sources\' own m2.condition.source_path, verbatim, and its reader admits it exactly', () => {
 assert.deepEqual([...MATERIAL_FIBRES],['earth','fire','water','air'],'QL\'s MaterialFibre (m2_engine.rs)');
 const sources={original:{},current:{m2:{condition:{source_path:{tattva_coordinate:'#2-2-2-5-5',material_fibre:'earth',maqam_name:'Kirdan'}}}},original_field:{}};
 const condition=conditionReadingOf(sources);
 assert.deepEqual(condition,{tattva_ref:'#2-2-2-5-5',material_fibre:'earth'},'only the tattva and its fibre are announced');
 assert.deepEqual(readFrameCondition(JSON.parse(JSON.stringify(condition))),condition);
 assert.equal(conditionReadingOf(null),undefined,'no sources inspected: nothing');
 assert.equal(readFrameCondition({tattva_ref:'#2-2-2-5-5',material_fibre:'earth',extra:1}),null);
});

test('the controller carries the condition on its reading, the frame announces it, and the editor observation carries the phases and stations (source reading)', () => {
 const controller=source('native-field/controller.ts'),app=source('app.ts'),editor=source('hostEditor.ts');
 assert.match(controller,/condition:conditionReadingOf\(this\.sources\)\?\?null,/,'from the sources last inspected, never derived');
 assert.match(app,/const condition=readFrameCondition\(instrument\?\.condition\?\?null\);return \{\.\.\.\(stage\?\{instrumentStage:stage\}:\{\}\),\.\.\.\(condition\?\{instrumentCondition:condition\}:\{\}\)\};/);
 assert.match(app,/stations:\(\)=>engine\.stations\?\.\(\),/,'the engine\'s own stations');
 assert.match(editor,/phases:\{theta:telemetry\.drive\.theta,phi:telemetry\.drive\.phi\}/,'the engine\'s own accumulators, verbatim');
 assert.match(editor,/const stations=options\.stations\?\.\(\);return stations\?\.length\?\{stations:clone\(stations\)\}:\{\};/);
});
