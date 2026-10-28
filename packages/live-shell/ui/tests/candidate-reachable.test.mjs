import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join, relative} from 'node:path'

// The reachability measure (scripts/candidate-reachable.mjs; FOUNDATION §7 "Unreached code"): a file is product when a page the
// candidate ships and opens loads it at runtime. Two rules are proved here on fixtures, then held on the real tree:
// - an import the build erases does not reach: `import type`, an import whose every name carries `type`, and an import whose names
//   are used only as types (Vite's esbuild transform drops all three; `--types` restores the old measure that counted them);
// - every page the candidate ships and opens is a root: the shell's index.html, and the hosted Expressions frame's index.html and
//   library.html (package-payload.py shell_entry / expressions_entry; hostedApp.ts hostedLibraryUrl).
// Channel: scripted (the script's own exports over fixture files and over the seat's tree). No build is run.

const measure = await import('../scripts/candidate-reachable.mjs')
const {walk, pageScripts, roots, reachable, unreachedUnder, devPagesUnder, declaresOnlyTypes, ENTRIES, UNOPENED, repo} = measure

/** A fixture tree in the OS temporary directory; removed after the test. */
function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'candidate-reachable-'))
  t.after(() => rmSync(root, {recursive: true, force: true}))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), {recursive: true})
    writeFileSync(join(root, path), text)
  }
  return root
}
const names = (root, set) => [...set].map(file => relative(root, file)).sort()

const IMPORTS = {
  'src/main.tsx': [
    "import type {A} from './typeOnly'",
    "import {type B, type B2} from './inlineTypes'",
    "import {C} from './usedAsType'",
    "import {D} from './usedAsValue'",
    "import {type E, F} from './mixed'",
    "import './side.css'",
    "export * from './reexported'",
    "export type {H} from './typeReexport'",
    "import Page from './Page'",
    "import raw from './script.js?raw'",
    "const later = () => import('./lazy')",
    "const worker = new Worker(new URL('./work.ts', import.meta.url), {type: 'module'})",
    'export const value: A | B | B2 | C | E = D + F + raw',
    'export const page = <Page />',
    'void later; void worker',
  ].join('\n'),
  'src/typeOnly.ts': 'export interface A {a: number}\nexport type A2 = string',
  'src/inlineTypes.ts': "import './inlineSide.css'\nexport type B = number\nexport type B2 = string",
  'src/inlineSide.css': '.x{}',
  'src/usedAsType.ts': "import {deep} from './deep'\nexport interface C {c: number}\nexport const runtime = deep",
  'src/deep.ts': 'export const deep = 1',
  'src/usedAsValue.ts': 'export const D = 1',
  'src/mixed.ts': 'export type E = number\nexport const F = 2',
  'src/side.css': "@import './imported.css';\n.y{}",
  'src/imported.css': '.z{}',
  'src/reexported.ts': 'export const G = 3',
  'src/typeReexport.ts': 'export type H = number',
  'src/Page.tsx': 'export default function Page() { return null }',
  'src/script.js': "import './notFollowed'\nwindow.x = 1",
  'src/notFollowed.ts': 'export const never = 1',
  'src/lazy.ts': 'export const lazy = 1',
  'src/work.ts': 'self.onmessage = () => {}',
  'src/orphan.ts': 'export const orphan = 1',
  'src/orphan.css': '.o{}',
  'src/declared.d.ts': 'declare const g: number',
  'src/orphan.test.ts': 'export {}',
  'src/dev/index.html': '<!doctype html><script type="module" src="./devMain.tsx"></script>',
  'src/dev/devMain.tsx': "import {devOnly} from '../devOnly'\nconsole.log(devOnly)",
  'src/devOnly.ts': 'export const devOnly = 1',
  'index.html': '<!doctype html><div id="app"></div><script type="module" src="/src/main.tsx"></script>',
}

test('an import the build erases does not reach: import type, all-inline-type names, and names used only as types', t => {
  const root = fixture(t, IMPORTS)
  const reached = names(root, walk([[join(root, 'src/main.tsx'), join(root, 'index.html')]]).keys())
  for (const file of ['src/typeOnly.ts', 'src/inlineTypes.ts', 'src/inlineSide.css', 'src/usedAsType.ts', 'src/deep.ts', 'src/typeReexport.ts']) {
    assert.ok(!reached.includes(file), `${file} is named only by types: the build erases the import, so it never runs`)
  }
  for (const file of ['src/main.tsx', 'src/usedAsValue.ts', 'src/mixed.ts', 'src/side.css', 'src/imported.css', 'src/reexported.ts',
    'src/Page.tsx', 'src/lazy.ts', 'src/work.ts', 'src/script.js']) {
    assert.ok(reached.includes(file), `${file} is loaded at runtime`)
  }
  assert.ok(!reached.includes('src/notFollowed.ts'), 'a ?raw file ships as text: it is reached, and its own imports are not followed')
  assert.ok(!reached.includes('src/orphan.ts'))
})

