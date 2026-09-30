#!/usr/bin/env node
/** Replay actual native long-message projection. No provider answer or terminal
 * is supplied by this test. Run with a captured native view and evidence path. */
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createServer} from 'vite';

const [source, output] = process.argv.slice(2);
assert.ok(source?.includes('/T/') && output?.includes('/T/'));
const bytes = await readFile(source), envelope = JSON.parse(bytes);
const reading = envelope.outcome?.data ?? envelope;
assert.equal(reading.schema, 'aikit.encounter-view/v1');
const server = await createServer({configFile: false, root: process.cwd(),
  cacheDir: path.join(path.dirname(output), 'nara-text-run-vite-cache'),
  server: {middlewareMode: true, hmr: false, ws: false}, appType: 'custom'});
try {
  const {nativeTextRuns} = await server.ssrLoadModule('/src/nara/nativeTranscript.ts');
  const {dialogueQuestion} = await server.ssrLoadModule('/src/nara/nativeDialogue.ts');
  const {nativeAnswer} = await server.ssrLoadModule('/src/nara/nativeReturn.ts');
  const runs = nativeTextRuns(reading.blocks);
  const prompt = runs.find(block => block.kind === 'user' && block.blockIds.length > 1);
  assert.ok(prompt, 'Requires an actual native multi-block user message');
  const raw = reading.blocks.filter(block => prompt.blockIds.includes(block.id));
  assert.equal(prompt.text, raw.map(block => block.text).join(''));
  assert.ok(Buffer.byteLength(prompt.text) > 16 * 1024);
  const input = JSON.parse(prompt.text);
  assert.equal(input.schema, 'oi.nara-dialogue-input/v1');
  assert.match(input.context.subject_ref, /^controlled:/);
  assert.equal(dialogueQuestion(prompt.text), input.question);
  assert.ok(input.identity.natal.sky.bodies.some(body => body.body === 'Sun'));
  assert.equal(input.identity.natal.chart.svg, undefined);
  const dialogue = {key: 'captured-native-long-message', role: input.role, project: '',
    provisioning: {agent_session: reading.agent_session}, binding: {
      person_ref: input.context.subject_ref, nara_ref: input.context.nara_ref,
      source_ref: input.identity.source.source_ref, expected_revision: input.identity.source.revision,
      expression_ref: input.expression.ref, role: input.role}};
  const answer = runs.find(block => block.kind === 'assistant' && block.id > prompt.id);
  assert.ok(answer, 'Requires actual provider text, including a partial response');
  const terminal = runs.slice(runs.indexOf(answer) + 1).find(block => ['user', 'completed', 'cancelled', 'error'].includes(block.kind));
  const checks = ['Actual native blocks reassemble byte-for-byte with every original block id',
    'Visible question is extracted from the full actual chart context; SVG is excluded'];
  if (terminal?.kind === 'completed') {
    const retained = nativeAnswer(dialogue, reading, answer.id);
    assert.equal(retained.question, input.question);
    assert.equal(retained.answer, answer.text);
    assert.deepEqual(retained.questionBlockIds, prompt.blockIds);
    assert.deepEqual(retained.answerBlockIds, answer.blockIds);
    checks.push('Actual native completion permits the whole answer with original multi-block question basis');
  } else {
    assert.throws(() => nativeAnswer(dialogue, reading, answer.id), /own native turn did not complete/);
    checks.push('Actual unfinished or unsuccessful native turn remains ineligible for retention');
  }
  // Remove captured bytes to prove missing context cannot become a new basis.
  for (const removed of prompt.blockIds) {
    assert.throws(() => nativeAnswer(dialogue, {...reading,
      blocks: reading.blocks.filter(block => block.id !== removed)}, answer.id),
    /no recorded Nara identity|no recorded Nara|no complete retained context|no unambiguous|missing a source identity/);
  }
  checks.push('Removing any actual question chunk refuses retention rather than substituting current UI identity');
  await writeFile(output, JSON.stringify({schema: 'oi.nara-native-text-runs/v1', source,
    source_sha256: createHash('sha256').update(bytes).digest('hex'), checks,
    agent_session: reading.agent_session, native_state: reading.connection?.state,
    question_block_ids: prompt.blockIds, question_bytes: Buffer.byteLength(prompt.text),
    assistant_block_ids: answer.blockIds, terminal: terminal?.kind ?? null,
    standing: terminal?.kind === 'completed' ? 'Captured native completed answer and original context' : 'Captured native partial answer; no successful dialogue or retention claim'}, null, 2) + '\n');
  console.log(JSON.stringify({checks, terminal: terminal?.kind ?? null}));
} finally {await server.close();}
