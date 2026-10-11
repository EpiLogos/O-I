/** Second real process reopens the same filesystem-backed checkpoint. */
import assert from 'node:assert/strict'
import {loadWorkspaceBook, workspaceStorageNamespace} from '../../../../desktop/cradle/src/workspace/store.ts'
import {lastKnownGood} from '../../../../desktop/cradle/src/workspace/checkpoints.ts'
import {latestRecovery} from '../../../../desktop/cradle/src/workspace/recovery.ts'
import {readCandidateApplicationView} from '../src/continuity/applicationView.ts'
const options = {storageKey:'oi.live-shell.candidate.workspace.v2',legacyLayoutKey:'oi.live-shell.candidate.layout.v1'}
const namespace = workspaceStorageNamespace(options)
assert.ok(lastKnownGood(namespace.key,namespace.journalKey))
assert.equal(loadWorkspaceBook(options).book.workspaces[0].name,'Candidate')
assert.equal(latestRecovery(namespace.recovery).raw,'{damaged-6')
assert.equal(localStorage.getItem('oi-cradle.workspaces.v1'),'{everyday-original}')
const recoveredFrame = loadWorkspaceBook({storageKey:`${namespace.key}.application-view`}).book.workspaces[0]
const retainedFrame = readCandidateApplicationView(recoveredFrame.modeLayouts.base.applicationView)
assert.equal(retainedFrame.alsPath,'/Users/admin/Music/Set.als')
assert.equal(retainedFrame.tab,'arrangement')
assert.deepEqual(retainedFrame.selection,{track:4,scene:null,clip:2})
assert.equal(recoveredFrame.layout.mode,'techne')
assert.equal(Object.values(recoveredFrame.modeLayouts.base.surfaces).some(binding=>binding.location?.path?.endsWith('.als')),false)
console.log('PASS separate process recovered committed candidate and quarantined originals without changing everyday bytes')
