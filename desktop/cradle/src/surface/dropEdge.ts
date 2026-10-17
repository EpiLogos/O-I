/** The drag type an instrument carries from the browser into a pane (FOUNDATION F2). */
export const INSTRUMENT_DRAG_TYPE = "application/x-oi-instrument";

/** Which edge of a pane body a pointer stands over — a fifth of each side — or null for the middle, where a drop opens
 * into the pane itself (manual §10.2: "To make a new split, drag a tab onto the edge of a pane"). */
export function dropEdge(rect: {left: number; top: number; width: number; height: number}, x: number, y: number): import("./types").PaneEdge | null {
  const fx = (x - rect.left) / rect.width, fy = (y - rect.top) / rect.height;
  const near = Math.min(fx, 1 - fx, fy, 1 - fy);
  if (near > 0.2) return null;
  if (near === fx) return "left";
  if (near === 1 - fx) return "right";
  return near === fy ? "top" : "bottom";
}
