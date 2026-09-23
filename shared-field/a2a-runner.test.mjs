import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { createA2aBinding, createA2aPresence } from './a2a.mjs';

// The kernel's process doorway (KernelOp::A2aExchange spawns `node a2a-runner.mjs`
// with the composed request on stdin and reads one JSON document from stdout).
const RUNNER = fileURLToPath(new URL('./a2a-runner.mjs', import.meta.url));
const FIELD = 'field:encounter:agent-session/runner';
const PARTICIPANT = 'participant:runner-peer';

function run(input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [RUNNER], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, reply: JSON.parse(out) }));
    child.stdin.end(typeof input === 'string' ? input : JSON.stringify(input));
  });
}

async function withPeer(fn) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const port = server.address().port;
    requests.push(req.url);
    if (req.url === '/.well-known/agent-card.json') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ name: 'runner peer', version: '1.0.0', supportedInterfaces: [{ url: `http://127.0.0.1:${port}/a2a`, protocolBinding: 'HTTP+JSON', protocolVersion: '1.0' }], capabilities: {}, defaultInputModes: ['text/plain'], defaultOutputModes: ['text/plain'], skills: [] }));
      return;
    }
    if (req.url === '/a2a/message:send' && req.method === 'POST') {
      for await (const _ of req);
      res.setHeader('content-type', 'application/a2a+json');
      res.end(JSON.stringify({ message: { messageId: 'a2a-message:runner-reply', role: 'ROLE_AGENT', parts: [{ text: 'returned' }] } }));
      return;
    }
    res.statusCode = 404; res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    const binding = createA2aBinding({
      binding_ref: 'a2a-binding:runner', binding_revision: 1, field_ref: FIELD, participant_ref: PARTICIPANT,
      agent_ref: 'agent:runner-peer', publisher_participant_ref: 'participant:desktop-operator',
      publication_decision_ref: 'decision:runner', source_revision: 'runner@1', published_at: '2026-09-23T00:00:00.000Z',
      endpoint_url: `http://127.0.0.1:${port}/a2a`, agent_card_url: `http://127.0.0.1:${port}/.well-known/agent-card.json`,
      provenance: [{ kind: 'desktop-operator-observation', ref: 'observation:runner', source_system: 'oi.cradle' }],
    });
    const presence = createA2aPresence({
      binding_ref: binding.binding_ref, field_ref: FIELD, participant_ref: PARTICIPANT, availability: 'online', sequence: 1,
      observed_at: '2026-09-23T00:00:01.000Z', provenance: [{ kind: 'desktop-operator-observation', ref: 'observation:runner', source_system: 'oi.cradle' }],
    });
    await fn({ binding, presence, requests });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const message = { message_id: 'a2a-runner-1', text: 'the exact passage', purpose: 'runner-test' };
const authority = { allowed: true, grant_ref: 'exchange-grant:operator-send:a2a-runner-1', operation_id: 'a2a-runner-1' };

test('the runner answers the floor with the kernel-composed authority and returns the difference verbatim', async () => {
  await withPeer(async ({ binding, presence, requests }) => {
    const { code, reply } = await run({ binding, presence, initiator_participant_ref: 'participant:desktop-operator', message, authority });
    assert.equal(code, 0);
    assert.equal(reply.schema, 'oi.a2a-difference/v1');
    assert.equal(reply.admission, 'pending');
    assert.deepEqual(reply.exchange_authority, { grant_ref: authority.grant_ref, operation_id: 'a2a-runner-1' });
    assert.deepEqual(requests, ['/.well-known/agent-card.json', '/a2a/message:send']);
  });
});

test('an authority for another operation, or a denied one, is refused before any network I/O', async () => {
  await withPeer(async ({ binding, presence, requests }) => {
    for (const other of [{ ...authority, operation_id: 'a2a-elsewhere' }, { ...authority, allowed: false }]) {
      const { code, reply } = await run({ binding, presence, initiator_participant_ref: 'participant:desktop-operator', message, authority: other });
      assert.equal(code, 1);
      assert.match(reply.a2aError, /denied by explicit Exchange authority/);
    }
    assert.deepEqual(requests, []);
  });
});

test('a request without the composed authority or unreadable bytes is a refusal document, never a crash', async () => {
  assert.match((await run({ message })).reply.a2aError, /kernel-composed exchange authority/);
  assert.equal(typeof (await run('not json')).reply.a2aError, 'string');
});
