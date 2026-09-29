#!/usr/bin/env node
/** Real native retention replay. Run from desktop/cradle:
 * node tests/nara-return-native.mjs /absolute/config.json
 * Config: {bridge, world, project, binding:{source_ref,expected_revision,
 * person_ref,nara_ref,expression_ref,role}, block_id, destination_receipt, output,
 * day_preparation?:"/absolute/native-day-preparation.json"}.
 * day_preparation opts into proposal/review/include ONLY in the matching
 * disposable world, via its already authenticated controlled-human bridge.
 * The native session must already contain a completed controlled answer. This
 * test never creates an answer, provider, human authority grant or private Day. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';

const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
assert.match(config.bridge, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(config.world.includes('/Control/agents/now/clearings/') && config.world.includes('/T/') && config.world.endsWith('/world'), 'Only an explicitly scoped disposable NOW world is permitted');
assert.ok(config.output.includes('/T/'), 'Evidence belongs in the assigned NOW task');
const destination = JSON.parse(await readFile(config.destination_receipt, 'utf8'));
assert.equal(destination.world, config.world);
const checks = [], server = await createServer({configFile: false, root: process.cwd(),
  cacheDir: path.join(config.output, 'vite-ssr-cache', 'initial'), server: {middlewareMode: true, hmr: false, ws: false}, appType: 'custom'});
let closeOpened;
try {
  const {kernelOp} = await server.ssrLoadModule('/src/kernel/bridge.ts');
  const owner = await server.ssrLoadModule('/src/nara/nativeReturn.ts');
  const instances = await server.ssrLoadModule('/src/flow/instances.ts');
  const {receiving} = await server.ssrLoadModule('/src/receiving/client.ts');
  const {htmlToText, textToHtml} = await server.ssrLoadModule('/src/flow/instance.ts');
  const transport = {kind: 'bridge', url: config.bridge};
  if(config.file_path){
    assert.match(config.binding.expression_ref,/^expression:controlled-epii-/);
    const listed=await kernelOp(transport,{op:'expression',request:{operation:'list'}});
    assert.ok(listed.outcome?.data?.expressions);
    const wasOpen=listed.outcome.data.expressions.some(value=>value.expression_ref===config.binding.expression_ref);
    const {hostedCompositionFile}=await server.ssrLoadModule('/src/expressions/hostedComposition.ts');
    const opened=await hostedCompositionFile(transport,{operation:'open',path:config.file_path});
    assert.equal(opened.document.expression_ref,config.binding.expression_ref);
    if(!wasOpen)closeOpened=async()=>{
      const closed=await kernelOp(transport,{op:'expression',request:{operation:'close',expression_ref:config.binding.expression_ref,actor:'agent:nara-native-verification'}});
      assert.ok(!closed.error,closed.error);
      await writeFile(path.join(config.output,'closed-expression.json'),JSON.stringify(closed,null,2));
    };
  }
  const result = await kernelOp(transport, {op: 'nara_dialogue', project: config.project,
    request: {...config.binding, operation: 'lookup'}});
  assert.ok(!result.error, result.error);
  assert.equal(result.outcome?.result, 'nara_dialogue');
  const native = result.outcome.data;
  assert.ok(native.provisioning?.agent_session, 'The native owner must disclose an existing session');
  const dialogue = {key: JSON.stringify(native.binding), role: native.binding.role,
    project: config.project, provisioning: native.provisioning, binding: Object.freeze({...native.binding})};
  if(config.reconnect===true){
    const connected=await kernelOp(transport,{op:'encounter',project:config.project,request:{action:'reconnect',agent_session:native.provisioning.agent_session,space:native.provisioning.space,provider:native.provisioning.provider}});
    assert.ok(!connected.error,connected.error);
    if(config.expected_native_session_id)assert.equal(connected.outcome.data.native_session_id,config.expected_native_session_id);
  }
  const answer = await owner.readNativeAnswer(transport, dialogue, config.block_id);
  checks.push('Read actual idle native assistant block and original identity/Expression question basis');
  const basis = await instances.readFlowInstance(transport, destination.location);
  assert.equal(basis.location.root, config.world);
  const before = basis.doc.entries.length;
  const written = await owner.retainAnswerInFlow(transport, basis, answer);
  const reopened = await instances.readFlowInstance(transport, destination.location);
  const entry = reopened.doc.entries.find(entry => entry.id === written.entryId);
  assert.ok(entry);
  if(written.already)assert.equal(entry.html,basis.doc.entries.find(e=>e.id===written.entryId).html,'Existing native quotations must not be rewritten by a presentation upgrade');
  else assert.equal(entry.html, owner.answerHtml(answer, 'flow'));
  if(config.require_curated===true){
    assert.ok(answer.epii,'A curated Epii Return must come from actual native typed review');
    const [primary,inspect]=entry.html.split('<details><summary>Source Inspect — original Epii answer</summary>');
    assert.ok(inspect,'The raw native answer must be retained in Source Inspect');
    assert.ok(primary.includes(textToHtml(answer.epii.enrichment.synthesis)));
    assert.ok(!primary.includes(textToHtml(answer.answer)));
    assert.ok(inspect.includes(textToHtml(answer.answer)));
    if(answer.epii.enrichment.factory_commission_proposal)assert.ok(primary.includes(textToHtml(answer.epii.enrichment.factory_commission_proposal.discrepancy)));
    checks.push('Actual Central Flow primary content contains typed native synthesis/proposal; exact raw answer and native provenance remain in Source Inspect');
  }
  assert.ok(reopened.doc.meta.participants.some(participant => participant.initial === entry.author
    && participant.kind === 'agent' && participant.ref === dialogue.provisioning.agent_session));
  assert.deepEqual(reopened.doc.entries.filter(entry => entry.id !== written.entryId), basis.doc.entries.filter(entry => entry.id !== written.entryId));
  assert.equal(reopened.doc.entries.length, before + (written.already ? 0 : 1));
  checks.push('Native Flow write/reopen preserves every earlier entry and exact agent-session attribution');
  const repeated = await owner.retainAnswerInFlow(transport, reopened, answer);
  assert.equal(repeated.already, true);
  const twice = await instances.readFlowInstance(transport, destination.location);
  assert.equal(twice.doc.entries.filter(entry => entry.id === written.entryId).length, 1);
  assert.equal(twice.revision, reopened.revision);
  checks.push('Repeated retention reads the exact existing entry without a second write');
  if(answer.epii){
    const altered={...answer,epii:{...answer.epii,enrichment:{...answer.epii.enrichment,synthesis:answer.epii.enrichment.synthesis+' Not part of the native return.'}}};
    await assert.rejects(()=>owner.retainAnswerInFlow(transport,twice,altered),/reviewed reading changed/);
    assert.equal((await instances.readFlowInstance(transport,destination.location)).revision,twice.revision);
    checks.push('Tampering with the actual typed owner synthesis is refused before any Central write');
  }
  const other = {...dialogue, binding: {...dialogue.binding, person_ref: 'controlled:wrong-person'}};
  await assert.rejects(() => owner.readNativeAnswer(transport, other, answer.blockId), /bound person/);
  checks.push('Different-person native binding refuses the actual retained answer basis before any write');
  let day;
  if (config.day_preparation) {
    const prepared = JSON.parse(await readFile(config.day_preparation, 'utf8'));
    assert.equal(prepared.schema, 'oi.nara-controlled-day-preparation/v1');
    assert.equal(prepared.world, config.world);
    assert.equal(prepared.standing, 'controlled-test-fixture-not-personal-adoption');
    const created = prepared.native_calls.find(call => call.action === 'central.document.create')?.response?.data;
    assert.ok(created?.document, 'Day must have been created by the native owner');
    assert.equal(created.document.created_by, 'human:nara-controlled-test');
    const target = await owner.readDayTarget(transport);
    assert.equal(target.document.source.ref, created.source.ref);
    assert.equal(target.document.document_id, created.document_id);
    assert.deepEqual(target.document.document.template_payload, created.document.template_payload);
    assert.deepEqual(target.document.document.fields, created.document.fields);
    assert.ok(!path.isAbsolute(target.document.source.path));
    const dayPath = path.resolve(config.world, target.document.source.path);
    assert.ok(dayPath.startsWith(path.resolve(config.world) + path.sep));
    const beforeDay = await readFile(dayPath);
    const fieldId = target.fields[0].id;
    const contributionId = await owner.answerId(answer);
    assert.ok(!target.document.document.contributions.some(value => value.id === contributionId),
      'Positive Day proof requires this answer not already included; use another actual completed answer');
    await assert.rejects(() => owner.proposeAnswerForDay(transport, target, 'nara-nonexistent-field', answer), /Choose a field/);
    await assert.rejects(() => receiving(transport, null, {kind: 'mutate-field',
      source_ref: target.document.source.ref, document_id: target.document.document_id,
      expected_revision: target.document.revision.revision, request_id: `nara-invalid-field:${contributionId}`,
      field_id: 'nara-nonexistent-field', value: 'This must never enter the controlled Day'}), /field/i);
    assert.deepEqual(await readFile(dayPath), beforeDay);
    checks.push('Unknown Day field refuses in helper and actual native mutation without source change');

    const proposed = await owner.proposeAnswerForDay(transport, target, fieldId, answer);
    assert.equal(proposed.record.author.principal_ref, 'human:nara-controlled-test');
    assert.equal(proposed.record.author.actor_kind, 'human');
    assert.equal(proposed.included, false);
    assert.equal(proposed.source_changed_by_arrival_or_review, false);
    const quotedHtml = `${owner.answerHtml(answer, 'day')}<p>Retained for Day ${target.day.day_ref}.</p>`;
    assert.equal(proposed.record.proposal.html, quotedHtml);
    assert.equal(proposed.record.proposal.field_id, fieldId);
    assert.equal(proposed.record.proposal.contribution_id, contributionId);
    assert.deepEqual(await readFile(dayPath), beforeDay);
    const nativeProposed = await receiving(transport, null, {kind: 'read', return_ref: proposed.return_ref});
    assert.deepEqual(nativeProposed.record, proposed.record);
    checks.push('Actual native proposal retains exact attributed quotation while Day source remains byte-identical');

    // A new Vite module graph recreates all helper module state, including the
    // in-memory submissions map. The native receiving record is the only retry
    // basis retained across this application-module restart.
    const restarted = await createServer({configFile: false, root: process.cwd(),
      cacheDir: path.join(config.output, 'vite-ssr-cache', 'restart'), server: {middlewareMode: true, hmr: false, ws: false}, appType: 'custom'});
    let recovered;
    try {
      const freshOwner = await restarted.ssrLoadModule('/src/nara/nativeReturn.ts');
      assert.notEqual(freshOwner.proposeAnswerForDay, owner.proposeAnswerForDay);
      recovered = await freshOwner.proposeAnswerForDay(transport, await freshOwner.readDayTarget(transport), fieldId, answer);
    } finally {await restarted.close();}
    assert.equal(recovered.return_ref, proposed.return_ref);
    assert.equal(recovered.revision, proposed.revision);
    assert.equal(recovered.record.occurred_at_unix_seconds, proposed.record.occurred_at_unix_seconds);
    assert.equal(recovered.record.received_at_unix_seconds, proposed.record.received_at_unix_seconds);
    assert.deepEqual(recovered.record.proposal, proposed.record.proposal);
    assert.deepEqual(await readFile(dayPath), beforeDay);
    checks.push('Fresh application modules recover existing native proposal, original timestamp and revision without resubmission');

    const accepted = await receiving(transport, null, {kind: 'review', return_ref: recovered.return_ref,
      expected_return_revision: recovered.revision, disposition: 'accepted',
      expected_source_revision: target.document.revision.revision});
    assert.equal(accepted.record.status, 'accepted');
    assert.equal(accepted.record.review.reviewer_ref, 'human:nara-controlled-test');
    assert.deepEqual(await readFile(dayPath), beforeDay);
    const included = await receiving(transport, null, {kind: 'include', return_ref: accepted.return_ref,
      expected_return_revision: accepted.revision, expected_source_revision: target.document.revision.revision});
    assert.equal(included.included, true);
    const savedDay = await owner.readDayTarget(transport);
    const saved = savedDay.document.document;
    assert.deepEqual(saved.template_payload, target.document.document.template_payload);
    assert.deepEqual(saved.fields, target.document.document.fields);
    assert.deepEqual(saved.contributions.filter(value => value.id !== contributionId), target.document.document.contributions);
    assert.equal(saved.contributions.filter(value => value.id === contributionId).length, 1);
    const contribution = saved.contributions.find(value => value.id === contributionId);
    assert.equal(contribution.field_id, fieldId);
    assert.equal(contribution.author_ref, 'human:nara-controlled-test');
    assert.equal(contribution.actor_kind, 'human');
    assert.equal(contribution.reviewed_by, 'human:nara-controlled-test');
    // Central sanitises supported rich text (details/summary wrappers are not
    // part of its native HTML vocabulary). Compare complete decoded content;
    // the unsanitised exact proposal above remains independently retrievable.
    assert.equal(htmlToText(contribution.html), htmlToText(quotedHtml));
    assert.ok(htmlToText(contribution.html).includes(htmlToText(textToHtml(answer.answer))));
    assert.notDeepEqual(await readFile(dayPath), beforeDay);
    const repeatedDay = await owner.proposeAnswerForDay(transport, savedDay, fieldId, answer);
    assert.equal(repeatedDay.return_ref, included.return_ref);
    assert.equal(repeatedDay.included, true);
    assert.equal((await owner.readDayTarget(transport)).document.revision.revision, savedDay.document.revision.revision);
    checks.push('Native review leaves source unchanged; explicit inclusion retains quotation and attribution, preserves all original fields, and deduplicates');
    day = {state: 'included', day_ref: target.day.day_ref, field_id: fieldId,
      source_ref: target.document.source.ref, document_id: target.document.document_id,
      return_ref: included.return_ref, contribution_id: contributionId,
      occurred_at_unix_seconds: proposed.record.occurred_at_unix_seconds,
      source_revision_before: target.document.revision.revision, source_revision_after: savedDay.document.revision.revision,
      proposal: nativeProposed, recovered, accepted, included, contribution,
      source_sha256_before: createHash('sha256').update(beforeDay).digest('hex'),
      source_sha256_after: createHash('sha256').update(await readFile(dayPath)).digest('hex')};
  } else {
    try {const target = await owner.readDayTarget(transport); day = {state: 'available-not-exercised', day_ref: target.day.day_ref, fields: target.fields};}
    catch (error) {day = {state: 'unavailable', reason: String(error)};}
  }
  const sources = {};
  for (const file of ['src/nara/nativeReturn.ts', 'src/nara/NativeAnswerReturn.tsx', 'src/nara/nativeDialogue.ts']) sources[file] = createHash('sha256').update(await readFile(file)).digest('hex');
  await mkdir(config.output, {recursive: true});
  await writeFile(path.join(config.output, 'receipt.json'), JSON.stringify({schema: 'oi.nara-return-native-replay/v1',
    recorded_at: new Date().toISOString(), checks, world: config.world, agent_session_ref: dialogue.provisioning.agent_session,
    block_id: answer.blockId, question_block_id: answer.questionBlockId, basis: answer.basis, destination: destination.location,
    document_id: reopened.doc.meta.documentId, entry_id: written.entryId, revision: reopened.revision, day, sources,
    limits: config.day_preparation
      ? ['Controlled human quotation retention only; no personal Day adoption or agent impersonation.', 'Restart proof recreates application modules; it does not restart the native owner process.']
      : ['Day proposal/include is not exercised without explicit controlled Day preparation.']}, null, 2) + '\n');
  process.stdout.write(JSON.stringify({checks, entry_id: written.entryId, revision: reopened.revision, day_state: day?.state, receipt: path.join(config.output, 'receipt.json')}) + '\n');
} catch (error) {
  await mkdir(config.output, {recursive: true});
  await writeFile(path.join(config.output, 'failure.json'), JSON.stringify({schema: 'oi.nara-return-native-replay-failure/v1',
    recorded_at: new Date().toISOString(), checks, world: config.world, block_id: config.block_id,
    error: String(error), stack: error?.stack}, null, 2) + '\n');
  throw error;
} finally {try{await closeOpened?.();}finally{await server.close();}}