test('--types counts the erased imports again, which is how a file reached only by types is named', t => {
  const root = fixture(t, IMPORTS)
  const named = names(root, walk([[join(root, 'src/main.tsx'), join(root, 'index.html')]], {types: true}).keys())
  for (const file of ['src/typeOnly.ts', 'src/inlineTypes.ts', 'src/usedAsType.ts', 'src/deep.ts', 'src/typeReexport.ts']) assert.ok(named.includes(file), file)
  assert.ok(!named.includes('src/orphan.ts'), 'a file nothing names is not reached either way')
})

test('a module that declares only types is told apart from one that only types reach but that carries code', t => {
  const root = fixture(t, IMPORTS)
  assert.equal(declaresOnlyTypes(join(root, 'src/typeOnly.ts')), true, 'interfaces and aliases only: it never runs, the product type-checks against it')
  assert.equal(declaresOnlyTypes(join(root, 'src/typeReexport.ts')), true)
  assert.equal(declaresOnlyTypes(join(root, 'src/usedAsType.ts')), false, 'it carries code that no runtime path runs')
  assert.equal(declaresOnlyTypes(join(root, 'src/inlineTypes.ts')), false, 'a side-effect import is code')
})

test('a page\'s module scripts are its roots: "/" is the page\'s own directory, as Vite serves it', t => {
  const root = fixture(t, {
    ...IMPORTS,
    'frame/index.html': '<html><body><div id="app"></div><script type="module" src="/src/native.ts"></script><script src="/plain.js"></script></body></html>',
    'frame/src/native.ts': "import {app} from './app'\nconsole.log(app)",
    'frame/src/app.ts': 'export const app = 1',
  })
  assert.deepEqual(pageScripts(join(root, 'frame/index.html')), [join(root, 'frame/src/native.ts')], 'only module scripts, resolved under the page')
  const shell = walk([[join(root, 'src/main.tsx'), join(root, 'index.html')]])
  const both = walk([[join(root, 'src/main.tsx'), join(root, 'index.html')], [join(root, 'frame/src/native.ts'), join(root, 'frame/index.html')]])
  assert.ok(!shell.has(join(root, 'frame/src/app.ts')), 'the shell alone never imports the frame\'s app')
  assert.ok(both.has(join(root, 'frame/src/app.ts')), 'with the frame\'s page as a second root, its app is product')
  assert.equal(both.get(join(root, 'frame/src/native.ts')), join(root, 'frame/index.html'), 'a root is reached by its page')
})

test('the unreached listing names what nothing loads, never a declaration or a test, and names what only a dev page loads', t => {
  const root = fixture(t, IMPORTS)
  const reached = new Set(walk([[join(root, 'src/main.tsx'), join(root, 'index.html')]]).keys())
  const unreached = names(root, unreachedUnder([join(root, 'src')], reached))
  assert.ok(unreached.includes('src/orphan.ts') && unreached.includes('src/orphan.css') && unreached.includes('src/typeOnly.ts'))
  assert.ok(!unreached.includes('src/declared.d.ts'), 'a declaration file never runs and is not listed')
  assert.ok(!unreached.includes('src/orphan.test.ts'), 'a test is not product and is not listed')
  const dev = devPagesUnder([join(root, 'src')])
  assert.equal(dev.get(join(root, 'src/devOnly.ts')), join(root, 'src/dev/index.html'), 'a file only a dev page loads is named with that page')
  assert.ok(!dev.has(join(root, 'src/orphan.ts')))
})

// ── the seat's tree ─────────────────────────────────────────────────────────────────────────────────────────────

const product = reachable()
const ui = (path) => join(repo, 'packages/live-shell/ui', path)

test('the roots are the pages the candidate ships and opens: the shell, the hosted frame and its Library', () => {
  assert.deepEqual(ENTRIES, ['packages/live-shell/ui/index.html', 'desktop/cradle/expressions-app/index.html', 'desktop/cradle/expressions-app/library.html'])
  assert.deepEqual(roots().map(([script]) => relative(repo, script)),
    ['packages/live-shell/ui/src/main.tsx', 'desktop/cradle/expressions-app/src/native.ts', 'desktop/cradle/expressions-app/src/library.ts'])
  for (const page of UNOPENED) for (const script of pageScripts(join(repo, page))) assert.ok(!product.has(script), `${page} is built but nothing in the candidate opens it`)
  assert.ok(product.has(join(repo, 'desktop/cradle/src/expressions/hostedApp.ts')), 'hostedApp.ts, which opens index.html and library.html, is itself product')
})

test('the frame\'s own code is product through its page, not through the shell: its application module is reached from native.ts', () => {
  const shellOnly = walk(roots().slice(0, 1))
  const app = join(repo, 'desktop/cradle/expressions-app/field-studies-journeys/src/app.ts')
  assert.ok(!shellOnly.has(app), 'the shell never imports the frame\'s application')
  assert.ok(product.has(app), 'the frame\'s page loads it')
})

