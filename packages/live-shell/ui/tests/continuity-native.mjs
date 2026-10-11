/** Explicit existing candidate owner; no replacement provider or mock server. */
import assert from 'node:assert/strict'
import {listFiles, readFile} from '../../../../desktop/cradle/src/files/client.ts'
import {acquireFileReading, peekFileReading, applyReceipt, resourceStats, releaseFileResourceScope, StaleFileAcquisition} from '../../../../desktop/cradle/src/files/resources.ts'
import {ContinuityResources, retainSourceReading} from '../src/continuity/resources.ts'
const argument = name => {const n = process.argv.indexOf(name); return n < 0 ? undefined : process.argv[n+1]}
const url = argument('--kernel-url'), filePath = argument('--path'), owner = argument('--owner'), world = argument('--world'), workcell = argument('--workcell')
if (![url,filePath,owner,world,workcell].every(Boolean)) throw Error('Pass explicit --kernel-url --path --owner --world --workcell for the reviewed candidate')
const transport = {kind:'bridge',url}
const directoryPath = filePath.includes('/') ? filePath.slice(0,filePath.lastIndexOf('/')) : ''
const directory = await listFiles(transport,directoryPath,true)
const entry = directory.entries.find(entry => entry.location.path === filePath && entry.kind === 'file' && entry.retrieval_allowed)
assert.ok(entry,'The reviewed file must be disclosed by its real native owner')
const location = entry.location
const scope = {owner,world,workcell,accessEpoch:crypto.randomUUID()}
const access = {transport,scope}, before = resourceStats()
try {
  const [first,second,third] = await Promise.all([1,2,3].map(() => acquireFileReading(transport,location,scope)))
  assert.equal(first,second); assert.equal(first,third)
  assert.equal(resourceStats().acquisitions,before.acquisitions+1)
  assert.equal(resourceStats().joined,before.joined+2)
  assert.equal(peekFileReading(location,access),first)
  assert.equal(peekFileReading(location,{transport,scope:{...scope,accessEpoch:crypto.randomUUID()}}),undefined)
  assert.equal(peekFileReading({...location,ref:`${location.ref}-other-subject`},access),undefined)
  const independent = await readFile(transport,location)
  assert.equal(independent.revision,first.revision)
  assert.equal(independent.content,first.content)
  let retained = new Map()
  for (const workspace of ['A','B','C','D']) retained = retainSourceReading(retained,workspace,first)
  assert.deepEqual([...retained.keys()],['B','C','D'],'source projections share the three-workspace warm budget')
  assert.equal(retained.get('D'),first,'actual native reading remains usable without cloning owner content')
  retained = retainSourceReading(retained,'B',first)
  assert.deepEqual([...retained.keys()],['C','D','B'],'a renewed owner reading makes its workspace warm')
  applyReceipt({event:'file_changed',seq:1,path:location.path},access)
  const revalidated = await acquireFileReading(transport,location,scope)
  assert.equal(revalidated.revision,independent.revision)
  const retiredAccess = {transport,scope:{...scope,accessEpoch:crypto.randomUUID()}}
  const retiredRead = acquireFileReading(transport,location,retiredAccess.scope)
  releaseFileResourceScope(retiredAccess)
  await assert.rejects(retiredRead,StaleFileAcquisition)
  assert.equal(peekFileReading(location,retiredAccess),undefined)
  await assert.rejects(() => acquireFileReading(transport,{...location,ref:`${location.ref}-other-subject`},scope))
  const resource = new ContinuityResources()
  resource.attach(access)
  const a = resource.ensureDirectory('A',directoryPath,true)
  await new Promise((resolve,reject) => {
    let stop = () => {}
    const timer = setTimeout(() => {stop(); reject(Error('Native directory did not settle within 20 seconds'))},20000)
    const inspect = () => {
      const entry = a.entry(directoryPath)
      if (entry.status === 'pending') return
      clearTimeout(timer); stop()
      entry.status === 'ready' ? resolve() : reject(Error(entry.error))
    }
    stop = a.subscribe(inspect); inspect()
  })
  const savedListing = a.entry(directoryPath)
  assert.ok(savedListing.reading.entries.some(row => row.location.ref === location.ref))
  const b = resource.directory('B')
  assert.notEqual(a,b); assert.equal(resource.directory('A'),a)
  assert.equal(resource.ensureDirectory('A',directoryPath).entry(directoryPath),savedListing)
  const intent = {workspaceId:'A',viewId:'reviewed-file',generation:1,isCurrent:() => true}
  assert.equal((await resource.read(location,intent)).revision,first.revision)
  const beforeReceipt = resourceStats()
  assert.equal(resource.receipt({event:'file_changed',seq:2,path:location.path}),true)
  assert.equal(resource.receipt({event:'file_changed',seq:2,path:location.path}),false,'native receipt cursor suppresses repeated selected-source refresh')
  assert.equal((await resource.read(location,intent)).revision,first.revision)
  assert.equal(resourceStats().acquisitions,beforeReceipt.acquisitions+1,'matching receipt causes one fresh owner acquisition')
  const beforeRefresh = resourceStats().acquisitions
  assert.equal((await resource.revalidate(location,intent)).revision,first.revision)
  assert.equal(resourceStats().acquisitions,beforeRefresh+1,'missed-event reconciliation bypasses retained cache through actual owner read')
  resource.attach({transport,scope:{...scope,accessEpoch:crypto.randomUUID()}})
  assert.equal(resource.peek(location),undefined)
  assert.notEqual(resource.directory('A'),a)
  assert.equal((await resource.read(location,intent)).revision,first.revision)
  resource.retire()
  console.log(JSON.stringify({claim:'scoped native acquisition, same-path subject refusal, retired completion and reconnect use real owner bytes; candidate directory lifetimes preserve A-B-A; native receipt cursor and explicit revalidation reacquire selected owner bytes; source projections share the warm workspace bound',passed:20,revision:first.revision,owner,world,workcell}))
} finally {releaseFileResourceScope(access)}
