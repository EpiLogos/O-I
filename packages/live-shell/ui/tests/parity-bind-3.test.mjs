import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

// PARITY bind-3: the Gateways monitor's row for the agency build selects Messages, where its mark stands (§19.9), not AGENCY_GATEWAY_ID,
// which nothing publishes (factory-placement.test.mjs keeps it unpublished).
test('PARITY bind-3: pressing the AIKit agency gateway row shows a device that is published', async () => {
  const rail = await readFile(new URL('../src/agent/devices/AgentRailDevices.tsx', import.meta.url), 'utf8')
  assert.match(rail, /chain === 'aikit-agency-gateway' \? MESSAGES_ID/)
  assert.doesNotMatch(rail, /\? AGENCY_GATEWAY_ID/)
})
