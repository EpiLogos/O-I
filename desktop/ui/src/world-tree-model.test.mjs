import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_FACTS,
  accessFacts,
  buildCompositionModel,
  buildSubjectModel,
  buildWorldTreeModel,
  conflictFromFailure,
  failureReason,
  focusRefs,
  nodeIsFocused,
  projectNodeForSource,
  sourceIsFocused,
  subjectRefForNode,
  subjectRefForSource,
} from './world-tree-model.mjs';

const treeReading = {
  schema: 'oi.world-tree/v1',
  provider: { class: 'live_provider', seam: 'central', detail: null },
  warnings: ['a warning, verbatim'],
  root: {
    world: { ref: 'world:personal', kind: 'world', native_owner: 'central', provenance: { source: 'central:world', revision: 'r7' } },
    access: { exists: true, readable: true },
    ground: { native_owner: 'central', contract: 'ground/v1', path: '/Central', present: true, owner_world_ref: null },
    wiki: { profile: 'okf-wiki/v1', wiki_ref: 'wiki:personal', source: null, federates: [] },
    children: [
      {
        world: { ref: 'world:project:one', kind: 'project', native_owner: 'central', provenance: { source: 'central:world' } },
        access: { exists: true },
        sources: [
          {
            ref: 'project/one/README.md',
            path: 'README.md',
            treatment: 'canonical',
            provenance: 'central',
            standing: 'current',
            roles: ['overview'],
            agent_retrieval_allowed: true,
            revision: 'r3',
            access: { exists: true, readable: true, retrievable: true },
          },
          {
            ref: 'project/one/notes.md',
            treatment: 'owner-dialect-treatment',
            provenance: 'central',
            standing: 'draft',
            agent_retrieval_allowed: false,
            access: { exists: true },
          },
        ],
        children: [],
      },
    ],
  },
};

test('the tree renders the reading verbatim — owner vocabulary is preserved, not reclassified', () => {
  const model = buildWorldTreeModel(treeReading);
  assert.ok(model);
  assert.equal(model.schema, 'oi.world-tree/v1');
  assert.equal(model.provider.class, 'live_provider');
  assert.deepEqual(model.warnings, ['a warning, verbatim']);
  assert.equal(model.root.ref, 'world:personal');
  assert.equal(model.root.wiki.wiki_ref, 'wiki:personal', 'Wiki presence carried as the reading declared it');
  assert.equal(model.root.ground.present, true);

  const project = model.nodes.find((node) => node.ref === 'world:project:one');
  assert.equal(project.parent_ref, 'world:personal');
  assert.equal(project.sources[0].treatment, 'canonical');
  // an owner treatment the desktop does not name survives exactly as declared
  assert.equal(project.sources[1].treatment, 'owner-dialect-treatment');
  assert.equal(model.summary.projects, 1);
  assert.equal(model.summary.sources, 2);
});

test('a reading that is not a World tree reading builds no tree', () => {
  assert.equal(buildWorldTreeModel(null), null);
  assert.equal(buildWorldTreeModel({ schema: 'oi.subject-reading/v1' }), null);
  assert.equal(buildWorldTreeModel({}), null);
});

test('selection comes from the focus relation, never from a tree access fact', () => {
  const model = buildWorldTreeModel(treeReading);
  const project = model.nodes.find((node) => node.ref === 'world:project:one');
  const source = project.sources[0];

  // K2 review F-M2: a fresh read never projects selection. A node the kernel
  // has focused still shows `selected` omitted — and the tree must not render
  // selection from access facts, so an access fact can never fake focus either.
  const focused = { world: { ref: 'world:personal' }, project: { ref: 'world:project:one' }, subject: { ref: source.ref } };
  const empty = {};

  assert.equal(project.access.selected, undefined, 'fresh reads leave selected omitted');
  assert.equal(nodeIsFocused(project, focused), true, 'focus renders the node as focused');
  assert.equal(nodeIsFocused(project, empty), false, 'no focus, no selection');
  assert.equal(sourceIsFocused(source, focused), true);
  assert.equal(sourceIsFocused(source, empty), false);

  // the reverse lie is equally impossible: access facts claiming selection do
  // not make a node focused
  const lying = buildWorldTreeModel({
    ...treeReading,
    root: {
      ...treeReading.root,
      children: [{
        ...treeReading.root.children[0],
        access: { selected: true, projected: true },
      }],
    },
  });
  const lyingNode = lying.nodes.find((node) => node.ref === 'world:project:one');
  assert.equal(lyingNode.access.selected, true, 'the provider fact is carried verbatim');
  assert.equal(nodeIsFocused(lyingNode, {}), false, 'but it is not selection — focus is the kernel’s');
});

test('access facts are disclosed only as asserted, in the reading’s own vocabulary', () => {
  assert.deepEqual(ACCESS_FACTS, ['exists', 'readable', 'indexable', 'retrievable', 'selected', 'projected', 'public']);
  const source = buildWorldTreeModel(treeReading).nodes.find((node) => node.ref === 'world:project:one').sources[0];
  assert.deepEqual(accessFacts(source.access), ['exists', 'readable', 'retrievable']);
  assert.deepEqual(accessFacts(undefined), []);
  assert.deepEqual(accessFacts({ exists: false }), [], 'a false fact is omitted, not rendered as present');
});

