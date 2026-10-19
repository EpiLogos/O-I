// Where the body's pictures are made (T-WORLDS §5 W3 phase B, W3a's open end (e)): in a module worker when the page can start one
// (globe/bodyWorker.ts), else on the main thread, with the same pure functions (globe/body.ts bodyImage, cloudImage), so the same record
// gives the same bytes either way. A worker that cannot start, or fails, is not tried again this session: its jobs and every later one
// run on the main thread, and nothing is dropped. Nothing here is random and nothing is kept but the one worker.
import { bodyImage, cloudImage, type BodyImage, type WorldBodyRecord } from './body';

/** A job for the worker: the owner's record and the widths to draw it at. */
export interface BodyJob {
  readonly id: number;
  readonly record: WorldBodyRecord;
  readonly width: number;
  readonly cloudWidth: number;
}
export type BodyJobAnswer = { readonly id: number; readonly image: BodyImage; readonly clouds: BodyImage } | { readonly id: number; readonly refused: string };

/** The body's base image and its cloud layer. */
export interface BodyPictures {
  readonly image: BodyImage;
  readonly clouds: BodyImage;
}

type Pending = { resolve(pictures: BodyPictures): void; reject(error: Error): void; job: BodyJob };

let worker: Worker | null = null;
/** false once a worker could not start or failed: the main thread draws from then on */
let workerUsable = typeof Worker !== 'undefined';
let nextId = 1;
const pending = new Map<number, Pending>();

const onMain = (job: Pick<BodyJob, 'record' | 'width' | 'cloudWidth'>): BodyPictures =>
  ({ image: bodyImage(job.record, job.width), clouds: cloudImage(job.record, job.cloudWidth) });

/** The worker failed: every job it holds is drawn on the main thread instead, and no worker is started again. */
function fallBack(): void {
  workerUsable = false;
  worker?.terminate();
  worker = null;
  for (const [id, job] of [...pending]) {
    pending.delete(id);
    try { job.resolve(onMain(job.job)); } catch (error) { job.reject(error instanceof Error ? error : new Error(String(error))); }
  }
}

function startWorker(): Worker | null {
  if (worker || !workerUsable) return worker;
  try {
    worker = new Worker(new URL('./bodyWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    workerUsable = false;
    return null;
  }
  worker.onmessage = (event: MessageEvent<BodyJobAnswer>) => {
    const answer = event.data, job = pending.get(answer.id);
    if (!job) return;
    pending.delete(answer.id);
    if ('refused' in answer) job.reject(new Error(answer.refused));
    else job.resolve({ image: answer.image, clouds: answer.clouds });
  };
  worker.onerror = () => fallBack();
  return worker;
}

/** The body's pictures at `width` (its clouds at `cloudWidth`), made off the main thread where it can be. */
export function renderBody(record: WorldBodyRecord, width: number, cloudWidth = Math.max(8, Math.floor(width / 2))): Promise<BodyPictures> {
  const job: BodyJob = { id: nextId++, record, width, cloudWidth };
  const thread = startWorker();
  if (!thread) {
    try { return Promise.resolve(onMain(job)); } catch (error) { return Promise.reject(error); }
  }
  return new Promise<BodyPictures>((resolve, reject) => {
    pending.set(job.id, { resolve, reject, job });
    try {
      thread.postMessage(job);
    } catch {
      fallBack();
    }
  });
}

/** Where the next job runs (a reading for the tests and the report). */
export const bodyRenderThread = (): 'worker' | 'main' => (workerUsable ? 'worker' : 'main');
