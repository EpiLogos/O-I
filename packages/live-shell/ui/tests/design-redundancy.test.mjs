import test from 'node:test'
import assert from 'node:assert/strict'

// A number stands once in a view (ProjectCentral/docs/1-vision/dlw/DLW.md §16.12). scripts/design-sweep.mjs renders every designed device's folded, compact,
// whole and widget views on its defaults and on each fixture and reads off what each says in numbers. A display's corner gives way to
// any number a control or readout in the same plate already states (panel.tsx Display); what is left is held here, each with the
// reason it stands. A device view that is not in this list says no number twice. A new duplicate fails this test: either remove it, or
// say here why it is not one.
const STANDS = {
  'actuation:frames-monitor · whole': 'The picture marks the held window and the keep line on its own axes; the readout and the dial are the numbers to read and to set.',
  'actuation:gateway · whole': 'The picture marks the check-in age beside its needle; the readout is the number to read.',
  'actuation:harness-model · compact': 'The corner is turns used of the cap (3 / 12); the cap is the Budget box.',
  'actuation:harness-model · whole': 'The corner is turns used of the cap; the Budget box is the cap and the readout the turns used: two parameters, the same number only when the agent spent its whole budget (12 / 12, the Failed fixture).',
  'actuation:harness-model · widget': 'The turns readout is used of the cap, two parameters that read the same only when the agent spent its whole budget (12 / 12, the Failed fixture).',
  'central:search · whole': 'The picture is the vāk neighbourhood with the symbol at its centre; the readout is the symbol to read.',
  'central:nara-conversation · whole': 'The corner is the turn against the budget (43 KB / 256 KB); the readout is the turn on its own.',
  'expressions:colour · whole': 'Different parameters that stand at the same value by default.',
  'expressions:contacts · compact': 'The corner is the wall bounce and the pair bounce; the dial is the wall bounce.',
  'expressions:field · whole': 'The corner joins the mode and the tone; the readout is the mode.',
  'expressions:ink · whole': 'Different parameters that stand at the same value by default.',
  'expressions:morph · whole': 'Different parameters that stand at the same value by default.',
  'expressions:resonance · whole': 'The dial is the frequency you set; the readout is the frequency live, which a modulator moves.',
  'expressions:studio · whole': 'The readout is the default the box would return to.',
  'quaternal-logic:resonator-bank · whole': 'The picture counts the resonators on its own axis; the readout is the count to read.',
  'quaternal-logic:resonator-bank · widget': 'The picture counts the resonators on its own axis; the readout is the count to read.',
  'software-factory:ledger · whole': 'The picture lists the tasks; the readout is the receipt of the chosen one.',
  'techne:lens · widget': 'The picture marks each lens on its ring; the readout names the lens in force.',
  'techne:journey · compact': 'The picture writes the journey\'s length on its own axis; the dial is the pace.',
  'techne:journey · whole': 'The picture writes the journey\'s length on its own axis; the dial is the pace.',
  'workcell:seat · compact': 'The picture shows both seats; the corner names the chosen one.',
  'workcell:seat · whole': 'The picture shows both seats; the corner and the readouts are the chosen one.',
}

const {sweep} = await import('../scripts/design-sweep.mjs')

test('no device view says a number twice, except where its picture and its reading are two things', {timeout: 600_000}, async () => {
  const {findings, skipped, designs} = await sweep()
  assert.ok(designs >= 80, `the sweep reads the catalogue (${designs} designs)`)
  assert.deepEqual(skipped, [], 'every design renders on the server')
  assert.deepEqual(findings.filter(f => f.error), [], 'every view renders')
  const unsaid = new Map()
  for (const f of findings.filter(f => !f.error)) {
    const key = `${f.id} · ${f.view}`
    if (STANDS[key]) continue
    unsaid.set(key, [...(unsaid.get(key) ?? []), `"${f.token}" in ${f.places.join(' and ')}`])
  }
  assert.deepEqual([...unsaid].map(([key, lines]) => `${key}: ${[...new Set(lines)].join('; ')}`), [], 'a number stands once in a view')
})
