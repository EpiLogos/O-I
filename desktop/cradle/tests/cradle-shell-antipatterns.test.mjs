/**
 * Shell UX antipatterns the owner named on the cradle consolidation branch:
 * system-explanation dumps, duplicate Graph/Wiki, scope monogram chrome,
 * splash z-index under portaled menus, a second agent picker beside Agents,
 * Central Context copying the centre pane canvas, Automations/git adverts
 * outside their real homes.
 *
 * Run: node --test tests/cradle-shell-antipatterns.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(join(root, 'src', rel), 'utf8');
const css = (rel) => readFileSync(join(root, 'src', rel), 'utf8');

test('World navigator does not dump a Daily ground system-explanation panel', () => {
  const body = src('surfaces/navigator/WorldNavigator.tsx');
  assert.doesNotMatch(body, /Daily ground/);
  assert.doesNotMatch(body, /CentralGround/);
  assert.doesNotMatch(body, /left-central-ground/);
});

test('Rest page offers Graph once, never a duplicate Open wiki or filler instruction copy', () => {
  const body = src('Rest.tsx');
  assert.doesNotMatch(body, /Start a draft, find a source/);
  assert.doesNotMatch(body, /<span>Open wiki<\/span>/);
  assert.doesNotMatch(body, /\bonWiki\b/);
  assert.match(body, /<span>Graph<\/span>/);
  assert.match(body, /Start writing/);
  const fresh = src('flow/FreshSurface.tsx');
  assert.doesNotMatch(fresh, /Write something new, find a source/);
  const frame = src('CradleFrame.tsx');
  assert.doesNotMatch(frame, /<Rest[\s\S]*\bonWiki=/);
});

test('scope selector shows the name without a monogram tile, and Central uses the home glyph', () => {
  const body = src('workspace/left/LeftFrame.tsx');
  assert.doesNotMatch(body, /left-scope-tile/);
  assert.doesNotMatch(body, />C</);
  assert.match(body, /Glyph name="home"/);
  assert.doesNotMatch(body, /openAutomations/);
  assert.doesNotMatch(css('workspace/left/left.css'), /\.left-scope-tile/);
});

test('opening splash stacks above portaled popovers so the scope menu cannot bleed through', () => {
  const welcome = css('visuals/welcome.css');
  assert.match(welcome, /z-index:\s*calc\(var\(--oi-z-popover\)\s*\+\s*1\)/);
  assert.doesNotMatch(welcome, /oi-z-stage-frontstate/);
});

test('right panel presence opens Agents; it is not a roster picker', () => {
  const avatar = src('agent/panel/AvatarMenu.tsx');
  assert.match(avatar, /export function AvatarPresence/);
  assert.doesNotMatch(avatar, /avatar-menu-list/);
  assert.doesNotMatch(avatar, /menuitemradio/);
  assert.doesNotMatch(avatar, /onChoose/);
  assert.doesNotMatch(avatar, /Working with you|Guardians/);
  assert.match(avatar, /onOpenAgents/);
  assert.match(avatar, /Open Agents/);
  const layer = src('agent/AgentLayer.tsx');
  assert.match(layer, /AvatarPresence/);
  assert.match(layer, /onOpenAgents/);
  assert.doesNotMatch(layer, /<AvatarMenu\b/);
});

test('Central mode Context is prepared-context, not a second pane canvas', () => {
  const bodies = src('workspace/modeBodies.tsx');
  assert.match(bodies, /export function PreparedContextMount/);
  assert.match(bodies, /if \(mode === "base" \|\| mode === "epi-logos"\) \{\s*return \[\{id: "context", label: "Context", body: <PreparedContextMount/);
  assert.match(bodies, /mode === "factory"[\s\S]*ContextPaneMount/);
  assert.doesNotMatch(bodies, /mode === "base"[\s\S]{0,200}ContextPaneMount/);
});

test('Context canvas no longer advertises git status or Automations', () => {
  const body = src('agent/panel/ContextCanvas.tsx');
  assert.doesNotMatch(body, /RepositoryContext/);
  assert.doesNotMatch(body, /openAutomations/);
  assert.doesNotMatch(body, />Automations</);
  assert.match(body, /PreparedContextView/);
});

test('Automations live on the Activity tab, not the left foot', () => {
  const activity = src('agent/panel/ActivityTab.tsx');
  assert.match(activity, /openAutomations/);
  assert.match(activity, /Automations/);
  const foot = src('workspace/left/LeftFrame.tsx');
  assert.doesNotMatch(foot, /Automations/);
});

test('left and right side planes stay glass — no solid sidebar ground slab', () => {
  const shell = css('workspace/shell.css');
  const panel = css('workspace/primitives/primitives.css');
  assert.match(shell, /\.desktop-side\.left\.depth-panel[\s\S]{0,120}background:\s*transparent/);
  assert.match(shell, /\.desktop-side\.right\.depth-panel[\s\S]{0,160}background:\s*transparent/);
  assert.match(panel, /\.panel-shell[^{]*\{[^}]*background:\s*transparent/);
  assert.doesNotMatch(shell, /background:\s*linear-gradient\([^)]*var\(--oi-sidebar-ground\)[^)]*var\(--desktop-left-width\)/);
  assert.match(shell, /--oi-sidebar-ground-glass/);
});

test('primary surfaces render no raw JSON where a person reads (DESKTOP-LANGUAGE ruling 2)', () => {
  // The payload-presentation repair (2026-09-25): every former dump is a real
  // component now, and the verbatim owner material sits only behind an
  // explicit collapsed disclosure — shared idiom in contributionPresentation.
  const shared = src('shared/contributionPresentation.tsx');
  assert.match(shared, /<details className="oi-disclosure" data-show-raw>/);
  const collapsed = (rel, marker) => {
    const body = src(rel);
    assert.doesNotMatch(body, marker, `${rel} still renders the old raw dump`);
  };
  collapsed('knowledge/SearchOverlay.tsx', /details className="search-evidence" open/);
  collapsed('knowledge/OwnerActions.tsx', /<pre>\{JSON\.stringify\(outcome\.data/);
  collapsed('explore/BeingEncounter.tsx', /JSON\.stringify\(change\)/);
  collapsed('explore/BeingEncounter.tsx', /being-invocation-result" open/);
  collapsed('explore/ContributionPanel.tsx', /JSON\.stringify\(body\.content\)/);
  collapsed('explore/ContextContributionPanel.tsx', /JSON\.stringify\(body\.content\)/);
  collapsed('agency/MintAgent.tsx', /JSON\.stringify\(entry\.current\)/);
  collapsed('nara/NaraSurface.tsx', /JSON\.stringify\(row\.enrichment_receipt\["currentness"\]\)/);
});

test('the world context is the one world owner; the arrangement carries no copy', () => {
  const types = src('surface/types.ts');
  assert.doesNotMatch(types, /epiLogos\?: boolean/, 'the retired LayoutState.epiLogos copy must not return');
  const persist = src('surface/persist.ts');
  assert.doesNotMatch(persist, /epiLogos: parsed\.epiLogos/);
  const frame = src('CradleFrame.tsx');
  assert.doesNotMatch(frame, /epiLogos: true\}\)\;/);
  assert.doesNotMatch(frame, /epiLogos=\{state\.epiLogos/);
});
