import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production Formation entity device in memory: the pure model, the React view, the shared entity body and the rack/catalogue joins.
// Same loader as native-entity-faces.test.mjs (.tsx transpiled, .css stubbed). The readings are minimal fixtures; they are not a
// native owner or a saved receipt. The inspector source is read only to check that each parameter the device names is one the
// Objects panel writes.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const [registry, views, face, faceView, settings, catalogue, rack, {entityTargets}] = await Promise.all([
  import('../src/components/nativeEntityFaceModel.ts'),
  import('../src/components/nativeEntityFaceViews.tsx'),
  import('../src/components/nativeEntityFace.formation.ts'),
  import('../src/components/NativeEntityFace.formation.tsx'),
  import('../../../expressions-boundary/src/nativeEntitySettings.ts'),
  import('../src/components/nativeDeviceCatalogue.ts'),
  import('../src/components/nativeDeviceRackModel.ts'),
  import(parameters),
])
const inspectorSource = await readFile(new URL('desktop/cradle/expressions-app/field-studies-journeys/src/inspector.ts', root), 'utf8')

const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
const formation = (over = {}) => ({id: 'form-a', name: 'Ring A', kind: 'formation', enabled: true, position: {x: 1, y: 2, z: 0.5}, size: {x: 3, y: 2},
  scale: 1.25, rotation: 30, shape: 'ring', text: '', share: 2, tint: '#336699', tintWeight: 0.4, locked: false, station: null,
  force: {kind: 'none', strength: 0, radius: 1, spin: 0}, sequence: {enabled: false, clock: 'seconds', steps: []}, ...over})
const pin = (over = {}) => ({id: 'force-1', name: 'Pin A', kind: 'pin', enabled: true, position: {x: -1, y: 0, z: 0}, size: {x: 1, y: 1},
  rotation: 0, shape: 'disc', text: '', share: 0, tint: '#000000', tintWeight: 1, locked: false, station: null,
  force: {kind: 'attract', strength: 2.5, radius: 1.25, spin: 0}, sequence: {enabled: false, clock: 'seconds', steps: []}, ...over})
const FIXTURE = () => [formation(), formation({id: 'form-b', name: 'Ring B', share: 6, position: {x: -2, y: 1, z: -1}, shape: 'text', text: 'OM'}), pin()]

