import type { PointCloudField } from './PointCloudField';
import { download, png } from '../../field-studies-journeys/src/capture';

/** Capture the resident field through its existing bounded renderImage path.
 * This neither advances physics nor resets the scene. Keep encoding errors
 * visible to the caller and start a download only after a real PNG exists. */
export async function downloadSnapshot(
  engine: Pick<PointCloudField, 'canvas' | 'renderImage'>,
): Promise<void> {
  const image = engine.renderImage(engine.canvas.width, engine.canvas.height);
  const blob = await png(image);
  download(blob, 'expression.png');
}
