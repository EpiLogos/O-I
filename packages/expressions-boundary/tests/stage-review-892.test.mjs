// O-I #747 round 892, XT12: the frame says whether a take's review stands open in it (stage.review), so the shell's line that sent the owner
// there ("The take is open for review. Choose Save recording there…") clears once the review has closed — its moment passed. The boundary
// admits the reading as a boolean, as it admits videoTake, and refuses the reading when it is anything else.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readHostedState} from '../src/index.ts';

const reading = stage => ({hostMode: 'expressions', sceneIndex: 0, sceneCount: 1, document: {id: 'expression:kept', name: 'Kept'},
  nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}, sceneName: 'One',
  stage: {mode: '2d', grid: false, snap: false, guides: false, videoTake: true, ...stage}});

test('r892: the stage reading carries whether the take\'s review stands open in the frame, and only as a boolean', () => {
  assert.equal(readHostedState(reading({review: true}))?.stage?.review, true);
  assert.equal(readHostedState(reading({review: false}))?.stage?.review, false);
  assert.equal('review' in (readHostedState(reading({}))?.stage ?? {}), false, 'a frame that does not say leaves it unread');
  for (const bad of ['yes', 1, null, {}]) assert.equal(readHostedState(reading({review: bad})), null, JSON.stringify(bad));
});
