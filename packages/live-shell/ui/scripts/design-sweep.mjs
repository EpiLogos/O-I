// The redundancy sweep (manual §16.12: "Put one short reading at the top right"; §16.10: a panel states a thing once).
// Renders every designed device's folded, compact, whole and widget views, server-side, on its defaults and on each of its fixtures,
// and reads off what each view says in numbers: the value under a dial, in a box, in a readout, in a display's corner, in a display's
// own text. A reading that one view says twice, by two different parts of the picture, is a duplicate: the owner reads the same thing
// twice and has to wonder if they are two things. (A control and the display it moves each show a number in the manual's own
// patterns (EQ Eight's handle and its dial); this reports them all, and tests/design-redundancy.test.mjs holds the ones that stand.)
//
//   node scripts/design-sweep.mjs [--json] [family:face ...]     prints the duplicates, device by device
//   node scripts/design-sweep.mjs --show family:face view         prints what one view says, place by place
//
// Pure reading: nothing is written. A design that does not render here is listed as skipped, with why.
import {register} from 'node:module'
import {readdir} from 'node:fs/promises'
import {fileURLToPath, pathToFileURL} from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const compiler = pathToFileURL(path.join(here, '../node_modules/typescript/lib/typescript.js')).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
globalThis.__CRADLE_DOCUMENTS__ ??= ''
const {createElement: h} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')

const PANELS = path.join(here, '../src/inhabitants/catalogue/panels')
export const VIEWS = ['folded', 'compact', 'whole', 'widget']

/** Every designed device: the six reference modules and each `<family>__<face>.tsx`. */
export async function designs(only = []) {
  const files = (await readdir(PANELS)).filter(f => /^[a-z-]+__[a-z0-9-]+\.tsx$/.test(f) || ['day.tsx', 'member.tsx', 'physics.tsx', 'scope.tsx', 'skills.tsx', 'torus.tsx'].includes(f))
  const found = [], skipped = []
  for (const file of files.sort()) {
    const named = file.includes('__') ? file.slice(0, -4).replace('__', ':') : undefined
    if (only.length && named && !only.includes(named)) continue
    try {
      const mod = await import(pathToFileURL(path.join(PANELS, file)).href)
      const design = Object.values(mod).find(x => x && typeof x === 'object' && typeof x.id === 'string' && typeof x.compact === 'function' && typeof x.whole === 'function')
      if (!design) { skipped.push({file, why: 'exports no design'}); continue }
      if (only.length && !only.includes(design.id)) continue
      found.push(design)
    } catch (error) { skipped.push({file, why: String(error?.message ?? error).split('\n')[0]}) }
  }
  return {found, skipped}
}

// ---------------------------------------------------------------- reading a view's markup

const VOID = new Set(['br', 'hr', 'img', 'input', 'path', 'circle', 'rect', 'line', 'use', 'stop', 'meta', 'link', 'polyline', 'polygon', 'ellipse'])
/** The text nodes of a markup string, each with the class names of its ancestors, innermost last. A small tolerant tokenizer: React's
 * static markup is well formed, and the kit's classes are all this needs. */
export function textNodes(markup) {
  const out = [], stack = []
  let cells = 0
  const token = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g
  let m
  while ((m = token.exec(markup))) {
    if (m[5] !== undefined) {
      const text = m[5].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()
      if (text) out.push({text, classes: stack.map(s => s.cls), tags: stack.map(s => s.tag), cell: [...stack].reverse().find(s => s.cell)?.cell})
    } else if (m[1]) {
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === m[2]) { stack.length = i; break }
    } else if (!m[4] && !VOID.has(m[2])) {
      const cls = /class="([^"]*)"/.exec(m[3])?.[1] ?? ''
      stack.push({tag: m[2], cls, cell: cls.split(/\s+/).some(c => c === 'dp-cell') ? ++cells : undefined})
    }
  }
  return out
}

/** What kind of place a reading stands in, or null for text that is a name, an axis or a sentence. */
function placeOf(node) {
  const has = c => node.classes.some(x => x.split(/\s+/).includes(c))
  if (has('dp-display-corner')) return 'display corner'
  if (has('dp-pad') && node.tags.at(-1) === 'text' && has('dp-ink-dim')) return 'pad'
  if (has('dp-readout-value')) return 'readout'
  if (has('dp-value')) return 'dial'
  if (has('dp-box')) return 'box'
  if (has('dp-fold-reading') || has('dp-folded-reading')) return 'folded reading'
  if (has('dp-tile-badge')) return 'badge'
  if (has('dp-display') && node.tags.at(-1) === 'text' && (has('dp-ink') || has('dp-ink-dim'))) return 'display text'
  return null
}

/** The numbers a reading says: "22 % / 2.40 s" says two. A bare digit is a count that happens to match another and a token with no digit
 * is a word: neither is compared. */
