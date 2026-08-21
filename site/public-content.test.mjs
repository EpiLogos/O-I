import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./content/public-site.md', import.meta.url), 'utf8');
const foundingPositions = readFileSync(new URL('../docs/positions/FOUNDING-POSITIONS.md', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('./vite.config.ts', import.meta.url), 'utf8');

function hasHeading(level, id) {
  const marks = '#'.repeat(level);
  return new RegExp(`^${marks} \\[${id}\\] `, 'm').test(source);
}

function sectionBody(pageId, sectionId) {
  const pageStart = source.search(new RegExp(`^# \\[${pageId}\\] `, 'm'));
  assert.notEqual(pageStart, -1, `missing page ${pageId}`);
  const nextPage = source.slice(pageStart + 1).search(/^# \[[a-z0-9-]+\] /m);
  const page = nextPage === -1 ? source.slice(pageStart) : source.slice(pageStart, pageStart + 1 + nextPage);
  const sectionStart = page.search(new RegExp(`^## \\[${sectionId}\\] `, 'm'));
  assert.notEqual(sectionStart, -1, `missing section ${pageId}/${sectionId}`);
  const nextSection = page.slice(sectionStart + 1).search(/^## \[[a-z0-9-]+\] /m);
  return nextSection === -1 ? page.slice(sectionStart) : page.slice(sectionStart, sectionStart + 1 + nextSection);
}

test('public site markdown contains every routed page', () => {
  for (const page of ['home', 'oi', 'products', 'shared-field', 'research', 'build']) {
    assert.equal(hasHeading(1, page), true, `missing [${page}] page heading`);
  }
});

test('product sections expose the renderer contract', () => {
  for (const product of ['central', 'actuation', 'aikit', 'factory', 'workcell', 'ql']) {
    const body = sectionBody('products', product);
    for (const field of ['summary', 'lede', 'what', 'why', 'change', 'capabilities', 'repo']) {
      assert.match(body, new RegExp(`^### \\[${field}\\] `, 'm'), `${product} missing ${field}`);
    }
  }
});

test('research page represents the wider programme and keeps QL as one deeper surface', () => {
  for (const section of ['object', 'human-authorship', 'method', 'programme', 'ql', 'open']) {
    sectionBody('research', section);
  }
  assert.match(sectionBody('research', 'method'), /^### \[cycle\] Discover → Source-lock → Study →/m);
  assert.match(sectionBody('research', 'programme'), /Human authorship and operative orientation/);
  assert.match(sectionBody('research', 'programme'), /Personal and project worlds/);
  assert.match(sectionBody('research', 'programme'), /Community extensions/);
  assert.match(sectionBody('research', 'ql'), /A deeper formal research programme/);
});

test('human authorship remains a developed provenance relation, not generic personalisation', () => {
  const human = sectionBody('oi', 'human-agency');
  assert.match(human, /human authorship → durable source → selective operative use → action and encounter → returned evidence → human Recognition and revision/);
  assert.match(human, /Generated interpretation is not authored source/);
  assert.match(human, /Retrieval is not permission/);

  const central = sectionBody('products', 'central');
  assert.match(central, /authored source/);
  assert.match(central, /observed state/);
  assert.match(central, /generated material/);
  assert.match(central, /Natural prose is first-class/);
  assert.match(central, /human acceptance/);

  const research = sectionBody('research', 'human-authorship');
  assert.match(research, /Where should the human enter an agentic system/);
  assert.match(research, /smallest relevant part of durable ground/);
  assert.match(research, /repeated prompting and micromanagement/);
  assert.match(research, /hold the model, task and tools approximately constant/);
});

test('collective extension is represented as a research method, not generic extensibility', () => {
  const collective = sectionBody('research', 'open');
  assert.match(collective, /Community development is part of the research method/);
  assert.match(collective, /SDK \/ public contract/);
  assert.match(collective, /Fixture \+ evidence/);
  assert.match(collective, /Reproduce and adapt/);
  assert.match(collective, /Return/);
  assert.match(sectionBody('products', 'intro'), /abstractions are the durable root/);
});

test('founding positions carry the same positive world, authorship and collective research commitments', () => {
  assert.match(foundingPositions, /^## 1 — Agency is constituted through model capacity in relation with a World$/m);
  assert.match(foundingPositions, /^## 2 — Existing technological Worlds are legitimate starting Worlds$/m);
  assert.match(foundingPositions, /^## 4 — Increasing artificial agency should return more room for human agency$/m);
  assert.match(foundingPositions, /^## 5 — Agentic engineering is an open, collective research field$/m);
  assert.match(foundingPositions, /human authorship[\s\S]*durable authored source[\s\S]*selective derivation \/ retrieval \/ disclosure[\s\S]*human Recognition \/ accepted revision/);
  assert.match(foundingPositions, /Generated interpretation is not authored source/);
  assert.match(foundingPositions, /Human authorship is itself an agency variable/);
  assert.match(foundingPositions, /stable abstraction[\s\S]*native SDK \/ public contract[\s\S]*fixture \+ verification[\s\S]*Return to product and research/);
});

test('first-contact copy carries the world-making proposition and local-to-shared movement', () => {
  assert.match(sectionBody('home', 'what'), /^### \[title\] O:I maps what it means for an AI agent to have a world\.$/m);
  assert.match(sectionBody('home', 'existing-world'), /^### \[title\] Start where you are\.$/m);
  assert.match(sectionBody('home', 'existing-world'), /principles, preferences, project purposes, rules and ways of working/i);
  assert.match(sectionBody('home', 'field'), /Minimal O:I: durable ground \+ actuated model capacity/);
  assert.match(sectionBody('home', 'centres'), /mapping what constitutes having-a-world for an AI agent/);
  assert.match(sectionBody('home', 'shared'), /local agent world → selective Projection → Shared Field → encounter by another world/);
  assert.match(sectionBody('shared-field', 'intro'), /^### \[title\] A world, defined for agents\.$/m);
  assert.match(sectionBody('shared-field', 'co-internality'), /legibility without capture/);
});

test('Objective : Internality is the authored title form', () => {
  assert.match(source, /^### \[title\] Objective : Internality$/m);
  assert.doesNotMatch(source, /^#{1,4} .*Objective Internality[.]*$/m);
});

test('vite emits the structured public pages without replacing Explore', () => {
  for (const entry of ['index.html', 'oi.html', 'products.html', 'shared-field.html', 'research.html', 'build.html', 'explore.html']) {
    assert.match(viteConfig, new RegExp(entry.replace('.', '\\.')));
  }
});