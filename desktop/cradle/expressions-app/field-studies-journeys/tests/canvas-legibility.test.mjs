import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {icon} from '../build/icons.js';

// D3 — the canvas tool row is icon-led (techne-expression-mode.md §13, thin
// 24×24 icon language; Consolidation §4 icon-only chrome). Every new glyph
// this repair added must resolve to its own real <path>, not silently fall
// back to the shared 'formation' glyph reserved for an unknown name.
test('new tool icons resolve to their own distinct 24×24 thin-stroke glyph', () => {
 const fallback = icon('__unknown-name-not-in-the-table__');
 for (const name of ['pen', 'lasso', 'distributeH', 'distributeV']) {
  const markup = icon(name);
  assert.match(markup, /^<svg viewBox="0 0 24 24"/, `${name} renders a 24×24 svg`);
  assert.match(markup, /<path d="[^"]+"\/>/, `${name} carries a real path`);
  assert.notEqual(markup, fallback, `${name} is a real entry, not the 'formation' fallback`);
 }
 // Icons D3 reuses for existing tools still resolve (regression: a rename
 // or removal in icons.ts would silently blank a button).
 for (const name of ['text', 'camera', 'save', 'grid', 'options', 'frame']) {
  assert.notEqual(icon(name), fallback, `${name} still resolves to its own glyph`);
 }
});

const readSrc = async (name) => readFile(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), 'utf8');

// D3 — the canvas tool row must actually have stopped being text-led: this
// pins the repair so a later edit cannot quietly revert the row to bare
// text without a test noticing. Behaviour (aria-label/title carrying the
// exact prior visible text, aria-pressed state, onClick wiring) is
// unit-tested nowhere else in this suite because `controls` is only ever
// assembled inside the live `installResearchInstruments` closure; this is
// therefore a source-contract check, not a DOM render.
test('canvas tool row is icon-led with the prior text preserved as aria-label/title', async () => {
 const src = await readSrc('researchInstruments.tsx');
 const controlsStart = src.indexOf('const controls=');
 assert.ok(controlsStart > -1, 'the controls block still exists');
 const controlsEnd = src.indexOf('const edgeId=', controlsStart);
 // The rail row and the Studio's Canvas section together are the Canvas tools.
 const controls = src.slice(controlsStart, controlsEnd);
 const studioStart = src.indexOf('const canvasStudio=');
 assert.ok(studioStart > controlsStart && studioStart < controlsEnd, 'Canvas views/frames/source focus live in the Studio section');
 const rail = src.slice(controlsStart, studioStart);
 for (const select of ['Focus disclosed source', 'Frames', 'Saved views']) assert.doesNotMatch(rail, new RegExp(`aria-label="${select}"`), `${select} is not a drop-down in the rail`);
 // The old bare text-led buttons must be gone …
 for (const bareText of ['>Note<', '>Image<', '>Draw<', '>Save view<', '>Snap<', '>Lasso<', '>Save view as…<', '>Inspector<', '>Distribute ↔<', '>Distribute ↕<', '>Frame selection<']) {
  assert.doesNotMatch(rail, new RegExp(bareText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${bareText} is no longer a bare-text button label`);
 }
 // … and every one of them must still carry its exact old text as an
 // accessible name, so aria semantics and hover discovery are unchanged.
 for (const label of ['Note', 'Image', 'Draw', 'Save view', 'Snap', 'Lasso', 'Save view as…', 'Frame selection', 'Distribute ↔', 'Distribute ↕']) {
  assert.match(controls + src.slice(controlsEnd, controlsEnd + 400), new RegExp(`aria-label="${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), `${label} still has an aria-label`);
 }
 // The node/connection card follows the selection (owner commission §6: an
 // anchor click opens the compact information surface) — there is no
 // separate toggle button that could leave it detached from the selection.
 assert.doesNotMatch(controls, /Toggle canvas inspector/, 'no detached inspector toggle');
 // Acts on the selected node live in its card, not the tool rail.
 const card = src.slice(src.indexOf('const inspector=<div className="research-inspector-content"'), src.indexOf('return <>{createPortal(controls'));
 assert.doesNotMatch(rail, /Edit object|ConstellationAction/, 'node acts are not rail tools');
 assert.match(card, />Edit object</, 'Edit object is in the node card');
 assert.match(card, /<ConstellationAction /, 'constellation editing is in the node card');
 assert.match(src, /const inspecting=!!cardFor&&cardFor!==dismissedCard;/, 'the card is derived from the current node or connection selection');
 // Source…, Frames, Saved views, Align selection stay compact selects.
 for (const select of ['Focus disclosed source', 'Frames', 'Saved views', 'Align selection']) {
  assert.match(controls, new RegExp(`aria-label="${select}"[^>]*>|<select aria-label="${select}"`), `${select} is still offered as a select`);
 }
});

// D2 — compact circular graph anchors carry their title outside the circle,
// never clipped inside it (techne-expression-mode.md §13). The circle must
// come from a flat background + border-radius, not overflow:hidden — that
// same overflow:hidden would also clip the label positioned below it.
test('resource-node anchor CSS clips nothing that would hide the title label', async () => {
 const css = await readSrc('researchInstruments.css');
 assert.match(css, /\.research-canvas-native \.react-flow__node-resource\{overflow:visible\}/, 'the node box no longer clips its own label');
 assert.doesNotMatch(css, /\.research-canvas-native \.react-flow__node-resource\{border-radius:50%;overflow:hidden\}/, 'the old clip-to-circle-and-hide-the-label rule is gone');
 assert.match(css, /\.knowledge-card__title\{[^}]*position:absolute/, 'the title is taken out of normal flow to sit outside the circle');
 assert.match(css, /:hover \.knowledge-card__title,[\s\S]{0,80}:focus-within \.knowledge-card__title/, 'the full title is reachable on hover/focus, not only ellipsised');
});
