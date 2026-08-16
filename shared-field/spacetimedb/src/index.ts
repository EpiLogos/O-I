import { schema, table, t } from 'spacetimedb/server';

const spacetimedb = schema({
  sharedField: table(
    { public: true },
    {
      rowId: t.u64().primaryKey().autoInc(),
      fieldRef: t.string().unique(),
      kind: t.string(),
      visibility: t.string(),
      contractJson: t.string(),
    }
  ),
  participant: table(
    { public: true },
    {
      rowId: t.u64().primaryKey().autoInc(),
      participantRef: t.string().unique(),
      fieldRef: t.string().index('btree'),
      identityKind: t.string(),
      identityRef: t.string().index('btree'),
      sourceSystem: t.string(),
      sourceRevision: t.string(),
      contractJson: t.string(),
    }
  ),
  projection: table(
    { public: true },
    {
      rowId: t.u64().primaryKey().autoInc(),
      projectionKey: t.string().unique(),
      projectionRef: t.string().index('btree'),
      projectionRevision: t.u32(),
      sourceRevision: t.string(),
      publisherParticipantRef: t.string().index('btree'),
      state: t.string(),
      contractJson: t.string(),
    }
  ),
  exploreEntry: table(
    { public: true },
    {
      rowId: t.u64().primaryKey().autoInc(),
      semanticRef: t.string().unique(),
      worldRef: t.string().index('btree'),
      kind: t.string().index('btree'),
      label: t.string(),
      revision: t.string(),
      entryJson: t.string(),
    }
  ),
  exploreRelation: table(
    { public: true },
    {
      rowId: t.u64().primaryKey().autoInc(),
      relationRef: t.string().unique(),
      fromRef: t.string().index('btree'),
      toRef: t.string().index('btree'),
      relation: t.string().index('btree'),
      origin: t.string(),
      relationJson: t.string(),
    }
  ),
  watch: table(
    { public: true },
    {
      rowId: t.u64().primaryKey().autoInc(),
      watchRef: t.string().unique(),
      fieldRef: t.string().index('btree'),
      watcherParticipantRef: t.string().index('btree'),
      targetKind: t.string().index('btree'),
      targetRef: t.string().index('btree'),
      state: t.string(),
      contractJson: t.string(),
    }
  ),
});

export default spacetimedb;

