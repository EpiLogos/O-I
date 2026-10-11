/**
 * audit-l6-wire-grammar — lane zcode:native-actions-audit-l6, 2026-10-09.
 *
 * Mechanical cross-check of the aperture law for the Expressions port: the
 * verbs the shell actually dispatches must be verbs the owning receiver
 * admits — no invented kernel verbs, no shell-private grammar. Read-only over
 * the seat's source; nothing here executes a native operation and nothing
 * here promotes a ledger row or a target.
 *
 * Checked, by reading the shipped modules:
 *   1. Every stage command name the shell's builders produce appears in the
 *      hosted frame's STAGE_COMMANDS set (frame stageCommands.ts).
 *   2. Every editor operation the shell's request layer sends appears in the
 *      retained receiver's operation allow-list (hostEditor.ts).
 *   3. Every device change kind a shell component dispatches appears among
 *      the kinds the boundary's device reducer applies (nativeDeviceEdits.ts
 *      + the receiver's family router in hostEditor.ts).
 *   4. The kernel op the agent gateway controls dispatch is typed in the
 *      kernel's own op union (desktop/cradle/src/kernel/types.ts).
 */

import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync} from 'node:fs'
import {join} from 'node:path'

const UI = '/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui'
const BOUNDARY = '/Users/admin/Central/worktrees/env-1/o-i/packages/expressions-boundary/src'
const APP = '/Users/admin/Central/worktrees/env-1/o-i/desktop/cradle/expressions-app/field-studies-journeys/src'
const CRADLE = '/Users/admin/Central/worktrees/env-1/o-i/desktop/cradle/src'
const read = path => readFileSync(join(path), 'utf8')

test('every shell stage command rides the frame-hosted STAGE_COMMANDS vocabulary', () => {
  const frameGrammar = read(join(APP, 'stageCommands.ts'))
  const declared = frameGrammar.match(/STAGE_COMMANDS = \[([^\]]+)\]/)?.[1] ?? ''
  const frameCommands = new Set([...declared.matchAll(/'([a-z-]+)'/g)].map(row => row[1]))
  assert.ok(frameCommands.size >= 10, `frame STAGE_COMMANDS parse found ${frameCommands.size}; the grammar moved — update this audit`)
  const shellSender = read(join(UI, 'src/native/stageCommands.ts'))
  const shellCommands = new Set([...shellSender.matchAll(/command: '([a-z-]+)'/g)].map(row => row[1]))
  assert.ok(shellCommands.size >= 8, `shell stage builders parse found ${shellCommands.size}`)
  const invented = [...shellCommands].filter(command => !frameCommands.has(command))
  assert.deepEqual(invented, [], `shell stage commands the frame does not admit: ${invented.join(', ')}`)
})

test('every editor operation the shell sends is in the retained receiver allow-list', () => {
  const receiver = read(join(APP, 'hostEditor.ts'))
  const allowList = receiver.match(/\['read','apply','select','select-field','scene','scene-edit','scene-material','blueprint','open','undo','redo','save','material'\]/)
  assert.ok(allowList, 'the receiver operation allow-list moved — re-audit hostEditor.ts before trusting this check')
  const admitted = new Set(allowList[0].match(/'([a-z-]+)'/g).map(row => row.slice(1, -1)))
  const actionsLayer = read(join(UI, 'src/shell/nativeContent.ts'))
  const sent = new Set([...actionsLayer.matchAll(/operation:\s*'([a-z-]+)'/g)].map(row => row[1]))
  // `select-field` carries no basis key pattern matched above? It does (operation: 'select-field').
  const invented = [...sent].filter(operation => !admitted.has(operation))
  assert.deepEqual(invented, [], `nativeContent.ts sends operations the receiver refuses: ${invented.join(', ')}`)
})

