import assert from 'node:assert/strict';
import {createServer} from 'vite';
// F03 consumer: the desktop's attempt-task reads reach the owner through the
// kernel, validate the returned identity against the request, and refuse a
// cross-bound Run/task, an under-counted list or an incompatible contract.
// A bridge transport with a stubbed kernel stands in for the owner CLI.
const server = await createServer({server:{middlewareMode:true}, appType:'custom'});
let n = 0;
try {
  const {listFactoryAttemptTasks, readFactoryAttemptTask} = await server.ssrLoadModule('/src/contributions/factory/attempt-task.ts');
  const bridge = {kind:'bridge', url:'http://kernel-test'};
  const listReading = (over={}) => ({contract:'factory.attempt-task-list-reading/v1', projectRef:'proj', runRef:'run:1', runRevision:3, taskRefs:['task:a','task:b'], totalTasks:2, ...over});
  const taskReading = (over={}) => ({contract:'factory.attempt-task-reading/v1', projectRef:'proj', runRef:'run:1', taskRef:'task:a', revision:5, runRevision:3, topologyRevision:1, sourceCurrent:true, workflowSourceRef:'wf', workflowSourceRevision:'r1', workflowSourceDigest:'d1', totalAttempts:0, attempts:[], ...over});
  // Route each op to a caller-supplied body; records the ops seen.
  const withKernel = async (route, fn) => {
    const old = globalThis.fetch; const ops = [];
    globalThis.fetch = async (_url, init) => { const op = JSON.parse(init.body); ops.push(op.op); return {ok:true, json:async()=>route(op)}; };
    try { return {value: await fn(), ops}; } finally { globalThis.fetch = old; }
  };
  const ok = (result, data) => ({ok:true, outcome:{result, data}});

  // A real owner list and a real task reading reach the desktop.
  const list = await withKernel(op => ok('factory_attempt_task_list_reading', listReading()), () => listFactoryAttemptTasks(bridge, {statePath:'/s', runRef:'run:1'}));
  assert.deepEqual(list.value.taskRefs, ['task:a','task:b']); n++;
  assert.equal(list.ops[0], 'factory_attempt_task_list_read'); n++;
  const task = await withKernel(op => ok('factory_attempt_task_reading', taskReading()), () => readFactoryAttemptTask(bridge, {statePath:'/s', runRef:'run:1', taskRef:'task:a'}));
  assert.equal(task.value.taskRef, 'task:a'); n++;

  // Two Runs cannot cross-bind: the reading names a different Run than requested.
  await assert.rejects(() => withKernel(() => ok('factory_attempt_task_list_reading', listReading({runRef:'run:OTHER'})), () => listFactoryAttemptTasks(bridge, {statePath:'/s', runRef:'run:1'})).then(r=>r.value), /different Run/); n++;
  await assert.rejects(() => withKernel(() => ok('factory_attempt_task_reading', taskReading({taskRef:'task:OTHER'})), () => readFactoryAttemptTask(bridge, {statePath:'/s', runRef:'run:1', taskRef:'task:a'})).then(r=>r.value), /different Run or task/); n++;

  // A list that under-counts its own set is rejected (pagination integrity).
  await assert.rejects(() => withKernel(() => ok('factory_attempt_task_list_reading', listReading({totalTasks:1})), () => listFactoryAttemptTasks(bridge, {statePath:'/s', runRef:'run:1'})).then(r=>r.value), /different Run or an incompatible contract/); n++;

  // An incompatible contract and an unavailable executable are distinct failures.
  await assert.rejects(() => withKernel(() => ok('factory_attempt_task_list_reading', {contract:'factory.wrong/v1'}), () => listFactoryAttemptTasks(bridge, {statePath:'/s', runRef:'run:1'})).then(r=>r.value), /incompatible contract/); n++;
  await assert.rejects(() => withKernel(() => ({ok:false, error:'factory attempt list failed: unavailable'}), () => listFactoryAttemptTasks(bridge, {statePath:'/s', runRef:'run:1'})).then(r=>r.value), /unavailable/); n++;

  // The task read carries the owner's pagination grammar to the kernel op.
  const paged = await withKernel(op => { assert.equal(op.limit, 10); assert.deepEqual(op.cursor, {after:'x'}); return ok('factory_attempt_task_reading', taskReading()); }, () => readFactoryAttemptTask(bridge, {statePath:'/s', runRef:'run:1', taskRef:'task:a', limit:10, cursor:{after:'x'}}));
  assert.equal(paged.value.taskRef, 'task:a'); n++;

  console.log(`Factory attempt-task consumer: ${n} identity/pagination/refusal assertions passed`);
} finally { await server.close(); }
