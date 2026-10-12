import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, readdir} from 'node:fs/promises'

// P0-R5c guard: the restored owner-receipt disclosure in NativeMaterialBrowser
// resolves to a style rule, folded by default, token colours only. Textual on
// purpose: the element and its rules are read from source, so the guard does
// not depend on a browser render. The rule is a port of RefusalCard's
// folded-receipt treatment (agentShell.css, .agent-refusal details rules).

const src = new URL('../src/', import.meta.url)

async function walk(dir, base = '') {
  const out = []
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...await walk(new URL(`${entry.name}/`, dir), rel))
    else out.push(rel)
  }
  return out
}
const read = rel => readFile(new URL(rel, src), 'utf8')

test('the owner-receipt disclosure is still rendered by NativeMaterialBrowser, folded by default', async () => {
  const tsx = await read('components/NativeMaterialBrowser.tsx')
  const line = tsx.split('\n').find(l => l.includes('className="owner-receipt"'))
  assert.ok(line, 'NativeMaterialBrowser renders <details className="owner-receipt">')
  assert.doesNotMatch(line, /<details[^>]*\sopen[\s=>]/, 'the owner receipt is folded by default (no open attribute)')
})

test('a stylesheet under src carries the owner-receipt rules', async () => {
  const css = (await walk(src))
    .filter(rel => rel.endsWith('.css'))
    .map(async rel => ({rel, text: await read(rel)}))
  const sheets = await Promise.all(css)
  const hits = sheets.filter(({text}) => /(^|[\s,}])\.owner-receipt\s*\{/m.test(text))
  assert.ok(hits.length > 0, '.owner-receipt has a rule in a stylesheet bundled into the app')
  const body = hits.map(({text}) => text).join('\n')
  assert.match(body, /\.owner-receipt\s+summary\s*\{[^}]*color:\s*var\(--text-faint\)/, 'the summary reads as a quiet affordance (token colour)')
  assert.match(body, /\.owner-receipt\s+pre\s*\{[^}]*font-family:\s*var\(--mono/, 'the body is monospace via the mono token')
})

test('the owner-receipt rules use token colours only, no raw colour literals', async () => {
  const sheets = await Promise.all((await walk(src))
    .filter(rel => rel.endsWith('.css'))
    .map(async rel => ({rel, text: await read(rel)})))
  for (const {rel, text} of sheets) {
    const rules = [...text.matchAll(/(\.owner-receipt[^{]*)\{([^}]*)\}/g)]
    for (const [, selector, decls] of rules) {
      assert.doesNotMatch(decls, /#[0-9a-fA-F]{3,8}\b|\b(rgb|rgba|hsl|hsla)\(/, `${rel}: ${selector.trim()} uses token colours only`)
    }
  }
})
