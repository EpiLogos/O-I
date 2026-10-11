import {MessageChannel} from 'node:worker_threads';
/** Observe actual MessageChannel delivery by FIFO acknowledgement, never by
 * guessing how many milliseconds a loaded machine needs to drain its queue. */
export function messageWire() {
  const {port1, port2} = new MessageChannel(), messages = [], barriers = new Map();
  port2.on('message', data => {
    if (data?.__boundary_test_barrier) barriers.get(data.__boundary_test_barrier)?.();
    else messages.push(data);
  });
  return {port1, port2, messages,
    observe: () => new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {barriers.delete(id); reject(Error('The MessageChannel observation barrier did not arrive'));}, 3000);
      barriers.set(id, () => {clearTimeout(timer); barriers.delete(id); resolve(messages);});
      port1.postMessage({__boundary_test_barrier: id});
    }),
    dispose: () => {port1.close(); port2.close();},
  };
}
