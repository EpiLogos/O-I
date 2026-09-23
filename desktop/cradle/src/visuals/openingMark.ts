/**
 * The opening mark is the derived static splash (black stipple on a baked
 * light plate). This builds an alpha mask of that stipple so the welcome
 * can paint it in the theme's ink on the theme's ground. A CSS invert of
 * the plate would animate through gray and would keep the baked paper,
 * which fights the ground.
 */
import splashUrl from "../../src-tauri/icons/splash.png";

export const OPENING_SPLASH_URL = splashUrl;

/** Paper near the plate's #f2f2f2 drops out; dense ink stays opaque. */
const PAPER_FLOOR = 0.1;
const INK_RANGE = 0.7;

export function stippleMaskUrl(image: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }): Promise<string> {
  const width = image.naturalWidth || image.width || 0;
  const height = image.naturalHeight || image.height || 0;
  if (!width || !height) return Promise.reject(new Error("The opening mark has no pixels."));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return Promise.reject(new Error("The opening mark could not be prepared."));
  context.drawImage(image, 0, 0, width, height);
  const frame = context.getImageData(0, 0, width, height);
  const data = frame.data;
  for (let index = 0; index < data.length; index += 4) {
    const luminance = (data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722) / 255;
    const coverage = Math.min(1, Math.max(0, (1 - luminance - PAPER_FLOOR) / INK_RANGE));
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = Math.round(coverage * 255);
  }
  context.putImageData(frame, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("The opening mark could not be prepared."));
      else resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}
