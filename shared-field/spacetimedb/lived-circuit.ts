/**
 * The lived two-world circuit — World B's half (Lane C steps 6/7).
 *
 * Run on the second world's own machine, against the retained field, under
 * B's own transport token (`token_label` world-b) and B's own Central
 * readings. World A's half is the field client (`field.sh` participant /
 * contact / admit / publish) plus Central's native Return on A's machine.
 *
 *   SPACETIMEDB_URI=… SPACETIMEDB_DATABASE=… npx tsx lived-circuit.ts b-discover --world <ref> --artifact <hosted ref> --readings <dir> --out receipt.json
 *   … b-engage  --field <A field> --participant <B in A> --owner <A owner participant> --artifact <hosted ref> --projection <ref> --readings <dir> --text "…" --run <id> --out receipt.json
 *   … b-observe --projection <ref> --revision 2 --contribution <ref> --run <id> --out receipt.json
 *
 * Laws exercised: discoverable ≠ contactable ≠ writer; received ≠ admitted ≠
 * indexed; visible ≠ disclosed (no sentinel in the neighbourhood); transport
 * identity ≠ Participant identity.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { open, close, resolveTarget, rows, waitUntil, fieldSnapshot } from './field-lib';
import { createContribution } from '../social.mjs';
import { createWatch } from '../watch.mjs';

for (const level of ['log', 'info', 'warn', 'debug'] as const) console[level] = (...parts: unknown[]) => { process.stderr.write(`${parts.map(String).join(' ')}\n`); };

const argv = process.argv.slice(2);
const step = argv[0];
const flag = (name: string, fallback?: string) => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : fallback; };
const out = flag('--out');
const binding = resolveTarget();
if (!binding.bound) throw new Error(binding.reason);
const SENTINEL = /PRIVATE_SENTINEL|identity\.md|wiki:node:identity/;

function readings(dir: string) {
  const root = JSON.parse(readFileSync(join(dir, 'root.json'), 'utf8'));
  const project = JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8'));
  return { root, project, source: project.source, world_ref: project.world_ref };
}

function emit(receipt: unknown) {
  const json = `${JSON.stringify(receipt, null, 2)}\n`;
  if (out) writeFileSync(out, json);
  process.stdout.write(json);
}

const client = await open(binding.target, 'world-b');
try {
  if (step === 'b-discover') {
    const worldRef = flag('--world')!; const artifactRef = flag('--artifact')!; const own = readings(flag('--readings')!);
    await waitUntil(() => client.live.snapshot().entries.some((entry: any) => entry.ref === worldRef), `A's world ${worldRef} in B's subscription`);
    const hits = client.live.search('O-I', { limit: 8 });
    assert.ok(hits.some((hit: any) => hit.ref === worldRef), 'B finds A by search');
    const world = client.live.resolve(worldRef);
    const artifact = client.live.resolve(artifactRef);
    assert.equal(artifact.world_ref, worldRef, 'the artifact resolves inside A\'s world');
    const neighbourhood = client.live.open(worldRef, { depth: 2, budget: 24 });
    const seen = new Set<string>(neighbourhood.relations.edges.flatMap((edge: any) => [edge.from, edge.to]));
    assert.ok(seen.has(artifactRef), 'B sees the world → artifact relation');
    assert.ok(![...seen].some((ref) => SENTINEL.test(ref)), 'no unprojected material in the neighbourhood');
    const nodeSource = client.live.snapshot().relations.find((relation: any) => relation.relation === 'node-source' && relation.to === artifactRef);
    const edition = artifact.locators.find((locator: any) => locator.surface === 'edition')?.locator;
    const manifestLocator = artifact.locators.find((locator: any) => locator.surface === 'edition-manifest')?.locator;
    const page = edition ? await (await fetch(edition)).text() : '';
    const manifest = manifestLocator ? await (await fetch(manifestLocator)).json() : null;
    if (manifest) assert.equal(createHash('sha256').update(page).digest('hex'), manifest.digest.value, 'served edition bytes match the manifest digest');
    assert.ok(!SENTINEL.test(page), 'the served edition carries no sentinel');
    assert.ok(!page.includes('id="ql-doc"'), 'the served edition is rebuilt, not the source carrier');
    const projection = client.live.snapshot().projections.find((candidate: any) => candidate.subject?.ref === artifact.aliases?.[0] || candidate.projection_ref === artifact.meta?.projection_ref);
    const authority = rows((client.conn.db as any).myFieldAuthority);
    emit({
      step, run_at: new Date().toISOString(), target: binding.target,
      world_b: { transport_identity: client.identityHex, central_root_revision: own.root.source.revision, central_project_revision: own.source.revision, world_ref: own.world_ref, project_space: own.project.spaces?.[0]?.ref },
      discovered: { world: { ref: world.ref, label: world.label, revision: world.revision }, artifact: { ref: artifact.ref, kind: artifact.kind, label: artifact.label, summary: artifact.summary, revision: artifact.revision, standing: artifact.meta?.standing, provenance: artifact.provenance }, projection: projection ? { projection_ref: projection.projection_ref, projection_revision: projection.projection_revision, source_revision: projection.source.revision, publisher: projection.publisher_participant_ref } : null, node_source_relation: nodeSource ? { from: nodeSource.from, origin: nodeSource.origin } : null, neighbourhood_size: seen.size },
      edition: edition ? { locator: edition, digest: manifest?.digest?.value ?? null, rebuilt: manifest?.rebuilt ?? null, bytes: page.length } : null,
      authority_before_grant: authority.length,
      laws: ['discoverable without any grant', 'neighbourhood bounded to projected material', 'edition digest identifies bytes only'],
    });
  } else if (step === 'b-engage') {
    const fieldRef = flag('--field')!; const participantRef = flag('--participant')!; const ownerRef = flag('--owner')!; const artifactRef = flag('--artifact')!; const projectionRef = flag('--projection')!; const run = flag('--run', Date.now().toString(36))!; const own = readings(flag('--readings')!);
    const text = flag('--text', 'A reply from the second world.')!;
    const db: any = client.conn.db; const reducers: any = client.conn.reducers;
    await waitUntil(() => rows(db.myFieldAuthority).some((row: any) => row.fieldRef === fieldRef && row.participantRef === participantRef && !row.revoked), `B's own grant as ${participantRef} in ${fieldRef}`);
    const contactRef = `contact:world-b:${run}`;
    await reducers.requestContact({ contactRef, fieldRef, initiatorParticipantRef: participantRef, recipientParticipantRef: ownerRef, purpose: 'B read A\'s curated artifact and asks to be in contact about it', requestedScopeJson: JSON.stringify({ mode: 'conversation', about: artifactRef }), ttlSeconds: 3600, provenanceJson: JSON.stringify({ kind: 'authored', ref: own.world_ref, source_system: 'central', revision: own.source.revision }) });
    const contact = await waitUntil(() => rows(db.myContact).find((row: any) => row.contactRef === contactRef), 'B\'s Contact request in its own view');
    const watch = createWatch({ watch_ref: `watch:world-b:${run}:artifact`, watcher_participant_ref: participantRef, field_ref: fieldRef, target: { kind: 'object', ref: artifactRef }, created_at: new Date().toISOString(), provenance: { source_system: 'central', source_revision: own.source.revision } });
    await reducers.putWatch({ watchRef: watch.watch_ref, fieldRef: watch.field_ref, watcherParticipantRef: watch.watcher_participant_ref, targetKind: watch.target.kind, targetRef: watch.target.ref, state: watch.state, contractJson: JSON.stringify(watch) });
    await waitUntil(() => rows(db.myWatch).some((row: any) => row.watchRef === watch.watch_ref), 'B\'s Watch in its own view');
    const contributionRef = `contribution:world-b:${run}:reply`;
    const contribution = createContribution({
      contribution_ref: contributionRef, field_ref: fieldRef, contributor_participant_ref: participantRef, created_at: new Date().toISOString(), mode: 'reply',
      target: { kind: 'oi.projection', ref: projectionRef }, relation: { kind: 'responds-to' },
      representation: { kind: 'oi.sparse-representation/v1', payload: { schema: 'oi.sparse-representation/v1', title: 'A reply from the second world', description: text, groups: [], meta: [{ label: 'from', value: own.world_ref }, { label: 'about', value: artifactRef }] } },
      provenance: [{ kind: 'authored', ref: own.world_ref, source_system: 'central', revision: own.source.revision }],
      source: { system: 'central', revision: own.source.revision },
    });
    await reducers.submitContribution({ fieldRef, contributorParticipantRef: participantRef, transportMessageId: `msg:world-b:${run}:1`, contractJson: JSON.stringify(contribution) });
    const receipt = await waitUntil(() => rows(db.myContributionReceipt).find((row: any) => row.contributionRef === contributionRef), 'B\'s Contribution receipt');
    assert.equal(receipt.state, 'quarantined');
    assert.equal(rows(db.contribution).filter((row: any) => row.contributionRef === contributionRef).length, 0, 'received ≠ admitted');
    assert.ok(!client.live.snapshot().entries.some((entry: any) => entry.ref === contributionRef), 'received ≠ indexed');
    let forged = 'not attempted';
    try { await reducers.putExploreEntry({ semanticRef: `${artifactRef}#forged`, fieldRef, worldRef: 'world:central:project:O-I', kind: 'wiki-node', label: 'forged', revision: '', entryJson: '{}' }); forged = 'ACCEPTED (defect)'; } catch (error: any) { forged = `refused: ${String(error?.message ?? error).slice(0, 80)}`; }
    emit({
      step, run, run_at: new Date().toISOString(), target: binding.target,
      world_b: { transport_identity: client.identityHex, participant_ref: participantRef, central_project_revision: own.source.revision },
      contact: { contact_ref: contactRef, recipient: ownerRef, state: contact.state ?? contact.decision ?? 'requested' },
      watch: { watch_ref: watch.watch_ref, target: watch.target, state: watch.state },
      contribution: { contribution_ref: contributionRef, ingress_ref: receipt.ingressRef, state: receipt.state, target: contribution.target, source_revision: own.source.revision },
      forged_index_write: forged,
      laws: ['contactable only after A\'s grant', 'watch is B\'s own record', 'received ≠ admitted ≠ indexed', 'B cannot write A\'s index'],
    });
  } else if (step === 'b-observe') {
    const projectionRef = flag('--projection')!; const revision = Number(flag('--revision', '2')); const contributionRef = flag('--contribution')!; const run = flag('--run', '')!;
    const db: any = client.conn.db;
    const projection = await waitUntil(() => client.live.snapshot().projections.find((candidate: any) => candidate.projection_ref === projectionRef && candidate.projection_revision === revision), `P${revision} of ${projectionRef} through B's subscription`);
    const admitted = await waitUntil(() => rows(db.contribution).find((row: any) => row.contributionRef === contributionRef), 'B\'s admitted Contribution in the public view');
    const indexed = client.live.snapshot().entries.find((entry: any) => entry.ref === contributionRef);
    const found = client.live.search('second world', { limit: 8 }).some((hit: any) => hit.ref === contributionRef);
    const replies = projection.representation?.payload?.regions?.find((region: any) => region.region_ref === 'replies');
    const contact = rows(db.myContact).find((row: any) => row.contactRef === `contact:world-b:${run}`);
    const watch = rows(db.myWatch).find((row: any) => row.watchRef === `watch:world-b:${run}:artifact`);
    const snapshot = fieldSnapshot(client);
    emit({
      step, run, run_at: new Date().toISOString(), target: binding.target,
      world_b: { transport_identity: client.identityHex },
      observed: { projection_ref: projectionRef, projection_revision: projection.projection_revision, source_revision: projection.source.revision, supersedes: projection.supersedes ?? null, replies_region: replies ? replies.bindings.map((binding: any) => binding.subject_ref) : null, admitted: { contribution_ref: admitted.contributionRef, contributor: admitted.contributorParticipantRef, source_revision: JSON.parse(admitted.contractJson).source?.revision }, indexed: Boolean(indexed), found_by_search: found, contact_state: contact ? (contact.state ?? contact.decision ?? null) : null, watch_state: watch?.state ?? null },
      counts: snapshot.counts,
      laws: ['admitted ≠ canonical: A\'s source revision unchanged on P2', 'attribution and B\'s source revision preserved through admission', 'B observes the lawful new revision through its own subscription'],
    });
  } else {
    throw new Error(`unknown step: ${step}`);
  }
} finally {
  close(client);
}
