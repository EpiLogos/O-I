// O-I #747 round 890, the render walk (captures 8 and 9): File › Export › Picture… was pressed Export, then Escape, and the choices stood
// on over the next Expression. Export left focus on the page (the pressed button is disabled while the frame captures), and Escape was
// heard only by the dialog itself (an onKeyDown on its div), so it never reached them. Picture…'s choices stand "over the window until
// Export or Close" (panels/expressions.tsx), and Escape closes them wherever focus stands in them or where Export left it, never a key
// meant for another control.
// SCRIPTED: the panel's source read for the one listener; the listener's decision run over a fixture document.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const panel = await readFile(new URL('../src/panels/expressions.tsx', import.meta.url), 'utf8')

test('Escape closes Picture… where Export left focus, not only from inside its dialog', () => {
  const listener = panel.match(/const closePictureOnEscape = \(event: KeyboardEvent\) => \{([^\n]*)\}\n/)
  assert.ok(listener, 'one listener on the document while Picture… stands')
  assert.match(panel, /if \(!picture\) return\s*\n\s*document\.addEventListener\('keydown', closePictureOnEscape\)\s*\n\s*return \(\) => document\.removeEventListener\('keydown', closePictureOnEscape\)\s*\n\s*\}, \[picture\]\)/)
  assert.doesNotMatch(panel, /onKeyDown=\{event => \{if \(event\.key === 'Escape'\) \{event\.preventDefault\(\); setPicture\(false\)\}\}\}/, 'one way Escape closes it')
  // The decision itself: run over a page whose focus stands on its body, in the dialog, or in another control.
  const body = {tag: 'body'}, inside = {tag: 'select'}, other = {tag: 'input'}
  const dialog = {contains: node => node === inside}
  const run = (key, at, prevented = false) => {
    let closed = false, stopped = false
    const document = {activeElement: at, body}
    const decide = new Function('document', 'pictureDialog', 'setPicture', `return (event: KeyboardEvent) => {${listener[1]}}`.replace(': KeyboardEvent', ''))
    decide(document, {current: dialog}, value => { closed = value === false })({key, defaultPrevented: prevented, preventDefault: () => { stopped = true }})
    return {closed, stopped}
  }
  assert.deepEqual(run('Escape', body), {closed: true, stopped: true}, 'focus left on the page by Export')
  assert.deepEqual(run('Escape', inside), {closed: true, stopped: true}, 'focus in its choices')
  assert.deepEqual(run('Escape', other), {closed: false, stopped: false}, 'another control\'s Escape is its own')
  assert.deepEqual(run('Escape', body, true), {closed: false, stopped: false}, 'an Escape already answered')
  assert.deepEqual(run('Enter', body), {closed: false, stopped: false})
})
