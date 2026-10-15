#!/usr/bin/env python3
"""The re-home input builder (ticket M, 15 Oct): resolve every cited needle to path:line in the seat and write the rehome input.

Each citation is (path, needle[, near]): the line is the match of `needle` nearest `near` (first match without it). The
output carries {path, line, quote=needle}; acceptance.py `rehome` re-opens each file and checks the line holds the quote.
"""
import json
import subprocess
import sys
from pathlib import Path

# The checkout this script stands in (never a machine path): re-run from any seat as the code moves.
REPO = Path(subprocess.run(['git', 'rev-parse', '--show-toplevel'], cwd=Path(__file__).parent, capture_output=True, text=True, check=True).stdout.strip())
OUT = Path(sys.argv[1])

FSJ = 'desktop/cradle/expressions-app/field-studies-journeys/src/'
RC = 'desktop/cradle/expressions-app/vendor/research-canvas/packages/canvas/src/'
UI = 'packages/live-shell/ui/src/'
EB = 'packages/expressions-boundary/src/'
CR = 'desktop/cradle/src/'
LIB = 'desktop/cradle/kernel/src/lib.rs'


def cite(path, needle, near=None):
    lines = (REPO / path).read_text().split('\n')
    hits = [i + 1 for i, line in enumerate(lines) if needle in line]
    if not hits:
        raise SystemExit(f'unresolved: {path} :: {needle!r}')
    line = min(hits, key=lambda n: abs(n - near)) if near else hits[0]
    return {'path': path, 'line': line, 'quote': needle}


# ── reach chains ─────────────────────────────────────────────────────────────
LENS_ROW = {
    'canvas': cite(UI + 'frame/instruments.ts', "lens: 'canvas'"),
    'timeline': cite(UI + 'frame/instruments.ts', "lens: 'timeline'"),
    'journey': cite(UI + 'frame/instruments.ts', "lens: 'journey'"),
    'palace': cite(UI + 'frame/instruments.ts', "lens: 'palace'"),
}
LENS_FRAME = {
    'canvas': cite(FSJ + 'app.ts', "void researchInstruments?.open(lens==='canvas'?'m1'"),
    'timeline': cite(FSJ + 'app.ts', "void researchInstruments?.open(lens==='canvas'?'m1'"),
    'journey': cite(FSJ + 'app.ts', "if(lens==='journey')void journeyInstrument?.open()"),
    'palace': cite(FSJ + 'app.ts', "if(lens==='palace'){if(propertyTake)finishPropertyTake();editing=true;"),
}
LENS_CHAIN = [
    cite(UI + 'shell/modeBrowsers.tsx', "{id: 'instruments', categories: [{id: 'instruments', label: 'Instruments'"),
    cite(UI + 'frame/InstrumentsSection.tsx', 'openInstrument(instrumentPayload(entry))'),
    cite(UI + 'frame/instrumentDoor.ts', 'if (lens) driveStageLens(lens, reportInstrumentFault)'),
    cite(UI + 'App.tsx', 'captureTechneInstrumentOpen({workspaceId: now.workspaceId'),
    cite(UI + 'native/techneInstrumentOpen.ts', "throw Error('Open an available native Expression before choosing its instrument')"),
    cite(UI + 'panels/expressions.tsx', 'stopInstruments = connectTechneInstrumentRequests'),
    cite(UI + 'native/techneInstrumentOpen.ts', 'receiver.host.selectInstrument(input.lens, input.focus_ref)'),
    cite(FSJ + 'app.ts', 'function activateInstrument(lens:LensId){'),
]
OPEN_WORK = [
    cite(UI + 'components/WorldBrowser.tsx', 'aria-label="Saved native works"'),
]
WIKI_SCENE = [
    cite(UI + 'panels/knowledge.tsx', "registerPanel({id: 'world.knowledge'"),
    cite(CR + 'knowledge/KnowledgeSurface.tsx', 'await openSubjectInTechne(transport,binding.project,node'),
    cite(CR + 'knowledge/techneHandoff.ts', 'requestWikiSelection({'),
    cite(UI + 'panels/expressions.tsx', 'stopSelection.current = navigator.current.connectSelectionRequests()'),
    cite(EB + 'techne.ts', 'const openSelection = async (request: NativeTechneSelection)'),
    cite(CR + 'techne/wikiReadingProvider.ts', 'This Scene has no exact Wiki register binding'),
]
PLACES_CHAIN = [
    cite(UI + 'shell/modeBrowsers.tsx', "expressions: () => [{id: 'expressions', categories: WORLD_BROWSER_CATEGORIES"),
    cite(UI + 'components/WorldBrowser.tsx', "<div hidden={category !== 'knowledge'}><NativeTechneBrowser"),
    cite(UI + 'components/NativeTechneBrowser.tsx', "{id:'place',title:'Places'"),
    cite(UI + 'components/NativeTechneBrowser.tsx', 'window.dispatchEvent(new CustomEvent(TECHNE_INSTRUMENT_OPEN,{detail}));'),
    cite(FSJ + 'lensStudio.ts', "{id: 'place', office: 'M4′'"),
    cite(FSJ + 'lensStudio.ts', "chooser.hidden = mode !== 'techne'"),
    cite(FSJ + 'app.ts', 'function activateInstrument(lens:LensId){'),
    cite(FSJ + 'app.ts', "void researchInstruments?.open(lens==='canvas'?'m1'"),
]
STAGE_CHAIN = [
    cite(UI + 'panels/expressions.tsx', 'mounted = mountExpressionsApplication(target'),
]
GRAPH_CHAIN = [
    cite(UI + 'central/CentralClipDetail.tsx', 'Open the wiki Constellation focused on this subject'),
    cite(UI + 'components/WorldBrowser.tsx', "window.dispatchEvent(new CustomEvent('oi:epi-open-knowledge', {detail: {...input, complete}}))"),
    cite(UI + 'native/hostedSummons.ts', "deps.openKnowledge({title: 'Graph', project, plane: 'graph'"),
    cite(UI + 'panels/knowledge.tsx', "window.addEventListener('oi:epi-open-knowledge', receive)"),
    cite(UI + 'panels/knowledge.tsx', "registerPanel({id: 'world.knowledge'"),
    cite(CR + 'knowledge/KnowledgeSurface.tsx', 'void loadGraph(transport,binding.project,visit.query'),
]

