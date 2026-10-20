// Where the body's pictures are made (T-WORLDS §5 W3 phase B; T-PROCEDURAL-BODY): in a module worker when the page can start one (globe/bodyWorker.ts), else on the main thread, with
// the same pure functions (globe/body.ts bodyImage, cloudImage; globe/bodyTiles.ts bodyTile), so the same record gives the same bytes either way. A worker that cannot start, or
// fails, is not tried again this session: its jobs and every later one run on the main thread, and nothing is dropped. Nothing here is random and nothing is kept but the workers.
//
// There are two workers, so that a close tile is not kept waiting behind the big base image: one makes the base pictures (a few seconds a job), the other the tiles (a few tenths of a
// second a job, a couple at a time; a tile that has been given up on before it is sent is never made).
import { bodyImage, cloudImage, type BodyImage, type BodyLook, type WorldBodyRecord } from './body';
import { bodyTile } from './bodyTiles';
import type { TileSource } from './tiles';

/** A job for the base worker: the owner's record, the widths to draw it at, and how it is drawn (the look). */
export interface BodyJob {
  readonly id: number;
  readonly record: WorldBodyRecord;
  readonly width: number;
  readonly cloudWidth: number;
  readonly look?: BodyLook;
}
/** A job for the tile worker: the tile of the record at a Web-Mercator slippy tile. */
export interface TileJob {
  readonly id: number;
  readonly record: WorldBodyRecord;
  readonly z: number;
  readonly x: number;
  readonly y: number;
  readonly look?: BodyLook;
}
export type BodyJobAnswer =
  | { readonly id: number; readonly image: BodyImage; readonly clouds: BodyImage }
  | { readonly id: number; readonly tile: BodyImage }
  | { readonly id: number; readonly refused: string };

/** The body's base image and its cloud layer. */
export interface BodyPictures {
  readonly image: BodyImage;
  readonly clouds: BodyImage;
}

type Lane = 'base' | 'tile';
type Pending = { resolve(answer: BodyJobAnswer): void; reject(error: Error): void; local(): BodyJobAnswer; lane: Lane };

const workers: Record<Lane, Worker | null> = { base: null, tile: null };
/** false once a worker could not start or failed: the main thread draws from then on */
let workerUsable = typeof Worker !== 'undefined';
let nextId = 1;
const pending = new Map<number, Pending>();

/** The worker failed: every job it holds is made on the main thread instead, and no worker is started again. */
function fallBack(): void {
  workerUsable = false;
  for (const lane of ['base', 'tile'] as const) {
    workers[lane]?.terminate();
    workers[lane] = null;
  }
  for (const [id, job] of [...pending]) {
    pending.delete(id);
    try { job.resolve(job.local()); } catch (error) { job.reject(error instanceof Error ? error : new Error(String(error))); }
  }
}

function startWorker(lane: Lane): Worker | null {
  if (workers[lane] || !workerUsable) return workers[lane];
  let worker: Worker;
  try {
    worker = new Worker(new URL('./bodyWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    workerUsable = false;
    return null;
  }
  workers[lane] = worker;
  worker.onmessage = (event: MessageEvent<BodyJobAnswer>) => {
    const answer = event.data, job = pending.get(answer.id);
    if (!job) return;
    pending.delete(answer.id);
    if ('refused' in answer) job.reject(new Error(answer.refused));
    else job.resolve(answer);
  };
  worker.onerror = () => fallBack();
  return worker;
}

/** Send a job to the lane's worker, or make it here where there is none. */
function send(lane: Lane, job: BodyJob | TileJob, local: () => BodyJobAnswer): Promise<BodyJobAnswer> {
  const thread = startWorker(lane);
  if (!thread) {
    try { return Promise.resolve(local()); } catch (error) { return Promise.reject(error); }
  }
  return new Promise<BodyJobAnswer>((resolve, reject) => {
    pending.set(job.id, { resolve, reject, local, lane });
    try {
      thread.postMessage(job);
    } catch {
      fallBack();
    }
  });
}

/** The body's pictures at `width` (its clouds at `cloudWidth`), as `look` draws it, made off the main thread where it can be. */
export function renderBody(record: WorldBodyRecord, width: number, cloudWidth = Math.max(8, Math.floor(width / 2)), look?: BodyLook): Promise<BodyPictures> {
  const job: BodyJob = { id: nextId++, record, width, cloudWidth, look };
  const local = (): BodyJobAnswer => ({ id: job.id, image: bodyImage(record, width, look), clouds: cloudImage(record, cloudWidth, look) });
  return send('base', job, local).then((answer) => {
    if (!('image' in answer)) throw new Error('the worker answered a picture job with something else');
    return { image: answer.image, clouds: answer.clouds };
  });
}

// ── tiles ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Tiles in flight at the worker at once: enough to keep it busy, few enough that a tile given up on is mostly never made. */
const TILES_AT_ONCE = 2;
interface QueuedTile { readonly signal: AbortSignal | undefined; run(): void }
const tileQueue: QueuedTile[] = [];
let tilesInFlight = 0;

function pumpTiles(): void {
  while (tileQueue.length && tilesInFlight < TILES_AT_ONCE) {
    const next = tileQueue.shift()!;
    if (next.signal?.aborted) continue; // given up on before it was sent: not made (its caller has been told)
    tilesInFlight++;
    next.run();
  }
}

/** The tile of the body at `z`/`x`/`y` (256 × 256), made off the main thread where it can be. A tile whose `signal` aborts before its turn is never made. */
export function renderTile(record: WorldBodyRecord, z: number, x: number, y: number, look?: BodyLook, signal?: AbortSignal): Promise<BodyImage> {
  return new Promise<BodyImage>((resolve, reject) => {
    const run = () => {
      const job: TileJob = { id: nextId++, record, z, x, y, look };
      send('tile', job, () => ({ id: job.id, tile: bodyTile(record, z, x, y, look) })).then((answer) => {
        if (!('tile' in answer)) throw new Error('the worker answered a tile job with something else');
        resolve(answer.tile);
      }, reject).finally(() => { tilesInFlight = Math.max(0, tilesInFlight - 1); pumpTiles(); });
    };
    signal?.addEventListener('abort', () => reject(new DOMException('the tile was given up on', 'AbortError')), { once: true });
    tileQueue.push({ signal, run });
    pumpTiles();
  });
}

/** The tiles of a generated body as a tile source for the globe's tile layer (globe/tiles.ts): asked of the worker, never of the network. */
export function bodyTileSource(record: WorldBodyRecord, look?: BodyLook): TileSource {
  return { load: (z, x, y, signal) => renderTile(record, z, x, y, look, signal) };
}

/** Where the next job runs (a reading for the tests and the report). */
export const bodyRenderThread = (): 'worker' | 'main' => (workerUsable ? 'worker' : 'main');
