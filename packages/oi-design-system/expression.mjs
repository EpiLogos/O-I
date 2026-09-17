/** Semantic vocabulary only. The O:I window stage projects these cues through
 * its one production native field. This package creates no renderer or clock. */
export const formNames = Object.freeze(['idle', 'waiting', 'listening', 'searching', 'presence', 'arrival', 'fire', 'water', 'air', 'earth']);
export const gestureDisposition = Object.freeze({resize: 'edge', open: null, close: null, split: null, move: null, save: null});
export function gestureFor(intent) {
  if (!Object.prototype.hasOwnProperty.call(gestureDisposition,intent)) throw new RangeError(`Unknown expression intent: ${intent}`);
  return gestureDisposition[intent];
}
