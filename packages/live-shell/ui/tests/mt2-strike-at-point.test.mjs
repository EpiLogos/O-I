// MT2 (O-I #771, DLW §21.2 "What strikes the Torus": "A touch | The point of the surface you touch"; Full: "Touch the surface and it
// rings"). A touch on the torus strikes the native owner at the point of the surface under the pointer, through the owner's strike at a
// point (QL-MEF #342 `strike-at`, InstrumentSession.strikeAt). The frame names the point only from its own drawing of the stage: the
// orthographic stage the engine is handed (production.ts setHostView from camera.ts), inverted, meets the torus of QL's `m1::torus`
// (R 16/9, r 1) at its first surface, and that surface point's own angles are what the owner is struck at.
//
// The frame's sources are TypeScript: each module is bundled once with esbuild into a temporary directory, as the frame's own torus
// tests do (desktop/cradle/expressions-app/field-studies-journeys/tests/me1-torus-drive.test.mjs). The owner is the controlled scene
// owner of desktop/cradle/tests/native-expression-fixture.mjs (protocol only, not QL's numbers); it has no `strike-at`, so the owner
// below commits one generation for it, as the native owner does, and keeps every point it was struck at.
import test, {after} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const frame = fileURLToPath(new URL('../../../../desktop/cradle/expressions-app/', import.meta.url))
const journeys = join(frame, 'field-studies-journeys')
const out = mkdtempSync(join(tmpdir(), 'mt2-strike-at-'))
after(() => rmSync(out, {recursive: true, force: true}))
const cache = new Map()
const bundle = (entry, name) => {
  if (!cache.has(name)) cache.set(name, (async () => {
    const outfile = join(out, `${name}.mjs`)
    await esbuild.build({absWorkingDir: journeys, nodePaths: [join(frame, 'node_modules')], entryPoints: [entry], bundle: true, format: 'esm',
      platform: 'node', outfile, logLevel: 'silent', loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}})
    return import(pathToFileURL(outfile).href)
  })())
  return cache.get(name)
}
const touch = () => bundle(join(journeys, 'src/native-field/surfaceTouch.ts'), 'touch')
const stage = () => bundle(join(journeys, 'src/camera.ts'), 'camera')
const controller = () => bundle(join(journeys, 'src/native-field/controller.ts'), 'controller')
const fixture = () => import(new URL('../../../../desktop/cradle/tests/native-expression-fixture.mjs', import.meta.url))

const TAU = 2 * Math.PI
const R = 16 / 9
/** QL-MEF crates/ql-mef/src/m1.rs `torus(theta1, theta2)`: the reference these tests hold the frame to. */
const qlTorus = (theta, phi) => [(R + Math.cos(theta)) * Math.cos(phi), (R + Math.cos(theta)) * Math.sin(phi), Math.sin(theta)]
const angleNear = (a, b, tolerance, label) => {
  const d = Math.abs(((a - b) % TAU + TAU + Math.PI) % TAU - Math.PI)
  assert.ok(d <= tolerance, `${label}: ${a} vs ${b}`)
}
const onSheet = (point, label) => {
  for (const key of ['theta', 'phi']) assert.ok(Number.isFinite(point[key]) && point[key] >= 0 && point[key] < TAU, `${label}: ${key} ${point[key]} lies on the sheet [0, 2π)`)
}
/** The candidate's own stage: 1280 × 800, QL's presentation scale (120 engine units per metre) over the frame's 400 engine units per stage unit. */
const SIZE = {width: 1280, height: 800}
const SCALE = {unitsPerMetre: 120, worldScale: 400}
const camera = patch => ({mode: '3d', yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0, plane: 'XY', depth: 0, grid: false, snap: false, ...patch})
const toStage = point => {
  const k = SCALE.unitsPerMetre / SCALE.worldScale
  return {x: point[0] * k, y: point[1] * k, z: point[2] * k}
}

// ---------------------------------------------------------------------------------------------------- the torus and its angles

test('a point of the torus reads back as the angles that made it, and a point moved along its normal keeps them', async () => {
  const {torusPoint, surfaceAngles} = await touch()
  for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) {
    const theta = i * TAU / 24, phi = j * TAU / 24 + 0.01
    const point = torusPoint(theta, phi)
    qlTorus(theta, phi).forEach((value, axis) => assert.ok(Math.abs(point[axis] - value) < 1e-12, 'the frame\'s torus is QL\'s m1::torus'))
    const read = surfaceAngles(point)
    onSheet(read, 'read back')
    angleNear(read.theta, theta, 1e-12, 'theta')
    angleNear(read.phi, phi, 1e-12, 'phi')
    // The body moves along its normal (scene_field.rs `surface`), so a struck, displaced point still names the same place.
    const normal = [Math.cos(theta) * Math.cos(phi), Math.cos(theta) * Math.sin(phi), Math.sin(theta)]
    for (const d of [-0.3, 0.25]) {
      const moved = surfaceAngles(point.map((v, axis) => v + d * normal[axis]))
      angleNear(moved.theta, theta, 1e-12, 'displaced theta')
      angleNear(moved.phi, phi, 1e-12, 'displaced phi')
    }
  }
})