function requireJsonObject(value: string, name: string): void {
  if (value.trim() === '') throw new Error(`${name} must be non-empty JSON`);
  const parsed = JSON.parse(value);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${name} must contain a JSON object`);
  }
}

export const put_shared_field = spacetimedb.reducer(
  {
    fieldRef: t.string(),
    kind: t.string(),
    visibility: t.string(),
    contractJson: t.string(),
  },
  (ctx, args) => {
    requireJsonObject(args.contractJson, 'SharedField contract');
    const existing = ctx.db.sharedField.fieldRef.find(args.fieldRef);
    if (existing) {
      ctx.db.sharedField.rowId.update({ ...existing, ...args });
    } else {
      ctx.db.sharedField.insert({ rowId: 0n, ...args });
    }
  }
);

export const put_participant = spacetimedb.reducer(
  {
    participantRef: t.string(),
    fieldRef: t.string(),
    identityKind: t.string(),
    identityRef: t.string(),
    sourceSystem: t.string(),
    sourceRevision: t.string(),
    contractJson: t.string(),
  },
  (ctx, args) => {
    requireJsonObject(args.contractJson, 'Participant contract');
    if (!ctx.db.sharedField.fieldRef.find(args.fieldRef)) {
      throw new Error(`Unknown SharedField semantic ref: ${args.fieldRef}`);
    }
    const existing = ctx.db.participant.participantRef.find(args.participantRef);
    if (existing) {
      ctx.db.participant.rowId.update({ ...existing, ...args });
    } else {
      ctx.db.participant.insert({ rowId: 0n, ...args });
    }
  }
);

export const put_projection = spacetimedb.reducer(
  {
    projectionKey: t.string(),
    projectionRef: t.string(),
    projectionRevision: t.u32(),
    sourceRevision: t.string(),
    publisherParticipantRef: t.string(),
    state: t.string(),
    contractJson: t.string(),
  },
  (ctx, args) => {
    requireJsonObject(args.contractJson, 'Projection contract');
    if (!ctx.db.participant.participantRef.find(args.publisherParticipantRef)) {
      throw new Error(`Unknown publisher Participant semantic ref: ${args.publisherParticipantRef}`);
    }
    const expectedKey = `${args.projectionRef}@${args.projectionRevision}`;
    if (args.projectionKey !== expectedKey) {
      throw new Error(`Projection key must be ${expectedKey}`);
    }
    const existing = ctx.db.projection.projectionKey.find(args.projectionKey);
    if (existing) {
      ctx.db.projection.rowId.update({ ...existing, ...args });
    } else {
      ctx.db.projection.insert({ rowId: 0n, ...args });
    }
  }
);

export const put_explore_entry = spacetimedb.reducer(
  {
    semanticRef: t.string(),
    worldRef: t.string(),
    kind: t.string(),
    label: t.string(),
    revision: t.string(),
    entryJson: t.string(),
  },
  (ctx, args) => {
    requireJsonObject(args.entryJson, 'Explore entry');
    const existing = ctx.db.exploreEntry.semanticRef.find(args.semanticRef);
    if (existing) {
      ctx.db.exploreEntry.rowId.update({ ...existing, ...args });
    } else {
      ctx.db.exploreEntry.insert({ rowId: 0n, ...args });
    }
  }
);

export const put_explore_relation = spacetimedb.reducer(
  {
    relationRef: t.string(),
    fromRef: t.string(),
    toRef: t.string(),
    relation: t.string(),
    origin: t.string(),
    relationJson: t.string(),
  },
  (ctx, args) => {
    requireJsonObject(args.relationJson, 'Explore relation');
    if (!ctx.db.exploreEntry.semanticRef.find(args.fromRef)) {
      throw new Error(`Unknown Explore source semantic ref: ${args.fromRef}`);
    }
    if (!ctx.db.exploreEntry.semanticRef.find(args.toRef)) {
      throw new Error(`Unknown Explore target semantic ref: ${args.toRef}`);
    }
    const existing = ctx.db.exploreRelation.relationRef.find(args.relationRef);
    if (existing) {
      ctx.db.exploreRelation.rowId.update({ ...existing, ...args });
    } else {
      ctx.db.exploreRelation.insert({ rowId: 0n, ...args });
    }
  }
);

export const put_watch = spacetimedb.reducer(
  {
    watchRef: t.string(),
    fieldRef: t.string(),
    watcherParticipantRef: t.string(),
    targetKind: t.string(),
    targetRef: t.string(),
    state: t.string(),
    contractJson: t.string(),
  },
  (ctx, args) => {
    requireJsonObject(args.contractJson, 'Watch contract');
    const participant = ctx.db.participant.participantRef.find(args.watcherParticipantRef);
    if (!participant) {
      throw new Error(`Unknown Watcher Participant semantic ref: ${args.watcherParticipantRef}`);
    }
    if (participant.fieldRef !== args.fieldRef) {
      throw new Error(`Watch field must match watcher Participant field: ${participant.fieldRef}`);
    }
    if (!ctx.db.exploreEntry.semanticRef.find(args.targetRef)) {
      throw new Error(`Unknown Watch target semantic ref: ${args.targetRef}`);
    }
    const existing = ctx.db.watch.watchRef.find(args.watchRef);
    if (existing) {
      ctx.db.watch.rowId.update({ ...existing, ...args });
    } else {
      ctx.db.watch.insert({ rowId: 0n, ...args });
    }
  }
);