REACH_TEXT = {
    'lens': 'Any mode → browser › Instruments › {L} (double-click, or drag into a pane) → the Expressions stage pane opens and turns to its {L} lens → the frame\'s {L} instrument{X}. First an open native Expression: Expressions › browser › Expressions › a work (or New).',
    'places': 'Expressions › browser › Knowledge › Places (double-click), or the frame\'s own lens chooser (M4′ World · Places) while the stage stands in Technē → the frame\'s Places map{X}. First an open native Expression: Expressions › browser › Expressions › a work (or New).',
    'stage': 'Expressions › the centre\'s Expressions stage pane (the hosted frame, edge to edge) → the frame\'s own {L}{X}. Its owner writes need an open native Expression (Expressions › browser › Expressions › a work, or New); on the frame\'s local draft they stay local.',
    'graph': 'The Graph and source pane (world.knowledge): Central › a Day clip › Clip view › names, or Expressions › browser › Knowledge › Graph (with an open work), or a frame card\'s Show in graph → the knowledge graph{X}.',
}
WIKI_TEXT = ' Its dated and placed facets read only a Scene bound to a Wiki register: the Graph and source pane › a subject › Examine in Technē opens the register\'s Scene in the stage (N2\'s subject door is not mounted); any other work is refused by the owner read, by name.'


ROUTES = {}


def reach(kind, label, extra='', chain_extra=(), condition='open-work'):
    if kind == 'lens':
        route, chain = f'lens:{label.lower()}', [LENS_ROW[label.lower()], *LENS_CHAIN, LENS_FRAME[label.lower()], *OPEN_WORK]
    elif kind == 'places':
        route, chain = 'places', [*PLACES_CHAIN, *OPEN_WORK]
    elif kind == 'stage':
        route, chain = 'stage', [*STAGE_CHAIN, *OPEN_WORK]
    else:
        route, chain = 'graph', [*GRAPH_CHAIN]
    text = REACH_TEXT[kind].format(L=label, X=extra)
    chain = chain + list(chain_extra)
    if condition == 'open-work+wiki-scene':
        route += '+wiki-scene'
        chain = chain + WIKI_SCENE
        text += WIKI_TEXT
    if route in ROUTES:
        assert ROUTES[route] == {'chain': chain, 'condition': condition}, route
    ROUTES[route] = {'chain': chain, 'condition': condition}
    return {'text': text, 'route': route, 'condition': condition}


