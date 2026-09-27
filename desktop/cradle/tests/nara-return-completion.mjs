#!/usr/bin/env node
/** Terminal eligibility regression over an actual captured native owner view.
 * node tests/nara-return-completion.mjs /absolute/native-view.json /absolute/evidence.json
 * The successful terminal comes only from the supplied native receipt. Negative
 * cases deliberately remove/replace boundaries; they are adversarial projections,
 * not claims that a provider was cancelled or that this answer is useful. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';

const [source, output] = process.argv.slice(2);
assert.ok(source?.includes('/Control/agents/now/clearings/') && source.includes('/T/'));
assert.ok(output?.includes('/Control/agents/now/clearings/') && output.includes('/T/'));
const bytes = await readFile(source), envelope = JSON.parse(bytes);
const reading = envelope.outcome?.data ?? envelope;
assert.equal(reading.schema, 'aikit.encounter-view/v1');
const server = await createServer({configFile: false, root: process.cwd(),
  cacheDir: path.join(path.dirname(output), 'nara-completion-vite-ssr-cache'), server: {middlewareMode: true, hmr: false, ws: false}, appType: 'custom'});
const checks = [];
try {
  const {nativeAnswer, answerId} = await server.ssrLoadModule('/src/nara/nativeReturn.ts');
  const {nativeTextRuns} = await server.ssrLoadModule('/src/nara/nativeTranscript.ts');
  const runs = nativeTextRuns(reading.blocks);
  const selected = runs.findIndex((block, index) => block.kind === 'assistant'
    && runs.slice(index + 1).find(next => ['user', 'completed', 'cancelled', 'error'].includes(next.kind))?.kind === 'completed');
  assert.ok(selected >= 0, 'An actual native-completed assistant run is required; this script never supplies one');
  const block = runs[selected];
  const prompt = runs.slice(0, selected).reverse().find(value => value.kind === 'user');
  assert.ok(prompt, 'The actual completed turn must include its full question');
  const input = JSON.parse(prompt.text);
  assert.equal(input.schema, 'oi.nara-dialogue-input/v1');
  assert.match(input.context.subject_ref, /^controlled:/, 'Use the controlled native session only');
  const dialogue = {key: 'terminal-regression', role: input.role, project: 'controlled-terminal-regression',
    provisioning: {agent_session: reading.agent_session}, binding: Object.freeze({
      source_ref: input.identity.source.source_ref, expected_revision: input.identity.source.revision,
      person_ref: input.context.subject_ref, nara_ref: input.context.nara_ref,
      expression_ref: input.expression.ref, role: input.role})};
  const retained = nativeAnswer(dialogue, reading, block.id);
  assert.equal(retained.answer, block.text);
  assert.deepEqual(retained.answerBlockIds, block.blockIds);
  assert.deepEqual(retained.questionBlockIds, prompt.blockIds);
  checks.push('Actual owner completed marker qualifies the actual answer for terminal status only');
  const lastAnswerId = block.blockIds.at(-1);
  const throughAnswer = reading.blocks.filter(value => value.id <= lastAnswerId);
  assert.throws(() => nativeAnswer(dialogue, {...reading, blocks: throughAnswer}, block.id), /own native turn did not complete/);
  checks.push('The former before:blockId+1 projection now refuses despite Resident state');
  for (const kind of ['cancelled', 'error']) {
    const denied = {...reading, blocks: [...throughAnswer, {id: lastAnswerId + 1, kind, text: ''}]};
    assert.throws(() => nativeAnswer(dialogue, denied, block.id), /own native turn did not complete/);
    checks.push(`Adversarial ${kind} terminal cannot qualify a partial answer`);
  }
  // Reuse the actual successful terminal text, moved behind a new user boundary:
  // only the earlier answer is under test, and it must refuse that later success.
  const actualTerminal = runs.slice(selected + 1).find(value => value.kind === 'completed');
  const laterTurn = {...reading, blocks: [...throughAnswer,
    {...prompt, id: lastAnswerId + 1}, {...actualTerminal, id: lastAnswerId + 2}]};
  assert.throws(() => nativeAnswer(dialogue, laterTurn, block.id), /own native turn did not complete/);
  checks.push('A later user turn and its completion cannot lend success to an earlier unfinished answer');
  const afterTerminal = {...reading, blocks: [prompt, {...actualTerminal, id: prompt.id + 1},
    {...block, id: prompt.id + 2}, {...actualTerminal, id: prompt.id + 3}]};
  assert.throws(() => nativeAnswer(dialogue, afterTerminal, prompt.id + 2), /unambiguous original user turn/);
  checks.push('An assistant block after its original terminal cannot borrow the earlier prompt');
  // Adversarial storage projection only: repartition the exact captured bytes
  // into more than one native page. No generated answer or success marker is
  // introduced, and the projected IDs are not native retention identities.
  assert.ok(prompt.text.length >= 18 && block.text.length >= 2);
  const promptParts = Array.from({length: 18}, (_, index) => ({id: index + 1, kind: 'user',
    text: prompt.text.slice(Math.floor(index * prompt.text.length / 18), Math.floor((index + 1) * prompt.text.length / 18))}));
  const middle = Math.floor(block.text.length / 2);
  const split = [...promptParts, {id: 19, kind: 'assistant', text: block.text.slice(0, middle)},
    {id: 20, kind: 'assistant', text: block.text.slice(middle)}, {...actualTerminal, id: 21}];
  const latestPage = split.slice(-16), olderPage = split.slice(0, -16);
  assert.throws(() => nativeAnswer(dialogue, {...reading, blocks: latestPage}, 20), /no recorded Nara identity/);
  const reassembled = {...reading, blocks: [...olderPage, ...latestPage]};
  const first = nativeAnswer(dialogue, reassembled, 19), continuation = nativeAnswer(dialogue, reassembled, 20);
  assert.equal(continuation.answer, block.text);
  assert.equal(continuation.question, input.question);
  assert.equal(continuation.blockId, 19);
  assert.deepEqual(continuation.answerBlockIds, [19, 20]);
  assert.deepEqual(continuation.questionBlockIds, promptParts.map(value => value.id));
  assert.equal(await answerId(first), await answerId(continuation));
  assert.equal(nativeTextRuns(reassembled.blocks).find(value => value.kind === 'user').text, prompt.text);
  checks.push('Adversarial re-pagination of captured bytes refuses an incomplete question and resolves an assistant continuation to the same full-run identity after assembly');
  const receipt = {schema: 'oi.nara-retention-terminal-regression/v1', source,
    source_sha256: createHash('sha256').update(bytes).digest('hex'),
    agent_session: reading.agent_session, assistant_block_id: block.id,
    assistant_block_ids: block.blockIds, question_block_ids: prompt.blockIds, checks,
    standing: 'Native captured completion plus adversarial boundary and storage-projection validation; not answer-quality, transport-pagination, cancellation-effect or live retention proof',
    implementation_sha256: createHash('sha256').update(await readFile('src/nara/nativeReturn.ts')).digest('hex')};
  await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
  process.stdout.write(JSON.stringify(receipt) + '\n');
} finally {await server.close();}
