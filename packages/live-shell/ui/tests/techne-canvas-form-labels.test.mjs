// The Canvas's Form page draws its words apart (O-I #742): the display's own line (the whole the form gathers round), its corner (the
// form), each role's number and each card's name round the ring, and the count of roles placed never stand on one another. Each word is
// measured as the device's type draws it (sdk/panel.css: .dp-ink 9.5 px, .dp-ink-dim 9 px, .dp-axis 8.5 px, the corner 9.5 px with its
// padding), at the widest a character of the UI face takes.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) return r
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const {renderToStaticMarkup} = await import('react-dom/server')
const {design} = await import('../src/inhabitants/catalogue/panels/techne__canvas.tsx')

const nav = {fold() {}, full() {}, unfold() {}, select() {}}
const formPage = v => renderToStaticMarkup(design.whole({v, set() {}, nav, page: 'form', setPage() {}}))
const unescape = text => text.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/** The widest a character of the UI face draws, per px of type. */
const WIDE = 0.58
const SIZE = {'dp-ink': 9.5, 'dp-ink-dim': 9, 'dp-axis': 8.5}
/** Every word the form's display draws, as a box in its own pixels: its SVG texts, and the corner where the well puts it. */
function words(markup) {
  const at = markup.indexOf('aria-label="The form"')
  assert.ok(at > 0, 'the Form page draws its display')
  const well = markup.slice(markup.lastIndexOf('<div', at), markup.indexOf('</div>', at) + 6)
  const w = Number(/viewBox="0 0 (\d+) (\d+)"/.exec(well)[1]), h = Number(/viewBox="0 0 (\d+) (\d+)"/.exec(well)[2])
  const boxes = []
  for (const m of well.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)) {
    const attrs = m[1], text = unescape(m[2]), size = SIZE[/class="([^"]+)"/.exec(attrs)?.[1]] ?? 9.5
    const x = Number(/ x="([-\d.]+)"/.exec(attrs)[1]), y = Number(/ y="([-\d.]+)"/.exec(attrs)[1]), anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
    const width = text.length * size * WIDE, left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x
    boxes.push({text, left, right: left + width, top: y - size * 0.78, bottom: y + size * 0.22})
  }
  const corner = /class="dp-display-corner">([^<]*)</.exec(well)
  if (corner) { const text = unescape(corner[1]), width = text.length * 9.5 * WIDE + 6; boxes.push({text, left: w - 5 - width, right: w - 5, top: 3, bottom: 3 + 13, corner: true}) }
  return {w, h, boxes}
}
const meet = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

const TWELVE = ['0', '1', '2', '3', '4', '5'].flatMap(r => [r, `${r}′`])
const cards = names => JSON.stringify([{id: 'W', kind: 'card', x: 0, y: 0, w: 94, h: 94, name: 'The inquiry the scratch world gathers round'},
  ...TWELVE.map((role, i) => ({id: `m${i}`, kind: 'card', x: 0, y: 0, w: 94, h: 94, name: names(role)}))])
const BOARDS = {
  'a twelvefold round a long whole, every role filled': {form: 'twelvefold', whole: 'W', items: cards(role => `Member on ${role} of the inquiry`),
    roles: JSON.stringify(Object.fromEntries(TWELVE.map((role, i) => [role, `m${i}`])))},
  'a twelvefold with seven placed': {form: 'twelvefold', whole: 'W', items: cards(role => `Member ${role}`),
    roles: JSON.stringify(Object.fromEntries(TWELVE.slice(0, 7).map((role, i) => [role, `m${i}`])))},
  'a sixfold round a long whole': {form: 'sixfold', whole: 'W', items: cards(role => `The sixfold's member ${role}`),
    roles: JSON.stringify(Object.fromEntries(['0', '1', '2', '3', '4', '5'].map((role, i) => [role, `m${i * 2}`])))},
}

for (const [name, board] of Object.entries(BOARDS)) {
  test(`the Form display's words stand apart: ${name}`, () => {
    const {w, h, boxes} = words(formPage({...design.defaults, ...board, layout: 'form'}))
    assert.ok(boxes.some(box => box.corner), 'the corner names the form')
    for (const box of boxes) assert.ok(box.left >= 0 && box.right <= w + 0.5 && box.top >= 0 && box.bottom <= h + 0.5, `“${box.text}” stands inside the display (${JSON.stringify(box)})`)
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++)
      assert.ok(!meet(boxes[i], boxes[j]), `“${boxes[i].text}” and “${boxes[j].text}” overlap`)
  })
}
