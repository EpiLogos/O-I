/**
 * The projection-seam harness (WORLD-SHELL-DESIGN §10 seams 1–3).
 *
 * What stands here, all of it real:
 * - the surface ENGINE (`desktop/cradle/src/surface`) builds the pane tree —
 *   `openBinding` / `splitOff` / `makeProjectionBinding` — a split of two
 *   pane groups holding two projections of ONE subject;
 * - the module CONTRACT mounts each pane's body through the admitted
 *   reference module (`admitEncounterEcho` — a labelled placeholder whose
 *   job is proving mount/unmount + encounter subscription + hidden
 *   retention);
 * - the live-shell's real ENCOUNTER BRIDGE (`../encounterBridge`) rides a
 *   spine shaped exactly like the shell's (book WorldContext + workspace
 *   accessEpoch); switching the subject propagates as an encounter
 *   transition and BOTH panes receive it — no second selection store;
 * - bumping the kernel epoch retires the stale monitor's registration, the
 *   same accessEpoch/accessReady guard the shell's own views obey.
 *
 * Harness only: nothing here is the shell build, and the reference module is
 * admitted nowhere else.
 */
import {createRoot} from 'react-dom/client';
import {createElement as h, useCallback, useMemo, useReducer, useState, type ReactNode} from 'react';

import {
  openBinding,
  splitOff,
  makeProjectionBinding,
  activateSurface,
} from '../../../../../../desktop/cradle/src/surface/engine';
import {freshLayout, type LayoutState, type Pane, type TabGroupPane} from '../../../../../../desktop/cradle/src/surface/types';
import {registerProjectionModule} from '../../../../../../desktop/cradle/src/surface/projectionModules';
import {ProjectionEncounterProvider, ProjectionSurface} from '../../../../../../desktop/cradle/src/surface/projectionPane';
import {createSpineEncounterBridge} from '../encounterBridge';
import {admitEncounterEcho} from '../reference/encounterEcho';

// ---------------------------------------------------------------------------
// admission — the reference module under two kinds (placeholder bodies,
// labelled as such on their faces). The real kinds belong to their owners.
registerProjectionModule(admitEncounterEcho('projection.timeline'));
registerProjectionModule(admitEncounterEcho('projection.constellation'));

// ---------------------------------------------------------------------------
// the spine — shaped exactly like the shell's (book WorldContext + workspace
// accessEpoch) so the REAL bridge module runs here unmodified.
type Context = {world?: string; subject?: {ref?: string; kind?: string; title: string}; reading?: {ref: string; position?: string}; trail?: {mode: string; label: string}[]};
const subjects = {
  stone: {ref: 'stone1950', kind: 'artefact', title: 'Stone 1950'},
  loom: {ref: 'ariadne-loom', kind: 'artefact', title: "Ariadne's Loom"},
} as const;

const spineBarReading = document.createElement('div');
const monitorsRow = document.createElement('div');
interface Monitor {epoch: number; count: number; el: HTMLElement; unsubscribe: () => void}
const monitors: Monitor[] = [];

const book: {current: {context: Context}; setContext: (change: (context: Context) => Context) => void} = {
  current: {context: {world: 'central', subject: subjects.stone, trail: [{mode: 'techne', label: 'Bollingen'}]}},
  setContext(change) {
    book.current.context = change(book.current.context ?? {});
    onSpineChange();
  },
};
const workspaceState = {mode: 'techne', accessEpoch: 3};
const spine = {current: {book, workspace: workspaceState}};
const bridge = createSpineEncounterBridge(spine as unknown as Parameters<typeof createSpineEncounterBridge>[0]);

function renderSpineBar() {
  const context = book.current.context;
  spineBarReading.textContent =
    `mode ${workspaceState.mode} · world ${context.world ?? '—'} · epoch ${workspaceState.accessEpoch} · subject ${context.subject ? context.subject.title : '— (none pinned)'}`;
}
function renderMonitors() {
  monitorsRow.replaceChildren(
    ...monitors.map(monitor => {
      monitor.el.textContent = `listener@e${monitor.epoch}: ${monitor.count} ${monitor.epoch === workspaceState.accessEpoch ? '' : '(retired — epoch guard)'}`;
      return monitor.el;
    }),
  );
}
function addMonitor() {
  const el = document.createElement('b');
  const monitor: Monitor = {epoch: workspaceState.accessEpoch, count: 0, el, unsubscribe: () => {}};
  monitor.unsubscribe = bridge.subscribe(() => {
    monitor.count++;
    el.textContent = `listener@e${monitor.epoch}: ${monitor.count} ${monitor.epoch === workspaceState.accessEpoch ? '' : '(retired — epoch guard)'}`;
  });
  monitors.push(monitor);
  renderMonitors();
}
function onSpineChange() {
  bridge.publish();
  renderSpineBar();
}

