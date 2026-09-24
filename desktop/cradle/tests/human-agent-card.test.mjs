// HumanAgentCard renders oi.human-agent-card/v1 exactly as `oi agent card`
// derives it: every section, progressive expansion to exact refs, "How I
// orient" only when a Methodology is carried, and citizenship per dimension
// with unavailable dimensions visible (and naming their failing command),
// never hidden. The component is bundled from source with the app's own
// esbuild and rendered with React's server renderer — no DOM fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, rm} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const here = dirname(fileURLToPath(import.meta.url));
// Bundle beside the tests so the externals resolve from the cradle's node_modules.
const temp = await mkdtemp(join(here, '.human-agent-card-'));
await build({
  entryPoints: [join(here, '../src/agency/HumanAgentCard.tsx')],
  bundle: true, platform: 'node', format: 'esm', jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  outfile: join(temp, 'card.mjs'), logLevel: 'error',
});
const {HumanAgentCard} = await import(pathToFileURL(join(temp, 'card.mjs')));
test.after(() => rm(temp, {recursive: true, force: true}));

// Shape copied from a real `oi agent card --agent agent/oh-i --world project:Factory --json`
// on the development machine (2026-09-24), with AIKit's praxis command absent.
function card(overrides = {}) {
  return {
    schema: 'oi.human-agent-card/v1',
    identity: {name: 'agent/oh-i', agent_ref: 'agent/oh-i', profile_ref: 'profile/oh-i', revision: 'r1', refs: ['agent/oh-i', 'profile/oh-i@r1']},
    why_im_here: {text: 'Oh, I! — the native Central default agency for anyone\'s Central.', intent_expression: null, role: 'central-default-agency', refs: ['profile/oh-i@r1']},
    what_i_can_do: {state: 'unavailable', command: 'aikit --json praxis disclose --profile-json <agent-profile.read JSON>', text: 'Resolved repertoire is not readable here: AIKit\'s praxis disclosure is unavailable.', items: [], standing: 'authored-unresolved', refs: []},
    how_i_work: {text: 'Works by Gate review.', items: ['Gate review'], refs: ['method/ql/gate-review']},
    how_i_orient: null,
    what_i_carry: {text: 'Carries skill-set/aletheia-gates.', skill_sets: [{ref: 'skill-set/aletheia-gates', resolved: true, members: 3, withheld: 0}], refs: ['skill-set/aletheia-gates@rev-1']},
    where_i_participate: {text: 'Holds central:position:project:Factory:factory-sensing-guardian in project:Factory.', world_ref: 'project:Factory', home_world_ref: 'control:root', other_worlds: ['control:root'], positions: {occupied: ['central:position:project:Factory:factory-sensing-guardian'], eligible: []}, refs: ['project:Factory', 'central:position:project:Factory:factory-sensing-guardian']},
    citizenship: {
      summary: '2 established · 4 partial · 2 absent · 3 unavailable in project:Factory',
      dimensions: {
        residence: {state: 'partial', reading: 'project:Factory inherits control:root.', basis: ['profile/oh-i@r1', 'control:root']},
        role: {state: 'established', reading: 'Holds 1 Position(s) in project:Factory.', basis: ['actuation:generation:18b44fdf-df44-43df-b660-591ca4623b26']},
        repertoire: {state: 'unavailable', reading: 'The AIKit praxis disclosure could not be read.', basis: [], command: 'aikit --json praxis disclose --profile-json <agent-profile.read JSON>'},
        reach: {state: 'unavailable', reading: 'The AIKit praxis disclosure could not be read.', basis: [], command: 'aikit --json praxis disclose --profile-json <agent-profile.read JSON>'},
        authority: {state: 'partial', reading: 'Acts through a bound Agency.', basis: ['agency:factory-sensing:project-Factory:199']},
        relation: {state: 'absent', reading: 'No other occupant in project:Factory.', basis: []},
        contribution: {state: 'partial', reading: '2 work item(s) in custody, none completed yet.', basis: ['factory:custody:01a0d2e7-2666-7226-a8d0-4eb04ca2c2be']},
        reciprocity: {state: 'partial', reading: 'Carries work whose Return has not closed yet.', basis: []},
        reliability: {state: 'unavailable', reading: 'The AIKit praxis disclosure could not be read.', basis: [], command: 'aikit --json praxis disclose --profile-json <agent-profile.read JSON>'},
        recognition: {state: 'absent', reading: 'Not accepted; the profile stands as unrecognised.', basis: ['profile/oh-i@r1']},
        continuity: {state: 'established', reading: 'Holds its Position across more than one tenure generation.', basis: ['actuation:generation:18b44fdf-df44-43df-b660-591ca4623b26']},
      },
      refs: [],
    },
    currently: {text: 'unreported in central:position:project:Factory:factory-sensing-guardian; 1 work item(s) in progress.', refs: ['factory:custody:01a0d2e7-2666-7226-a8d0-4eb04ca2c2be']},
    public: {capabilities: [], basis: 'none-declared', refs: []},
    ...overrides,
  };
}
const render = (value) => renderToStaticMarkup(createElement(HumanAgentCard, {card: value}));