test('import.meta.glob reaches what its patterns match, as Vite bundles it: relative and root patterns, arrays, negations; a ?raw glob ships text', t => {
  const root = fixture(t, {
    'vite.config.mjs': 'export default {}',
    'index.html': '<!doctype html><script type="module" src="/src/main.ts"></script>',
    'src/main.ts': [
      "const panels = import.meta.glob<{design: unknown}>('./panels/*__*.tsx')",
      "const vendor = import.meta.glob(['./vendor/*.js', '!./vendor/skipped.js'], {eager: true})",
      "const deep = import.meta.glob('/src/deep/**/*.ts')",
      "const texts = import.meta.glob('./texts/*.md', {query: '?raw', import: 'default'})",
      'export {panels, vendor, deep, texts}',
    ].join('\n'),
    'src/panels/a__one.tsx': "import {shared} from '../shared'\nexport const design = shared",
    'src/panels/plain.tsx': 'export const notMatched = 1',
    'src/shared.ts': 'export const shared = 1',
    'src/vendor/kept.js': 'export const kept = 1',
    'src/vendor/skipped.js': 'export const skipped = 1',
    'src/deep/x/y/leaf.ts': 'export const leaf = 1',
    'src/texts/note.md': "import './never'",
    'src/never.ts': 'export const never = 1',
  })
  const reached = names(root, walk([[join(root, 'src/main.ts'), join(root, 'index.html')]]).keys())
  for (const file of ['src/panels/a__one.tsx', 'src/shared.ts', 'src/vendor/kept.js', 'src/deep/x/y/leaf.ts']) assert.ok(reached.includes(file), `${file}: a glob the build keeps loads it`)
  assert.ok(!reached.includes('src/panels/plain.tsx'), 'a file the pattern does not match is not reached')
  assert.ok(!reached.includes('src/vendor/skipped.js'), 'a negated pattern takes its match out')
  assert.ok(!reached.includes('src/never.ts'), 'a glob with a query ships its files as text: they are not followed')
})

test('a file imported with a query (`?raw`, `?url`) is reached as a leaf whatever its kind — an HTML form, an SVG — and its text is not followed', t => {
  const root = fixture(t, {
    'index.html': '<!doctype html><script type="module" src="/src/main.ts"></script>',
    'src/main.ts': "import form from '../documents/form.html?raw'\nimport mark from './mark.svg?url'\nimport copy from './copy.md?raw'\nexport {form, mark, copy}",
    'documents/form.html': '<!doctype html><script type="module" src="./never.ts"></script>',
    'documents/never.ts': 'export const never = 1',
    'src/mark.svg': '<svg/>',
    'src/copy.md': 'text',
    'src/unnamed.html': '<p></p>',
  })
  const reached = names(root, walk([[join(root, 'src/main.ts'), join(root, 'index.html')]]).keys())
  for (const file of ['documents/form.html', 'src/mark.svg', 'src/copy.md']) assert.ok(reached.includes(file), `${file}: the build carries it as text or a URL`)
  assert.ok(!reached.includes('documents/never.ts'), 'a ?raw file is text: what it names is not followed')
  assert.ok(!reached.includes('src/unnamed.html'), 'a file nothing names is not reached')
})

test('on the tree: the Flow\'s form (desktop/cradle/documents/ql-flow.html) is product: the shell imports it with ?raw', () => {
  assert.ok(product.has(join(repo, 'desktop/cradle/documents/ql-flow.html')), 'DocumentFlowFace.tsx and flow/instance.ts import it with ?raw; the candidate\'s build carries it')
})

test('on the tree: the catalogue\'s designs load through the panels\' glob (panels/index.ts), and a file nothing names stays unreached', () => {
  for (const design of ['techne__palace.tsx', 'software-factory__ledger.tsx', 'workcell__remote-carrier.tsx']) {
    assert.ok(product.has(ui(`src/inhabitants/catalogue/panels/${design}`)), `${design}: the shell loads it through import.meta.glob('./*__*.tsx')`)
  }
  // REPLACED (#788): "knowledgeRouteBinding.ts: nothing the candidate loads names it" — the retired Knowledge route's binding was deleted
  // (its page is Scope's Knowledge page, §19.12). A file nothing names stays unreached on the fixture tree above (src/unnamed.html); on the
  // tree, the agent chain's devices hold no file the candidate does not load.
  assert.deepEqual(unreachedUnder([ui('src/agent/devices')], product).map(file => relative(repo, file)), [], 'every file of the agent devices is product')
})

test('on the tree: the shell is reached, and a module only types name is not, unless it declares only types', () => {
  assert.ok(product.has(ui('src/App.tsx')))
  assert.ok(product.has(ui('src/shell/liveSelection.ts')), 'SetSelection\'s owner carries code the shell runs')
  const workspaceTypes = ui('src/shell/workspaceTypes.ts')
  assert.ok(!product.has(workspaceTypes) && declaresOnlyTypes(workspaceTypes), 'a types module: the product type-checks against it, it never runs')
  assert.ok(reachable({types: true}).has(workspaceTypes), 'and the product\'s types name it')
})
