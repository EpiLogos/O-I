// The body's generator off the main thread (T-WORLDS §5 W3 phase B; W3a's report: about 0.85 s at 1024 on the main thread): a module
// worker that runs globe/body.ts's own pure functions on the record it is sent and hands the pixels back without copying them. It holds
// nothing between messages, reads nothing and writes nothing: the record is the owner's, read by the page (body/worldBody.ts).
import { bodyImage, cloudImage, isWorldBody, parseWorldBody } from './body';
import type { BodyJob, BodyJobAnswer } from './bodyRender';

const scope = self as unknown as { onmessage: ((event: MessageEvent<BodyJob>) => void) | null; postMessage(message: BodyJobAnswer, transfer: Transferable[]): void };

scope.onmessage = (event) => {
  const { id, record, width, cloudWidth, look } = event.data;
  const parsed = parseWorldBody(record);
  if (!isWorldBody(parsed)) {
    scope.postMessage({ id, refused: parsed.refused }, []);
    return;
  }
  const image = bodyImage(parsed, width, look);
  const clouds = cloudImage(parsed, cloudWidth, look);
  scope.postMessage({ id, image, clouds }, [image.data.buffer, clouds.data.buffer]);
};
