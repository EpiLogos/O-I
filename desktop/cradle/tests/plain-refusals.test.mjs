// A refusal speaks plainly (packages/oi-design-system/DESKTOP-LANGUAGE.md ruling 2; DLW.md §16.14 "When a device is done"; the
// 22 Oct screen pass S1-67). Where a person reads, a failure says what happened in plain words, and what they can do; the
// owner's own words stand beside it when they are plain words; the raw cause (a thrown error, a path, an owner code, JSON) sits
// behind a "Why" disclosure, never in the main line. The one pattern is shared/Refusal.tsx: `Refusal` for a block, and
// `refusalWords` for a line that cannot hold a disclosure (a workspace message, a strip, a live region).
//
// Two holds:
//  1. The reader (plainReason / refusalDetail) and the block, on the owner's real refusals.
//  2. A ratchet over the product (every .ts/.tsx under desktop/cradle/src and packages/live-shell/ui/src that the candidate
//     loads, scripts/candidate-reachable.mjs): no JSX child and no workspace message carries a raw error (an Error, its
//     message, a caught value, an owner refusal or code) except through the pattern or behind <details>. The swept surfaces
//     carry none; every other product file holds at most its recorded count (CEILING), which only goes down.
// Channels: SCRIPTED (the reader and the block rendered on the server; the ratchet reads the source). Not a screen pass.
//
//   PLAIN_REFUSALS_LIST=1 node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/plain-refusals.test.mjs
//   prints every raw site the ratchet finds, file by file.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, rm} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const here = dirname(fileURLToPath(import.meta.url));
const ts = createRequire(import.meta.url)('typescript');
const {reachable, repo} = await import(pathToFileURL(join(here, '../../../packages/live-shell/ui/scripts/candidate-reachable.mjs')));

const temp = await mkdtemp(join(here, '.plain-refusals-'));
test.after(() => rm(temp, {recursive: true, force: true}));
await build({
  entryPoints: {refusal: join(here, '../src/shared/Refusal.tsx')},
  bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', loader: {'.css': 'empty'},
  external: ['react', 'react-dom', 'react/jsx-runtime'], outdir: temp, outExtension: {'.js': '.mjs'}, logLevel: 'error',
});
const {Refusal, plainReason, refusalDetail, refusalWords} = await import(pathToFileURL(join(temp, 'refusal.mjs')));

// ── the reader ───────────────────────────────────────────────────────────

/** S1-67 as the screen pass saw it: a thrown-error prefix, a kernel wrapper, a type name and an absolute path. */
const S1_67 = 'Error: Central owner Action refused: AgentProfile source not found: /Users/admin/Central/Work/O-I/ProjectCentral/agents/profiles/profile-bbf99f6f2ff90b4c.json';

test('the owner\'s plain words stand in the open, with the thrown-error prefix gone and a full stop', () => {
  assert.equal(plainReason('The native owner refused all eight collision-safe Flow filenames.'), 'The native owner refused all eight collision-safe Flow filenames.');
  assert.equal(plainReason(new Error('Native source changed; review its current revision before saving retained drafts.')), 'Native source changed; review its current revision before saving retained drafts.');
  assert.equal(plainReason('Error: the gateway is not running'), 'The gateway is not running.');
  assert.equal(plainReason({message: 'Name the withdrawal reason first.'}), 'Name the withdrawal reason first.');
  assert.equal(plainReason('{"kind":"owner_refused","message":"The day is closed."}'), 'The day is closed.', 'a JSON refusal is read for its message');
});

test('a cause that is not plain words stays out of the main line; a known cause is said in plain words, never made up', () => {
  assert.equal(plainReason(S1_67), 'It was not found.', 'S1-67: no prefix, no type name, no path');
  assert.equal(plainReason('SyntaxError: Unexpected token < in JSON at position 0'), undefined, 'a parse fault is the runtime\'s, not a reason');
  assert.equal(plainReason(new TypeError('Cannot read properties of undefined (reading \'rows\')')), undefined);
  assert.equal(plainReason('TypeError: Failed to fetch'), 'The owner could not be reached.');
  assert.equal(plainReason('Error: connect ECONNREFUSED 127.0.0.1:9341'), 'The owner could not be reached.');
  assert.equal(plainReason('git_repository_read unavailable'), undefined, 'an owner operation\'s name is a code');
  assert.equal(plainReason('Error: EACCES: permission denied, open \'/Users/admin/.aikit/state.db\''), 'Permission was refused.');
  assert.equal(plainReason('Error: ETIMEDOUT'), 'No answer came in time.');
  assert.equal(plainReason('Encounter is not attached [encounter.not_attached]'), 'Encounter is not attached.', 'the owner\'s code goes behind Why');
  assert.equal(plainReason('refused: {"code":"stale_basis","revision":12}'), undefined, 'a JSON dump is cut, and what is left is a code');
  assert.equal(plainReason('Error: the read was cut short\n    at read (file:///app/src/x.ts:1:2)'), 'The read was cut short.', 'the first line only; the stack never');
  assert.equal(plainReason('Error: boom'), undefined, 'one word is not a reason');
  assert.equal(plainReason(undefined), undefined);
  assert.equal(plainReason(''), undefined);
});

