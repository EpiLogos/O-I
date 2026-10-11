/**
 * Agent-shell fixture fidelity suite — OFFLINE refusal harness only.
 *
 * Bundles src/agent/agentShellFixture.tsx (the REAL agent-shell components
 * over an unavailable transport and EMPTY agency data) and asserts only the
 * honest-refusal behaviours: the unavailable banner disclosures, the
 * disclosed-absence lines, honest telemetry absence, and no fabricated
 * rows. It needs no kernel and stays green offline.
 *
 * The live path — real native.agent against the F1 oracle — lives in
 * tests/agent-shell-live.browser.mjs (--live / --cut / --fixture /
 * --expect-live-red-when-cut). The fixture here is the refusal half; it is
 * NOT run against the oracle (that green-lit a fake shell once; never again).
 *
 * Env: OI_FIDELITY_EVIDENCE (default: a NEW dir, never the old fixture
 * evidence), OI_CHROME, OI_BROWSER_RUNTIME.
 */

import {
  runFixtureHarness, summarize, EVIDENCE_FIXTURE_DEFAULT,
} from './support/agentShellHarness.mjs'

const args = process.argv.slice(2)
const evidence = args.includes('--evidence') ? args[args.indexOf('--evidence') + 1] : EVIDENCE_FIXTURE_DEFAULT

const checker = await runFixtureHarness({evidence})
const summary = summarize('agent-shell fixture refusal', checker)
if (checker.faults.length) {
  console.error(JSON.stringify({...summary, faults: checker.faults}, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({...summary, ok: true, evidence}, null, 2))