test('a ray meets the torus at the first surface it reaches; through the hole or past the rim it meets nothing', async () => {
  const {rayHit, surfaceAngles} = await touch()
  const top = rayHit([R, 0, 10], [0, 0, -1])
  assert.ok(top, 'a ray down onto the ring meets it')
  const topAngles = surfaceAngles(top.point)
  angleNear(topAngles.theta, Math.PI / 2, 1e-7, 'the top of the tube')
  angleNear(topAngles.phi, 0, 1e-7, 'above φ = 0')
  const side = rayHit([10, 0, 0], [-1, 0, 0])
  assert.ok(side && Math.abs(side.point[0] - (R + 1)) < 1e-7, 'the first surface along −x is the outer equator, not the inner one behind it')
  angleNear(surfaceAngles(side.point).theta, 0, 1e-7, 'the outer equator')
  assert.equal(rayHit([0, 0, 10], [0, 0, -1]), null, 'through the hole')
  assert.equal(rayHit([4, 0, 10], [0, 0, -1]), null, 'past the rim')
  assert.equal(rayHit([R, 0, -10], [0, 0, -1]), null, 'a ray pointing away from the torus')
})

// ---------------------------------------------------------------------------------------------------- the stage: a touch names its point

test('a touch on the stage names the surface point drawn under it, at any turn of the camera', async () => {
  const {touchedSurface, torusPoint} = await touch()
  const {project, basis} = await stage()
  const cameras = [camera({}), camera({yaw: 0.7, pitch: -0.4}), camera({yaw: -2.1, pitch: 1.2, zoom: 1.6, panX: 40, panY: -25}), camera({yaw: 3, pitch: -1.45, zoom: 0.6})]
  let exact = 0
  for (const view of cameras) {
    const {a, b} = basis(view), n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
    for (let i = 0; i < 12; i++) for (let j = 0; j < 16; j++) {
      const theta = (i + 0.5) * TAU / 12, phi = (j + 0.25) * TAU / 16, drawn = torusPoint(theta, phi)
      const pixel = project(toStage(drawn), view, SIZE.width, SIZE.height)
      const touched = touchedSurface(pixel.x, pixel.y, {camera: view, ...SIZE}, {projection: 'orthographic', ...SCALE})
      assert.ok(touched.point, `a point the stage draws is a point a touch can reach (${theta}, ${phi})`)
      onSheet(touched.point, 'touched')
      const at = torusPoint(touched.point.theta, touched.point.phi), back = project(toStage(at), view, SIZE.width, SIZE.height)
      assert.ok(Math.hypot(back.x - pixel.x, back.y - pixel.y) < 1e-4, 'the touched point is drawn under the pointer')
      const depth = p => p[0] * n[0] + p[1] * n[1] + p[2] * n[2]
      assert.ok(depth(at) >= depth(drawn) - 1e-7, 'the touched point is the surface nearest the eye, never one behind it')
      if (Math.abs(depth(at) - depth(drawn)) < 1e-7) {
        angleNear(touched.point.theta, theta, 1e-6, 'theta of the front point')
        angleNear(touched.point.phi, phi, 1e-6, 'phi of the front point')
        exact++
      }
    }
  }
  assert.ok(exact > 200, `most drawn points are their own front surface and read back exactly (${exact})`)
})

test('a press off the torus is no touch, and a perspective stage is refused in words, not guessed', async () => {
  const {touchedSurface} = await touch()
  const {project} = await stage()
  const view = camera({})
  const centre = project({x: 0, y: 0, z: 0}, view, SIZE.width, SIZE.height)
  const hole = touchedSurface(centre.x, centre.y, {camera: view, ...SIZE}, {projection: 'orthographic', ...SCALE})
  assert.equal(hole.point, null)
  assert.match(hole.why, /No surface of the torus/)
  const rim = project(toStage([R + 1, 0, 0]), view, SIZE.width, SIZE.height)
  const perspective = touchedSurface(rim.x - 5, rim.y, {camera: view, ...SIZE}, {projection: 'perspective', ...SCALE})
  assert.equal(perspective.point, null)
  assert.match(perspective.why, /perspective/)
  assert.throws(() => touchedSurface(rim.x, rim.y, {camera: view, ...SIZE}, {projection: 'orthographic', unitsPerMetre: 0, worldScale: 400}), /units per metre/)
})

