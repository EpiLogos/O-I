// Review-4 #9: a view name that is a JavaScript object's own machinery (__proto__, constructor, prototype) is refused,
// so it neither skips the view limit nor sets a prototype in place of an own key.
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyResearchMaterial} from '../build/researchMaterial.js';
import {fieldStudies,clone} from '../build/model.js';
import {placeViewNameProblem} from '../build/placeViews.js';

test('reserved view names are refused for every view kind', ()=>{
 const scene=clone(fieldStudies().scenes[0]);
 for(const name of ['__proto__','constructor','prototype']){
  assert.throws(()=>applyResearchMaterial(scene,{type:'view-save',name,viewport:{x:0,y:0,zoom:1},selectedRefs:[],frameOrder:[]}),/reserved/,name);
  assert.match(placeViewNameProblem(name,{})??'',/reserved/,name);
 }
 assert.equal(placeViewNameProblem('Overview',{}),null);
});
