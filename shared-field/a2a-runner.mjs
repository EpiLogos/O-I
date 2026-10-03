#!/usr/bin/env node
/**
 * The A2A owner floor's process doorway, spawned by the desktop kernel
 * (`KernelOp::A2aExchange`, desktop/cradle/kernel/src/shared_field.rs).
 *
 * stdin:  one JSON request — { binding, presence, initiator_participant_ref,
 *         message, authority } — where `authority` is the kernel-composed
 *         operator-send decision ({ allowed, grant_ref, operation_id }).
 * stdout: the floor's `oi.a2a-difference/v1` document verbatim, or
 *         { "a2aError": "<the floor's own refusal>" }.
 *
 * The floor stays the protocol owner: `performA2aExchange` validates the
 * binding and presence, asks the authority before any network I/O, checks the
 * peer's Agent Card and sends the one bounded message. This runner only
 * answers the floor's authority demand with the kernel's decision — and
 * refuses when that decision names a different operation.
 */
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performA2aExchange } from './a2a.mjs';

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export async function runA2aExchange(request, { fetch_impl = globalThis.fetch } = {}) {
  if (request === null || typeof request !== 'object' || Array.isArray(request)) throw new TypeError('A2A runner request must be an object');
  const { binding, presence, initiator_participant_ref, message, authority } = request;
  if (authority === null || typeof authority !== 'object') throw new TypeError('A2A runner requires the kernel-composed exchange authority');
  return performA2aExchange({
    binding,
    presence,
    initiator_participant_ref,
    message,
    fetch_impl,
    authorize_exchange: async (demand) => {
      if (authority.operation_id !== demand.operation_id) return { allowed: false };
      return { allowed: authority.allowed === true, grant_ref: authority.grant_ref };
    },
  });
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let deliveryAttempted = false;
  try {
    const difference = await runA2aExchange(JSON.parse(await readStdin()), {
      fetch_impl: (url, init) => {
        // The owner floor performs card/authority checks before its one POST.
        // A lost POST response cannot establish that the peer did no work.
        if (init?.method === 'POST') deliveryAttempted = true;
        return globalThis.fetch(url, init);
      },
    });
    process.stdout.write(`${JSON.stringify(difference)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ a2aError: error instanceof Error ? error.message : String(error), kind: deliveryAttempted ? 'outcome_unknown' : 'refused', delivery_attempted: deliveryAttempted })}\n`);
    process.exitCode = 1;
  }
}
