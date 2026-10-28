import test from 'node:test'
import assert from 'node:assert/strict'

// A number stands once in a view (ProjectCentral/docs/1-vision/dlw/DLW.md §16.12). scripts/design-sweep.mjs renders every designed device's folded, compact,
// whole and widget views on its defaults and on each fixture and reads off what each says in numbers. A display's corner gives way to
// any number a control or readout in the same plate already states (panel.tsx Display); what is left is held here, each with the
// reason it stands. A device view that is not in this list says no number twice. A new duplicate fails this test: either remove it, or
// say here why it is not one.
const STANDS = {
  'actuation:gateway · whole': 'The picture marks the check-in age beside its needle; the readout is the number to read.',
  'actuation:harness-model · compact': 'The corner is turns used of the cap (3 / 12); the cap is the Budget box.',
  'actuation:harness-model · whole': 'The corner is turns used of the cap; the Budget box is the cap and the readout the turns used: two parameters, the same number only when the agent spent its whole budget (12 / 12, the Failed fixture). On the Answer page (#804, the retired Answer\'s entry), the corner is the turn against the budget (43 KB / 256 KB); the readout is the turn on its own.',
  'actuation:harness-model · widget': 'The turns readout is used of the cap, two parameters that read the same only when the agent spent its whole budget (12 / 12, the Failed fixture).',
  'central:search · whole': 'The picture is the vāk neighbourhood with the symbol at its centre; the readout is the symbol to read.',
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
}

// (#725: the Frames monitor's, the Nara conversation's and the Seat's entries left with their designs, retired in the 22 Oct manual rewrite.)

const {sweep} = await import('../scripts/design-sweep.mjs')
const {readdir} = await import('node:fs/promises')
/** The designs the catalogue holds: each `<family>__<face>.tsx` panel (catalogue/panels/index.ts) and the six reference modules (§16.15). */
const catalogued = async () => (await readdir(new URL('../src/inhabitants/catalogue/panels/', import.meta.url)))
  .filter(f => /^[a-z-]+__[a-z0-9-]+\.tsx$/.test(f) || ['day.tsx', 'member.tsx', 'physics.tsx', 'scope.tsx', 'skills.tsx', 'torus.tsx'].includes(f)).length

test('no device view says a number twice, except where its picture and its reading are two things', {timeout: 600_000}, async () => {
  const {findings, skipped, designs} = await sweep()
  // REPLACED (#725): "at least 80 designs" — the 22 Oct manual rewrite retired 28 panel files into the pages of other devices; the sweep reads
  // every design the catalogue holds.
  assert.equal(designs, await catalogued(), `the sweep reads the whole catalogue (${designs} designs)`)
  assert.ok(designs >= 60, 'and the catalogue is the whole one, not a stub')
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
