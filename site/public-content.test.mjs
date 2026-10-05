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

test('the home says what Objective Internality is, holds the six facets with their products, then the Cradle and the essay', () => {
  const home = source.slice(source.indexOf('# [home] '), source.indexOf('\n# [oi] '));
  const order = [...home.matchAll(/^## \[([a-z0-9-]+)\] /gm)].map(match => match[1]);
  assert.deepEqual(order, ['hero', 'reading', 'what', 'cradle', 'essay', 'return']);
  const oi = sectionBody('home', 'what');
  assert.match(oi, /^## \[what\] What is O:I$/m);
  assert.match(oi, /^### \[title\] The world an agent acts from\.$/m);
  assert.match(oi, /^O:I stands for Objective : Internality: the means through which a life knows and acts within a world\./m);
  assert.match(oi, /^An AI agent acts from such a world too, and it has six facets\./m);
  assert.match(oi, /treat these facets as implicit, or bolt them on one at a time as features/);
  assert.match(oi, /O:I differentiates them, giving each its own tool, its own records and its own contracts/);
  assert.doesNotMatch(oi, /capable model|harness before the harness|Central|Actuation|AIKit|Workcell/);
  // The facets and their products are one component: the facts that framed the old products section stay with it.
  assert.match(oi, /^### \[facets\] /m);
  assert.match(oi, /command-line tool and libraries in its own repository, usable alone or together, meeting the others through versioned contracts rather than a shared runtime/);
  assert.match(oi, /All six are in use and still developing/);
  assert.match(oi, /^### \[readme\] O:I README on GitHub\n\nhttps:\/\/github\.com\/EpiLogos\/O-I#readme$/m);
  assert.ok(oi.slice(oi.indexOf('### [facets]')).includes('O:I README on GitHub gives their current state'));
  const cradle = sectionBody('home', 'cradle');
  assert.match(cradle, /^### \[title\] Before the harness\.$/m);
  assert.match(cradle, /bootstraps the agent’s world as such/);
  assert.match(cradle, /one situation that any harness can then act within/);
  assert.match(cradle, /The Cradle is being built now\./);
  assert.ok(cradle.split(/\n\n/).filter(p => p && !p.startsWith('#')).length <= 2, 'the Cradle runs to two paragraphs at most');
  const what = sectionBody('home', 'essay');
  assert.match(what, /^## \[essay\] The essay$/m);
  assert.match(what, /^### \[title\] An essay on what knows, and the means through which it knows\.$/m);
  assert.match(what, /^\*Confronting the Limit: Determination, Subjectivity and Mind as Objective Internality\*/m);
  assert.match(what, /Its foundation, §0\/1 “The Integral Threshold”, is submitted to \*Agentworld\*, the special issue of \*Antikythera\*/);
  const ret = sectionBody('home', 'return');
  assert.match(ret, /^## \[return\] A steward of relations$/m);
  assert.match(ret, /The essay was written with AI agents/);
  assert.match(sectionBody('oi', 'name'), /constituted means through which a Life encounters and acts within a World/);
  assert.match(sectionBody('shared-field', 'intro'), /^### \[title\] A world, defined for agents\.$/m);
  assert.match(sectionBody('shared-field', 'co-internality'), /legibility without capture/);
});

test('each facet is held by one product with its line, command and repository', () => {
  const facets = [
    ['central', 'Ground', 'ctrl', 'https://github.com/EpiLogos/Central', /ordinary files and changed through named actions/],
    ['actuation', 'Agency', 'actuation', 'https://github.com/EpiLogos/Actuation', /on whose authority and within what bounds, with a record of what each act did/],
    ['aikit', 'Capability', 'aikit', 'https://github.com/EpiLogos/ai-kit', /installed into the harness already in use/],
    ['factory', 'Development', 'factory', 'https://github.com/EpiLogos/Factory', /runs, attempts and evidence, and the judgement/],
    ['workcell', 'Environment', 'workcell', 'https://github.com/EpiLogos/Workcell', /made real on request, with a record of what was provided/],
    ['ql', 'Reflection', 'ql', 'https://github.com/EpiLogos/QL-MEF', /what shaped an act and what should change, built as typed operations with the Meta-Epistemic Framework/],
  ];
  for (const [id, role, cli, repo, line] of facets) {
    const body = sectionBody('products', id);
    const roleBlock = body.slice(body.indexOf('### [role] '), body.indexOf('### [cli] '));
    assert.match(roleBlock, new RegExp(`^### \\[role\\] ${role}\\n\\n[^\\n#]{40,170}\\n`, 'm'), `${id}: role and one line`);
    assert.match(roleBlock, line, `${id}: facet line`);
    assert.match(body, new RegExp(`^### \\[cli\\] ${cli}$`, 'm'), `${id}: cli`);
    assert.match(body, new RegExp(`^### \\[repo\\] [^\\n]+\\n\\n${repo.replace(/[.]/g, '\\.')}$`, 'm'), `${id}: repo`);
  }
});

test('each product carries its facet role and truthful local installation does not imply publication or verification', () => {
  for (const [id, role] of [['central', 'Ground'], ['actuation', 'Agency'], ['aikit', 'Capability'], ['factory', 'Development'], ['workcell', 'Environment'], ['ql', 'Reflection']]) {
    assert.match(sectionBody('products', id), new RegExp(`^### \\[role\\] ${role}$`, 'm'), id);
  }
  assert.match(sectionBody('products', 'central'), /root meta-project/);
  const build = sectionBody('build', 'intro');
  assert.match(build, /immutable released artifacts from the current native-source suite/);
  assert.match(build, /npm registry command is not a verified distribution/);
  assert.match(build, /oi update --check/);
  assert.match(build, /successful build, an installed product and a verified human experience remain different claims/);
  assert.match(sectionBody('build', 'links'), /INSTALL-UPDATE-FLOW\.md/);
});

test('the home reads through the essay alone and points to O:I on GitHub', () => {
  const reading = sectionBody('home', 'reading');
  assert.doesNotMatch(reading, /^### \[library\] /m, 'the Library is not a home reading entrance');
  assert.match(reading, /^### \[essay\] Essay$/m);
  assert.match(reading, /^Begin with the foundation, §0\/1, or enter the field of its arguments and sources\.$/m);
  assert.match(reading, /^### \[github\] O:I on GitHub\n\nhttps:\/\/github\.com\/EpiLogos\/O-I$/m);
  assert.doesNotMatch(source.slice(source.indexOf('# [home] '), source.indexOf('\n# [oi] ')), /Enter a product below|An open Library|A living field|capable model|The means can become a question|^## \[(existing-world|field|shared|build|centres)\] /m);
});

test('O:I keeps its authored brand and the essay carries its full authored title', () => {
  assert.match(source, /^### \[title\] Objective : Internality$/m);
  assert.doesNotMatch(source, /^#{1,4} (?!\[essay-title\]).*Objective Internality[.]*$/m);
  assert.match(source, /^### \[essay-title\] Confronting the Limit: Determination, Subjectivity and Mind as Objective Internality\.$/m);
});

test('vite emits the structured public pages without replacing Explore', () => {
  for (const entry of ['index.html', 'oi.html', 'products.html', 'shared-field.html', 'research.html', 'build.html', 'explore.html']) {
    assert.match(viteConfig, new RegExp(entry.replace('.', '\\.')));
  }
});