# ── owner chains ─────────────────────────────────────────────────────────────
KE_RELAY = [
    cite(FSJ + 'kernelExpressions.ts', "return call('kernel-expression',{request});"),
    cite(EB + 'host.ts', 'FRAME_EXPRESSION_OPERATIONS.has(request.operation)'),
    cite(UI + 'native/expressionOwners.ts', 'const result = await access.owners.channels[channel](request, access.context)'),
    cite(EB + 'cradle.ts', ": data({op: 'expression', request} as KernelOp, 'expression', context)"),
    cite(LIB, '    Expression {', 379),
    cite('desktop/cradle/kernel/src/expression.rs', '"operations":["capabilities","list","inspect"'),
]
OWNERS = {
    'ke-edit': ('kernel `expression` op · edit (KernelOp::Expression)', [
        cite(FSJ + 'nativeWorking.ts', "return {operation:'edit',expression_ref:document.expression_ref"), *KE_RELAY]),
    'ke-research': ('kernel `expression` op · edit (KernelOp::Expression), the Scene\'s research material', [
        cite(FSJ + 'app.ts', 'material:async(id,action:ResearchMaterialAction)'),
        cite(FSJ + 'app.ts', 'async function commitResearch(){'),
        cite(FSJ + 'nativeWorking.ts', "return {operation:'edit',expression_ref:document.expression_ref"), *KE_RELAY]),
    'ke-connector': ('kernel `expression` op · edit (KernelOp::Expression), the connector record', [
        cite(FSJ + 'app.ts', 'connector:async(id,edgeId,value)'),
        cite(FSJ + 'nativeWorking.ts', "return {operation:'edit',expression_ref:document.expression_ref"), *KE_RELAY]),
    'ke-read': ('kernel `expression` op · inspect (KernelOp::Expression) — presentation over the open Scene; writes nothing', [
        cite(FSJ + 'nativeWorking.ts', "this.ports.expression({operation:'inspect',expression_ref:record.view.document.expression_ref})"), *KE_RELAY]),
    'ke-index': ('kernel `expression` op · index, then edit with `collections_set` (KernelOp::Expression)', [
        cite(FSJ + 'app.ts', "nativeExpressionRequest({operation:'index'})"),
        cite(FSJ + 'app.ts', 'async function assignCollections(el:HTMLElement){'), *KE_RELAY]),
    'ke-compose': ('kernel `expression` op · edit, Palace composition (KernelOp::Expression)', [
        cite(FSJ + 'app.ts', "composeExpression:async({expression_ref,expected_revision,changes})=>{const data=await nativeExpressionRequest({operation:'edit'"), *KE_RELAY]),
    'ke-invoke': ('kernel `expression` op · invoke_action, the routed Return (KernelOp::Expression)', [
        cite(EB + 'cradle.ts', "'kernel-expression': (request, context) => object(request) && request.operation === 'invoke_action'"),
        cite(EB + 'host.ts', "if (request.operation === 'invoke_action' && !readFrameActionRequest(request))"), *KE_RELAY[2:]]),
    'techne-reading': ('techne-reading → kernel `expression` op · inspect + the Wiki register reading (Central files, kernel `knowledge`)', [
        cite(FSJ + 'kernelExpressions.ts', 'export const readTechneReading = (request:TechneSceneReadingRequest)'),
        cite(UI + 'native/expressionOwners.ts', "if(channel==='techne-reading'&&object(request)&&request.facet===undefined&&request.scope===undefined"),
        cite(EB + 'cradle.ts', "'techne-reading': request => readWikiSceneTechne(transport, request)"),
        cite(CR + 'techne/wikiReadingProvider.ts', 'export async function readWikiSceneTechne(transport: KernelTransportStatus, input: unknown)'),
        cite(CR + 'techne/wikiReadingProvider.ts', 'const inspected = await kernelOp(transport, {op: "expression", request: {operation: "inspect", expression_ref: request.expression_ref}});'),
        cite(CR + 'techne/wikiExpression.ts', 'kernelOp(transport, {op: "knowledge", project: register.project'),
        cite(LIB, '    Expression {', 379),
        cite(LIB, '    Knowledge {', 447)]),
    'time-window': ('techne-time-window → the host\'s disclosure session (createNativeTimeWindowOwner over desktop/cradle/src/techne/session.ts) — a shell session owner, not a kernel op', [
        cite(FSJ + 'kernelExpressions.ts', 'export const techneTimeWindowRequest'),
        cite(UI + 'native/expressionOwners.ts', "'techne-time-window':async(request,context)=>{"),
        cite(UI + 'native/expressionOwners.ts', 'const time = createNativeTimeWindowOwner({store:disclosureSession})'),
        cite(EB + 'timeWindow.ts', 'export function createNativeTimeWindowOwner({store}: {store: DisclosureSessionStore})'),
        cite(CR + 'techne/session.ts', 'export const disclosureSession: DisclosureSessionStore = createDisclosureSessionStore();')]),
    'crossing': ('techne-time-window · cross/return → the disclosure session\'s one history (crossToExpression)', [
        cite(FSJ + 'kernelExpressions.ts', 'export const techneTimeWindowRequest'),
        cite(UI + 'native/expressionOwners.ts', "'techne-time-window':async(request,context)=>{"),
        cite(EB + 'timeWindow.ts', 'const crossed = crossToExpression(session, target);'),
        cite(CR + 'techne/session.ts', 'export const disclosureSession: DisclosureSessionStore = createDisclosureSessionStore();')]),
    'constellation': ('techne-constellation → the Scene\'s Wiki constellation register (open in its source editor / relate) through Central', [
        cite(FSJ + 'kernelExpressions.ts', 'export const techneConstellationRequest'),
        cite(EB + 'cradle.ts', "'techne-constellation': async (request, context) => {"),
        cite(CR + 'techne/wikiReadingProvider.ts', 'export async function resolveSceneConstellation(transport: KernelTransportStatus, input: unknown)')]),
    'graph': ('kernel `graph` op (KernelOp::Graph): Central\'s wiki read model with AIKit and Shared Field rows', [
        cite(CR + 'knowledge/KnowledgeSurface.tsx', 'void loadGraph(transport,binding.project,visit.query'),
        cite(CR + 'knowledge/graph.ts', 'const response=await kernelOp(transport,{op:"graph",project,query'),
        cite(LIB, '    Graph {', 461)]),
    'recovery': ('expression-recovery → kernel `expression_recovery` op (KernelOp::ExpressionRecovery)', [
        cite(FSJ + 'app.ts', 'const persistDraft=(journey:Journey)=>nativeWorkspace?nativeWorkspace.persistDraft(journey):writeDraft(journey);'),
        cite(FSJ + 'kernelExpressions.ts', "return call('expression-recovery',{request});"),
        cite(EB + 'cradle.ts', "'expression-recovery': (request, context) => data({op: 'expression_recovery', request}"),
        cite(LIB, '    ExpressionRecovery {', 382)]),
    'standing': ('wiki-subject-standing (the candidate\'s own channel) → the Wiki registers\' projection through Central; sources through central-subject-text', [
        cite(UI + 'native/wikiSubjectStanding.ts', 'return {...owners, channels: {...owners.channels, [WIKI_SUBJECT_STANDING_CHANNEL]: wikiStandingChannel(source)}}'),
        cite(UI + 'panels/expressions.tsx', 'const owners = withWikiSubjectStanding(qualifiedExpressionOwners('),
        cite(EB + 'cradle.ts', "'central-subject-text': async request => {")]),
    'journey-presence': ('the Journey presence store (desktop/cradle/src/techne/m0m5/journey/presence.ts): webview storage, presentation by the target\'s own design — not a suite owner', [
        cite(FSJ + 'journeyInstrument.tsx', 'recordPosition(sceneId:string){')]),
    'palace-presence': ('the Palace presence store (desktop/cradle/src/techne/m0m5/palace/presence.ts): webview storage, presentation by the target\'s own design — not a suite owner', [
        cite(FSJ + 'palaceInstrument.tsx', 'palacePresenceStorage,PALACE_UNPERSISTED_NOTICE'),
        cite(CR + 'techne/m0m5/palace/presence.ts', 'export function palacePresenceStorage(): PresenceStorage | null {')]),
    'library': ('kernel `expression` op · list/inspect for kernel-bound entries + the frame\'s browser-local library store (libraryStore.ts)', [
        cite(FSJ + 'app.ts', "// T22: a kernel-bound library entry is opened from the kernel once the native channel is up"), *KE_RELAY]),
    'graph-hop': ('kernel `expression` op · inspect (the card\'s subject basis) → the Graph and source pane centred on it, which reads kernel `graph`', [
        cite(UI + 'components/WorldBrowser.tsx', "owners.channels['kernel-expression']({operation: 'inspect', expression_ref: captured.basis.expression_ref}"),
        cite(UI + 'native/hostedSummons.ts', "deps.openKnowledge({title: 'Graph', project, plane: 'graph'"),
        cite(CR + 'knowledge/graph.ts', 'const response=await kernelOp(transport,{op:"graph",project,query'),
        cite(LIB, '    Graph {', 461)]),
}


def owner(*keys, note=None):
    out = {'op': ' + '.join(OWNERS[key][0] for key in keys), 'call': OWNERS[keys[0]][1][0], 'chains': list(keys)}
    if note:
        out['note'] = note
    return out


ROWS = {}
NOTES = {}


def homed(target, component, reach_, owner_, note=None, retires=None):
    row = {'home': {'component': component, 'reach': reach_['text'], 'route': reach_['route'], 'condition': reach_['condition']}, 'owner_op': owner_, 'gap': None}
    if retires:
        row['home']['retires'] = retires
    ROWS[target] = row
    if note:
        NOTES[target] = note


def gap(target, kind, what, ticket, where=None, owner_=None, note=None):
    row = {'home': None, 'owner_op': owner_, 'gap': {'kind': kind, 'what': what, 'ticket': ticket}}
    if where:
        row['gap']['where'] = where
    ROWS[target] = row
    if note:
        NOTES[target] = note


RI = FSJ + 'researchInstruments.tsx'
CANVAS = reach('lens', 'Canvas')
L4_RETIRES = 'FOUNDATION §4 (owner, 14 Oct): Places is the Archetypal-Earth atlas alone; the frame\'s Places map and its overlays retire once this behaviour is re-homed onto the atlas (ticket R1).'
N4_RETIRES = 'FOUNDATION §3 N4: palaces live in the atlas, with no separate palace surface; this frame Palace home moves onto the atlas (ticket R2).'