// ---------------------------------------------------------------------------------------------------- the owner: the point passed to strikeAt

const openController = async () => {
  const {ControlledAudio, ControlledSceneOwner} = await fixture()
  const THREE = await import(pathToFileURL(join(frame, 'node_modules/three/build/three.module.js')).href)
  const {NativeFieldController} = await controller()
  class Owner extends ControlledSceneOwner {
    strikesAt = []
    async request(request) {
      const command = request.request?.command
      if (command?.operation !== 'strike-at' || this.refuse?.(command)) return super.request(request)
      const read = structuredClone(request)
      read.request.command = {operation: 'read'}
      const reply = await super.request(read)
      this.strikesAt.push(structuredClone(command.points))
      this.bump(1n)
      reply.field = structuredClone(this.frame)
      reply.field.audio = []
      return reply
    }
  }
  const texture = () => new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType)
  const port = {texWidth: 2, texHeight: 2, particleCount: 4, targetA: texture(), targetB: texture(), setTargetTextures() {}}
  const renderer = {retainedTopology: () => ({tex_width: 2, tex_height: 2, particle_count: 4, slot_count: 4}), retainedTargetPort: () => port, setNativeDomain() {},
    releaseRetainedField() {}, onRetainedRecoveryRequired: () => () => {}, checkpointRetainedField() { return {receipt: {}}; }, restoreRetainedField() {}}
  const owner = new Owner(), audio = new ControlledAudio(), c = new NativeFieldController(owner, renderer, () => audio)
  await c.compose({sky: 'none'})
  return {owner, c}
}

test('a touch strikes the owner at the touched point: the point passed to strikeAt is the point under the pointer', async () => {
  const {touchStrike, torusPoint} = await touch()
  const {project} = await stage()
  const {owner, c} = await openController()
  try {
    // The stage at the presentation scale the controller itself reports (QL's 120 units per metre), not one the test supplies.
    assert.equal(c.reading.presentation_units_per_metre, SCALE.unitsPerMetre)
    const view = camera({yaw: 0.5, pitch: -0.6}), drawn = torusPoint(1.1, 4.0)
    const pixel = project(toStage(drawn), view, SIZE.width, SIZE.height)
    const strike = touchStrike(c.reading, pixel.x, pixel.y, {camera: view, ...SIZE}, {projection: 'orthographic', worldScale: SCALE.worldScale})
    assert.ok(strike.point, strike.why)
    await c.playAt([strike.point], strike.amplitude)
    assert.deepEqual(owner.strikesAt.at(-1), [{theta: strike.point.theta, phi: strike.point.phi, amplitude: [0.35, 0]}], 'the owner is struck at exactly the touched point, at the owner\'s default strike')
    angleNear(strike.point.theta, 1.1, 1e-6, 'the touched theta')
    angleNear(strike.point.phi, 4.0, 1e-6, 'the touched phi')
    const struck = c.reading.instrument.struck
    assert.equal(struck.source, 'point')
    assert.deepEqual(struck.points, [{theta: strike.point.theta, phi: strike.point.phi}])
    // A strike at a point excites every standing voice by its own shape there (QL scene_field.rs ShapeBasis::strike_at), so the
    // plate follows every voice the owner tunes, as it does for an event that strikes.
    assert.deepEqual(struck.refs, c.reading.instrument.influence.voices.map(voice => `scene:planet/${voice.planet_ref}`))
    assert.equal(c.reading.instrument.played.strikes, 1)
  } finally { await c.dispose() }
})

test('a chord of touches is one act, and only a running field takes a touch; a point off the sheet never reaches the owner', async () => {
  const {owner, c} = await openController()
  try {
    await c.playAt([{theta: 0.5, phi: 1}, {theta: 2, phi: 3}], 0.2)
    assert.deepEqual(owner.strikesAt.at(-1), [{theta: 0.5, phi: 1, amplitude: [0.2, 0]}, {theta: 2, phi: 3, amplitude: [0.2, 0]}], 'two points, one strike-at act')
    const sent = owner.strikesAt.length
    await assert.rejects(c.playAt([{theta: TAU, phi: 1}], 0.35), /\[0, 2π\)/)
    await assert.rejects(c.playAt([{theta: 1, phi: -0.1}], 0.35), /\[0, 2π\)/)
    await assert.rejects(c.playAt([], 0.35), /1\.\.64/)
    await assert.rejects(c.playAt([{theta: 1, phi: 1}], 0), /amplitude/)
    assert.equal(owner.strikesAt.length, sent, 'nothing off the sheet was sent')
    c.hold('test')
    await assert.rejects(c.playAt([{theta: 1, phi: 1}], 0.35), /not running/)
    assert.equal(owner.strikesAt.length, sent, 'a held field takes no touch')
  } finally { await c.dispose() }
})

