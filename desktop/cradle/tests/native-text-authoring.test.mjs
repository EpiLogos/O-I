import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {textLayout} from '../../../packages/oi-design-system/expressions-engine/shell/capture.mjs';
import {blankJourney,validateJourney} from '../../../packages/oi-design-system/expressions-engine/shell/model.mjs';

const nativeReview=JSON.parse(readFileSync(new URL('../material/expressive-material/scene/review.expression.json',import.meta.url),'utf8'));
function reviewJourney(){
 const journey=blankJourney();
 journey.scenes=[structuredClone(nativeReview.scenes[0].presentation.scene)];
 assert.ok(journey.scenes[0].text.length,'The actual Factory review material must supply its authored text');
 return validateJourney(journey);
}

test('the actual native text layout consumes authored supporting-text size at each viewport',()=>{
 const journey=reviewJourney(),text=journey.scenes[0].text[0];
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
  const journey=reviewJourney();journey.scenes[0].text[0].bodySize=bodySize;
  assert.throws(()=>validateJourney(journey),/Invalid page text|Non-finite value/);
 }
});