# ── lane 1 ───────────────────────────────────────────────────────────────────
homed('lane-1:A1', cite(RI, '/** A1 — alignment guides for the card being dragged'), CANVAS, owner('ke-research', note='The guides are presentation; the settled card position is the owner write.'))
homed('lane-1:A2', cite(RI, '/** A2 — the one canvas object picker'), CANVAS, owner('ke-research'))
homed('lane-1:A3', cite(RI, "/** lane-1 A3 — a connection's line kind"), CANVAS, owner('ke-connector', note='The relation itself is untouched; the line kind, label and sides are presentation keyed by the native edge id.'))
homed('lane-1:A4', cite(RI, '// A4 — the side a drag ended on'), CANVAS, owner('ke-connector'))
homed('lane-1:A5', cite(RI, '<CanvasNavigationOverview key={canvas.key}'), CANVAS, owner('ke-read'))
homed('lane-1:A6', cite(RI, 'aria-label="Fit all cards"'), CANVAS, owner('ke-read'))
homed('lane-1:A7', cite(RI, '<CanvasFindOverlay key={`find:'), CANVAS, owner('ke-read'))
homed('lane-1:A8', cite(RI, 'aria-label="Present frames"'), CANVAS, owner('ke-read', note='Fullscreen inside the hosted frame is allowed by the host (expressions-boundary host.ts sets allowfullscreen).'))
homed('lane-1:A9', cite(RI, "/** lane-1 A9 — a frame's heading at its top edge"), CANVAS, owner('ke-research'))
homed('lane-1:A10', cite(RI, '/** lane-1 A10 — an embed or media card drawn over'), CANVAS, owner('ke-research', note='An https link card is research material; opening it leaves the frame only through the host.'))
homed('lane-1:B1', cite(RI, '// B1 — one quiet save-state glyph'), CANVAS, owner('ke-research'))
gap('lane-1:B2', 'no-native-receiver',
    'The .canvas import is one owner edit and is reachable, but the export is a browser download (saveBlob, an <a download> click) and the candidate\'s main webview has no download handler, so WKWebView cancels it: the exported file never lands.',
    'G1', where=cite(RI, '// B2 — the composed Canvas as one Obsidian .canvas file'), owner_=owner('ke-research'),
    note='Code-reading: desktop/cradle/src-tauri/src/main.rs builds the main window from config with no on_download (only the in-app browser child webviews set one, browser.rs); wry 0.55.1 wkwebview/navigation.rs cancels a download action when no handler is set. Screen leg UNVERIFIED.')
gap('lane-1:B3', 'no-native-receiver',
    'The frame PNG is made from the live stage but saved as a browser download (saveBlob), which the candidate\'s main webview cancels (no download handler): nothing lands.',
    'G1', where=cite(RI, '// B3 — the selection (or a frame\'s members) as the canvas draws it'), owner_=owner('ke-read'),
    note='Same evidence as B2.')
homed('lane-1:B4', cite(RI, '// B4: applying a view reports the members that have left the Scene'), CANVAS, owner('ke-research', note='Views are saved in the Scene\'s research material; applying one reads the open Scene.'))
GRAPH = reach('graph', 'Graph', condition='none')
homed('lane-1:C1', cite(CR + 'knowledge/graphNavigation.ts', 'export function projectUnresolvedGraph(reading: GraphReading): GraphReading {'), GRAPH, owner('graph'),
      note='PATH §7 records the Graph op at 88 s cold with AIKit timing out at 20 s: the graph may stand without AIKit\'s rows until warm.')
homed('lane-1:C2', cite(CR + 'knowledge/GraphCanvas.tsx', "import {NavigationMinimap,type NavigationMinimapController} from '../shared/NavigationMinimap.tsx';"), GRAPH, owner('graph'))
homed('lane-1:C3', cite(RI, '{current&&host.showInGraph&&'), reach('lens', 'Canvas', extra=' › a bound card › Show in graph → the Graph and source pane centred on its subject'),
      owner('graph-hop'),
      note='The register\'s implemented evidence cites desktop/cradle/src/library/techneSummon.tsx, which the candidate does not reach (legacy desktop); the candidate\'s route is the frame\'s graph summon answered by native/hostedSummons.ts, and Expressions › browser › Knowledge › Graph (WorldBrowser.tsx, native/knowledgeOpen.ts).')
homed('lane-1:C4', cite(CR + 'knowledge/GraphCanvas.tsx', 'emphasizedGraphRelations'), GRAPH, owner('graph'))
gap('lane-1:D1', 'not-built',
    'The candidate\'s rail is the browser\'s Instruments group (F2 removed the lens bar): Canvas, Timeline, Journey and Palace turn the one stage with the open Scene\'s basis, but Places is absent (the atlas is Places) and Graph opens the atlas Graph (projection.constellation), which takes no subject from the stage — so the definition\'s Canvas→Timeline→Graph hop keeping the subject_ref is not built.',
    'G2', where=cite(UI + 'frame/InstrumentsSection.tsx', 'openInstrument(instrumentPayload(entry))'),
    note='Definition and code disagree: the definition\'s rail (instrumentRail.ts, TechneCentre.tsx consumers, a localStorage key) is superseded twice — by the lens bar (14 Oct) and by the browser Instruments group (F2); the book now holds pane state, so the localStorage clause no longer applies.')
homed('lane-1:D2', cite(RI, '// D2: the basis a view is saved against and applied from'), CANVAS, owner('ke-research'))
homed('lane-1:D3', cite(CR + 'knowledge/KnowledgeSurface.tsx', 'const applyView=(saved:SavedGraphView)=>'), GRAPH, owner('graph', note='A saved view\'s camera and filters persist in webview storage (KnowledgeSurface.tsx, oi-cradle.knowledge-view.v1) — presentation; the graph it restores over is the kernel `graph` reading.'))

