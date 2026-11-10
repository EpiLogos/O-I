// O-I #747 round 896, 1T item 18 (DLW build ruling 2026-11-09; review c99d N-1, "classification fails open"): the controller says which
// holds stand (controller.ts holdStands) by naming what is transient, so a hold it makes later outside those reads as the sound closed by
// default. This census lists every place the controller holds the field (`this.hold(` and `this.status='held'`), by its method and its
// reason, each with its class, as the port ledger lists its rows: a new self-hold fails here until it names its class.
//   transient  the controller's own, while its work runs (one serial exchange, a take's part) or as the application's pause or a
//              suspension, each marked as theirs before it is told: it lets the field go itself, and says nothing.
//   person's   the person's own hold, or a hold put back as it was found, its mark with it (controller.ts remark): it reads as it did,
//              the person's saying nothing.
//   stands     a hold that waits on the person (an error, a refusal, a reading complete, the GPU lost, reduced motion's opening, a
//              checkpoint): it is said as the sound closed, with one press to open it (entitySound.ts fieldSoundClosed).
// Rules read from the source: a transient hold is made only inside a method that runs through the one serial owner (`this.serial(`),
// or by the pause or a suspension, which mark it before it is told; a hold put back as found carries its mark (`remark(`) unless it
// is the hold's own body or admission telling the hold made while admitting, whose mark stands at its revision.
// CODE-READING over controller.ts, comments blanked (strings kept: a hold's words are its reason).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const SOURCE = resolve('expressions-app/field-studies-journeys/src/native-field/controller.ts');

/** [method, site, count, class, why] for every hold the controller makes. */
const CENSUS = [
  ['constructor', 'hold(reason)', 1, 'stands', 'the port holds the field (channel.ts onHold): a host epoch changed, or an acknowledgement it could not read and will not retry'],
  ['admit', 'hold(`GPU context ${state}; explicit same-state checkpoint recovery or disconnect required`)', 1, 'stands', 'the GPU context was lost or restored: a checkpoint or a disconnect, which the person asks for'],
  ['admit', "status='held' (reason this.openingHold)", 2, "person's", 'admission tells the hold made while admitting (the person\'s, the pause\'s, a suspension\'s, reduced motion\'s), no new revision: its own mark stands'],
  ['rejoin', "status='held' (reason this.openingHold)", 1, "person's", 'rejoining after an unknown acknowledgement (1T item 22) tells the hold made while it read the owner again, as admission does: its own mark stands'],
  ['frame', 'hold(REDUCED_MOTION_HOLD)', 1, 'stands', 'under reduced motion the field opens held until the person resumes it'],
  ['frame', "status='held' (reason reading.reason??'native/audio owner held')", 1, 'stands', 'the instrument holds itself (audio recovery, a presentation failure): the controller mirrors it'],
  ['frame', 'hold(String(error))', 1, 'stands', 'presenting the field failed'],
  ['pauseHold', 'hold(reason)', 1, 'transient', 'the application\'s pause, marked as the pause\'s before it is told: its end resumes the field'],
  ['hold', "status='held' (reason reason)", 1, "person's", 'the hold itself: the person\'s Hold and the host\'s hold command come here and are marked as the person\'s; each of the controller\'s own calls is its own row'],
  ['suspend', 'hold(reason)', 1, 'transient', 'a suspension, standing before its hold is told: its release resumes the field'],
  ['finishCommand', "status='held' (reason reason)", 1, 'stands', 'a command over a held field leaves the hold it found (its caller puts the mark back: remark) or, with none, its own words "applied while held; resume explicitly"'],
  ['afterReading', "status='held' (reason reason)", 1, "person's", 'a reading puts back the person\'s hold, the pause\'s or a suspension\'s that it found, its mark with it'],
  ['afterReading', 'hold(words)', 1, 'stands', 'a reading on a field that followed, or held by another hold, leaves its own: "… complete; resume explicitly"'],
  ['resumeAt', 'hold(String(error))', 1, 'stands', 'a resume the owner refused'],
  ['operate', "hold('native operation')", 1, 'transient', 'an operation in flight, through the one serial owner'],
  ['operate', 'hold(String(error))', 1, 'stands', 'an operation that failed'],
  ['determinant', "hold('native determinant event')", 1, 'transient', 'a determinant event in flight, through the one serial owner'],
  ['determinant', "status='held' (reason prior??'determinant refused')", 1, "person's", 'a refused determinant puts back the hold it found, its mark with it; a field that followed is left held in the refusal\'s words'],
  ['determinant', 'hold(String(error))', 1, 'stands', 'a determinant event that failed'],
  ['influence', "hold('native influence reading')", 1, 'transient', 'the influence reading in flight'],
  ['stageState', "hold('stage disclosure reading')", 1, 'transient', 'the stage disclosure in flight'],
  ['torusState', "hold('Torus session reading')", 1, 'transient', 'the Torus session reading in flight'],
  ['torusCheckpoint', "hold('Torus checkpoint')", 1, 'transient', 'the Torus checkpoint in flight'],
  ['renderTake', "hold('take render')", 1, 'transient', 'a take\'s part rendering; the take counts as the controller\'s work between its parts (working)'],
  ['score', "hold('Tarot score reading')", 1, 'transient', 'the Tarot score reading in flight'],
  ['inspectSources', "hold('native source inspection')", 1, 'transient', 'the source inspection in flight'],
  ['editBasis', "hold('native basis edit')", 1, 'transient', 'a basis edit in flight'],
  ['editBasis', 'hold(String(error))', 1, 'stands', 'a basis edit that failed'],
  ['saveCheckpoint', "hold('checkpoint hold')", 2, 'stands', 'a GPU checkpoint is kept with the field held, and the field stays held until the person resumes it'],
  ['restoreCheckpoint', "status='held' (reason 'checkpoint restored; resume explicitly')", 1, 'stands', 'a checkpoint restored stands held until the person resumes it'],
];