function reading({entities = FIXTURE(), selection = ['form-a'], plane = 'XY', blueprint, composition, devices = []} = {}) {
  const scene = {name: 'Fixture', entities, automation: [], engine: {...ENGINE}, field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}},
    composition: composition === undefined ? {layout: 'free', plane, focus: 'parallel', focusDuration: 4, carryTint: true, carryStation: false,
      frequencyDriver: 'manual', ...(blueprint ? {blueprint} : {})} : composition}
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {'form-a': 'occ:a', 'form-b': 'occ:b', 'force-1': 'occ:p'}, chosenControls: {available: false, entries: [], controls: []}, devices,
    selection: {entity_ids: selection, step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
const byId = (r, id) => r.scene.entities.find(item => item.id === id)
const esc = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const shownSettings = {}
const noopApply = async changes => { shownSettings.last = changes; return {ok: true} }
const FORMATION_PATHS = ['x', 'y', 'z', 'size.x', 'size.y', 'scale', 'rotation', 'share', 'tintWeight']

test('the registry wires the formation family to its model, its view and the Entity device catalogue', () => {
  assert.equal(registry.ENTITY_FACE_MODELS.formation, face.formationFaceModel)
  assert.equal(views.ENTITY_FACE_VIEWS.formation, faceView.formationEntityView)
  assert.ok(registry.entityFamilies().includes('formation'))
  const device = catalogue.deviceCatalogue().find(row => row.family === 'formation')
  assert.equal(device.scope, 'entity')
  assert.equal(device.name, 'Formation')
  assert.equal(device.studio, 'formations', 'the Objects panel is the formations section (studioSections.ts)')
  assert.equal(device.toggle, null)
})

test('paths are the Objects panel numeric rows, in app order, and each resolves to an entity target the panel writes', () => {
  assert.deepEqual([...face.FORMATION_PATHS], FORMATION_PATHS)
  const rows = new Map(entityTargets(reading().scene).filter(row => row.entityId === 'form-a').map(row => [row.key, row]))
  for (const path of FORMATION_PATHS) {
    const row = rows.get(path)
    assert.ok(row, `${path} is a formation entity target`)
    assert.ok(inspectorSource.includes(`'${row.bind}'`), `inspector.ts writes ${row.bind}`)
  }
  // The non-numeric rows of the same panel, and the stored tint, are the view's own controls.
  for (const bind of ["'entity.name'", "'entity.locked'", "'entity.enabled'", 'entity.tint"']) assert.ok(inspectorSource.includes(bind), `inspector.ts has ${bind}`)
})

test('the formation targets this device does not hold belong to the Force device and the sequence editor', () => {
  const held = new Set(FORMATION_PATHS)
  const others = entityTargets(reading().scene).filter(row => row.entityId === 'form-a' && !held.has(row.key)).map(row => row.key).sort()
  assert.deepEqual(others, ['forces.radius', 'forces.spin', 'forces.strength', 'sequence.hold', 'sequence.phaseOffset', 'sequence.rateMul', 'sequence.transition'])
  assert.ok(inspectorSource.includes("'entity.force.strength'"), 'the Influence group is the Force device (its own registry entry)')
})

test('groups cover paths exactly with no duplicates, compact is a justified subset of at most four, and the enable light is the enabled flag', () => {
  const groups = face.formationFaceModel.groups
  assert.deepEqual(groups.map(group => group.title), ['Placement', 'Size & share', 'Appearance'])
  const flat = groups.flatMap(group => group.paths)
  assert.equal(new Set(flat).size, flat.length, 'no path in two groups')
  assert.deepEqual([...flat].sort(), [...FORMATION_PATHS].sort())
  assert.deepEqual(face.formationFaceModel.compact, ['x', 'y', 'scale', 'share'])
  assert.ok(face.formationFaceModel.compact.length <= 4)
  assert.ok(face.formationFaceModel.compact.every(path => FORMATION_PATHS.includes(path)))
  assert.equal(face.formationFaceModel.name, 'Formation')
  const r = reading()
  assert.equal(face.formationFaceModel.enabled(r, formation()), true)
  assert.equal(face.formationFaceModel.enabled(r, formation({enabled: false})), false)
  assert.equal(face.formationFaceModel.enabled(r, formation({enabled: undefined})), true, 'an unset enabled flag is enabled')
  assert.equal(face.formationFaceModel.enabled(r, pin()), undefined, 'pins have no enable operation')
})

test('shares: the enabled-formation fraction, disabled formations excluded, pins excluded, and the all-disabled and zero cases', () => {
  const entities = [formation({id: 'a', share: 2}), formation({id: 'b', share: 6}), formation({id: 'c', share: 2, enabled: false}), pin({share: 1})]
  const rows = face.formationShareRows(entities)
  assert.deepEqual(rows.map(row => row.id), ['a', 'b', 'c'], 'formations only, in scene order')
  assert.equal(rows[0].fraction, 0.25)
  assert.equal(rows[1].fraction, 0.75)
  assert.equal(rows[2].fraction, null, 'a disabled formation has no fraction')
  assert.equal(face.enabledShareTotal(entities), 8, 'the pin share is not in the denominator')
  assert.equal(rows.reduce((sum, row) => sum + (row.fraction ?? 0), 0), 1)
  const allOff = [formation({id: 'a', enabled: false}), formation({id: 'b', share: 4, enabled: false})]
  assert.ok(face.formationShareRows(allOff).every(row => row.fraction === null))
  assert.equal(face.enabledShareTotal(allOff), 1, 'with no enabled formation the total is the app fallback of 1')
  const zero = [formation({id: 'z', share: 0})]
  assert.equal(face.formationShareRows(zero)[0].fraction, 0, 'an enabled zero share is zero, not undefined')
})

test('blueprint members are frozen on position only, and the lock gate disables Name and Enabled while keeping Lock', () => {
  const blueprint = {schema: 'oi.scene-blueprint/v1', members: [{entity_ref: 'form-a', subject_ref: 's', role_ref: 'r', position: 0}]}
  const r = reading({blueprint})
  assert.equal(face.isBlueprintMember(r.scene, formation({id: 'form-a'})), true)
  assert.deepEqual([...face.formationFrozenPaths(r.scene, formation({id: 'form-a'}))], ['x', 'y', 'z'])
  assert.deepEqual([...face.formationFrozenPaths(r.scene, formation({id: 'form-b'}))], [], 'a non-member has no frozen path')
  assert.equal(face.isBlueprintMember(reading().scene, formation()), false)

  assert.deepEqual(face.formationGate(formation(), false), {name: false, enabled: false, lock: false, reason: null})
  assert.deepEqual(face.formationGate(formation(), true), {name: true, enabled: true, lock: true, reason: null}, 'editor busy: nothing changes')
  const locked = face.formationGate(formation({locked: true}), true)
  assert.equal(locked.name, true)
  assert.equal(locked.enabled, true)
  assert.equal(locked.lock, false, 'a locked entity keeps its Lock row')
  assert.match(locked.reason, /Locked: unlock to change the name or the enabled state/)
})

test('admitted change shapes: each Name, Lock and Enabled change validates through the boundary; malformed ones are refused', async () => {
  const a = formation()
  const named = settings.validateNativeEntitySettingChange(face.formationSettingChange(a, 'name', 'New'))
  assert.deepEqual(named, {kind: 'entity-setting', entity_id: 'form-a', key: 'name', value: 'New'})
  assert.deepEqual(face.formationSettingChange(a, 'locked', true), {kind: 'entity-setting', entity_id: 'form-a', key: 'locked', value: true})
  assert.deepEqual(face.formationSettingChange(a, 'enabled', false), {kind: 'entity-setting', entity_id: 'form-a', key: 'enabled', value: false})
  assert.throws(() => settings.validateNativeEntitySettingChange({kind: 'entity-setting', entity_id: 'form-a', key: 'enabled', value: 'yes'}))

  assert.equal(face.formationNameDraft(a, '  Ring A '), null, 'an unchanged name sends nothing')
  assert.equal(face.formationNameDraft(a, '   '), null, 'an empty name sends nothing')
  assert.equal(face.formationNameDraft(a, 'x'.repeat(161)), null, 'over the 160 limit sends nothing')
  assert.deepEqual(face.formationNameDraft(a, '  Renamed  ').value, 'Renamed', 'the draft is trimmed as the boundary trims it')
  assert.equal(face.formationNameDraft(a, 'x'.repeat(160)).value.length, 160)
})

test('the view commits through the editor apply with a stub: Lock, Enabled and Name each send exactly one admitted change', async () => {
  const sent = []
  const apply = async changes => { sent.push(changes); return {ok: true} }
  const a = formation()
  await faceView.commitFormationSetting(apply, face.formationSettingChange(a, 'locked', true))
  await faceView.commitFormationSetting(apply, face.formationSettingChange(a, 'enabled', false))
  assert.equal(faceView.commitFormationName(apply, a, '   '), null)
  await faceView.commitFormationName(apply, a, ' Renamed ')
  assert.deepEqual(sent, [
    [{kind: 'entity-setting', entity_id: 'form-a', key: 'locked', value: true}],
    [{kind: 'entity-setting', entity_id: 'form-a', key: 'enabled', value: false}],
    [{kind: 'entity-setting', entity_id: 'form-a', key: 'name', value: 'Renamed'}],
  ])
  assert.equal(sent.length, 3, 'an unchanged or empty name sends nothing')
})

test('plan layout: plane axes from composition.plane (XY default), selected mark, share as fill, depth as outline, all inside the viewBox', () => {
  const r = reading()
  const layout = face.planLayout(r, 'form-a')
  assert.equal(layout.plane, 'XY')
  assert.deepEqual([layout.horizontal, layout.vertical, layout.depth], ['x', 'y', 'z'])
  assert.equal(layout.marks.length, 3)
  const mark = id => layout.marks.find(item => item.id === id)
  assert.equal(mark('form-a').selected, true)
  assert.equal(mark('form-b').selected, false)
  assert.equal(mark('form-b').enabled, true)
  assert.equal(mark('force-1').fillOpacity, 0, 'a pin is a ring, not a share')
  assert.ok(Math.abs(mark('form-a').fillOpacity - (0.2 + 0.8 / 3)) < 1e-9, 'a share of 2 against the largest of 6')
  assert.equal(mark('form-b').fillOpacity, 1, 'the largest share is full opacity')
  assert.equal(mark('form-a').rotation, 30)
  assert.equal(mark('force-1').rotation, 0)
  assert.equal(mark('form-b').outlineOpacity, 0.35, 'the lowest depth is the faintest outline')
  assert.equal(mark('form-a').outlineOpacity, 1, 'the highest depth is the strongest outline')
  for (const item of layout.marks) {
    assert.ok(item.cx >= 0 && item.cx <= 360 && item.cy >= 0 && item.cy <= 180, `${item.id} inside the 360x180 viewBox`)
  }
  const disabled = face.planLayout(reading({entities: [formation({id: 'a', enabled: false}), formation({id: 'b', share: 2})]}), null)
  assert.equal(disabled.marks.find(item => item.id === 'a').fillOpacity, 0.1, 'a disabled formation is faint')
  assert.equal(disabled.marks.find(item => item.id === 'a').enabled, false)
})

test('plan layout: XZ puts z on the vertical axis and y on depth; YZ puts y horizontal; a missing composition is XY; an empty Scene has no marks', () => {
  const xz = face.planLayout(reading({plane: 'XZ'}), null)
  assert.deepEqual([xz.horizontal, xz.vertical, xz.depth], ['x', 'z', 'y'])
  // form-a has z 0.5 and form-b has z -1: the higher z is drawn higher (smaller cy) on the vertical axis.
  assert.ok(xz.marks.find(item => item.id === 'form-a').cy < xz.marks.find(item => item.id === 'form-b').cy)
  const yz = face.planLayout(reading({plane: 'YZ'}), null)
  assert.deepEqual([yz.horizontal, yz.vertical, yz.depth], ['y', 'z', 'x'])
  const missing = face.planLayout(reading({composition: null}), null)
  assert.equal(missing.plane, 'XY')
  assert.deepEqual(face.planLayout(reading({entities: []}), null).marks, [])
})

test('rack and catalogue: the formation widget reads its compact controls from the selected formation and summarises its derived fraction', () => {
  const r = reading({devices: [{id: 'formation-1', family: 'formation'}]})
  const widget = rack.rackWidgets(r)[0]
  assert.equal(widget.scope, 'entity')
  assert.equal(widget.target, 'Ring A')
  assert.deepEqual(widget.compact.map(control => control.path), ['entity:form-a:x', 'entity:form-a:y', 'entity:form-a:scale', 'entity:form-a:share'])
  assert.equal(widget.compact[0].value, byId(r, 'form-a').position.x)
  assert.equal(widget.compact[3].value, 2)
  assert.equal(widget.summary, '25% of particles · Ring')
  const idle = rack.rackWidgets(reading({selection: [], devices: [{id: 'formation-1', family: 'formation'}]}))[0]
  assert.deepEqual(idle.compact, [])
  assert.equal(idle.on, undefined)
  const pinned = rack.rackWidgets(reading({selection: ['force-1'], devices: [{id: 'formation-1', family: 'formation'}]}))[0]
  assert.equal(pinned.on, undefined, 'a pin has no enable light')
  assert.equal(pinned.summary, 'Pins have no formation panel')
})

const FORMATION_BODY = {formation: face.formationFaceModel}
const FORMATION_VIEW = {formation: faceView.formationEntityView}
const renderControl = suffix => createElement('span', {className: 'ctl'}, `CTL:${suffix}`)
/** The shared body as the editor mounts it: disabled is the editor's own flag OR the lock (NativeDeviceEditors EntityFaceBody call). */
const body = (r, entity, disabled = false) => renderToStaticMarkup(createElement(views.EntityFaceBody, {family: 'formation', models: FORMATION_BODY,
  views: FORMATION_VIEW, reading: r, entity, disabled: disabled || entity.locked, apply: noopApply, renderControl}))

test('SSR: the whole panel renders in app order with accessible names, the groups, the controls and the derived views', () => {
  const r = reading()
  const html = body(r, byId(r, 'form-a'))
  assert.match(html, /class="native-device native-entity-device" aria-label="Formation"/)
  for (const title of ['Placement', 'Size &amp; share', 'Appearance', 'Identity', 'Plan', 'Particle share', 'Shape and tint']) {
    assert.match(html, new RegExp(`<h4>${esc(title)}</h4>`), `${title} heading`)
  }
  assert.deepEqual([...html.matchAll(/CTL:([^<]+)</g)].map(match => match[1]), FORMATION_PATHS, 'numeric controls in app order')
  const nameInput = html.match(/<input[^>]*aria-label="Name"[^>]*>/)[0]
  assert.match(nameInput, /value="Ring A"/)
  assert.match(nameInput, /maxLength="160"/)
  assert.match(html, /<span>Lock editing<\/span>/)
  assert.match(html, /<span>Enabled in the field<\/span>/)
  assert.match(html, /aria-label="Plan of 3 objects on the XY plane; Ring A selected"/)
  assert.equal((html.match(/<meter /g) || []).length, 2, 'one share meter per formation, none for the pin')
  assert.match(html, /aria-label="Ring A share of particles"/)
  assert.match(html, /#336699/, 'the stored tint is shown as a hex value')
  assert.match(html, /Edit the shape in Glyph Sequence/)
  assert.match(html, /Ring/)
  assert.doesNotMatch(html, /Blueprint member/)
})

test('SSR: a locked formation disables Name and Enabled, keeps Lock, and shows the reason', () => {
  const r = reading({entities: [formation({locked: true}), formation({id: 'form-b', share: 6}), pin()]})
  const html = body(r, byId(r, 'form-a'))
  assert.match(html, /<input[^>]*aria-label="Name"[^>]*disabled=""/)
  assert.match(html, /<input([^>]*)\/?>\s*<span>Enabled in the field<\/span>/)
  assert.match(html.match(/<input([^>]*)\/?>\s*<span>Enabled in the field<\/span>/)[1], /disabled=""/)
  assert.doesNotMatch(html.match(/<input([^>]*)\/?>\s*<span>Lock editing<\/span>/)[1], /disabled=""/, 'Lock stays usable while locked')
  assert.match(html, /Locked: unlock to change the name or the enabled state/)
})

test('SSR: a disabled formation shows as excluded from the share, and an all-disabled Scene says nothing normalises', () => {
  const r = reading({entities: [formation({enabled: false}), formation({id: 'form-b', enabled: false, share: 4})]})
  const html = body(r, byId(r, 'form-a'))
  assert.equal((html.match(/Disabled · excluded/g) || []).length, 2)
  assert.match(html, /No formation is enabled, so the share has nothing to normalise over/)
  assert.doesNotMatch(html, /<meter /)
})

test('SSR: a pin says Select a formation and offers no name or enable controls', () => {
  const r = reading({selection: ['force-1']})
  const html = body(r, byId(r, 'force-1'))
  assert.match(html, /Select a formation/)
  assert.doesNotMatch(html, /aria-label="Name"/)
  assert.doesNotMatch(html, /Enabled in the field/)
})

test('SSR: a blueprint member shows the Blueprint reason; the plan redraws when a position changes in the reading', () => {
  const blueprint = {schema: 'oi.scene-blueprint/v1', members: [{entity_ref: 'form-a', subject_ref: 's', role_ref: 'r', position: 0}]}
  const member = reading({blueprint})
  assert.match(body(member, byId(member, 'form-a')), /Blueprint member: its position is held by the Blueprint/)
  assert.doesNotMatch(body(member, byId(member, 'form-b')), /Blueprint member/)
  const plan = html => html.match(/<svg[\s\S]*?<\/svg>/)[0]
  const before = reading()
  const after = reading({entities: [formation({position: {x: -1, y: 2, z: 0.5}}), formation({id: 'form-b', share: 6, position: {x: -2, y: 1, z: -1}, shape: 'text', text: 'OM'}), pin()]})
  assert.notEqual(plan(body(before, byId(before, 'form-a'))), plan(body(after, byId(after, 'form-a'))), 'the diagram is derived from the reading')
})

test('shape labels are the inspector names; the square shape is Plane', () => {
  assert.equal(face.FORMATION_SHAPE_LABELS.square, 'Plane', 'inspector.ts shapeOptions')
  assert.ok(inspectorSource.includes("['square','Plane']"), 'the label is the inspector option')
})

test('the frozen suffixes of a blueprint member come from the model, and the shared body disables only those controls with the reason', () => {
  const blueprint = {schema: 'oi.scene-blueprint/v1', members: [{entity_ref: 'form-a', subject_ref: 's', role_ref: 'r', position: 0}]}
  const member = reading({blueprint}), other = reading({blueprint})
  const reason = 'Held by Blueprint: use Blueprint to move this shape'
  assert.deepEqual(face.formationFaceModel.frozen(member, byId(member, 'form-a')), {paths: ['x', 'y', 'z'], reason})
  assert.equal(face.formationFaceModel.frozen(other, byId(other, 'form-b')), null, 'a non-member has nothing frozen')
  const control = (suffix, frozenReason) => createElement('span', {className: 'ctl', 'data-suffix': suffix, 'data-frozen': frozenReason ?? undefined}, `CTL:${suffix}`)
  const html = renderToStaticMarkup(createElement(views.EntityFaceBody, {family: 'formation', models: FORMATION_BODY, views: FORMATION_VIEW,
    reading: member, entity: byId(member, 'form-a'), disabled: false, apply: noopApply, renderControl: control}))
  for (const suffix of ['x', 'y', 'z']) assert.match(html, new RegExp(`data-suffix="${suffix}" data-frozen="${esc(reason)}"`), `${suffix} is frozen`)
  for (const suffix of ['size.x', 'scale', 'rotation', 'share', 'tintWeight']) assert.doesNotMatch(html, new RegExp(`data-suffix="${esc(suffix)}" data-frozen`), `${suffix} stays enabled`)
  assert.match(html, /class="native-entity-frozen" role="note">Held by Blueprint/, 'the reason is named beside the controls')
  const free = renderToStaticMarkup(createElement(views.EntityFaceBody, {family: 'formation', models: FORMATION_BODY, views: FORMATION_VIEW,
    reading: other, entity: byId(other, 'form-b'), disabled: false, apply: noopApply, renderControl: control}))
  assert.doesNotMatch(free, /data-frozen|native-entity-frozen/)
})

test('EntityControl disables exactly the frozen suffix and leaves the same suffix enabled when nothing is frozen', async () => {
  const editors = await import('../src/components/NativeDeviceEditors.tsx')
  const blueprint = {schema: 'oi.scene-blueprint/v1', members: [{entity_ref: 'form-a', subject_ref: 's', role_ref: 'r', position: 0}]}
  const member = reading({blueprint}), entity = byId(member, 'form-a')
  const control = (suffix, frozen) => createElement(editors.EntityControl, {reading: member, entity, family: 'formation', suffix, disabled: false,
    frozen, apply: noopApply, captureCurrent: () => () => ({})})
  const inputOf = html => html.match(/<input[^>]*>/)?.[0] ?? ''
  assert.match(inputOf(renderToStaticMarkup(control('x', 'Held by Blueprint: use Blueprint to move this shape'))), /disabled=""/, 'x is disabled')
  assert.doesNotMatch(inputOf(renderToStaticMarkup(control('scale', null))), /disabled=""/, 'scale stays enabled')
  assert.doesNotMatch(inputOf(renderToStaticMarkup(control('x', null))), /disabled=""/, 'nothing frozen means x is enabled')
})