test('the detail is the owner\'s words verbatim, for the disclosure', () => {
  assert.equal(refusalDetail(new Error('x failed')), 'x failed');
  assert.equal(refusalDetail(S1_67), S1_67);
  assert.equal(refusalDetail({kind: 'refused'}), '{"kind":"refused"}');
  assert.equal(refusalDetail(undefined), '');
});

test('the block: the plain line in the open, the raw cause behind Why, the site\'s own actions after it', () => {
  const out = renderToStaticMarkup(createElement(Refusal, {said: 'Couldn\'t read this agent.', error: S1_67, className: 'panel-line', role: 'status', 'data-line': 'agent'},
    createElement('button', {type: 'button'}, 'Retry')));
  const open = out.replace(/<details[\s\S]*<\/details>/, '');
  assert.match(out, /^<div class="panel-line" role="status" data-line="agent">/);
  assert.match(open, /<p class="oi-refusal-line">Couldn(&#x27;|')t read this agent\. It was not found\.<\/p>/);
  assert.doesNotMatch(open, /Error:|\/Users\/|AgentProfile|\.json/, 'S1-67: nothing raw in the open');
  assert.match(out, /<details class="oi-refusal-detail"><summary>Why<\/summary><p>Error: Central owner Action refused: AgentProfile source not found: \/Users\/admin\/[^<]+\.json<\/p><\/details>/);
  assert.match(out, /<\/details><button type="button">Retry<\/button><\/div>$/);
  const plain = renderToStaticMarkup(createElement(Refusal, {said: 'Couldn\'t make the Flow.', error: 'Error: The native owner refused all eight collision-safe Flow filenames.'}));
  assert.match(plain, /^<div class="oi-refusal" role="alert"><p class="oi-refusal-line">Couldn(&#x27;|')t make the Flow\. The native owner refused all eight collision-safe Flow filenames\.<\/p><\/div>$/,
    'the owner\'s plain words in the open, and nothing more to disclose');
  const own = renderToStaticMarkup(createElement(Refusal, {said: 'That file operation didn\'t go through.', ownWords: true, error: 'The file changed. Your draft is retained; compare the current file before applying it.'}));
  assert.match(own, /<p class="oi-refusal-line">The file changed\. Your draft is retained; compare the current file before applying it\.<\/p><\/div>$/, 'a place\'s own designed words stand alone');
  assert.match(renderToStaticMarkup(createElement(Refusal, {said: 'That file operation didn\'t go through.', ownWords: true, error: new TypeError('x.y is not a function')})),
    /<p class="oi-refusal-line">That file operation didn(&#x27;|')t go through\.<\/p><details class="oi-refusal-detail"><summary>Why<\/summary><p>TypeError: x\.y is not a function<\/p><\/details>/);
  assert.equal(renderToStaticMarkup(createElement(Refusal, {said: 'Couldn\'t read the Desk.'})), '<div class="oi-refusal" role="alert"><p class="oi-refusal-line">Couldn&#x27;t read the Desk.</p></div>');
  assert.equal(refusalWords('That source could not be resolved.', new TypeError('x is undefined')), 'That source could not be resolved.');
  assert.equal(refusalWords('Couldn\'t open the run.', 'Error: The run was withdrawn.'), 'Couldn\'t open the run. The run was withdrawn.');
  assert.equal(refusalWords('That source could not be opened.', S1_67, 'Reopen it to try again.'), 'That source could not be opened. It was not found. Reopen it to try again.', 'what happened, why, then what to do');
});

// ── the ratchet ──────────────────────────────────────────────────────────

/** A name that holds an error, a refusal or an owner fault. `reason` is not one by name: most reasons are the owner's designed words;
 * a reason that holds a caught error is one by where it came from (below). */
const CARRIER = /^(?:err|error|errors|cause|failure|fault|refused|__refused|refusal|exception)$|(?:Error|Failure|Fault|Refused|Refusal|Exception)$/;
/** What an error's fields hold: its words, its trace, its code. */
const PARTS = new Set(['message', 'detail', 'stack', 'code']);
/** The pattern's own readers: what passes through them is plain words. */
const SAFE = new Set(['plainReason', 'refusalWords']);

const nameOf = n => ts.isIdentifier(n) ? n.text : ts.isPropertyAccessExpression(n) ? n.name.text
  : ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression) ? n.argumentExpression.text : undefined;
const isFunction = n => ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n);
const bindingNames = (name, out = []) => {
  if (ts.isIdentifier(name)) out.push(name.text);
  else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) for (const element of name.elements) if (!ts.isOmittedExpression(element)) bindingNames(element.name, out);
  return out;
};

function scanFile(file) {
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  // State a caught error is put into: `const [x, setX] = useState()` with setX(<a raw error>) anywhere in the file.
  const setters = new Map(), stateCarriers = new Set();
  sf.forEachChild(function visit(n) {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && /use(State|Ref)$/.test(n.initializer.expression.getText())) {
      const [value, setter] = n.name.elements;
      if (value && setter && !ts.isOmittedExpression(value) && !ts.isOmittedExpression(setter) && ts.isIdentifier(value.name) && ts.isIdentifier(setter.name)) setters.set(setter.name.text, value.name.text);
    }
    n.forEachChild(visit);
  });
  /** The declaration that binds `name` where `at` stands, nearest scope first. */
  function declarationOf(name, at) {
    for (let scope = at.parent; scope; scope = scope.parent) {
      if (ts.isCatchClause(scope) && scope.variableDeclaration && bindingNames(scope.variableDeclaration.name).includes(name)) return {kind: 'caught'};
      if (isFunction(scope)) {
        const param = scope.parameters.find(p => bindingNames(p.name).includes(name));
        if (param) {
          const call = scope.parent;
          const rejected = call && ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression)
            && ((call.expression.name.text === 'catch' && call.arguments[0] === scope) || (call.expression.name.text === 'then' && call.arguments[1] === scope));
          return {kind: rejected ? 'caught' : 'param'};
        }
      }
      if (ts.isBlock(scope) || ts.isSourceFile(scope) || ts.isModuleBlock(scope) || ts.isCaseClause(scope)) {
        for (const statement of scope.statements) {
          if (!ts.isVariableStatement(statement)) continue;
          for (const declaration of statement.declarationList.declarations) {
            if (!bindingNames(declaration.name).includes(name)) continue;
            if (ts.isArrayBindingPattern(declaration.name) && setters.has(`set${name[0].toUpperCase()}${name.slice(1)}`)) return {kind: 'state'};
            return {kind: 'variable', declaration};
          }
        }
      }
    }
    return undefined;
  }
  const seen = new Set();
  function isCarrier(n) {
    if (ts.isIdentifier(n)) {
      const declared = declarationOf(n.text, n);
      if (declared?.kind === 'caught') return true;
      if (declared?.kind === 'state' && stateCarriers.has(n.text)) return true;
      if (declared?.kind === 'variable' && ts.isIdentifier(declared.declaration.name) && declared.declaration.initializer && !seen.has(declared.declaration)) {
        seen.add(declared.declaration);
        try { if (carriersIn(declared.declaration.initializer).length) return true; } finally { seen.delete(declared.declaration); }
      }
      return CARRIER.test(n.text);
    }
    const name = nameOf(n);
    if (!name || !(ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n))) return false;
    if (CARRIER.test(name)) return true;
    return PARTS.has(name) && isCarrier(n.expression);
  }
  /** What an expression can evaluate to that carries a raw error — not what it only tests. */
  function carriersIn(n, out = []) {
    if (!n) return out;
    if (ts.isParenthesizedExpression(n) || ts.isNonNullExpression(n) || ts.isAsExpression(n) || ts.isTypeAssertionExpression(n) || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(n))) return carriersIn(n.expression, out);
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) return out; // its own children are read where they stand
    if (ts.isConditionalExpression(n)) { carriersIn(n.whenTrue, out); return carriersIn(n.whenFalse, out); }
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) return carriersIn(n.right, out);
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.PlusToken) { carriersIn(n.left, out); return carriersIn(n.right, out); }
      return out; // a comparison answers a boolean
    }
    if (ts.isPrefixUnaryExpression(n) || ts.isTypeOfExpression(n) || ts.isLiteralExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) return out;
    if (ts.isTemplateExpression(n)) { for (const span of n.templateSpans) carriersIn(span.expression, out); return out; }
    if (ts.isCallExpression(n)) {
      const callee = nameOf(n.expression);
      if (callee && SAFE.has(callee)) return out;
      if (ts.isPropertyAccessExpression(n.expression)) carriersIn(n.expression.expression, out); // x.toString(), rows.map(…).join(…)
      for (const arg of n.arguments) {
        if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
          if (ts.isBlock(arg.body)) arg.body.forEachChild(function returns(s) { if (ts.isReturnStatement(s)) carriersIn(s.expression, out); else if (!isFunction(s)) s.forEachChild(returns); });
          else carriersIn(arg.body, out);
        } else carriersIn(arg, out);
      }
      return out;
    }
    if (ts.isIdentifier(n) || ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) { if (isCarrier(n)) out.push(n); return out; }
    return out;
  }
  // A setter given a raw error makes its state a carrier.
  sf.forEachChild(function visit(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && setters.has(n.expression.text) && n.arguments[0] && carriersIn(n.arguments[0]).length) stateCarriers.add(setters.get(n.expression.text));
    n.forEachChild(visit);
  });
  /** Behind an explicit disclosure of the cause (ruling 2): the nearest <details> is one when its class or its summary says so
   * (Why, Show raw, Receipt, … details). A section that only folds, a Flow's decision panel say, is not one: its lines are main lines. */
  const DISCLOSURE = /refusal-detail|raw|disclosure|detail/, SUMMARY = /\b(why|raw|receipt|details?|inspect)\b/i;
  const insideDetails = n => {
    for (let p = n.parent; p; p = p.parent) {
      if (!ts.isJsxElement(p) || p.openingElement.tagName.getText() !== 'details') continue;
      const className = p.openingElement.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText() === 'className');
      if (className?.initializer && DISCLOSURE.test(className.initializer.getText())) return true;
      const summary = p.children.find(c => ts.isJsxElement(c) && c.openingElement.tagName.getText() === 'summary');
      return !!summary && SUMMARY.test(summary.children.map(c => ts.isJsxText(c) ? c.text : '').join(' '));
    }
    return false;
  };
  const found = [];
  const push = (n, kind) => found.push({kind, line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, text: n.getText().replace(/\s+/g, ' ').slice(0, 140)});
  sf.forEachChild(function visit(n) {
    // A child of an element: what a person reads, or a screen reader says.
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent)) && !insideDetails(n) && carriersIn(n.expression).length) push(n, 'jsx');
    // A workspace message: the frame's toast line, or the host's onMessage that leads to it.
    if (ts.isNewExpression(n) && n.expression.getText() === 'CustomEvent' && n.arguments?.[0] && ts.isStringLiteralLike(n.arguments[0]) && n.arguments[0].text === 'oi:workspace-message') {
      const detail = n.arguments[1] && ts.isObjectLiteralExpression(n.arguments[1]) ? n.arguments[1].properties.find(p => p.name?.getText() === 'detail') : undefined;
      const message = detail && ts.isPropertyAssignment(detail) && ts.isObjectLiteralExpression(detail.initializer) ? detail.initializer.properties.find(p => p.name?.getText() === 'message') : undefined;
      if (message && ts.isPropertyAssignment(message) && carriersIn(message.initializer).length) push(n, 'message');
    }
    if (ts.isCallExpression(n) && nameOf(n.expression) === 'onMessage' && n.arguments[0] && carriersIn(n.arguments[0]).length) push(n, 'message');
    n.forEachChild(visit);
  });
  return found;
}