test('every change kind a shell face dispatches is applied by some owning boundary reducer', () => {
  // The admitted-kind union across the boundary's family reducers (device,
  // object/formation, glyph, track, automation, rack, fold, text/material,
  // chosen controls) plus the retained receiver's family router.
  const admitted = new Set()
  for (const file of readdirSync(BOUNDARY).filter(name => name.endsWith('.ts'))) {
    const source = read(join(BOUNDARY, file))
    for (const match of source.matchAll(/kind\s*(?:===|!==)\s*'([a-z-]+)'/g)) admitted.add(match[1])
    for (const match of source.matchAll(/'kind':\s*'([a-z-]+)'/g)) admitted.add(match[1])
  }
  const receiver = read(join(APP, 'hostEditor.ts'))
  for (const match of receiver.matchAll(/type==='([a-z-]+)'\?apply[A-Za-z]+/g)) admitted.add(`${match[1]} family`)
  for (const match of receiver.matchAll(/case '([a-z-]+)':/g)) admitted.add(match[1])
  for (const match of receiver.matchAll(/change\.kind === '([a-z-]+)'/g)) admitted.add(match[1])
  const applied = new Set()
  for (const name of admitted) if (!name.endsWith(' family')) applied.add(name)
  assert.ok(applied.has('parameter') && applied.has('force-mode') && applied.has('morph-setting') && applied.has('step-source'),
    `boundary union parse found ${applied.size} kinds; the reducers moved — re-audit`)
  // Kinds dispatched by the shipped faces and models.
  const kinds = new Set()
  for (const file of ['NativeDeviceEditors.tsx', 'NativeColourField.tsx', 'NativeMorphDrive.tsx', 'NativeDeviceStrip.tsx',
    'nativeColourController.ts', 'nativeMorphController.ts', 'nativeDeviceStripModel.ts', 'nativePinMode.ts',
    'NativeFieldFace.ink.tsx', 'nativeSceneFace.text.ts', 'GlyphSequenceEditor.tsx', 'nativeBrowserModel.ts',
    'nativeEntityFace.formation.ts', 'NativeSceneFace.body.tsx', 'NativeSceneFace.blueprint.tsx',
    'nativeSceneFace.scene.ts', 'nativeSceneList.ts', 'nativePinMode.ts', 'nativeGlyphRefit.ts', 'nativeStarters.ts']) {
    const source = read(join(UI, 'src/components', file))
    for (const match of source.matchAll(/kind:\s*'([a-z-]+)'/g)) kinds.add(match[1])
  }
  // Non-change kinds: clip-source/track identities and value shapes that are
  // not editor changes (each verified by reading the dispatching file).
  const knownPresentationKinds = new Set(['glyph-sequence', 'formation', 'force', 'field', 'scene-member', 'image', 'ascii', 'text',
    'ring', 'disc', 'triangle', 'square', 'drag', 'route', 'entity', 'gesture', 'centre', 'opening'])
  const unapplied = [...kinds].filter(kind => !applied.has(kind) && !knownPresentationKinds.has(kind))
  assert.deepEqual(unapplied, [], `faces dispatch change kinds no boundary reducer applies: ${unapplied.join(', ')} (verify each against its owning reducer before dismissing)`)
})

test('the agent gateway control rides the kernel-typed harness_agent_control op', () => {
  const kernelTypes = read(join(CRADLE, 'kernel/types.ts'))
  assert.match(kernelTypes, /op:"harness_agent_control";binding:string;control:"new"\|"stop"\|"restart"\|"pause"\|"resume"/,
    'the kernel op union no longer types harness_agent_control — re-audit src/agent/harnessAgentControl.ts')
  const sender = read(join(UI, 'src/agent/harnessAgentControl.ts'))
  assert.match(sender, /op: 'harness_agent_control'/, 'the shell sender drifted from the kernel op name')
  assert.match(sender, /harness_agent_outcome/, 'the sender no longer verifies the outcome kind — receipts lost')
})

test('the scene request union admits exactly the actions the transport model produces', () => {
  const union = read(join(BOUNDARY, 'editor.ts'))
  const sceneUnion = union.match(/export type NativeSceneEditorRequest = \{operation: 'scene';[\s\S]*?\n\)/)?.[0] ?? ''
  const admitted = new Set([...sceneUnion.matchAll(/'([a-z-]+)'/g)].map(row => row[1]))
  assert.ok(admitted.has('play') && admitted.has('seek') && admitted.has('save-snapshot') && admitted.has('play-saved'),
    `scene union parse found ${admitted.size} actions; the union moved — re-audit`)
  const model = read(join(UI, 'src/components/nativeScenePlayback.ts'))
  const produced = new Set([...model.matchAll(/action:\s*'([a-z-|]+)'/g)].flatMap(row => row[1].split('|')))
  const invented = [...produced].filter(action => !admitted.has(action))
  assert.deepEqual(invented, [], `the transport model produces scene actions the owner union refuses: ${invented.join(', ')}`)
})
