/** UI request currency, not a new session or context store. Native scope,
 * revision and digest checks remain authoritative at mutation/dispatch. */
export function selectionScopeKey(project?: string, session?: string): string {
  return JSON.stringify([project ?? null, session ?? null]);
}
export function scopeGuard(read: () => string): () => void {
  const expected = read();
  return () => {
    if (read() !== expected) throw new Error("The context destination changed. Select the material again for the current conversation.");
  };
}
/** A delayed read cannot roll a more recent owner mutation back in the UI. */
export function newerContext<T extends {revision: number}>(previous: T | undefined, next: T): T {
  return previous && previous.revision > next.revision ? previous : next;
}
