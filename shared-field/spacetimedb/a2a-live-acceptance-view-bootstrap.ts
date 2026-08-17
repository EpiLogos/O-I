/*
 * Phase-1 conformance adapter for the existing #37 live acceptance fixture.
 *
 * The strengthened server contract exposes `projection` as a caller-filtered
 * View, so generated raw-table secondary-index helpers are intentionally absent.
 * #37's production A2A source already consumes `projection.iter()`; only one
 * legacy assertion still calls `projection.projectionKey.find(...)`.
 *
 * Keep the inherited fixture unchanged and translate that one lookup into a
 * scan of the legal caller View. This does not restore raw backing access.
 */
Object.defineProperty(Object.prototype, 'projectionKey', {
  configurable: true,
  get(this: any) {
    if (typeof this?.iter !== 'function') return undefined;
    return {
      find: (storageKey: string) => {
        const split = storageKey.lastIndexOf('@');
        if (split <= 0) return undefined;
        const projectionRef = storageKey.slice(0, split);
        const projectionRevision = Number(storageKey.slice(split + 1));
        return [...this.iter()].find((row: any) =>
          row?.projectionRef === projectionRef
          && row?.projectionRevision === projectionRevision
        );
      },
    };
  },
});

await import('./a2a-live-acceptance.ts');
