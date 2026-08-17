/*
 * Phase-1 conformance adapter for the existing #37 live acceptance fixture.
 *
 * The strengthened server contract exposes `projection` as a caller-filtered
 * View, so generated raw-table secondary-index helpers are intentionally absent.
 * #37's production A2A source already consumes `projection.iter()`; only one
 * legacy assertion still calls `projection.projectionKey.find(...)`.
 *
 * Patch only test connections after they are created: the compatibility lookup
 * scans the legal caller View and never restores raw backing-table access.
 */
import { DbConnection } from './module_bindings/index';

const originalBuilder = DbConnection.builder.bind(DbConnection);

(DbConnection as any).builder = (...args: any[]) => {
  const builder: any = originalBuilder(...args);
  const originalOnConnect = builder.onConnect.bind(builder);

  builder.onConnect = (callback: any) => originalOnConnect((conn: any, ...rest: any[]) => {
    const projection = conn.db.projection;
    if (projection && projection.projectionKey === undefined) {
      Object.defineProperty(projection, 'projectionKey', {
        configurable: true,
        value: {
          find: (storageKey: string) => {
            const split = storageKey.lastIndexOf('@');
            if (split <= 0) return undefined;
            const projectionRef = storageKey.slice(0, split);
            const projectionRevision = Number(storageKey.slice(split + 1));
            return [...projection.iter()].find((row: any) =>
              row?.projectionRef === projectionRef
              && row?.projectionRevision === projectionRevision
            );
          },
        },
      });
    }
    return callback(conn, ...rest);
  });

  return builder;
};

await import('./a2a-live-acceptance.ts');
