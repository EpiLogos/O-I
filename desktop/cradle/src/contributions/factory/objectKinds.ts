/** The object kinds Factory's centre opens in place itself (11-FACTORY §1):
 * in Factory mode these pages replace the Desk with ← Back inside
 * FactoryCentre, so the frame's generic object layer and tab opener stand
 * down for them. One list, read by both sides. */
export const FACTORY_OBJECT_KINDS: ReadonlySet<string> = new Set(["factory-run", "factory-unit", "factory-attempt", "factory-check", "factory-now", "factory-agent", "tape-event"]);

/** True when an open of this kind belongs to Factory's own centre. */
export function factoryCentreOwns(mode: string | undefined, kind: string): boolean {
  return mode === "factory" && FACTORY_OBJECT_KINDS.has(kind);
}