/** The product's source: what the candidate loads, under the two roots the sweep reads. */
const product = [...reachable()].filter(file => /\.tsx?$/.test(file) && !/\.d\.ts$/.test(file)
  && (file.startsWith(join(repo, 'desktop/cradle/src/')) || file.startsWith(join(repo, 'packages/live-shell/ui/src/'))))
  .map(file => relative(repo, file)).sort();
const findings = new Map(product.map(file => [file, scanFile(join(repo, file))]).filter(([, found]) => found.length));
if (process.env.PLAIN_REFUSALS_LIST) for (const [file, found] of findings) for (const site of found) console.log(`${file}:${site.line} [${site.kind}] ${site.text}`);

/** Sites the name rule catches that stand, each reviewed: the owner's designed words, not a raw error. */
const ALLOWED = {
  'desktop/cradle/src/flow/FlowSurface.tsx': [{text: '{error}', why: 'the string branch holds only the surface\'s own sentences (a conflict, the agent\'s answer kept unlost, what to choose first); every caught fault is {said, cause} and goes through Refusal'}],
};

/** The surfaces the plain-refusal sweep carried (the ui-coherence lane, 5–6 Oct, ported onto main 29 Oct; S1-67): none may carry
 * a raw error in its main line again. */
const SWEPT = [
  'desktop/cradle/src/agency/AgencyRoster.tsx',
  'desktop/cradle/src/agency/AgentSetupReturn.tsx',
  'desktop/cradle/src/agency/GuardianRepertoire.tsx',
  'desktop/cradle/src/agency/MintAgent.tsx',
  'desktop/cradle/src/agency/NativeAgentLauncher.tsx',
  'desktop/cradle/src/agency/SkillSearch.tsx',
  'desktop/cradle/src/agency/character/CharacterEditor.tsx',
  'desktop/cradle/src/agency/character/CharacterSection.tsx',
  'desktop/cradle/src/agent/AgentLayer.tsx',
  'desktop/cradle/src/agent/chat/AgentChat.tsx',
  'desktop/cradle/src/agent/chat/ChatComposer.tsx',
  'desktop/cradle/src/agent/chat/ChatTranscript.tsx',
  'desktop/cradle/src/agent/chat/ComposerChips.tsx',
  'desktop/cradle/src/agent/panel/AgentsTab.tsx',
  'desktop/cradle/src/browser/BrowserSurface.tsx',
  'desktop/cradle/src/configuration/AdoptionEntry.tsx',
  'desktop/cradle/src/configuration/AdoptionFlow.tsx',
  'desktop/cradle/src/context/PreparedContextView.tsx',
  'desktop/cradle/src/context/SelectionResolution.tsx',
  'desktop/cradle/src/contributions/automations/Automations.tsx',
  'desktop/cradle/src/contributions/factory/CandidateReading.tsx',
  'desktop/cradle/src/contributions/factory/ComputerView.tsx',
  'desktop/cradle/src/contributions/factory/FactoryDevelopmentSurface.tsx',
  'desktop/cradle/src/contributions/factory/RunExpressionBody.tsx',
  'desktop/cradle/src/contributions/factory/desk/Desk.tsx',
  'desktop/cradle/src/contributions/factory/desk/RunHandoff.tsx',
  'desktop/cradle/src/contributions/factory/desk/RunPage.tsx',
  'desktop/cradle/src/contributions/factory/live/RunLiveExpression.tsx',
  'desktop/cradle/src/contributions/factory/sidebar/FactoryAgentsTab.tsx',
  'desktop/cradle/src/encounter/AddressedComposer.tsx',
  'desktop/cradle/src/encounter/EncounterView.tsx',
  'desktop/cradle/src/epilogos/EpiLogosSurface.tsx',
  'desktop/cradle/src/explore/BeingEncounter.tsx',
  'desktop/cradle/src/explore/ConstituentEncounter.tsx',
  'desktop/cradle/src/explore/ContextContributionPanel.tsx',
  'desktop/cradle/src/explore/ExploreSurface.tsx',
  'desktop/cradle/src/explore/KnowledgeEncounter.tsx',
  'desktop/cradle/src/explore/ShareProjection.tsx',
  'desktop/cradle/src/explore/SharedStage.tsx',
  'desktop/cradle/src/expression/ActStrip.tsx',
  'desktop/cradle/src/expression/ExpressionView.tsx',
  'desktop/cradle/src/expressions/PointCloudHost.tsx',
  'desktop/cradle/src/files/FileSurface.tsx',
  'desktop/cradle/src/flow/DecisionContemplate.tsx',
  'desktop/cradle/src/flow/DraftSurface.tsx',
  'desktop/cradle/src/flow/FlowParticipants.tsx',
  'desktop/cradle/src/flow/FlowSurface.tsx',
  'desktop/cradle/src/flow/FreshSurface.tsx',
  'desktop/cradle/src/flow/contemplate.tsx',
  'desktop/cradle/src/git/DiffPage.tsx',
  'desktop/cradle/src/instrument/FocusedInstrumentComposition.tsx',
  'desktop/cradle/src/knowledge/KnowledgeExpression.tsx',
  'desktop/cradle/src/knowledge/KnowledgeStatus.tsx',
  'desktop/cradle/src/knowledge/KnowledgeSurface.tsx',
  'desktop/cradle/src/knowledge/OwnerActions.tsx',
  'desktop/cradle/src/knowledge/ParticipationFacts.tsx',
  'desktop/cradle/src/knowledge/SearchOverlay.tsx',
  'desktop/cradle/src/knowledge/WikiFactsEditor.tsx',
  'desktop/cradle/src/knowledge/WikiSourceTools.tsx',
  'desktop/cradle/src/material/MaterialSurface.tsx',
  'desktop/cradle/src/personal/PageExpression.tsx',
  'desktop/cradle/src/receiving/DayDieFace.tsx',
  'desktop/cradle/src/receiving/NowRelations.tsx',
  'desktop/cradle/src/receiving/SharedFieldMaterial.tsx',
  'desktop/cradle/src/surface/Workbench.tsx',
  'desktop/cradle/src/techne/TechneCentre.tsx',
  'desktop/cradle/src/terminal/TerminalSurface.tsx',
  'desktop/cradle/src/workspace/left/ChatRows.tsx',
  'desktop/cradle/src/workspace/left/rows.tsx',
  'desktop/cradle/src/workspace/settings/AuthLogin.tsx',
  'desktop/cradle/src/workspace/settings/ReviewSheet.tsx',
  'desktop/cradle/src/workspace/settings/VisualsView.tsx',
  'desktop/cradle/src/workspace/settings/rows.tsx',
  'desktop/cradle/src/workspace/settings/sections/CredentialsSection.tsx',
  'desktop/cradle/src/workspace/settings/sections/HarnessesSection.tsx',
  'desktop/cradle/src/workspace/settings/sections/ModelCatalogue.tsx',
  'desktop/cradle/src/workspace/settings/sections/ProfilesSection.tsx',
  'desktop/cradle/src/workspace/settings/sections/SkillsSection.tsx',
];

