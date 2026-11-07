// O-I #747 round 892, XT12: the frame tells the shell whether a take's review stands open in it, so the shell's line that sent the owner
// there clears once the review has closed. app.ts is a browser entry that touches the DOM at import, so these are code-reading locks:
// - the announced stage carries `review`, read off the dialog itself: the review dialog open with the take's video in it;
// - the video dialog's close announces the state again, so the shell hears that the review closed when it closes;
// - the save that opens the review announces it before its answer, so the shell knows the review stands when it reads that answer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');

test('r892: the announced stage says whether the take\'s review stands open, read off the review dialog', () => {
  assert.match(src, /function reviewShown\(\)\{return !!document\.querySelector\('#video-dialog\[open\] #recording-review'\);\}/);
  assert.match(src, /stage:\{mode:camera\.mode,[^}]*videoTake:!!currentVideo,review:reviewShown\(\)\}/);
});

test('r892: the review\'s opening and closing are announced, the opening before the answer that sends the owner there', () => {
  assert.match(src, /\$\('video-dialog'\)\.addEventListener\('close',\(\)=>announceHostState\(\)\)/, 'a closed review is heard at once');
  const save = src.slice(src.indexOf("if(command.action==='save'){"), src.indexOf("await action('save-video',body);break;"));
  assert.match(save, /\$<HTMLDialogElement>\('video-dialog'\)\.showModal\(\);announceHostState\(\);throw new Error\('The take is open for review\./);
});