test('the tree mints whole refs for the kernel, and never relations from kinds', () => {
  const model = buildWorldTreeModel(treeReading);
  const project = model.nodes.find((node) => node.ref === 'world:project:one');
  const nodeRef = subjectRefForNode(project);
  assert.deepEqual(nodeRef, {
    ref: 'world:project:one',
    kind: 'project',
    native_owner: 'central',
    provenance: { source: 'central:world' },
  });
  const sourceRef = subjectRefForSource(project.sources[0], project);
  assert.equal(sourceRef.ref, 'project/one/README.md');
  assert.equal(sourceRef.kind, 'world-source', 'the kind names what the ref addresses; routing stays with the kernel');
  assert.equal(sourceRef.native_owner, 'central');
});

test('a source’s project node is found by walking the composed Projection, not by parsing the ref', () => {
  const project = projectNodeForSource(treeReading, 'project/one/notes.md');
  assert.ok(project);
  assert.equal(project.ref, 'world:project:one');
  assert.equal(projectNodeForSource(treeReading, 'unrelated/ref'), null, 'a ref no node disclosed yields no advice');
});

test('the composition reading is presence as observed; capability descriptors are never presence', () => {
  const composition = buildCompositionModel({
    schema: 'oi.composition-reading/v1',
    condition: 'partial',
    constituents: [
      { native_owner: 'central', state: 'present', provider_class: 'live_provider', capabilities: ['cap/central'], detail: null },
      { native_owner: 'factory', state: 'degraded', provider_class: 'fixture', capabilities: ['cap/factory'], detail: 'fixture fallback' },
      { native_owner: 'ai-kit', state: 'absent', provider_class: 'unobserved', capabilities: ['cap/aikit', 'cap/aikit-2'] },
    ],
    warnings: [],
  });
  assert.ok(composition);
  assert.deepEqual(composition.counts, { present: 1, degraded: 1, absent: 1 });
  assert.equal(composition.constituents[2].state_word, 'absent');
  assert.deepEqual(composition.constituents[2].capabilities, ['cap/aikit', 'cap/aikit-2'], 'descriptors are carried as descriptors');
  assert.equal(buildCompositionModel({ schema: 'oi.world-tree/v1' }), null);
});

test('a write conflict is structured data, never mined from prose (K2 F-M4)', () => {
  const conflict = conflictFromFailure({
    reason: 'conflict',
    source_ref: 'project/one/README.md',
    expected_revision: 'r3',
    current_revision: 'r9',
  });
  assert.deepEqual(conflict, { source_ref: 'project/one/README.md', expected_revision: 'r3', current_revision: 'r9' });
  assert.equal(conflictFromFailure({ reason: 'denied', detail: 'no' }), null);
  assert.equal(conflictFromFailure(null), null);
  assert.deepEqual(failureReason({ reason: 'owner', detail: 'the owner refused' }), { reason: 'owner', detail: 'the owner refused' });
  assert.equal(failureReason({ reason: 'conflict' }), 'conflict');
});

test('a subject reading is rendered as what the owner served — an unserved reading is not content', () => {
  const served = buildSubjectModel({
    schema: 'oi.subject-reading/v1',
    subject: { ref: 'project/one/README.md', kind: 'world-source', native_owner: 'central', provenance: { source: 'central:world' } },
    access: { exists: true, readable: true, retrievable: true, selected: true },
    source: { ref: 'project/one/README.md', treatment: 'canonical', provenance: 'central', standing: 'current', agent_retrieval_allowed: true, access: { readable: true } },
    content: '# One\n',
    revision: 'r3',
    provider: { class: 'live_provider', seam: 'central', detail: null },
    warnings: [],
  });
  assert.ok(served);
  assert.equal(served.content, '# One\n');
  assert.equal(served.revision, 'r3');
  assert.deepEqual(served.access_facts, ['exists', 'readable', 'retrievable', 'selected']);

  const unserved = buildSubjectModel({
    schema: 'oi.subject-reading/v1',
    subject: { ref: 'project/one/README.md', kind: 'world-source', native_owner: 'central', provenance: { source: 'central:world' } },
    access: {},
    provider: { class: 'unobserved', seam: 'oi.world-tree/v1', detail: 'no current Project relation addresses this source' },
    warnings: ['focus carries no Project relation, so the source was not read (reading ≠ selection)'],
  });
  assert.ok(unserved);
  assert.equal(unserved.content, null, 'no content is invented for an unserved subject');
  assert.equal(unserved.provider.class, 'unobserved');
  assert.match(unserved.warnings[0], /reading ≠ selection/);
});

test('the focus relation narrows to the refs the tree compares', () => {
  assert.deepEqual(focusRefs(null), { world: null, project: null, subject: null });
  assert.deepEqual(
    focusRefs({ world: { ref: 'world:personal' }, subject: { ref: 'project/one/README.md' } }),
    { world: 'world:personal', project: null, subject: 'project/one/README.md' },
  );
});
