// O-I #747 round 895, item 5 ("Studio: no reading"): the walks and the browser checks bundle the shell with esbuild
// (tests/support/agentShellHarness.mjs), and esbuild has no import.meta.glob. The catalogue's design loader
// (src/inhabitants/catalogue/panels/index.ts) threw on its first need, so every catalogue design was refused ("The design of
// expressions:studio did not load; the generic plate draws it") and the generic plate stood in its place, with no light to read. The
// walk took that for the Studio's own light. The app's Vite build reads the glob; the harness now builds the loader's table as Vite does,
// so a walk draws each device with its own design.
// SCRIPTED: the harness's own bundle options, bundling the catalogue's loader; the bundle is read, not run (a design needs a page).
import test from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync} from 'node:fs'
import {createRequire} from 'node:module'
import {join} from 'node:path'
import {bundleOptions, root, ui} from './support/agentShellHarness.mjs'

const esbuild = createRequire(join(root, 'desktop/cradle/package.json'))('esbuild')
const panels = join(ui, 'src/inhabitants/catalogue/panels')

test('the harness bundles the catalogue\'s design loader with every design module behind it, as the app\'s Vite build does', async () => {
  const built = await esbuild.build({...bundleOptions(), stdin: {contents: "export {loadDesign, DESIGNED_IDS} from './src/inhabitants/catalogue/panels'",
    resolveDir: ui, sourcefile: 'designs-895.tsx', loader: 'tsx'}, outfile: 'designs-895.mjs'})
  const js = built.outputFiles.find(file => file.path.endsWith('.mjs')).text
  // The vendored faces' globs stay as they are: guarded (faces/vendor.ts glob), they answer nothing under esbuild as under Node.
  assert.doesNotMatch(js, /import\.meta\.glob\("\.\/\*__\*\.tsx"\)/, 'the loader\'s glob is not left for the browser to refuse')
  const designs = readdirSync(panels).filter(name => /__.*\.tsx$/.test(name)).sort()
  assert.ok(designs.includes('expressions__studio.tsx'), 'the Studio is one of them')
  for (const name of designs) assert.ok(js.includes(`// src/inhabitants/catalogue/panels/${name}`), `${name} is bundled behind the loader`)
  assert.match(js, /"\.\/expressions__studio\.tsx": \(\) => /, 'the loader finds the Studio by the key Vite gives it')
})
