// The body's generator off the main thread (T-WORLDS §5 W3 phase B; W3a's report: about 0.85 s at 1024 on the main thread): a module
// worker that runs globe/body.ts's and globe/bodyTiles.ts's own pure functions on the record it is sent and hands the pixels back without copying them.
// It holds nothing between messages, reads nothing and writes nothing: the record is the owner's, read by the page (body/worldBody.ts). A job that names
// a tile (z, x, y) is a tile; any other is a base picture and its cloud layer.
import { bodyImage, cloudImage, isWorldBody, parseWorldBody } from './body';
import { bodyTile, hasTiles } from './bodyTiles';
import type { BodyJob, BodyJobAnswer, TileJob } from './bodyRender';

const scope = self as unknown as { onmessage: ((event: MessageEvent<BodyJob | TileJob>) => void) | null; postMessage(message: BodyJobAnswer, transfer: Transferable[]): void };

scope.onmessage = (event) => {
  const job = event.data, { id, look } = job;
  const parsed = parseWorldBody(job.record);
  if (!isWorldBody(parsed)) {
    scope.postMessage({ id, refused: parsed.refused }, []);
    return;
  }
  if ('z' in job) {
    if (!hasTiles(parsed)) {
      scope.postMessage({ id, refused: 'a body of generator version 1 has no tiles: its next change rebuilds it as version 2' }, []);
      return;
    }
    const tile = bodyTile(parsed, job.z, job.x, job.y, look);
    scope.postMessage({ id, tile }, [tile.data.buffer]);
    return;
  }
  const image = bodyImage(parsed, job.width, look);
  const clouds = cloudImage(parsed, job.cloudWidth, look);
  scope.postMessage({ id, image, clouds }, [image.data.buffer, clouds.data.buffer]);
};
