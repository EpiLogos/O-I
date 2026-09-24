import test from 'node:test';
import assert from 'node:assert/strict';
import {blankJourney} from '../build/model.js';
import {entryGateHTML} from '../build/entryGate.js';
import {nativeSeven} from '../build/expressions.js';
import {
  AUTHORED_CHAKRA_STARTER,NARA_PERSONAL_LIVE,CYMATIC_STATION,centreStandingDistinct,
} from '../build/centreStanding.js';

test('blank Expression starts empty so creation is discoverable',()=>{
  const j=blankJourney();
  assert.equal(j.scenes.length,1);
  assert.equal(j.scenes[0].entities.length,0);
  assert.equal(j.name,'Untitled expression');
});

test('entry gate exposes New / Continue / Open',()=>{
  const html=entryGateHTML({hasContinue:true,continueLabel:'Continue “Ink”'});
  assert.match(html,/entry-new/);
  assert.match(html,/entry-continue/);
  assert.match(html,/entry-open/);
  assert.match(html,/Browser draft/);
  assert.match(html,/not application modes/);
});

test('centre standing keeps authored, live Nara and cymatic distinct',()=>{
  assert.equal(centreStandingDistinct(AUTHORED_CHAKRA_STARTER,CYMATIC_STATION),true);
  assert.equal(centreStandingDistinct(NARA_PERSONAL_LIVE,CYMATIC_STATION),true);
  assert.equal(centreStandingDistinct(AUTHORED_CHAKRA_STARTER,AUTHORED_CHAKRA_STARTER),false);
});

test('seven-centres starter declares authored standing, not live Nara',()=>{
  const j=nativeSeven();
  assert.match(j.description,/authored/i);
  assert.match(j.description,/not live Nara/i);
  assert.match(j.description,/not a cymatic station/i);
});