# ── lane 2 (Timeline lens) ───────────────────────────────────────────────────
TL = reach('lens', 'Timeline', condition='open-work+wiki-scene')
TLR = RC + 'timeline/'
homed('lane-2:T1', cite('desktop/cradle/expressions-app/vendor/research-canvas/packages/desktop-api/src/techneBundle.ts', 'temporalPrecision is the facet precision verbatim'), TL, owner('techne-reading'))
homed('lane-2:T2', cite(TLR + 'TimelineNode.tsx', 'import { precisionLabel } from "./labels";'), TL, owner('techne-reading'))
homed('lane-2:T3', cite(TLR + 'TimelineNode.tsx', 'className={`timeline-node-standing timeline-node-standing--'), TL, owner('techne-reading'))
homed('lane-2:T4', cite(TLR + 'scale.ts', 'The zoom floor lets a deep-time reading fit (lane-2 T4)'), TL, owner('techne-reading'))
homed('lane-2:T5', cite(RI, 'import {timeAxisProjection,relativeTimeAxisProjection}'), TL, owner('techne-reading'),
      note='The relative axis itself is desktop/cradle/src/techne/m0m5/timeline/scale.ts (Relative axis, lane-2 T5), reached through the Timeline lens.')
homed('lane-2:T6', cite(CR + 'techne/m0m5/timeline/timeAxis.ts', 'export const TECHNE_TIME_AXIS_SCHEMA'), TL, owner('techne-reading'),
      note='Its lane-4 consumer is the frame\'s Places map, which retires (FOUNDATION §4); the atlas reads the session window through projections/atlas/sharedClock.ts, not this projection.')
homed('lane-2:T7', cite(TLR + 'TimelineAxis.tsx', 'major: AxisTick[];'), TL, owner('techne-reading'))
homed('lane-2:T8', cite(TLR + 'bands.ts', 'Period bands (lane-2 T8'), TL, owner('techne-reading'))
homed('lane-2:T9', cite(TLR + 'nesting.ts', 'lane-2 T9 — nested events with zoom-collapsing structure'), TL, owner('techne-reading'))
homed('lane-2:T10', cite(TLR + 'causeChain.ts', 'Cause chains along the axis (lane-2 T10)'), TL, owner('techne-reading'))
homed('lane-2:T11', cite(TLR + 'TimelineRelationshipLayer.tsx', 'The standing an edge is drawn with (lane-2 T11)'), TL, owner('techne-reading'))
homed('lane-2:T12', cite(TLR + 'clusters.ts', 'lane-2 T12 — honest clusters at the broad display tier'), TL, owner('techne-reading'))
homed('lane-2:T13', cite(TLR + 'TimelineSurface.tsx', 'The scale-window minimap (lane-2 T13)'), TL, owner('techne-reading'))
homed('lane-2:T14', cite(TLR + 'participantSpans.ts', 'lane-2 T14 — participant spans behind the event cards'), TL, owner('techne-reading'))
homed('lane-2:T15', cite(TLR + 'TimelineLens.tsx', "lane-2 T15–T18: the lens's presentation as a named view keeps it"), TL, owner('techne-reading', 'ke-research'))
homed('lane-2:T16', cite(RI, "// lane-2 T16: a card's colours persist in the Scene's timeline layout record"), TL, owner('techne-reading', 'ke-research'))
homed('lane-2:T17', cite(FSJ + 'sharedTimeWindow.tsx', "export const TIMELINE_ACT_LABEL='Read over this window';"), TL, owner('time-window', 'techne-reading'))
homed('lane-2:T18', cite(FSJ + 'researchMaterial.ts', 'workingSetRefs:string[];'), TL, owner('techne-reading', 'ke-research'))
homed('lane-2:T19', cite(RI, "// lane-2 T19: an event's evidence is read from the relation"), TL, owner('techne-reading'))
homed('lane-2:T20', cite(RI, '// lane-2 T20: the traversal trail, one history.'), TL, owner('time-window', 'techne-reading'))
homed('lane-2:T21', cite(RI, '// lane-2 T21/T22: "Show on the globe"'), TL, owner('time-window', 'techne-reading'),
      note='"Show on the globe" crosses to the frame\'s Places map, which FOUNDATION §4 retires; the crossing must be re-pointed at the atlas (ticket R1).',
      retires='FOUNDATION §4: the globe this carries to is the frame\'s Places map, which retires; the carry is re-homed onto the atlas (ticket R1).')
homed('lane-2:T22', cite(RI, '// lane-2 T22: the status line names the subject, reading basis and window'), TL, owner('time-window', 'techne-reading'))
homed('lane-2:T23', cite(TLR + 'palette.ts', "The chronology's one colour table (lane-2 T23)"), TL, owner('techne-reading'))
homed('lane-2:T24', cite(RI, '// lane-2 T24, hoisted to the install'), TL, owner('techne-reading'))
homed('lane-2:T25', cite(RI, '// lane-2 T25: the chronology, the Relations tab and the status line read one availability voice'), TL, owner('techne-reading'))

# ── lane 3 (the Expressions stage, the frame's own surfaces) ─────────────────
def stage(label, extra=''):
    return reach('stage', label, extra=extra, chain_extra=[cite(FSJ + 'app.ts', "case 'timeline':timelineOpen=!timelineOpen;")])

homed('lane-3:E01', cite(FSJ + 'app.ts', '// E01: clip extents come only from expressionTiming'), stage('Timeline (the scene track)'), owner('ke-read'),
      note='The candidate also draws the open work\'s Scenes as clips on the shared Session grid (timeline/expressionsTrackAdapter.ts) — a second reading of the same owner, not this surface.')