/** Bounded debt: every other product file's raw sites, counted when the sweep landed. A file may hold no more; when a site is
 * made plain, lower its count here (a count above what the file holds fails too, so the ceiling follows the code down). */
const CEILING = {
  'desktop/cradle/src/agency/HumanAgentCard.tsx': 1,
  'desktop/cradle/src/agency/SelfDefinitionSection.tsx': 2,
  'desktop/cradle/src/agency/character/CharacterPreview.tsx': 1,
  'desktop/cradle/src/contributions/factory/FactoryCentre.tsx': 1,
  'desktop/cradle/src/contributions/factory/components/SpanDetail.tsx': 2,
  'desktop/cradle/src/contributions/factory/desk/RunMap.tsx': 1,
  'desktop/cradle/src/contributions/factory/desk/RunMaterial.tsx': 1,
  'desktop/cradle/src/contributions/factory/desk/RunPositions.tsx': 1,
  'desktop/cradle/src/document/SourceDocumentHost.tsx': 1,
  'desktop/cradle/src/encounter/EncounterList.tsx': 1,
  'desktop/cradle/src/explore/ContributionPanel.tsx': 1,
  'desktop/cradle/src/field/Article.tsx': 1,
  'desktop/cradle/src/field/Right.tsx': 1,
  'desktop/cradle/src/knowledge/WikiReader.tsx': 1,
  'desktop/cradle/src/library/LibraryHost.tsx': 1,
  'desktop/cradle/src/surface/SourceSurface.tsx': 3,
  'desktop/cradle/src/surface/projectionPane.tsx': 1,
  'desktop/cradle/src/workspace/DetachedFrame.tsx': 1,
  'desktop/cradle/src/workspace/GroundChooser.tsx': 1,
  'desktop/cradle/src/workspace/settings/sections/ProductSection.tsx': 2,
  'packages/live-shell/ui/src/App.tsx': 1,
  'packages/live-shell/ui/src/agent/AgentShellBrowser.tsx': 2,
  'packages/live-shell/ui/src/central/devices/CentralDevices.tsx': 1,
  'packages/live-shell/ui/src/central/documents/CentralDocumentPane.tsx': 3,
  'packages/live-shell/ui/src/central/searchLine.tsx': 2,
  'packages/live-shell/ui/src/components/NativeActPassages.tsx': 1,
  'packages/live-shell/ui/src/components/NativeAgencyParticipation.tsx': 1,
  'packages/live-shell/ui/src/components/NativeBarControls.tsx': 3,
  'packages/live-shell/ui/src/components/NativeChosenControls.tsx': 1,
  'packages/live-shell/ui/src/components/NativeColourField.tsx': 3,
  'packages/live-shell/ui/src/components/NativeContextPanel.tsx': 5,
  'packages/live-shell/ui/src/components/NativeDeviceBrowser.tsx': 1,
  'packages/live-shell/ui/src/components/NativeDeviceEditors.tsx': 6,
  'packages/live-shell/ui/src/components/NativeDevicePoolView.tsx': 1,
  'packages/live-shell/ui/src/components/NativeDeviceRack.tsx': 1,
  'packages/live-shell/ui/src/components/NativeEntityFace.meaning.tsx': 3,
  'packages/live-shell/ui/src/components/NativeEntityFace.sound.tsx': 2,
  'packages/live-shell/ui/src/components/NativeFieldFace.depth.tsx': 1,
  'packages/live-shell/ui/src/components/NativeFieldFace.ink.tsx': 2,
  'packages/live-shell/ui/src/components/NativeFieldHandle.tsx': 1,
  'packages/live-shell/ui/src/components/NativeInputRetention.tsx': 3,
  'packages/live-shell/ui/src/components/NativeMaterialBrowser.tsx': 2,
  'packages/live-shell/ui/src/components/NativeMorphDrive.tsx': 3,
  'packages/live-shell/ui/src/components/NativeObjectBrowser.tsx': 1,
  'packages/live-shell/ui/src/components/NativePinControls.tsx': 2,
  'packages/live-shell/ui/src/components/NativePreparedContext.tsx': 2,
  'packages/live-shell/ui/src/components/NativePropertyBrowser.tsx': 1,
  'packages/live-shell/ui/src/components/NativeRackEditor.tsx': 2,
  'packages/live-shell/ui/src/components/NativeSceneEditor.tsx': 1,
  'packages/live-shell/ui/src/components/NativeSceneFace.arrange.tsx': 1,
  'packages/live-shell/ui/src/components/NativeSceneFace.automation.tsx': 2,
  'packages/live-shell/ui/src/components/NativeSceneFace.blueprint.tsx': 1,
  'packages/live-shell/ui/src/components/NativeSceneFace.body.tsx': 1,
  'packages/live-shell/ui/src/components/NativeSceneFace.scene.tsx': 2,
  'packages/live-shell/ui/src/components/NativeSceneFace.text.tsx': 1,
  'packages/live-shell/ui/src/components/NativeSceneTransport.tsx': 2,
  'packages/live-shell/ui/src/components/NativeTechneBrowser.tsx': 1,
  'packages/live-shell/ui/src/components/NativeWorldDetail.tsx': 1,
  'packages/live-shell/ui/src/components/OwnerRefusal.tsx': 1,
  'packages/live-shell/ui/src/components/StatusBar.tsx': 1,
  'packages/live-shell/ui/src/components/WorldBrowser.tsx': 2,
  'packages/live-shell/ui/src/components/devices/ExpressionsDeviceView.tsx': 1,
  'packages/live-shell/ui/src/components/devices/ExpressionsPicture.tsx': 1,
  'packages/live-shell/ui/src/components/expressions/studio/StudioStage.tsx': 1,
  'packages/live-shell/ui/src/frame/InstrumentsSection.tsx': 1,
  'packages/live-shell/ui/src/frame/browser/ConstellationRows.tsx': 1,
  'packages/live-shell/ui/src/frame/browser/LiveGroovePool.tsx': 2,
  'packages/live-shell/ui/src/frame/detail/ClipHost.tsx': 1,
  'packages/live-shell/ui/src/frame/detail/DetailHost.tsx': 1,
  'packages/live-shell/ui/src/inhabitants/CentralHygieneDevice.tsx': 2,
  'packages/live-shell/ui/src/inhabitants/DocumentDayDieFace.tsx': 2,
  'packages/live-shell/ui/src/inhabitants/DocumentFlowFace.tsx': 1,
  'packages/live-shell/ui/src/inhabitants/DocumentPageFace.tsx': 1,
  'packages/live-shell/ui/src/inhabitants/catalogue/panels/central__docs.tsx': 1,
  'packages/live-shell/ui/src/inhabitants/catalogue/panels/central__document.tsx': 1,
  'packages/live-shell/ui/src/inhabitants/catalogue/panels/central__search.tsx': 1,
  'packages/live-shell/ui/src/inhabitants/catalogue/panels/live__exact-ratio.tsx': 2,
  'packages/live-shell/ui/src/inhabitants/catalogue/panels/settings__window.tsx': 1,
  'packages/live-shell/ui/src/inhabitants/catalogue/panels/workcell__workcell.tsx': 1,
  'packages/live-shell/ui/src/inhabitants/inhabitantRack.tsx': 1,
  'packages/live-shell/ui/src/inhabitants/qlInstrumentDevice.tsx': 4,
  'packages/live-shell/ui/src/live/KeyboardOnChain.tsx': 1,
  'packages/live-shell/ui/src/live/LiveInstrumentSection.tsx': 3,
  'packages/live-shell/ui/src/live/LivePresets.tsx': 1,
  'packages/live-shell/ui/src/live/TorusOnChain.tsx': 1,
  'packages/live-shell/ui/src/live/designBindings/TorusEffectsOnChain.tsx': 1,
  'packages/live-shell/ui/src/live/janko/JankoDevice.tsx': 2,
  'packages/live-shell/ui/src/live/midiMap/midiMapControls.tsx': 1,
  'packages/live-shell/ui/src/native/ApplicationClose.tsx': 2,
  'packages/live-shell/ui/src/native/Detached.tsx': 1,
  'packages/live-shell/ui/src/native/Foundation.tsx': 2,
  'packages/live-shell/ui/src/native/Workbench.tsx': 4,
  'packages/live-shell/ui/src/panels/devices-pro/echo.tsx': 2,
  'packages/live-shell/ui/src/panels/devices-pro/glue.tsx': 2,
  'packages/live-shell/ui/src/panels/devices-pro/kit.tsx': 3,
  'packages/live-shell/ui/src/panels/devices-pro/operator.tsx': 2,
  'packages/live-shell/ui/src/panels/devices-pro/reverb.tsx': 2,
  'packages/live-shell/ui/src/panels/devices-pro/wavetable.tsx': 2,
  'packages/live-shell/ui/src/panels/devices/DevicePanel.tsx': 3,
  'packages/live-shell/ui/src/panels/knowledgeReceiver.tsx': 1,
  'packages/live-shell/ui/src/projections/stageInstruments/StageInstrumentPlate.tsx': 1,
  'packages/live-shell/ui/src/shell/ModeBrowser.tsx': 6,
  'packages/live-shell/ui/src/shell/constellationPreviews.tsx': 1,
  'packages/live-shell/ui/src/widgets/PacketWidget.tsx': 3,
};