test('renders every card section with its plain line', () => {
  const html = render(card());
  for (const title of ["Why I&#x27;m here", 'What I can do', 'How I work', 'What I carry', 'Where I participate', 'Citizenship', 'Currently', 'Publicly disclosed']) {
    assert.ok(html.includes(title), title);
  }
  assert.ok(html.includes('Oh, I! — the native Central default agency'));
  assert.ok(html.includes('2 established · 4 partial · 2 absent · 3 unavailable in project:Factory'));
});

test('expands progressively to exact refs and revisions', () => {
  const html = render(card());
  assert.ok(html.includes('profile/oh-i@r1'));
  assert.ok(html.includes('skill-set/aletheia-gates@rev-1'));
  assert.ok(html.includes('<summary>Exact refs</summary>'));
  assert.ok(html.includes('factory:custody:01a0d2e7-2666-7226-a8d0-4eb04ca2c2be'));
});

test('hides How I orient when no Methodology is carried, shows it when one is', () => {
  assert.equal(render(card()).includes('How I orient'), false);
  const html = render(card({how_i_orient: {text: 'Orients through Sixfold orientation.', items: ['Sixfold orientation'], refs: ['methodology/ql/sixfold']}}));
  assert.ok(html.includes('How I orient'));
  assert.ok(html.includes('methodology/ql/sixfold'));
});

test('shows every citizenship dimension with its state', () => {
  const html = render(card());
  const names = ['residence', 'role', 'repertoire', 'reach', 'authority', 'relation', 'contribution', 'reciprocity', 'reliability', 'recognition', 'continuity'];
  for (const name of names) assert.ok(html.includes(`>${name}</span>`), name);
  assert.equal((html.match(/data-state="established"/g) ?? []).length, 2);
  assert.equal((html.match(/data-state="partial"/g) ?? []).length, 4);
  assert.equal((html.match(/data-state="absent"/g) ?? []).length, 2);
  assert.ok(!/score/i.test(html), 'no scalar citizenship');
});

test('unavailable dimensions stay visible as unavailable and name the failing command', () => {
  const html = render(card());
  assert.equal((html.match(/data-state="unavailable"/g) ?? []).length, 3);
  assert.ok(html.includes('aikit --json praxis disclose --profile-json &lt;agent-profile.read JSON&gt;'));
  // An unavailable field is labelled as such, not silently blank.
  assert.ok(/What I can do<span class="oi-state"> Unavailable<\/span>/.test(html));
  // A dimension missing from the reading is shown as unavailable, not dropped.
  const partial = card();
  delete partial.citizenship.dimensions.continuity;
  const shown = render(partial);
  assert.ok(shown.includes('>continuity</span>'));
  assert.equal((shown.match(/data-state="unavailable"/g) ?? []).length, 4);
});

test('public section carries only publicly disclosed capabilities', () => {
  const internal = render(card());
  assert.ok(internal.includes('Nothing is publicly disclosed (none-declared)'));
  const html = render(card({public: {capabilities: [{id: 'skill/ql/aletheia-ql-gate', name: 'QL gate'}], basis: 'profile-declared', refs: ['skill/ql/aletheia-ql-gate']}}));
  const publicSection = html.slice(html.indexOf('aria-label="Public disclosure"'));
  assert.ok(publicSection.includes('skill/ql/aletheia-ql-gate'));
  assert.ok(!publicSection.includes('aletheia-internal-ledger'));
});
