import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const surface = readFileSync(new URL('./authored-relations.tsx', import.meta.url), 'utf8');
const composition = readFileSync(new URL('./project-field.tsx', import.meta.url), 'utf8');
const core = readFileSync(new URL('../../core/src/project_knowledge.rs', import.meta.url), 'utf8');
const fixture = JSON.parse(readFileSync(new URL('../../../suite/fixtures/authored-wiki-relations-150.json', import.meta.url), 'utf8'));

test('ordinary source fixture carries wikilink, Markdown link, typed metadata, backlink and unresolved evidence', () => {
  const edges = fixture.relations.authored_edges;
  assert.ok(edges.some((edge) => edge.authored_relation.raw_token === '[[Living Wiki]]'));
  assert.ok(edges.some((edge) => edge.authored_relation.raw_token === '[AgentSession](AgentSession.md)'));
  assert.ok(edges.some((edge) => edge.authored_relation.channel === 'metadata' && edge.authored_relation.anchor.field_path === 'relations.develops[0]'));
  assert.ok(edges.some((edge) => edge.to_ref === fixture.relations.authored.subject_ref && edge.from_ref === 'source:other'));
  assert.equal(fixture.relations.authored.pending[0].evidence.resolution.state, 'unresolved');
  assert.equal(fixture.relations.authored.automatic_agent_or_model_invocation, false);
});

test('Flow fixture remains ordinary retained prose without frontmatter capture', () => {
  assert.equal(fixture.flow_source.frontmatter_required, false);
  assert.equal(fixture.flow_source.relative_path, 'notes/live-thread.md');
  assert.match(fixture.flow_source.body, /\[\[Living Wiki\]\]/);
  assert.match(fixture.flow_source.body, /\[AgentSession\]\(AgentSession\.md\)/);
});

test('workbench consumes native relation state and follows the same stable selection', () => {
  assert.match(composition, /AuthoredRelationsWorkbench selection=\{props\.selection\} onSelect=\{props\.onSelect\}/);
  assert.match(surface, /knowledge_relations/);
  assert.match(surface, /authored_edges/);
  assert.match(surface, /authored\.pending/);
  assert.match(surface, /edge\.from_ref === focus/);
  assert.match(surface, /edge\.to_ref === focus/);
  assert.match(surface, /await onSelect\(/);
  assert.match(surface, /AIKit authored relation/);
  assert.match(surface, /Living Wiki · authored topology/);
  assert.match(surface, /automatic Agent\/model invocation/);
});

test('relation Explain disclosure keeps owner token, channel, source revision and anchor', () => {
  assert.match(surface, /Authored token/);
  assert.match(surface, /evidence\?\.raw_token/);
  assert.match(surface, /evidence\?\.source_ref/);
  assert.match(surface, /sourceRevision\(edge\)/);
  assert.match(surface, /anchorLabel/);
  assert.match(surface, /field_path/);
  assert.match(surface, /start_byte/);
  assert.match(surface, /source_authority/);
  assert.match(core, /AuthoredWikiSubjectRelations/);
});

test('renderer surface owns no Markdown parser, resolver, backlink store or Agent call', () => {
  for (const forbidden of [
    'parse_authored_wiki_source',
    'compile_authored_wiki_relations',
    'rebuild_semantic_wiki_with_authored_relations',
    'SemanticWikiIndex',
    'invoke_agent',
    'invoke_model',
  ]) assert.equal(surface.includes(forbidden), false, forbidden);
  assert.equal(/useState<.*Wiki.*Index/.test(surface), false);
});