const held = (file, found) => found.filter(site => !(ALLOWED[file] ?? []).some(entry => site.text.includes(entry.text)));

test('the swept surfaces put no raw error in a main line', () => {
  const raw = SWEPT.flatMap(file => held(file, findings.get(file) ?? []).map(site => `${file}:${site.line} [${site.kind}] ${site.text}`));
  assert.deepEqual(raw, [], 'say what happened through shared/Refusal.tsx (Refusal, refusalWords), and keep the raw cause behind Why');
  for (const file of SWEPT) assert.ok(product.includes(file), `${file} is product (candidate-reachable)`);
  for (const file of SWEPT) assert.equal(CEILING[file], undefined, `${file} was swept: it carries no debt`);
});

test('no other product file puts more raw errors in its main lines than it held when the sweep landed', () => {
  const over = [], under = [];
  for (const file of product) {
    if (SWEPT.includes(file)) continue;
    const count = held(file, findings.get(file) ?? []).length, ceiling = CEILING[file] ?? 0;
    if (count > ceiling) over.push(`${file}: ${count} > ${ceiling}\n    ${held(file, findings.get(file)).map(site => `${site.line} [${site.kind}] ${site.text}`).join('\n    ')}`);
    if (count < ceiling) under.push(`${file}: ${count} < ${ceiling}`);
  }
  assert.deepEqual(over, [], 'a new raw error in a main line: say it through shared/Refusal.tsx');
  assert.deepEqual(under, [], 'a site was made plain: lower its CEILING');
  for (const file of Object.keys(CEILING)) assert.ok(product.includes(file), `${file} in CEILING is product`);
});

test('every allowance names a site that still stands, and why it stands', () => {
  for (const [file, entries] of Object.entries(ALLOWED)) for (const entry of entries) {
    assert.ok((findings.get(file) ?? []).some(site => site.text.includes(entry.text)), `${file}: "${entry.text}" no longer stands — remove the allowance`);
    assert.ok(entry.why && entry.why.length > 20, `${file}: "${entry.text}" says why it stands`);
  }
});