homed('lane-3:E02', cite(FSJ + 'app.ts', '/** E02b/E03: a scene is moved by its ref'), stage('Timeline (the scene track)'), owner('ke-edit'))
homed('lane-3:E03', cite(FSJ + 'app.ts', '// E03 (T-E03): a Scene is addressed by its own id'), stage('Timeline (the scene track)'), owner('ke-edit'))
homed('lane-3:E04', cite(FSJ + 'app.ts', '// E04/E06 body gesture state'), stage('Timeline (the scene track)'), owner('ke-edit'))
homed('lane-3:E05', cite(FSJ + 'app.ts', '// E05 trim state'), stage('Timeline (the scene track)'), owner('ke-edit'))
homed('lane-3:E06', cite(FSJ + 'journeyTimelineLayout.ts', '* E06 slip:'), stage('Timeline (the scene track)'), owner('ke-edit'))
homed('lane-3:E07', cite(FSJ + 'app.ts', '// E07 · split:'), stage('Timeline (the scene track)'), owner('ke-edit'))
homed('lane-3:E08', cite(FSJ + 'propertyTracks.ts', "export type Interpolation='linear'|'hold'|'smooth'|'bezier';"), stage('Timeline (channel and curve lanes)'), owner('ke-edit'))
homed('lane-3:E09', cite(FSJ + 'app.ts', '// E09/E10 · channel lane.'), stage('Timeline (channel and curve lanes)'), owner('ke-edit'))
homed('lane-3:E10', cite(FSJ + 'app.ts', '// E09/E10 channel lane: the selected channel and keyframe'), stage('Timeline (channel and curve lanes)'), owner('ke-edit'))
homed('lane-3:E11', cite(FSJ + 'app.ts', '// E11 · seams.'), stage('Timeline (the scene track\'s seams)'), owner('ke-edit'))
homed('lane-3:E12', cite(FSJ + 'app.ts', '// lane-3 E12/E13: journey locators (markers) and the loop brace.'), stage('Timeline (the ruler)'), owner('ke-edit'))
homed('lane-3:E13', cite(FSJ + 'app.ts', '/** E13b: the clock the running playback reads'), stage('Timeline (the ruler)'), owner('ke-edit'))
homed('lane-3:E14', cite(FSJ + 'app.ts', '// E14 nested expression occurrence'), stage('Timeline (the scene track)'), owner('ke-edit'))
homed('lane-3:E15', cite(FSJ + 'store.ts', '/** E15c: one Save is one kernel checkpoint.'), stage('undo/redo and Save'), owner('ke-edit'))
homed('lane-3:E16', cite(FSJ + 'store.ts', '/** E16 (spanning): open ONE labelled gesture'), stage('undo/redo and Save'), owner('ke-edit'))
homed('lane-3:E17', cite(FSJ + 'app.ts', '/** lane-3 E17: the one schedule for draft backups.'), stage('draft schedule'), owner('recovery'))
homed('lane-3:E18', cite(FSJ + 'recovery.ts', '// lane-3 E18: damaged or invalid draft material'), stage('draft records and quarantine'), owner('recovery'))
homed('lane-3:E19', cite(FSJ + 'recovery.ts', '// lane-3 E19 (owner quarantine)'), stage('recovery offer'), owner('recovery'))
homed('lane-3:E20', cite(FSJ + 'kernelExpressions.ts', "/** The kernel's Change grammar (oi.expression/v1), wire form"), stage('Save'), owner('ke-edit'))
homed('lane-3:E21', cite(FSJ + 'app.ts', '// ——— E21 (SC-6) scene → source → subject'), stage('inspector (source and subject)'), owner('standing'))
gap('lane-3:E22', 'unreachable',
    'The frame writes its address (scene, t, marker) into its own iframe location, but the candidate opens the frame with ?mode, ?world, ?host-load and ?expression only and shows no address: a person can neither see, copy nor open a deep link.',
    'G3', where=cite(FSJ + 'app.ts', '// E22: the address (scene, time, marker) is applied once the Expression has settled'),
    owner_=owner('ke-read'),
    note='Code-reading: packages/live-shell/ui/src/panels/expressions.tsx builds the frame URL from mode, world, host-load and expression; no candidate surface reads the iframe\'s location.')
homed('lane-3:E23', cite(FSJ + 'focusMode.ts', "// lane-3 E23: focus mode is the app's presenting mode"), stage('focus mode'), owner('ke-read'))
homed('lane-3:E24', cite(FSJ + 'transport.ts', '* Working-view transport (lane-3 E24'), stage('working-view transport (J/K/L)'), owner('ke-read'),
      note='The shell\'s one transport (F7) binds Expressions\' scene play/stop and arm; the frame\'s J/K shuttle and frame stepping are in-frame only.')
homed('lane-3:E25', cite(FSJ + 'snapModel.ts', '* Timeline snap model (lane-3 E25'), stage('Timeline (snap)'), owner('ke-edit'))
homed('lane-3:E26', cite(FSJ + 'app.ts', '// ——— E26 collections as bins'), stage('Library (collections)'), owner('ke-index'))

# ── lane 4 (the frame's Places map) ──────────────────────────────────────────
PL = reach('places', 'Places', condition='open-work+wiki-scene')
PG = RC + 'psychogeographic/'
def place(target, component, *owners_, note=None):
    homed(target, component, PL, owner(*owners_), note=note, retires=L4_RETIRES)

place('lane-4:T1', cite(PG + 'placeNavigation.ts', 'precision grammar on the live globe (lane-4 T1, T2, T10)'), 'techne-reading')
place('lane-4:T2', cite(PG + 'PsychogeographicMap.tsx', '/** Hands the host the fly-to choreography (`flyToPlace`)'), 'techne-reading')
place('lane-4:T3', cite(PG + 'placeNavigation.ts', '// T3: the default view and the two eased returns to it'), 'techne-reading')
place('lane-4:T4', cite(PG + 'basemapLayers.ts', 'Lane-4 T4/T5 — the basemap layer stack'), 'techne-reading', note='The offline core is bundled; live imagery and terrain come from tile providers, which are not suite owners.')
place('lane-4:T5', cite(PG + 'PsychogeographicMap.tsx', '/** Lane-4 T4/T5: the basemap stack the surface starts from'), 'techne-reading')
place('lane-4:T6', cite(PG + 'mapStyle.ts', "/** Lane-4 T6: the globe's atmosphere"), 'techne-reading')
place('lane-4:T7', cite(PG + 'disclosure.ts', 'Provider disclosure for the Places surface (lane-4 T7)'), 'techne-reading')
place('lane-4:T8', cite(PG + 'placeLayers.ts', 'Relation layers and region polygons for the Places map (lane-4 T8 + T9)'), 'techne-reading')
place('lane-4:T9', cite(PG + 'PsychogeographicMap.tsx', "/** The reading's full spatial facets"), 'techne-reading')
place('lane-4:T10', cite(PG + 'placeNavigation.ts', 'function markerKindFor(precision: string)'), 'techne-reading',
      note='The register\'s implemented evidence cites PsychogeographicMap.tsx at the lane-4 T24 prop; the precision grammar itself is placeNavigation.ts markerKindFor over the cradle authority precisionMarker.')
