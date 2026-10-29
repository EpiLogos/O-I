import test from 'node:test'
import assert from 'node:assert/strict'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// A part whose code loads when it first draws (shell/loadWhenDrawn.ts; MAP, the build lane's loading item; O-I #740): until its
// module arrives the place shows the shell's waiting line for it, in words, never a blank; the part itself at once after; fetched
// ahead by load() or loadEveryPart() so a server render draws it; a module that did not arrive says so in words and offers to reload
// the window; a later draw asks again, not remembered as failed. Channel: scripted (renderToStaticMarkup over fake modules).

const {loadWhenDrawn, loadEveryPart, PartWaiting} = await import('../src/shell/loadWhenDrawn.ts')

const Greeting = ({who}) => createElement('p', null, `Hello ${who}`)

test('a part shows its waiting line until its module arrives, then the part itself with its props', async () => {
  let asked = 0
  const Part = loadWhenDrawn('Greeting', async () => { asked += 1; return Greeting })
  const waiting = renderToStaticMarkup(createElement(Part, {who: 'Day'}))
  assert.match(waiting, /role="status"/, 'not loaded: a waiting line, announced')
  assert.match(waiting, /data-part-loading="Greeting"/)
  assert.match(waiting, />Greeting — loading…</, 'not loaded: the place says what it waits for, in words')
  assert.equal(asked, 0, 'a server render does not start the fetch (effects do not run)')
  assert.equal(await Part.load(), Greeting)
  assert.equal(renderToStaticMarkup(createElement(Part, {who: 'Day'})), '<p>Hello Day</p>', 'arrived: drawn at once')
  await Part.load()
  assert.equal(asked, 1, 'the module is fetched once')
})

test('a load that failed says so in words, with the reason, and offers to reload the window, which reloads it', t => {
  // A browser keeps a module whose fetch failed failed for the document's life, so asking again in the same window cannot recover a
  // missing chunk (seen headless, O-I #740 round one): the one way back is a reload.
  const failed = renderToStaticMarkup(createElement(PartWaiting, {name: 'Central\'s chain', failure: 'chunk missing'}))
  assert.match(failed, /role="alert"/)
  assert.match(failed, /data-part-failed="Central&#x27;s chain"/)
  assert.match(failed, /Central&#x27;s chain did not load: chunk missing\./)
  assert.match(failed, /<button type="button"[^>]*>Reload the window<\/button>/)
  assert.doesNotMatch(failed, /Try again/, 'no retry that cannot recover')
  let reloads = 0
  globalThis.location = {reload: () => { reloads += 1 }}
  t.after(() => { delete globalThis.location })
  const line = PartWaiting({name: 'Central\'s chain', failure: 'chunk missing'})
  const button = [line.props.children].flat().find(child => child?.type === 'button')
  button.props.onClick()
  assert.equal(reloads, 1, 'the press reloads the window')
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