/** The source with comments blanked; strings and template literals (with their `${}` holes) kept. */
function blankComments(t) {
  let o = '', i = 0, mode = 'code';
  const holes = [];
  while (i < t.length) {
    const c = t[i], two = t.slice(i, i + 2);
    if (mode === 'code') {
      if (two === '//') { const e = t.indexOf('\n', i), s = e < 0 ? t.length : e; o += ' '.repeat(s - i); i = s; continue; }
      if (two === '/*') { const e = t.indexOf('*/', i + 2), s = e < 0 ? t.length : e + 2; o += t.slice(i, s).replace(/[^\n]/g, ' '); i = s; continue; }
      if (c === "'" || c === '"') { let j = i + 1; while (j < t.length && t[j] !== c && t[j] !== '\n') j += t[j] === '\\' ? 2 : 1; o += t.slice(i, j + 1); i = j + 1; continue; }
      if (c === '`') { mode = 'template'; o += c; i++; continue; }
      if (c === '{' && holes.length) holes[holes.length - 1]++;
      if (c === '}' && holes.length) { if (holes[holes.length - 1] === 0) { holes.pop(); mode = 'template'; o += c; i++; continue; } holes[holes.length - 1]--; }
      o += c; i++; continue;
    }
    if (c === '\\') { o += t.slice(i, i + 2); i += 2; continue; }
    if (c === '`') { mode = 'code'; o += c; i++; continue; }
    if (two === '${') { holes.push(0); mode = 'code'; o += two; i += 2; continue; }
    o += c; i++;
  }
  return o;
}

