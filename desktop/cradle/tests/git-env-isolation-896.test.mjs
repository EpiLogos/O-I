// O-I #747 round 896 1T (DLW build ruling 2026-11-09): no test aims git at a repository it did not make. A GIT_DIR, GIT_WORK_TREE or
// GIT_INDEX_FILE exported around a suite reaches every child that inherits the environment, and in a temp folder `git init` then
// initialises that repository again and `git config` writes its config: round 896 wrote `core.worktree` and a `[user]` section into
// O-I's own .git/config this way, from git-diff-native's fixture. Every test that makes a repository clears GIT_* from its children.
import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync, spawnSync} from 'node:child_process'
import {mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {extname, join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'

const cradle = fileURLToPath(new URL('..', import.meta.url))
const repo = join(cradle, '..', '..')
const withoutGit = env => Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith('GIT_')))
// Every file of a repository's .git, path to bytes, so that any write into it shows.
const contents = dir => {
  const files = {}
  const walk = at => { for (const entry of readdirSync(at, {withFileTypes: true})) {
    const path = join(at, entry.name)
    if (entry.isDirectory()) walk(path); else files[relative(dir, path)] = readFileSync(path, 'latin1')
  } }
  walk(dir)
  return files
}

test('git-diff-native, run with GIT_DIR, GIT_WORK_TREE and GIT_INDEX_FILE aimed at another repository, leaves that repository as it was', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'oi-git-env-'))
  try {
    const other = join(scratch, 'other'), elsewhere = join(scratch, 'elsewhere')
    mkdirSync(other); mkdirSync(elsewhere)
    execFileSync('git', ['init', '-q', other], {env: withoutGit(process.env)})
    const dotGit = join(other, '.git'), before = contents(dotGit)
    // As a suite run by hand: not a child of this runner (NODE_TEST_CONTEXT would have it report here and run nothing of its own).
    const {NODE_TEST_CONTEXT: _runner, ...own} = withoutGit(process.env)
    const env = {...own, GIT_DIR: dotGit, GIT_WORK_TREE: elsewhere, GIT_INDEX_FILE: join(dotGit, 'suite-index')}
    const run = spawnSync(process.execPath, ['--experimental-strip-types', '--import', './tests/ts-register.mjs', '--test', 'tests/git-diff-native.test.mjs'],
      {cwd: cradle, env, encoding: 'utf8'})
    const after = contents(dotGit)
    const written = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(path => before[path] !== after[path]).sort()
    assert.deepEqual(written, [], `the test wrote into the repository GIT_DIR named; its config reads\n${after.config}`)
    assert.equal(run.status, 0, `and it passes there:\n${run.stdout}${run.stderr}`)
  } finally { rmSync(scratch, {recursive: true, force: true}) }
})

// The census: every test source in the repository that runs git and makes a repository (`init` or `config`) clears GIT_* from its
// children's environment, by the language's own test of the name's prefix. Rust's in-module tests are read from their `#[cfg(test)] mod`.
const SKIP = new Set(['node_modules', 'dist', 'target', 'ui-dist', 'vendor', 'build', '.git', 'artifacts', '.public-edition'])
const JS = {runs: /\b(?:execFileSync|execFile|spawnSync|spawn|execSync)\(\s*['"`]git[\s'"`]/, clears: /startsWith\(\s*['"]GIT_['"]\s*\)/}
const LANGUAGES = {'.mjs': JS, '.js': JS, '.ts': JS,
  '.py': {runs: /\[\s*['"]git['"]/, clears: /startswith\(\s*['"]GIT_['"]\s*\)/},
  '.rs': {runs: /Command::new\(\s*"git"\s*\)/, clears: /starts_with\(\s*"GIT_"\s*\)/}}
const MAKES = /['"](?:init|config)['"]|\bgit (?:init|config)\b/
const TESTS = /(^|\/)(tests?|walk)\//
const testFile = file => TESTS.test(file) || /(\.test\.|_test\.|(^|\/)test_)/.test(file)
// Found by this census when it was written, so that it can never pass by reading nothing.
const KNOWN = ['cli/src/rolling_dev.rs', 'cli/src/update_flow.rs', 'cli/tests/descriptor_entries.rs', 'cli/tests/development_field_s0.rs',
  'cli/tests/development_field_source_package.rs', 'desktop/cradle/tests/git-diff-native.test.mjs',
  'desktop/cradle/tests/git-diff-read-comparisons-native.test.mjs', 'desktop/cradle/walk/lib/factory-specimen.mjs',
  'desktop/cradle/walk/scenarios/flow-canvas.mjs', 'site/cut-reading-edition.test.mjs', 'site/essay-source.test.mjs',
  'tests/continuous-work/test_campaign.py', 'tests/development-field/probe/src/main.rs', 'tests/factory-bootstrap/native-replay.py']

test('every test that makes a git repository clears GIT_* from its children', () => {
  const found = new Map()
  const walk = dir => { for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) { if (!SKIP.has(entry.name)) walk(join(dir, entry.name)); continue }
    const language = LANGUAGES[extname(entry.name)]
    if (!language || !entry.isFile()) continue
    const file = relative(repo, join(dir, entry.name))
    let text = readFileSync(join(dir, entry.name), 'utf8')
    if (!testFile(file)) {
      const tests = extname(file) === '.rs' ? text.search(/#\[cfg\(test\)\]\s*(?:pub(?:\([^)]*\))?\s+)?mod\s/) : -1
      if (tests < 0) continue
      text = text.slice(tests)
    }
    if (language.runs.test(text) && MAKES.test(text)) found.set(file, language.clears.test(text))
  } }
  walk(repo)
  assert.deepEqual([...found].filter(([, clears]) => !clears).map(([file]) => file).sort(), [],
    'these make a git repository with the caller\'s GIT_* in their children\'s environment')
  assert.deepEqual(KNOWN.filter(file => !found.has(file)), [], 'the census reads every test it was written over')
})