// ---------------------------------------------------------------------------
// the pane tree — built with the real engine: two pane groups, two
// projections, one shared subject through the shared encounter.
function buildLayout(): LayoutState {
  // Following panes: no subject_ref slice — they follow the encounter, so
  // both panes present the SAME subject the spine holds (the acceptance
  // walk's "two projections of one subject" is one fact, not two copies).
  const timeline = makeProjectionBinding(freshLayout(), 'projection.timeline');
  let state = openBinding(freshLayout(), timeline);
  const constellation = makeProjectionBinding(state, 'projection.constellation');
  state = openBinding(state, constellation);
  return splitOff(state, constellation.id, 'h');
}

function PaneNode({pane, layout, concealed, onActivate, onConceal}: {
  pane: Pane;
  layout: LayoutState;
  concealed: ReadonlySet<string>;
  onActivate: (groupId: string, tabId: string) => void;
  onConceal: (tabId: string) => void;
}): ReactNode {
  if (pane.type === 'split') {
    return h('div', {className: 'split', 'data-dir': pane.dir, 'data-split-id': pane.id, style: {gap: 0}},
      pane.children.map((child, index) => h('div', {key: child.id, style: {display: 'flex', flex: pane.weights?.[index] ?? 1, minWidth: 0, minHeight: 0}},
        h(PaneNode, {pane: child, layout, concealed, onActivate, onConceal}))));
  }
  const group: TabGroupPane = pane;
  return h('div', {className: `group${layout.focusedGroupId === group.id ? ' focused' : ''}`, 'data-group-id': group.id},
    h('div', {className: 'tab-strip'},
      group.tabs.map(tabId => h('button', {
        key: tabId,
        className: group.active === tabId ? 'active' : '',
        onClick: () => onActivate(group.id, tabId),
      }, layout.surfaces[tabId]?.title ?? tabId)),
      group.active ? h('button', {className: 'pane-conceal', onClick: () => onConceal(group.active!)}, concealed.has(group.active) ? 'reveal' : 'conceal') : null,
    ),
    h('div', {className: 'bodies'},
      group.tabs.map(tabId => h('div', {
        key: tabId,
        className: 'pane-body',
        'data-binding-id': tabId,
        'data-concealed': concealed.has(tabId) ? 'true' : undefined,
        hidden: concealed.has(tabId) || group.active !== tabId ? true : undefined,
      }, h(ProjectionSurface, {binding: layout.surfaces[tabId]}))),
    ),
  );
}

function App() {
  const [layout, setLayout] = useState<LayoutState>(buildLayout);
  const [concealed, setConcealed] = useState<ReadonlySet<string>>(new Set());
  // Imperative spine controls (the bar above the tree) trigger this render —
  // the render is what lets ProjectionSurface observe a new kernel epoch and
  // remount its module on the current connection generation.
  const [, renderTree] = useReducer(count => count + 1, 0);
  rerenderTree.current = renderTree;
  const source = useMemo(() => ({bridge, publish: () => bridge.publish()}), []);
  const onActivate = useCallback((groupId: string, tabId: string) => {
    setLayout(current => activateSurface({...current, focusedGroupId: groupId}, tabId));
  }, []);
  const onConceal = useCallback((tabId: string) => {
    setConcealed(current => {
      const next = new Set(current);
      if (next.has(tabId)) next.delete(tabId); else next.add(tabId);
      return next;
    });
  }, []);
  return h(ProjectionEncounterProvider, {
    source,
    children: h(PaneNode, {pane: layout.root!, layout, concealed, onActivate, onConceal}),
  });
}
const rerenderTree: {current: () => void} = {current: () => {}};

// ---------------------------------------------------------------------------
// frame — spine bar (imperative), tree (React over the engine state)
const bar = document.createElement('div');
bar.className = 'spine-bar';
const label = document.createElement('span');
label.className = 'label';
label.textContent = 'encounter spine';
const gap = document.createElement('span');
gap.className = 'gap';
const subjectStone = document.createElement('button');
subjectStone.textContent = 'subject: Stone 1950';
subjectStone.onclick = () => book.setContext(context => ({...context, subject: subjects.stone}));
const subjectLoom = document.createElement('button');
subjectLoom.textContent = "subject: Ariadne's Loom";
subjectLoom.onclick = () => book.setContext(context => ({...context, subject: subjects.loom}));
const subjectNone = document.createElement('button');
subjectNone.textContent = 'no subject';
subjectNone.onclick = () => book.setContext(context => ({...context, subject: undefined}));
const epochButton = document.createElement('button');
epochButton.textContent = 'bump kernel epoch';
epochButton.onclick = () => {
  workspaceState.accessEpoch++;
  addMonitor();
  renderSpineBar();
  bridge.publish(); // deliveries reach only current-epoch registrations
  rerenderTree.current(); // the host render remounts modules on the new epoch
};
bar.append(label, spineBarReading, gap, subjectStone, subjectLoom, subjectNone, epochButton);
const monitorsLabel = document.createElement('span');
monitorsLabel.className = 'label';
monitorsLabel.textContent = 'bridge registrations';
monitorsRow.className = 'monitors';
monitorsRow.prepend(monitorsLabel);
bar.append(monitorsRow);
document.getElementById('app')!.prepend(bar);

createRoot(document.getElementById('root')!).render(h(App));

renderSpineBar();
addMonitor();