test('a press is a touch only while the instrument plays; pen pressure strikes as on the keys; perspective is told, a miss is not', async () => {
  const {touchStrike} = await touch()
  const {project} = await stage()
  const {c} = await openController()
  try {
    const view = camera({}), rim = project(toStage([R + 0.9, 0, 0.3]), view, SIZE.width, SIZE.height), at = {camera: view, ...SIZE}
    const flat = {projection: 'orthographic', worldScale: SCALE.worldScale}
    assert.deepEqual(touchStrike(null, rim.x, rim.y, at, flat), {point: null, why: 'The live instrument is not playing.', say: false}, 'no instrument, no touch')
    assert.ok(touchStrike(c.reading, rim.x, rim.y, at, flat).point, 'a playing field takes the press')
    assert.equal(touchStrike(c.reading, rim.x, rim.y, at, flat).amplitude, undefined, 'a mouse or a finger strikes at the owner\'s default')
    assert.equal(touchStrike(c.reading, rim.x, rim.y, at, {...flat, pressure: 0.5}).amplitude, 0.45, 'a pen strikes at 0.9 × pressure')
    assert.equal(touchStrike(c.reading, rim.x, rim.y, at, {...flat, pressure: 0.05}).amplitude, 0.15, 'held to 0.15 at the lightest')
    assert.equal(touchStrike(c.reading, rim.x, rim.y, at, {...flat, pressure: 1}).amplitude, 0.9, 'held to 0.9 at the heaviest')
    const centre = project({x: 0, y: 0, z: 0}, view, SIZE.width, SIZE.height)
    assert.equal(touchStrike(c.reading, centre.x, centre.y, at, flat).say, false, 'a press through the hole is not a touch, and nothing is said')
    const perspective = touchStrike(c.reading, rim.x, rim.y, at, {...flat, projection: 'perspective'})
    assert.equal(perspective.point, null)
    assert.equal(perspective.say, true, 'a press on the playing torus under perspective is told why it did not ring')
    c.hold('test')
    assert.equal(touchStrike(c.reading, rim.x, rim.y, at, flat).point, null, 'a held field takes no touch')
  } finally { await c.dispose() }
})

test('the frame wires the touch: the stage press hands its pixel and the stage to the native field, which strikes what touchStrike names', async () => {
  const {readFile} = await import('node:fs/promises')
  const app = await readFile(join(journeys, 'src/app.ts'), 'utf8')
  const nativeField = await readFile(join(journeys, 'src/nativeField.ts'), 'utf8')
  const press = app.slice(app.indexOf("$('stage').addEventListener('pointerdown'"), app.indexOf("$('stage').addEventListener('pointermove'"))
  assert.match(press, /if\(presenting\|\|!editing\)\{if\(ev\.button===0\)nativeField\?\.touch\(ev\.clientX,ev\.clientY,\{camera,width,height\}/, 'a play-state press on the stage is offered to the torus first')
  assert.ok(press.indexOf('nativeField?.touch(') > press.indexOf("tool==='orbit'"), 'an orbit or pan drag never strikes: the camera takes it before the torus is offered the press')
  const body = nativeField.slice(nativeField.indexOf('const touch=('), nativeField.indexOf('const openLive='))
  assert.match(body, /touchStrike\(controller\.reading as any,x,y,view,\{projection,worldScale:WORLD_SCALE,pressure\}\)/)
  assert.match(body, /controller\.playAt\(\[strike\.point\],strike\.amplitude\)/)
  assert.match(nativeField, /return \{controller,panel,command,stage,playJanko,touch,/, 'the frame holds the touch on the native field it installs')
})

test('a touch the owner refuses changes nothing the torus plays, and the refusal is the owner\'s', async () => {
  const {owner, c} = await openController()
  try {
    await c.playAt([{theta: 1, phi: 2}], 0.35)
    const before = structuredClone(c.reading.instrument.struck)
    owner.refuse = command => command.operation === 'strike-at'
    await assert.rejects(c.playAt([{theta: 2, phi: 1}], 0.35))
    assert.deepEqual(c.reading.instrument.struck.points, before.points, 'a refused touch is not what the torus plays')
    assert.match(c.reading.instrument.refusal?.reason ?? '', /controlled refusal: strike-at/)
  } finally { await c.dispose() }
})
