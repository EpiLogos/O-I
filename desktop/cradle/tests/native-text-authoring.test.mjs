import test from 'node:test';
import assert from 'node:assert/strict';
import {textLayout} from '../../../packages/oi-design-system/expressions-engine/shell/capture.mjs';
import {fieldStudies,validateJourney} from '../../../packages/oi-design-system/expressions-engine/shell/model.mjs';

test('the actual native text layout consumes authored supporting-text size at each viewport',()=>{
 const journey=fieldStudies(),text=journey.scenes[0].text[0];
 for(const width of [360,760,1000,1440]){
  const legacy=textLayout(text,width,900);
  assert.equal(legacy.body,width<761?10:11,'Old native documents retain their original sizing');
  for(const bodySize of [8,18,24,72]){
   text.bodySize=bodySize;
   assert.equal(validateJourney(journey).scenes[0].text[0].bodySize,bodySize,'The authored scalar survives native document validation');
   assert.equal(textLayout(text,width,900).body,bodySize,'The production painter reads the authored value');
  }
  delete text.bodySize;
 }
});

test('native import refuses malformed supporting-text size before rendering',()=>{
 for(const bodySize of [0,7,73,NaN,Infinity,'18',null]){
  const journey=fieldStudies();journey.scenes[0].text[0].bodySize=bodySize;
  assert.throws(()=>validateJourney(journey),/Invalid page text|Non-finite value/);
 }
});
