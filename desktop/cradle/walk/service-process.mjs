// Direct service custody for a walk already inside an owned native supervisor.
// Descendants retain that supervisor's group; this module never signals a
// numeric process group after Node has reaped its leader.
import {spawn} from 'node:child_process';

export function spawnInheritedService(label, command, args, options = {}, onOutput = () => {}) {
  const child = spawn(command, args, {...options, detached:false, stdio:['ignore','pipe','pipe']});
  let output = Buffer.alloc(0), discarded = 0, spawnError = null, closed = false;
  const record = {label, child, output:()=>output.toString('utf8'), discardedBytes:()=>discarded};
  record.closed = new Promise(resolve => {
    child.once('error', error => { spawnError = error; });
    child.once('close', (code, signal) => {closed = true; resolve({code, signal, error:spawnError});});
  });
  const retain = chunk => {
    const incoming = Buffer.from(chunk);
    const tail = Buffer.concat([output, incoming]);
    const removed = Math.max(0, tail.length - 256 * 1024);
    discarded += removed;
    output = Buffer.from(tail.subarray(removed));
    onOutput(chunk);
  };
  child.stdout.on('data', retain); child.stderr.on('data', retain);
  const wait = milliseconds => new Promise(resolve => {
    const timer = setTimeout(()=>resolve(false), milliseconds);
    record.closed.then(()=>{clearTimeout(timer);resolve(true);});
  });
  record.stop = async () => {
    if (!closed) {
      child.kill('SIGTERM');
      if (!await wait(1500)) {
        child.kill('SIGKILL');
        if (!await wait(1500)) throw new Error(`cleanup_unknown: ${label} did not close within its owned-child retirement bound`);
      }
    }
    const result = await record.closed;
    if (result.error) throw result.error;
    return result;
  };
  return record;
}
