import assert from 'node:assert/strict';
import test from 'node:test';
import { createA2aBinding, createA2aPresence, performA2aExchange } from './a2a.mjs';

const FIELD = 'field:phase3:portable';
const INITIATOR = 'participant:phase3:portable:local';
const REMOTE = 'participant:phase3:portable:remote';

function binding(revision = 1) {
  return createA2aBinding({
    binding_ref: 'a2a-binding:phase3:portable', binding_revision: revision,
    field_ref: FIELD, participant_ref: REMOTE, agent_ref: 'agent:phase3:portable:remote',
    publisher_participant_ref: REMOTE, publication_decision_ref: `decision:binding:${revision}`,
    source_revision: `remote@${revision}`, published_at: '2026-08-17T11:00:00.000Z',
    endpoint_url: 'https://remote.example/a2a', agent_card_url: 'https://remote.example/.well-known/agent-card.json',
    provenance: [{ kind: 'fixture', ref: `binding:${revision}`, source_system: 'O:I' }],
  });
}
function presence(current) {
  return createA2aPresence({
    binding_ref: current.binding_ref, field_ref: current.field_ref, participant_ref: current.participant_ref,
    availability: 'online', sequence: 1, observed_at: '2026-08-17T11:00:01.000Z',
    provenance: [{ kind: 'probe', ref: 'probe:1', source_system: 'O:I' }],
  });
}
function message(overrides = {}) {
  return { message_id: 'message:phase3:portable', text: 'hello', purpose: 'portable-phase3-proof', ...overrides };
}

function jsonResponse(value, init = {}) {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' }, ...init });
}

test('missing or denied Exchange authority causes zero A2A network I/O', async () => {
  const current = binding();
  let calls = 0;
  const fetch_impl = async () => { calls += 1; throw new Error('network must not run'); };
  await assert.rejects(() => performA2aExchange({
    binding: current, presence: presence(current), initiator_participant_ref: INITIATOR,
    message: message(), fetch_impl,
  }), /authorize_exchange/);
  assert.equal(calls, 0);

  await assert.rejects(() => performA2aExchange({
    binding: current, presence: presence(current), initiator_participant_ref: INITIATOR,
    message: message(), fetch_impl,
    authorize_exchange: async () => ({ allowed: false, grant_ref: 'exchange-grant:denied' }),
  }), /denied/);
  assert.equal(calls, 0);
});

test('authority demand is bound before discovery to field, actor, counterparty, protocol, mode and endpoint lineage', async () => {
  const current = binding(7);
  let demand;
  let calls = 0;
  const fetch_impl = async (url, options) => {
    calls += 1;
    if (calls === 1) {
      assert.equal(url, current.agent_card_url);
      assert.equal(options.redirect, 'error');
      return jsonResponse({
        name: 'Remote card cannot widen authority', version: '1',
        supportedInterfaces: [{ url: current.endpoint_url, protocolBinding: 'HTTP+JSON', protocolVersion: '1.0' }],
        skills: [{ id: 'dangerous-tool-claim', description: 'metadata only' }],
      });
    }
    assert.equal(url, `${current.endpoint_url}/message:send`);
    assert.equal(options.redirect, 'error');
    return jsonResponse({ message: { messageId: 'message:phase3:return', role: 'ROLE_AGENT', parts: [{ text: 'ok' }] } }, { headers: { 'content-type': 'application/a2a+json' } });
  };
  const difference = await performA2aExchange({
    binding: current, presence: presence(current), initiator_participant_ref: INITIATOR,
    message: message({ exchange_operation_id: 'operation:phase3:portable' }), fetch_impl,
    authorize_exchange: async value => { demand = value; return { allowed: true, grant_ref: 'exchange-grant:phase3:portable' }; },
  });
  assert.deepEqual(demand, {
    field_ref: FIELD,
    initiator_participant_ref: INITIATOR,
    counterparty_participant_ref: REMOTE,
    protocol: 'a2a', protocol_version: '1.0', protocol_binding: 'HTTP+JSON', mode: 'message:send',
    binding_ref: current.binding_ref, binding_revision: 7,
    operation_id: 'operation:phase3:portable', purpose: 'portable-phase3-proof', scope_json: JSON.stringify({ kind: 'message' }),
  });
  assert.equal(calls, 2);
  assert.equal(difference.exchange_authority.grant_ref, 'exchange-grant:phase3:portable');
  assert.equal(difference.exchange_authority.operation_id, 'operation:phase3:portable');
  assert.equal('skills' in difference.exchange_authority, false);
});

test('endpoint revision replacement cannot silently inherit a grant bound to an earlier lineage', async () => {
  const replacement = binding(2);
  let calls = 0;
  await assert.rejects(() => performA2aExchange({
    binding: replacement, presence: presence(replacement), initiator_participant_ref: INITIATOR,
    message: message(), fetch_impl: async () => { calls += 1; throw new Error('must not call'); },
    authorize_exchange: async demand => ({
      allowed: demand.binding_revision === 1,
      grant_ref: 'exchange-grant:bound-to-revision-1',
    }),
  }), /denied/);
  assert.equal(calls, 0);
});

test('A2A response and request material are bounded before becoming returned data', async () => {
  const current = binding();
  const huge = 'x'.repeat(70 * 1024);
  let calls = 0;
  const fetch_impl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ name: huge, supportedInterfaces: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  await assert.rejects(() => performA2aExchange({
    binding: current, presence: presence(current), initiator_participant_ref: INITIATOR,
    message: message(), fetch_impl,
    authorize_exchange: async () => ({ allowed: true, grant_ref: 'exchange-grant:bounded' }),
  }), /byte limit/);
  assert.equal(calls, 1);

  await assert.rejects(() => performA2aExchange({
    binding: current, presence: presence(current), initiator_participant_ref: INITIATOR,
    message: message({ text: 'x'.repeat(40 * 1024) }),
    fetch_impl: async () => { throw new Error('must not call'); },
    authorize_exchange: async () => ({ allowed: true, grant_ref: 'exchange-grant:oversize-request' }),
  }), /message\.text exceeds/);
});