place('lane-4:T11', cite(PG + 'renderer.ts', '/** Lane-4 T11: the TRAVELLED_TO route'), 'techne-reading')
place('lane-4:T12', cite(PG + 'renderer.ts', '/** Lane-4 T12: the drawn LOCATED_IN hierarchy edges'), 'techne-reading')
place('lane-4:T13', cite(PG + 'placeProvenance.ts', 'Provenance on every pinned place — lane-4 T13'), 'techne-reading')
place('lane-4:T14', cite(PG + 'placeTimeControl.ts', 'Lane-4 T14–T16 — the docked time control on the Places map'), 'techne-reading', 'time-window',
      note='FOUNDATION §4 names placeTimeControl.ts among the overlays that retire: the atlas\'s own time control (ui/time-control.ts) is the re-home.')
place('lane-4:T15', cite(RI, '// Lane-4 T14–T16: the docked time control spans'), 'time-window', 'techne-reading')
place('lane-4:T16', cite(PG + 'disclosure.ts', '/** The imagery readout:'), 'techne-reading')
place('lane-4:T17', cite(PG + 'placeAuthoring.ts', 'Placemark authoring — lane-4 T17 (click to create), T18'), 'constellation')
place('lane-4:T18', cite(RI, "// Lane-4 T17–T19: the map's authoring surface asks this host for the owner's route"), 'constellation')
place('lane-4:T19', cite(PG + 'renderer.ts', '/** Lane-4 T19: a draggable marker'), 'constellation')
place('lane-4:T20', cite(RI, '// Lane-4 T20: named Places views.'), 'ke-research', 'techne-reading')
place('lane-4:T21', cite(FSJ + 'placeViews.ts', '/** lane-4 T21: the layers a Scene keeps'), 'ke-research')
place('lane-4:T22', cite(FSJ + 'placeSearchPanel.tsx', "/** Lane-4 T22 — the Places lens's search field"), 'techne-reading')
place('lane-4:T23', cite(PG + 'PsychogeographicMap.tsx', '/** Lane-4 T23: "Open in Timeline"'), 'techne-reading')
place('lane-4:T24', cite(PG + 'PsychogeographicMap.tsx', "// Lane-4 T24: honour the session's spatial focus once"), 'time-window', 'techne-reading')
place('lane-4:T25', cite(FSJ + 'placeTourPanel.tsx', '/** Lane-4 T25–T26 — the Places tour panel.'), 'ke-research', 'techne-reading')
place('lane-4:T26', cite(FSJ + 'placeTours.ts', '/** Lane-4 T25–T26 — Places tours'), 'ke-read', 'techne-reading')
OWNERS['nara-sky']=('nara-instrument → the personal Nara facade the candidate attaches (relayNaraChannel) → kernel `nara_identity` · transit (KernelOp::NaraIdentity)', [
    cite(RI, "const reply=await naraInstrumentRequest({operation:'identity',request:{operation:'transit',request}})"),
    cite(FSJ + 'kernelExpressions.ts', "return call('nara-instrument',{request},90000);"),
    cite(UI + 'panels/expressions.tsx', "if (facade) stopFacade = createCradleOwners(access.transport, {project: 'O-I', retainSelectionOnDispose: true, isCurrent}).attach?.(facade.frame, facade.state)"),
    cite(EB + 'cradle.ts', 'stop = relayNaraChannel(frame, transport, {'),
    cite(CR + 'expressions/naraChannel.ts', "case 'transit': fields(inner,['operation','request']); object(inner.request); break;"),
    cite(LIB, '    NaraIdentity {', 419)])
place('lane-4:T27', cite(RI, "const reply=await naraInstrumentRequest({operation:'identity',request:{operation:'transit',request}})"), 'nara-sky', 'time-window',
      note='The owner states the subsolar point only once the active suite carries QL main (PATH §7, install seam: QL-MEF #328); until then the reading says it is unavailable, by its own reason. The atlas carries the QL Sun (inhabitants/qlSkyEarthAdapter.ts), the re-home for day and night (R1).')
place('lane-4:T28', cite(PG + 'PsychogeographicMap.tsx', '/** Lane-4 T28: the reference-frame ladder'), 'techne-reading')
place('lane-4:T29', cite(PG + 'placeNavigation.ts', '// T29: stillness'), 'techne-reading')
place('lane-4:T30', cite(PG + 'LocationPanel.tsx', "/** Lane-4 T30: the place's standing class."), 'techne-reading')

# ── lane 5 (Journey and Palace) ──────────────────────────────────────────────
JN = reach('lens', 'Journey', condition='open-work+wiki-scene')
PA = reach('lens', 'Palace', condition='open-work+wiki-scene')
JI = FSJ + 'journeyInstrument.tsx'
PI = FSJ + 'palaceInstrument.tsx'
homed('lane-5:T1', cite(JI, 'export function installJourneyInstrument'), JN, owner('techne-reading'))
homed('lane-5:T2', cite(FSJ + 'app.ts', '// lane-5 T2 · compose a scene from the journey lens.'), JN, owner('ke-edit'))
homed('lane-5:T3', cite(FSJ + 'app.ts', "// lane-5 T3 · the pace draft's save."), JN, owner('ke-edit'))
homed('lane-5:T4', cite(FSJ + 'journeyBeats.ts', "* Identity: a beat card's identity is the binding's `scene_ref`, verbatim."), JN, owner('techne-reading'))
homed('lane-5:T5', cite(FSJ + 'journeyPath.ts', '// Lane-5 T5: a non-default switch mode and curve'), JN, owner('ke-edit'))
homed('lane-5:T6', cite(FSJ + 'app.ts', '// Lane-5 T6 · overlap-to-blend'), stage('scene strip (seams)'), owner('ke-edit'))
homed('lane-5:T7', cite(FSJ + 'app.ts', '// Lane-5 T7 · the live edge'), stage('scene strip (seams)'), owner('ke-read'))
homed('lane-5:T8', cite(FSJ + 'journeyPath.ts', '/** T8: where playback stops instead of wrapping'), JN, owner('ke-edit'))
homed('lane-5:T9', cite(JI, '/** T9: the presence disclosure for this load'), JN, owner('journey-presence', 'techne-reading'))
homed('lane-5:T10', cite(JI, "/** T10: enter the presented beat's Scene from the Journey through the owner's crossing"), JN, owner('crossing'))
homed('lane-5:T11', cite(FSJ + 'app.ts', '// T11: the in-frame return from a journey crossing.'), JN, owner('crossing'))
homed('lane-5:T12', cite(JI, "/** T12: the Scene's own explicit activation portals"), JN, owner('techne-reading', note='A portal opens through the frame\'s scene-portal summon to the host\'s surface seam; the beat\'s portals are the Scene\'s own triggers.'))
homed('lane-5:T13', cite(FSJ + 'journeyBeats.ts', '/** Present exactly when there are no cards'), JN, owner('techne-reading'))
def palace(target, component, *owners_, note=None):
    homed(target, component, PA, owner(*owners_), note=note, retires=N4_RETIRES)