function tokens(text) {
  return text.split(/\s(?:\/|·)\s|,\s/).map(t => t.replace(/\s+/g, ' ').trim()).filter(t => /\d/.test(t) && !/^[+−-]?\d$/.test(t))
}

/** The duplicates of one view: a number said by two different kinds of place, or twice by controls of the same name. Two dials that
 * happen to stand at the same number under different names are no duplicate. */
export function duplicatesIn(markup) {
  const nodes = textNodes(markup)
  const labelOf = new Map()
  for (const n of nodes) if (n.cell && n.classes.some(c => c.split(/\s+/).includes('dp-label'))) labelOf.set(n.cell, n.text)
  const readings = nodes.map(node => ({node, place: placeOf(node)})).filter(r => r.place)
  // The kit's own rule (panel.tsx Display): a corner whose every number stands elsewhere in the plate gives way.
  const elsewhere = new Set(readings.filter(r => r.place !== 'display corner' && r.place !== 'display text').flatMap(r => tokens(r.node.text)))
  const echoed = new Set(readings.filter(r => r.place === 'display corner' && r.node.text.split(/ (?:\/|·) /).every(part => elsewhere.has(part.trim()))).map(r => r.node))
  const seen = new Map()
  for (const {node, place} of readings) {
    if (echoed.has(node)) continue
    const label = node.cell ? labelOf.get(node.cell) : undefined
    for (const token of tokens(node.text)) {
      const list = seen.get(token) ?? []
      list.push({place, label})
      seen.set(token, list)
    }
  }
  const out = []
  for (const [token, list] of seen) {
    if (list.length < 2) continue
    const kinds = new Set(list.map(x => x.place)), labels = list.map(x => x.label).filter(Boolean)
    const real = kinds.size > 1 || new Set(labels).size < labels.length
    if (real) out.push({token, places: list.map(x => x.label ? `${x.place} "${x.label}"` : x.place)})
  }
  return out
}

/** The sweep: for each device, each fixture, each view, the duplicates. */
export async function sweep(only = []) {
  const {found, skipped} = await designs(only)
  const findings = []
  const nav = {}
  for (const design of found) {
    const fixtures = [['defaults', {}], ...Object.entries(design.fixtures ?? {})]
    for (const [name, fixture] of fixtures) {
      const v = {...design.defaults}
      for (const [k, x] of Object.entries(fixture)) { if (x === undefined) delete v[k]; else v[k] = x }
      for (const view of VIEWS) {
        let markup
        try { markup = renderToStaticMarkup(h('div', null, design[view]({v, set: () => {}, nav, page: design.firstPage ?? '', setPage: () => {}}))) } catch (error) {
          findings.push({id: design.id, fixture: name, view, error: String(error?.message ?? error).split('\n')[0]}); continue
        }
        for (const dup of duplicatesIn(markup)) findings.push({id: design.id, fixture: name, view, ...dup})
      }
    }
  }
  return {findings, skipped, designs: found.length}
}

/** The markup of one view of one design on its defaults (or on a fixture). */
export function markupOf(design, view, fixture = {}) {
  const v = {...design.defaults}
  for (const [k, x] of Object.entries(fixture)) { if (x === undefined) delete v[k]; else v[k] = x }
  return renderToStaticMarkup(h('div', null, design[view]({v, set: () => {}, nav: {}, page: design.firstPage ?? '', setPage: () => {}})))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2), json = args.includes('--json'), only = args.filter(a => a.includes(':'))
  if (args[0] === '--show') {
    const {found} = await designs([args[1]]), design = found[0]
    if (!design) { console.log(`no design ${args[1]}`); process.exit(1) }
    for (const n of textNodes(markupOf(design, args[2] ?? 'whole'))) console.log(`${(placeOf(n) ?? '').padEnd(14)} ${JSON.stringify(n.text)}  ${n.classes.filter(Boolean).slice(-2).join(' > ')}`)
    process.exit(0)
  }
  const {findings, skipped, designs: count} = await sweep(only)
  if (json) console.log(JSON.stringify({findings, skipped}, null, 2))
  else {
    const errors = findings.filter(f => f.error), dups = findings.filter(f => !f.error)
    const byDevice = new Map()
    for (const f of dups) {
      const key = `${f.id} · ${f.view}`, line = `"${f.token}" in ${f.places.join(' and ')}`
      const set = byDevice.get(key) ?? new Set()
      set.add(line); byDevice.set(key, set)
    }
    for (const [key, lines] of byDevice) { console.log(key); for (const line of lines) console.log('  ' + line) }
    console.log(`\n${count} designs swept, ${byDevice.size} device views say a number twice, ${errors.length} views did not render, ${skipped.length} designs skipped.`)
    for (const e of errors.slice(0, 20)) console.log(`  did not render: ${e.id} ${e.view} (${e.fixture}): ${e.error}`)
    for (const s of skipped) console.log(`  skipped: ${s.file}: ${s.why}`)
  }
}
