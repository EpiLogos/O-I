import test from 'node:test'
import assert from 'node:assert/strict'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// A part whose code loads when it first draws (shell/loadWhenDrawn.ts; MAP, the build lane's loading item): nothing until its
// module arrives, the part itself at once after; fetched ahead by load() or loadEveryPart() so a server render draws it; a module
// that did not arrive is fetched again, not remembered as failed. Channel: scripted (renderToStaticMarkup over fake modules).

const {loadWhenDrawn, loadEveryPart} = await import('../src/shell/loadWhenDrawn.ts')

const Greeting = ({who}) => createElement('p', null, `Hello ${who}`)

test('a part draws nothing until its module arrives, then the part itself with its props', async () => {
  let asked = 0
  const Part = loadWhenDrawn('Greeting', async () => { asked += 1; return Greeting })
  assert.equal(renderToStaticMarkup(createElement(Part, {who: 'Day'})), '', 'not loaded: nothing drawn')
  assert.equal(asked, 0, 'a server render does not start the fetch (effects do not run)')
  assert.equal(await Part.load(), Greeting)
  assert.equal(renderToStaticMarkup(createElement(Part, {who: 'Day'})), '<p>Hello Day</p>', 'arrived: drawn at once')
  await Part.load()
  assert.equal(asked, 1, 'the module is fetched once')
})

test('loadEveryPart fetches each part made so far', async () => {
  const A = loadWhenDrawn('A', async () => () => createElement('i', null, 'a'))
  const B = loadWhenDrawn('B', async () => () => createElement('b', null, 'b'))
  await loadEveryPart()
  assert.equal(renderToStaticMarkup(createElement('div', null, createElement(A), createElement(B))), '<div><i>a</i><b>b</b></div>')
})

test('a module that did not arrive is fetched again by the next try', async t => {
  t.mock.method(console, 'error', () => {})
  let tries = 0
  const Part = loadWhenDrawn('Flaky', async () => { tries += 1; if (tries === 1) throw new Error('chunk missing'); return Greeting })
  await assert.rejects(Part.load(), /chunk missing/)
  assert.equal(await Part.load(), Greeting, 'the second try loads it')
  assert.equal(tries, 2)
})