palace('lane-5:T14', cite(PI, '/** T14: the Expression-wide Technè reading the integral whole composes from.'), 'techne-reading')
palace('lane-5:T15', cite(FSJ + 'palaceBoardView.tsx', "/** The Palace board's face (lane-5 T15)"), 'palace-presence', 'techne-reading')
palace('lane-5:T16', cite(FSJ + 'palaceBoardView.tsx', "/** lane-5 T16: one card's Open"), 'techne-reading')
palace('lane-5:T17', cite(FSJ + 'palaceBoardView.tsx', "/** lane-5 T17: the region card the walk's focused element"), 'techne-reading', 'palace-presence')
palace('lane-5:T18', cite(FSJ + 'palaceWhole.ts', "export type PalaceStanding = 'warranted' | 'owner' | 'free';"), 'techne-reading')
palace('lane-5:T19', cite(PI, '// T19: the Return proposal the Palace shows'), 'ke-invoke', 'techne-reading')
palace('lane-5:T20', cite(FSJ + 'palaceHop.ts', "(`techne-time-window`, operation `palace`)"), 'time-window', 'ke-compose')
palace('lane-5:T21', cite(PI, '// T21: the saved arrangement, walk position and bookmarks come back'), 'palace-presence')
homed('lane-5:T22', cite(FSJ + 'app.ts', '// T22: each saved card names its origin'), stage('Library'), owner('library'))
homed('lane-5:T23', cite(EB + 'timeWindow.ts', 'const crossed = crossToExpression(session, target);'), JN, owner('crossing', 'techne-reading'))
palace('lane-5:T24', cite(FSJ + 'palaceBookmarks.ts', 'Palace bookmarks and the named start (lane-5 T24)'), 'palace-presence')

TICKETS = [
    {'id': 'G1', 'rank': 1, 'kind': 'gap', 'title': 'A native receiver for the stage\'s file exports',
     'what': 'Give the candidate\'s main webview a download handler (on_download on the main window built at desktop/cradle/src-tauri/src/main.rs from config, saving to a chosen or Downloads path), or route saveBlob through one host channel that writes the bytes where the owner says. Homes the .canvas export and the frame PNG at once; every other <a download> in the frame lands with them.',
     'targets': ['lane-1:B2', 'lane-1:B3']},
    {'id': 'G2', 'rank': 2, 'kind': 'gap', 'title': 'The Instruments rail keeps the subject across instruments',
     'what': 'The browser\'s Instruments group is the rail: give its Graph the stage\'s subject (open the Graph and source pane centred on the open Scene\'s subject, as WorldBrowser\'s Knowledge › Graph already does) and its Earth the same subject (N2\'s subject door), so Canvas → Timeline → Graph keeps one subject_ref with no second navigation state.',
     'targets': ['lane-1:D1']},
    {'id': 'G3', 'rank': 3, 'kind': 'gap', 'title': 'The shell carries the frame\'s deep-link address',
     'what': 'The candidate opens the frame with ?expression only; carry the frame\'s address (scene ref, t, marker) on the book\'s selection and on the stage\'s open, and offer it to copy, so a reference opens the same Scene at the same time.',
     'targets': ['lane-3:E22']},
    {'id': 'R1', 'rank': 4, 'kind': 're-home', 'title': 'Re-home the frame\'s Places behaviour onto the atlas before the frame map is removed',
     'what': 'FOUNDATION §4: list each lane-4 behaviour worth keeping and port it onto the Archetypal-Earth atlas as a device or pane control (search, facets, tours, standing marks, navigation identity, time control → the atlas\'s own), re-point the Timeline\'s "Show on the globe" at the atlas, then remove the frame map. These targets are homed today on a home that retires.',
     'targets': [t for t in ROWS if t.startswith('lane-4:')] + ['lane-2:T21']},
    {'id': 'R2', 'rank': 5, 'kind': 're-home', 'title': 'Palaces move onto the atlas (N4)',
     'what': 'FOUNDATION N4: a palace is a place on the world you can enter; move the Palace instrument\'s whole, board, walk, Return and presence onto the atlas, then retire the frame\'s Palace lens.',
     'targets': ['lane-5:T14', 'lane-5:T15', 'lane-5:T16', 'lane-5:T17', 'lane-5:T18', 'lane-5:T19', 'lane-5:T20', 'lane-5:T21', 'lane-5:T24']},
    {'id': 'S1', 'rank': 6, 'kind': 'door', 'title': 'Mount N2\'s subject door, so the reading instruments do not depend on the Graph pane',
     'what': 'Every Timeline, Places, Journey and Palace home reads its facets only on a Wiki-bound Scene, and today the only door to one is the Graph and source pane\'s Examine in Technē (the Graph op reads in 88 s cold, PATH §7). techne/subject/openSubject.ts (openWorldSubject) is built and unreached (candidate-reachable: NOT); mounting it on the browser\'s and the tracks\' subject rows makes every one of these homes reachable without the Graph.',
     'targets': [t for t, r in ROWS.items() if r['home'] and r['home']['condition'] == 'open-work+wiki-scene']},
]

head = subprocess.run(['git', '-C', str(REPO), 'rev-parse', 'HEAD'], capture_output=True, text=True, check=True).stdout.strip()
assert len(ROWS) == 126, len(ROWS)
used = sorted({key for r in ROWS.values() if r['owner_op'] for key in r['owner_op']['chains']})
OWNER_OPS = {key: {'op': OWNERS[key][0], 'calls': OWNERS[key][1]} for key in used}
OUT.write_text(json.dumps({'recorded_on': '2026-10-15', 'candidate_head': head, 'routes': ROUTES, 'owner_ops': OWNER_OPS, 'rows': ROWS, 'notes': NOTES, 'tickets': TICKETS}, indent=1, ensure_ascii=False) + '\n')
print(f'wrote {OUT}: {len(ROWS)} rows, {sum(1 for r in ROWS.values() if r["home"])} homed, {sum(1 for r in ROWS.values() if r["gap"])} gaps at {head[:10]}')
