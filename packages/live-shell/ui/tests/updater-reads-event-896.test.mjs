import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'

// O-I #747 round 896, item 1 (automation-play, walked on the private native stack): typing in the Automation device's From field blanked
// the whole shell. The field's onChange read `event.currentTarget.value` inside a state updater; React runs the updater after the event's
// dispatch, when currentTarget is null, so the render threw "Cannot read properties of null (reading 'value')" and, with no error
// boundary above the device pool, the shell unmounted. The Blueprint face's number fields did the same.
//
// The rule, over every component of the shell: an updater handed to a state setter never reads the event's currentTarget. The value is
// read in the handler, before the setter is called. CODE-READING over the sources, comments and strings blanked.
const src = fileURLToPath(new URL('../src/', import.meta.url))
const files = []
const walk = dir => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else if (/\.tsx?$/.test(name)) files.push(path) } }
walk(src)

/** The source with comments and string literals blanked (template literals kept: their `${}` holes are code). */
function blank(text) {
  let out = '', i = 0
  while (i < text.length) {
    const two = text.slice(i, i + 2), c = text[i]
    if (two === '//') { const end = text.indexOf('\n', i); const stop = end < 0 ? text.length : end; out += ' '.repeat(stop - i); i = stop }
    else if (two === '/*') { const end = text.indexOf('*/', i + 2); const stop = end < 0 ? text.length : end + 2; out += text.slice(i, stop).replace(/[^\n]/g, ' '); i = stop }
    else if (c === '"' || c === "'") { let j = i + 1; while (j < text.length && text[j] !== c && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1; out += ' '.repeat(Math.min(j + 1, text.length) - i); i = j + 1 }
    else { out += c; i += 1 }
  }
  return out
}

/** Each state setter called with an updater (`setX(current => …)`), with the updater's text up to the setter call's closing parenthesis. */
function updaters(code) {
  const found = []
  for (const match of code.matchAll(/\bset[A-Z]\w*\(\s*(?:\(\s*\w*\s*\)|\w+)\s*=>/g)) {
    let depth = 0, j = match.index + match[0].indexOf('(')
    for (; j < code.length; j++) { if (code[j] === '(') depth += 1; else if (code[j] === ')' && --depth === 0) break }
    found.push({at: match.index, text: code.slice(match.index, j + 1)})
  }
  return found
}

const lineOf = (text, at) => text.slice(0, at).split('\n').length

test('#747 r896 item 1: no state updater in the shell reads the event\'s currentTarget, which React has let go by the time it runs', () => {
  const faults = []
  let seen = 0
  for (const file of files) {
    const text = readFileSync(file, 'utf8'), code = blank(text)
    for (const {at, text: body} of updaters(code)) {
      seen += 1
      if (/\.currentTarget\b/.test(body)) faults.push(`${relative(src, file)}:${lineOf(text, at)} ${body.replace(/\s+/g, ' ').slice(0, 120)}`)
    }
  }
  assert.ok(seen > 200, `the shell's updaters are read (${seen})`)
  assert.deepEqual(faults, [], 'an updater reads the event after its dispatch')
})

test('#747 r896 item 1: the Automation and Blueprint faces read the typed value in the handler', () => {
  const automation = blank(readFileSync(join(src, 'components/NativeSceneFace.automation.tsx'), 'utf8'))
  const blueprint = blank(readFileSync(join(src, 'components/NativeSceneFace.blueprint.tsx'), 'utf8'))
  assert.match(automation, /onChange=\{event => \{const value = event\.currentTarget\.value; setDrafts\(current => \(\{\.\.\.current, \[draftKey\]: value\}\)\)\}\}/)
  assert.match(blueprint, /onChange=\{event => \{const value = event\.currentTarget\.value; setTexts\(current => \(\{\.\.\.current, \[key\]: value\}\)\)\}\}/)
})