const HEADER = /^ (?:(?:private|async|get|static|public|readonly)\s+)*([A-Za-z_$][\w$]*)\s*(?:\(|=\s*(?:async\s*)?\()/;
const NOT_A_METHOD = /^ (?:if|for|while|switch|return|const|let|var|await)\b/;

/** Every hold site, with the method it stands in (the class's methods begin one space in) and that method's text. */
function census(source) {
  const lines = blankComments(source).split('\n');
  const methods = [];
  lines.forEach((line, n) => { const m = line.match(HEADER); if (m && !NOT_A_METHOD.test(line)) methods.push({name: m[1], from: n}); });
  const methodOf = n => { let found = {name: '(class head)', from: 0}; for (const m of methods) if (m.from <= n) found = m; return found; };
  const bodyOf = m => { const next = methods.find(other => other.from > m.from); return lines.slice(m.from, next ? next.from : lines.length).join('\n'); };
  const argument = (line, open) => { let depth = 0, j = open; for (; j < line.length; j++) { if (line[j] === '(') depth++; else if (line[j] === ')' && --depth === 0) break; } return line.slice(open + 1, j); };
  const sites = [];
  lines.forEach((line, n) => {
    const m = methodOf(n), body = bodyOf(m);
    for (const hit of line.matchAll(/this\.hold\(/g)) sites.push({method: m.name, site: `hold(${argument(line, hit.index + 'this.hold'.length)})`, line, body});
    for (const hit of line.matchAll(/this\.status\s*=\s*'held'/g)) {
      const reason = line.match(/this\.reason\s*(?:\?\?)?=\s*('(?:[^'\\]|\\.)*'|[^;}]*)/);
      sites.push({method: m.name, site: `status='held' (reason ${reason ? reason[1].trim() : '?'})`, line, body});
      void hit;
    }
  });
  return sites;
}

test('round 896 1T item 18: every place the controller holds the field is in the census, by its method and reason, with its class', () => {
  const source = readFileSync(SOURCE, 'utf8');
  const sites = census(source);
  const naive = blankComments(source).match(/this\.hold\(|this\.status\s*=\s*'held'/g).length;
  assert.equal(sites.length, naive, 'the census reads every site the source has');
  const found = {};
  for (const s of sites) { const key = `${s.method} | ${s.site}`; found[key] = (found[key] ?? 0) + 1; }
  const listed = Object.fromEntries(CENSUS.map(([method, site, count]) => [`${method} | ${site}`, count]));
  assert.deepEqual(found, listed, 'a hold the controller makes that the census does not list, or one it lists that is gone: name its class here');
  for (const [method, site, , kind, why] of CENSUS) {
    assert.ok(['transient', "person's", 'stands'].includes(kind), `${method} | ${site}: its class`);
    assert.ok(why.length > 20, `${method} | ${site}: why it is ${kind}`);
  }
});

test('round 896 1T item 18: a transient hold is made only through the one serial owner, or by the pause or a suspension, which mark it first', () => {
  const sites = census(readFileSync(SOURCE, 'utf8'));
  const kinds = Object.fromEntries(CENSUS.map(([method, site, , kind]) => [`${method} | ${site}`, kind]));
  for (const s of sites) {
    const kind = kinds[`${s.method} | ${s.site}`];
    if (kind === 'transient') {
      const marked = (s.method === 'pauseHold' && /this\.pauseHeld\s*=\s*\{[^}]*\};\s*this\.hold\(reason\)/.test(s.body))
        || (s.method === 'suspend' && /this\.suspension\s*=\s*\{[\s\S]*?\};\s*if\(restore\)this\.hold\(reason\)/.test(s.body));
      assert.ok(marked || /this\.serial\(/.test(s.body), `${s.method} | ${s.site}: transient, so made through this.serial( or marked before it is told`);
    }
    if (kind === "person's" && !['hold', 'admit', 'rejoin'].includes(s.method))
      assert.match(s.line, /this\.remark\(found\)/, `${s.method} | ${s.site}: put back as found, its mark with it`);
  }
  // The person's mark is set by the hold itself, from the person's words, and put back by remark; a resume lets it go.
  const code = blankComments(readFileSync(SOURCE, 'utf8'));
  assert.equal(code.match(/this\.personHeld\s*=\s*PERSON_HOLDS\.includes\(reason\)/g)?.length, 1, 'hold() marks the person\'s hold');
  assert.equal(code.match(/this\.personHeld\s*=\s*at\b/g)?.length, 1, 'remark puts it back');
  assert.equal(code.match(/this\.personHeld\s*=\s*null/g)?.length, 3, 'following again (a command\'s resume, admission, a rejoin) lets it go');
});
