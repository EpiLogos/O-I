#!/usr/bin/env python3
"""The re-home input builder (ticket M, 15 Oct): resolve every cited needle to path:line in the seat and write the rehome input.

Each citation is (path, needle[, near]): the line is the match of `needle` nearest `near` (first match without it). The
output carries {path, line, quote=needle}; acceptance.py `rehome` re-opens each file and checks the line holds the quote.

Re-run by ticket T (15 Oct) after lanes P (6f82c20d6: G1, G3), N (3a8fbc2d6: S1, G2) and O (92a7d38d5, 235b4771f: R1, Places
onto the atlas): their rows re-homed, the closed tickets gone, and each changed row's note saying what changed.

Re-run by ticket X (15 Oct) after lane U (b5a935661, and 30ba8692f's World › Palaces: R2, palaces onto the atlas): the nine palace
rows homed on the atlas's palaces, the frame's Palace lens and its retiring homes gone, R2 closed.

Every citation is read at one revision (HEAD by default; `--at REV` after the output path), never from the seat's working tree: the
seat is shared with other lanes' uncommitted edits, as acceptance.py's progress verbs hold (its Tree). `rehome` re-opens the files
on disk, so it records this input from a tree whose files are that revision's.
"""
import json
import subprocess
import sys
from pathlib import Path

# The checkout this script stands in (never a machine path): re-run from any seat as the code moves.
REPO = Path(subprocess.run(['git', 'rev-parse', '--show-toplevel'], cwd=Path(__file__).parent, capture_output=True, text=True, check=True).stdout.strip())
OUT = Path(sys.argv[1])
REV = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == '--at' else 'HEAD'
_TEXT = {}


def text_at(path):
    """The file as the revision holds it."""
    if path not in _TEXT:
        shown = subprocess.run(['git', '-C', str(REPO), 'show', f'{REV}:{path}'], capture_output=True, text=True, check=False)
        if shown.returncode != 0:
            raise SystemExit(f'not in {REV}: {path}')
        _TEXT[path] = shown.stdout
    return _TEXT[path]

FSJ = 'desktop/cradle/expressions-app/field-studies-journeys/src/'
RC = 'desktop/cradle/expressions-app/vendor/research-canvas/packages/canvas/src/'
UI = 'packages/live-shell/ui/src/'
EB = 'packages/expressions-boundary/src/'
CR = 'desktop/cradle/src/'
LIB = 'desktop/cradle/kernel/src/lib.rs'


def cite(path, needle, near=None):
    lines = text_at(path).split('\n')
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
}
# The stage carries three lenses: its Palace lens retired with the frame's Palace (lane U, b5a935661; 30ba8692f) — palaces are entered
# on the Earth (PALACE_DOORS below).
LENS_FRAME = {
    'canvas': cite(FSJ + 'app.ts', "void researchInstruments?.open(lens==='canvas'?'m1'"),
    'timeline': cite(FSJ + 'app.ts', "void researchInstruments?.open(lens==='canvas'?'m1'"),
    'journey': cite(FSJ + 'app.ts', "if(lens==='journey')void journeyInstrument?.open()"),
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
# A Wiki-bound Scene has two doors (ticket T: lane N, 3a8fbc2d6, mounted N2's subject door): the browser's World rows in Technē,
# and Examine in the Graph and source pane. Both post the owner's selection ask, which the stage's navigator consumes (the tail).
WIKI_DOOR = [
    cite(UI + 'shell/ModeBrowser.tsx', 'if (isWorldGroup(category.id)) return <WorldGroupRows'),
    cite(UI + 'shell/ModeBrowser.tsx', "if (row.opens === 'subject') { void openHeldSubject(row.subject); return }"),
    cite(UI + 'techne/subject/subjectOpenings.ts', 'held = openingOf(await door(subject))'),
    cite(UI + 'techne/subject/openSubject.ts', 'const found = await resolveSubject(subject, source)'),
    cite(UI + 'techne/subject/subjectScenes.ts', 'source.ask({'),
    cite(UI + 'techne/subject/openSubject.ts', 'ask: request => requestWikiSelection(request),'),
    cite(UI + 'techne/subject/openSubject.ts', 'try { open(STAGE_KIND) }'),
]
WIKI_EXAMINE = [
    cite(UI + 'panels/knowledge.tsx', "registerPanel({id: 'world.knowledge'"),
    cite(CR + 'knowledge/KnowledgeSurface.tsx', 'await openSubjectInTechne(transport,binding.project,node'),
    cite(CR + 'knowledge/techneHandoff.ts', 'requestWikiSelection({'),
]
WIKI_TAIL = [
    cite(UI + 'panels/expressions.tsx', 'stopSelection.current = navigator.current.connectSelectionRequests()'),
    cite(EB + 'techne.ts', 'const openSelection = async (request: NativeTechneSelection)'),
    cite(CR + 'techne/wikiReadingProvider.ts', 'This Scene has no exact Wiki register binding'),
]
WIKI_SCENE = [*WIKI_DOOR, *WIKI_EXAMINE, *WIKI_TAIL]
# Places is the atlas, alone (ticket T: lane O, 92a7d38d5): the Earth pane, the M4′ World / Places plate on Technē's device side,
# and Technē's transport over the atlas's time. The frame's Places map, its lens row and chooser entry are removed.
AT = UI + 'projections/atlas/'
ATLAS_EARTH = [
    cite(UI + 'frame/instruments.ts', "'projection.earth': {label: 'Earth', mark: 'earth'"),
    cite(UI + 'frame/InstrumentsSection.tsx', 'openInstrument(instrumentPayload(entry))'),
    cite(AT + 'registerAtlasHost.ts', "registerProjectionModule({id: ATLAS_MODULE_ID, kind: 'projection.earth'"),
    cite(AT + 'AtlasProjectionPanel.tsx', 'places = bindPlaces({handle: mounted, transport, session: disclosureSession})'),
]
TD = UI + 'inhabitants/ql/devices/TechneDevices.tsx'
# The device side's atlas folds (M4′, M5′): a press opens the Earth on the focused pane, and holds across the focus it causes (d6b5aa672).
ATLAS_RACK = [
    cite(UI + 'shell/paneInstrument.ts', "case 'projection.earth':"),
    cite(UI + 'shell/modeDetails.tsx', 'techne: {clip: TechneClip, device: TechneChain,'),
    cite(UI + 'shell/ModeDetail.tsx', '<TechneDevices manifests={manifests} focusInstrument={focusInstrument ?? null} instrumentReading={instrumentReading} />'),
    cite(TD, 'onOpen={() => { setOpened({focus: focusAfterOpening(holder.id, focusInstrument), id: holder.id}); openOnFocusedPane(holder.id) }}'),
    cite(TD, "if (ATLAS_INSTRUMENTS.includes(id)) return {kind: 'projection.earth'}"),
]
ATLAS_PLATE = [*ATLAS_RACK, cite(TD, "'techne:m4': props => <PlacesPlate {...props} />,")]
ATLAS_TRANSPORT = [
    cite(UI + 'shell/modeTransports.tsx', 'const atlasTime = useAtlasTimeBindings()'),
    cite(AT + 'places/placesTransport.ts', 'export function atlasTimeBindings('),
]
# Palaces live in the atlas (ticket X: lane U, b5a935661, with 30ba8692f's World › Palaces; R2 closed). A palace is a register's native
# Expression standing on the Earth; three doors enter it there — the device side's M5′ fold (its plate lists the world's palaces and the
# doors the Earth's selection stands at), M4′'s Locations under the kind `palace`, and the browser's World › Palaces, which opens the
# Earth through the one instrument door and enters once the atlas has bound its palace owners. Inside, the M5′ plate holds the palace's
# controls, the Earth pane draws its floor, and Technē's transport walks it. The frame's Palace lens is removed.
PL = AT + 'palaces/'
PS = PL + 'palaceSession.ts'
PO = PL + 'palaceOwners.ts'
PALACE_DOORS = [
    *ATLAS_EARTH, *ATLAS_RACK,
    cite(TD, "'techne:m5': props => <PalacePlate {...props} />,"),
    cite(PL + 'PalacePlate.tsx', 'onClick={() => turn(row.key)} onDoubleClick={() => void enterPalace(palace)}>'),
    cite(PL + 'PalacePlate.tsx', 'onClick={() => void enterPalace(palace, {roomKey: room.key})}>'),
    cite(TD, "'techne:m4': props => <PlacesPlate {...props} />,"),
    cite(AT + 'places/PlacesPlate.tsx', "{kind === 'palace' ? <PalaceLocations handle={handle} query={query} />"),
    cite(AT + 'places/PlacesPlate.tsx', 'if (palace) void enterPalace(palace) }}>'),
    cite(UI + 'shell/ModeBrowser.tsx', 'if (category.id === PALACES_GROUP) return <PalaceGroupRows'),
    cite(UI + 'shell/ModeBrowser.tsx', "void enterFromOutside(palace, () => openInstrument('projection.earth'))"),
    cite(PL + 'palacesWorld.ts', 'export async function enterFromOutside('),
    cite(PL + 'palacesWorld.ts', 'void enterPalace(palace)'),
    cite(AT + 'AtlasProjectionPanel.tsx', 'palaces = bindPalaces({element, transport, storage: atlasMemoryStorage})'),
    cite(PL + 'palacesHost.ts', 'bindPalaceOwners(livePalaceOwners({transport, storage, said, live: () => live}))'),
    cite(PS, 'export async function enterPalace('),
]
PALACE_PLATE = [
    cite(TD, "return focus && ATLAS_INSTRUMENTS.includes(focus) && palace !== 'outside' ? 'techne:m5' : focus"),
    cite(PL + 'PalacePlate.tsx', 'const sections: PlateSection[] = here ? ['),
]
PALACE_FLOOR = [
    cite(PL + 'palacesHost.ts', 'root.render(createElement(PalaceFloor))'),
    cite(PL + 'PalaceFloor.tsx', 'export function PalaceFloor() {'),
]
PALACE_TRANSPORT = [
    cite(UI + 'shell/modeTransports.tsx', 'const palaceWalk = usePalaceWalkBindings()'),
    cite(PL + 'palaceTransport.ts', 'export function usePalaceWalkBindings(): TransportBindings {'),
]
# lane-2 T21: the Timeline's "Show on the globe" writes the session's focus and window, and the atlas follows them.
CARRY = [
    cite(FSJ + 'researchInstruments.tsx', '// lane-2 T21/T22: "Show on the globe"'),
    cite(FSJ + 'researchInstruments.tsx', 'the Earth atlas turns to it (Technē › Earth)'),
]
# The Studio plate on Expressions' Device side (lane P: its head shows and copies the frame's address).
STUDIO_CHAIN = [
    cite(UI + 'shell/modeDetails.tsx', 'expressions: {clip: ExpressionsClip, device: ExpressionsChain,'),
    cite(UI + 'shell/modeDetails.tsx', 'function ExpressionsChain() { const {native} = useDetailReading(); return <NativeWorldDetail mode="device" {...native} /> }'),
    cite(UI + 'components/NativeWorldDetail.tsx', '<ExpressionsStudio reading={reading} request={request}'),
]
# The browser's Instruments is the rail (lane N, G2): the stage's lenses keep the open Scene, the Graph opens on the held subject.
RAIL_CHAIN = [
    cite(UI + 'shell/modeBrowsers.tsx', "{id: 'instruments', categories: [{id: 'instruments', label: 'Instruments'"),
    cite(UI + 'frame/InstrumentsSection.tsx', 'openInstrument(instrumentPayload(entry))'),
    cite(UI + 'frame/instrumentDoor.ts', 'if (lens) driveStageLens(lens, reportInstrumentFault)'),
    cite(UI + 'frame/instruments.ts', "'projection.constellation': {label: 'Graph', mark: 'orbit'"),
    cite(AT + 'registerAtlasHost.ts', "registerProjectionModule({id: ATLAS_MODULE_ID, kind: 'projection.constellation'"),
    cite(AT + 'registerAtlasHost.ts', "if (view === 'graph') focusGraphOnOpen("),
    cite(UI + 'techne/subject/graphFocus.ts', 'atlas.ctl.navigate(next)'),
    cite(UI + 'techne/subject/graphFocus.ts', 'say(noNodeWords(titleOf(open.encounter, ref)))'),
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

PALACE_IN = ('Technē › a palace, entered on the Earth: the device side\'s M5′ Palace fold (it opens the Earth on the focused pane; its plate '
             'lists the world\'s palaces — press one to turn the Earth to its door, double-click to enter — and the doors the Earth\'s '
             'selection stands at), or the M4′ World / Places plate\'s Locations under the kind palace (double-click), or the browser\'s '
             'World › Palaces (double-click or Enter: it opens the Earth, waits for it, and enters)')
PALACE_NO_WORK = (' No open work is needed: a palace is a register\'s own native Expression, read through the suite\'s owners; Escape, or '
                  'the plate\'s Portals › ↩ the Earth, leaves it.')
REACH_TEXT = {
    'lens': 'Any mode → browser › Instruments › {L} (double-click, or drag into a pane) → the Expressions stage pane opens and turns to its {L} lens → the frame\'s {L} instrument{X}. First an open native Expression: Expressions › browser › Expressions › a work (or New).',
    'stage': 'Expressions › the centre\'s Expressions stage pane (the hosted frame, edge to edge) → the frame\'s own {L}{X}. Its owner writes need an open native Expression (Expressions › browser › Expressions › a work, or New); on the frame\'s local draft they stay local.',
    'graph': 'The Graph and source pane (world.knowledge): Central › a Day clip › Clip view › names, or Expressions › browser › Knowledge › Graph (with an open work), or a frame card\'s Show in graph → the knowledge graph{X}.',
    'atlas': 'Technē › the Earth pane, the atlas (browser › Instruments › Earth, double-click or drag into a pane; or the device side\'s M4′ World fold, which opens the Earth on the focused pane) → with the Earth focused, the device side\'s M4′ World fold stands the M4 World / Places plate open → {X}. No open work is needed: the atlas reads the suite\'s owners.',
    'globe': 'Technē › the Earth pane, the atlas (browser › Instruments › Earth, double-click or drag into a pane; or the device side\'s M4′ World fold, which opens the Earth on the focused pane) → {X}. No open work is needed: the atlas reads the suite\'s owners.',
    'atlas-transport': 'Technē › the Earth pane, the atlas (browser › Instruments › Earth, or the device side\'s M4′ World fold) → Technē\'s transport over the atlas\'s time: {X}. No open work is needed; the shared window is written only while a session stands (a work open in Technē).',
    'carry': 'Any mode → browser › Instruments › Timeline (double-click, or drag into a pane) → the stage turns to its Timeline lens → an event › Show on the globe (the event\'s place becomes the session\'s spatial focus, its validity the window) → Technē › the Earth pane, the atlas (browser › Instruments › Earth, or the device side\'s M4′ World fold){X}. First an open native Expression: Expressions › browser › Expressions › a work (or New).',
    'studio': 'Expressions › the detail row\'s Device side, the Studio plate → its {L}{X}. First an open native Expression: Expressions › browser › Expressions › a work (or New).',
    'rail': 'Any mode → browser › Instruments › Canvas or Timeline (the one stage turns and keeps its open Scene), then › Graph (double-click, or drag into a pane) → the Graph, the atlas\'s graph view, opens turned to the subject held now (THE selection){X}. First an open native Expression: Expressions › browser › Expressions › a work (or New).',
    'palace-plate': PALACE_IN + ' → inside, the device side stands the M5′ Palace / Integral Whole plate open → {X}.' + PALACE_NO_WORK,
    'palace-floor': PALACE_IN + ' → inside, the Earth pane draws the palace\'s floor plan, its rooms along the path → {X}.' + PALACE_NO_WORK,
    'palace-transport': PALACE_IN + ' → inside, Technē\'s transport walks the palace → {X}.' + PALACE_NO_WORK,
}
WIKI_TEXT = ' Its dated and placed facets read only a Scene bound to a Wiki register, and two doors open one in the stage: Technē › browser › Locations or Places › a subject (double-click or Enter) opens the Scene that carries it (N2\'s subject door); or the Graph and source pane › a subject › Examine in Technē opens the register\'s Scene. Any other work is refused by the owner read, by name.'


ROUTES = {}


def reach(kind, label, extra='', chain_extra=(), condition='open-work'):
    if kind == 'lens':
        route, chain = f'lens:{label.lower()}', [LENS_ROW[label.lower()], *LENS_CHAIN, LENS_FRAME[label.lower()], *OPEN_WORK]
    elif kind == 'stage':
        route, chain = 'stage', [*STAGE_CHAIN, *OPEN_WORK]
    elif kind == 'atlas':
        route, chain = 'atlas:plate', [*ATLAS_EARTH, *ATLAS_PLATE]
    elif kind == 'globe':
        route, chain = 'atlas:globe', [*ATLAS_EARTH]
    elif kind == 'atlas-transport':
        route, chain = 'atlas:transport', [*ATLAS_EARTH, *ATLAS_TRANSPORT]
    elif kind == 'carry':
        route, chain = 'carry:timeline-to-atlas', [LENS_ROW['timeline'], *LENS_CHAIN, LENS_FRAME['timeline'], *OPEN_WORK, *CARRY, *ATLAS_EARTH]
    elif kind == 'studio':
        route, chain = 'studio', [*STUDIO_CHAIN, *OPEN_WORK]
    elif kind == 'rail':
        route, chain = 'rail', [*RAIL_CHAIN, *OPEN_WORK]
    elif kind == 'palace-plate':
        route, chain = 'atlas:palace-plate', [*PALACE_DOORS, *PALACE_PLATE]
    elif kind == 'palace-floor':
        route, chain = 'atlas:palace-floor', [*PALACE_DOORS, *PALACE_FLOOR]
    elif kind == 'palace-transport':
        route, chain = 'atlas:palace-transport', [*PALACE_DOORS, *PALACE_TRANSPORT]
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
    # ticket X (15 Oct): the palace's composition and Return are written by the atlas's palace owners (palaces/palaceOwners.ts
    # livePalaceOwners, bound while the Earth stands), through the cradle owners' kernel-expression channel — the frame's Palace is removed.
    'ke-compose': ('kernel `expression` op · edit, the palace\'s composition: one CAS-gated edit of the register\'s Expression (m0m5/palace/basis.ts palaceEditRequest), its readback checked (KernelOp::Expression)', [
        cite(PS, 'const result = palaceComposeReply(await owners.edit(palaceEditRequest(here.draftDoc.expression_ref, here.draftDoc.revision, changes)))'),
        cite(CR + 'techne/m0m5/palace/basis.ts', 'export function palaceEditRequest('),
        cite(PO, 'edit: request => expression(request),'),
        cite(PO, "const expression = async (request: Record<string, unknown>) => (await channel('kernel-expression'))(request, context())"),
        *KE_RELAY[3:]]),
    'ke-invoke': ('the kernel-expression channel · invoke_action, the routed Return (expressions-boundary cradle.ts frameAction): the owner re-reads the reading the proposal came from and decides; only then kernel `invoke_action` (KernelOp::InvokeAction) dispatches it', [
        cite(PS, 'const raw = await owners.invoke(request as unknown as Record<string, unknown>)'),
        cite(PO, 'invoke: request => expression(request),'),
        cite(PO, "const expression = async (request: Record<string, unknown>) => (await channel('kernel-expression'))(request, context())"),
        cite(EB + 'cradle.ts', "'kernel-expression': (request, context) => object(request) && request.operation === 'invoke_action'"),
        cite(EB + 'cradle.ts', 'const reading = assertReading(await readWikiSceneTechne(transport, request.reading_request));'),
        cite(EB + 'cradle.ts', "const call = await kernelOp(transport, {op: 'invoke_action', invocation: {action: verdict.action"),
        cite(LIB, '    InvokeAction {', 513)]),
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
    # ticket X: the presence owner unchanged, over the atlas's workspace memory instead of the webview's raw storage (lane U).
    'palace-presence': ('the Palace presence store (desktop/cradle/src/techne/m0m5/palace/presence.ts) over the atlas\'s workspace memory (AtlasProjectionPanel.tsx atlasMemoryStorage, bound by palaces/palacesHost.ts): presentation by the target\'s own design — not a suite owner', [
        cite(PS, 'if (!savePalaceComposition(owners?.storage() ?? null, next, reading) && !persistFailed) {'),
        cite(PS, 'const restored = restorePalaceComposition(whole.reading, owners.storage())'),
        cite(CR + 'techne/m0m5/palace/presence.ts', 'export function savePalaceComposition('),
        cite(CR + 'techne/m0m5/palace/presence.ts', 'export function restorePalaceComposition('),
        cite(PL + 'palacesHost.ts', 'bindPalaceOwners(livePalaceOwners({transport, storage, said, live: () => live}))'),
        cite(AT + 'AtlasProjectionPanel.tsx', 'palaces = bindPalaces({element, transport, storage: atlasMemoryStorage})'),
        cite(AT + 'AtlasProjectionPanel.tsx', 'export function atlasMemoryStorage(): Storage {')]),
    # ticket X: the palace's whole, read by the atlas itself through the owner the frame's Palace reached.
    'palace-reading': ('techne-reading through the atlas\'s palace owners: the owner\'s Expression-wide reading (readWikiSceneTechne, scope "expression") over the register\'s own Expression, its document read with kernel `expression` op · inspect, opened by its owner first when the kernel does not hold it (KernelOp::Expression, KernelOp::Knowledge) — read only', [
        cite(PO, "readWhole: async basis => (await channel('techne-reading'))({...basis, scope: 'expression'}, context()),"),
        cite(PO, "const data = await expression({operation: 'inspect', expression_ref: ref}) as {document?: unknown} | null"),
        cite(PO, 'const held = await ensureWikiNativeExpression(transport, register)'),
        cite(PO, "module.createCradleOwners(transport, {project: 'O-I', personal: false, isCurrent: live})"),
        cite(EB + 'cradle.ts', "'techne-reading': request => readWikiSceneTechne(transport, request)"),
        cite(CR + 'techne/wikiReadingProvider.ts', 'export async function readWikiSceneTechne(transport: KernelTransportStatus, input: unknown)'),
        cite(CR + 'techne/wikiReadingProvider.ts', 'const inspected = await kernelOp(transport, {op: "expression", request: {operation: "inspect", expression_ref: request.expression_ref}});'),
        cite(CR + 'techne/wikiExpression.ts', 'kernelOp(transport, {op: "knowledge", project: register.project'),
        cite(EB + 'cradle.ts', ": data({op: 'expression', request} as KernelOp, 'expression', context)"),
        cite(LIB, '    Expression {', 379),
        cite(LIB, '    Knowledge {', 447)]),
    # ticket X: an object a palace holds opens through the shell's own doors; the Open's trail step rides the shared session.
    'palace-doors': ('the shell\'s own doors, through the atlas\'s palace owners (palaces/palaceOwners.ts open): a region\'s one Expression through the App\'s Expression door (timelinePaneHost journey.openExpression), a room\'s Scene through the owner\'s selection ask (requestWikiSelection, then the stage presented), a subject through the subject door (openWorldSubject), an entry through the instrument door with its ref as the subject, a source on Graph and source; the Open\'s trail step on the shared session (m0m5/palace/basis.ts palaceTrailStep → disclosureSession recordTraversal) — no kernel write', [
        cite(PS, 'const words = opened(() => owners!.open.scene(here.palace, room))'),
        cite(PS, 'const words = opened(() => owners!.open.expression(ref))'),
        cite(PO, 'const door = timelineReading()?.journey?.openExpression'),
        cite(PO, "requestWikiSelection({registerKey: palace.key, sceneRef: room.key, entityRef: null, subjectRef: null, title: room.name, origin: 'external'})"),
        cite(PO, 'void openWorldSubject({ref, title})'),
        cite(PO, 'openInstrument(payload, undefined, {ref, title: ref})'),
        cite(PO, "window.dispatchEvent(new CustomEvent('oi:epi-open-knowledge'"),
        cite(PS, 'palaceTrailStep(owners.session, here.reading, ref)'),
        cite(CR + 'techne/m0m5/palace/basis.ts', "store.recordTraversal({kind: 'traversal', instrument: 'expressions', step: 'endpoint'"),
        cite(CR + 'techne/session.ts', 'export const disclosureSession: DisclosureSessionStore = createDisclosureSessionStore();')]),
    'library': ('kernel `expression` op · list/inspect for kernel-bound entries + the frame\'s browser-local library store (libraryStore.ts)', [
        cite(FSJ + 'app.ts', "// T22: a kernel-bound library entry is opened from the kernel once the native channel is up"), *KE_RELAY]),
    'graph-hop': ('kernel `expression` op · inspect (the card\'s subject basis) → the Graph and source pane centred on it, which reads kernel `graph`', [
        cite(UI + 'components/WorldBrowser.tsx', "owners.channels['kernel-expression']({operation: 'inspect', expression_ref: captured.basis.expression_ref}"),
        cite(UI + 'native/hostedSummons.ts', "deps.openKnowledge({title: 'Graph', project, plane: 'graph'"),
        cite(CR + 'knowledge/graph.ts', 'const response=await kernelOp(transport,{op:"graph",project,query'),
        cite(LIB, '    Graph {', 461)]),
    # ticket T (15 Oct): the owners lanes N, O and P's homes read
    'download-receiver': ('the host\'s download receiver (desktop/cradle/src-tauri/src/downloads.rs), attached to every window the config builds: the file lands where the platform puts downloads and the Studio\'s Capture section says where, or names the fault — a native host seam, not a kernel op', [
        cite('desktop/cradle/src-tauri/src/downloads.rs', 'pub fn receiver<R: Runtime>('),
        cite('desktop/cradle/src-tauri/src/main.rs', 'builder.on_download(downloads::receiver()).build()?;'),
        cite(UI + 'components/expressions/studio/StudioStage.tsx', '{exported && <p className="studio-export-line"')]),
    'frame-address': ('the frame\'s own deep-link address (scene, t, marker), announced with its state and validated by the boundary; the shell keeps it beside the open work in the book\'s engine checkpoint and reopens the frame there — presentation over the open Scene, no owner write', [
        cite(FSJ + 'app.ts', 'function hostAddress()'),
        cite(FSJ + 'app.ts', 'const address=hostAddress();'),
        cite(EB + 'protocol.ts', 'export function readHostedAddress'),
        cite(UI + 'panels/expressions.tsx', 'function engineCheckpoint('),
        cite(EB + 'protocol.ts', 'export function entryAtAddress')]),
    'suite-reading': ('the atlas\'s suite reading: kernel `graph` op (KernelOp::Graph — Central\'s wiki, the Shared Field, AIKit\'s resolution, one input at a time) + Central\'s wiki file through kernel `file_read` (KernelOp::FileRead), composed by provider/suiteReading.ts — read only', [
        cite(AT + 'AtlasProjectionPanel.tsx', 'const provider = suiteProvider(transport)'),
        cite(AT + 'provider/suiteProvider.ts', "graph: input => readGraph(transport, undefined, '', {input, max_nodes: MAX_NODES, max_edges: MAX_EDGES}),"),
        cite(AT + 'provider/suiteProvider.ts', 'const file = await readFile(transport, entry.location);'),
        cite(CR + 'knowledge/graph.ts', 'const response=await kernelOp(transport,{op:"graph",project,query'),
        cite(CR + 'files/client.ts', 'const result=await kernelOp(transport,{op:"file_read",location});'),
        cite(LIB, '    Graph {', 464),
        cite(LIB, '    FileRead {', 972)]),
    'atlas-own': ('none — the atlas\'s own globe (its north-up rig, atmosphere and imagery) and the plate\'s words about it: presentation that reads and writes no suite owner', [
        cite(AT + 'src/globe/controls.ts', 'A north-up, inertial orbit rig'),
        cite(AT + 'src/globe/engine.ts', 'private shell: AtmosphereShell;'),
        cite(AT + 'src/globe/tiles.ts', 'streaming NASA GIBS Blue Marble')]),
    'atlas-window': ('the host\'s disclosure session window (desktop/cradle/src/techne/session.ts): the atlas\'s clock is a face of it (sharedClock.ts) and writes it by compare-and-set (expressions-boundary timeWindow.ts) — a shell session owner, not a kernel op; written only while a session stands', [
        cite(AT + 'AtlasProjectionPanel.tsx', 'clock: (time, scale) => bindSharedTimeClock({store: disclosureSession, time, scale})'),
        cite(AT + 'sharedClock.ts', 'export function writeSharedWindow(store: DisclosureSessionStore, window: SharedWindow | null): string | null {'),
        cite(EB + 'timeWindow.ts', 'export function writeSharedWindowCompareAndSet('),
        cite(CR + 'techne/session.ts', 'export const disclosureSession: DisclosureSessionStore = createDisclosureSessionStore();')]),
    'spatial-focus': ('the host\'s disclosure session · spatial_focus_ref (desktop/cradle/src/techne/session.ts), followed by the atlas (places/placesHost.ts followSpatialFocus) — a shell session owner, not a kernel op', [
        cite(AT + 'places/placesHost.ts', 'const ref = session.get()?.spatial_focus_ref ?? null;'),
        cite(AT + 'AtlasProjectionPanel.tsx', 'places = bindPlaces({handle: mounted, transport, session: disclosureSession})'),
        cite(CR + 'techne/session.ts', 'export const disclosureSession: DisclosureSessionStore = createDisclosureSessionStore();')]),
    'wiki-facts': ('the Wiki\'s time-and-place editor (WikiFactsEditor offerConstellationRoute) → AIKit `aikit.wiki.facts.apply` through kernel `invoke_action` (KernelOp::InvokeAction): the person chooses a source and saves; the plate never writes a coordinate', [
        cite(AT + 'places/placesHost.ts', 'editor => editor.offerConstellationRoute(subjectRef, draft),'),
        cite(CR + 'knowledge/WikiFactsEditor.tsx', 'export function offerConstellationRoute('),
        cite(CR + 'knowledge/wikiFacts.ts', "invoke<Record<string,unknown>>(transport,project,'aikit.wiki.facts.apply'"),
        cite(CR + 'knowledge/construction.ts', "const op: KernelOp = {op: 'invoke_action', project, invocation: {action, target_ref, input}};"),
        cite(LIB, '    InvokeAction {', 513)]),
    'ql-sun': ('kernel `nara_identity` op · transit (KernelOp::NaraIdentity): the QL owner\'s stated subsolar point for the instant the Earth shows, admitted by the atlas (inhabitants/qlSkyEarthAdapter.ts admitDatedSubsolar)', [
        cite(AT + 'AtlasProjectionPanel.tsx', 'admitDatedSubsolar(loaded.field, transport, instant)'),
        cite(UI + 'inhabitants/qlSkyEarthAdapter.ts', "const call = await kernelOp(transport, {op: 'nara_identity', request: {operation: 'transit', request: request.value}});"),
        cite(LIB, '    NaraIdentity {', 422)]),
}


def owner(*keys, note=None):
    out = {'op': ' + '.join(OWNERS[key][0] for key in keys), 'call': OWNERS[keys[0]][1][0], 'chains': list(keys)}
    if note:
        out['note'] = note
    return out


ROWS = {}
NOTES = {}


def homed(target, component, reach_, owner_, note=None):
    # No home retires (ticket X: R2 closed with the palaces on the atlas, as R1 closed with Places).
    row = {'home': {'component': component, 'reach': reach_['text'], 'route': reach_['route'], 'condition': reach_['condition']}, 'owner_op': owner_, 'gap': None}
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
homed('lane-1:B2', cite(RI, '// B2 — the composed Canvas as one Obsidian .canvas file'), CANVAS, owner('ke-research', 'download-receiver'),
      note='homed (lane P, 6f82c20d6; G1 closed): every window the config would create is now built in setup with the host\'s download receiver (src-tauri/src/downloads.rs receiver, attached in main.rs), so the .canvas export lands where the platform puts downloads (placement.json rules no export home) and the Studio\'s Capture section says where, or names the fault. The import stays one owner edit. Screen leg UNVERIFIED.')
homed('lane-1:B3', cite(RI, '// B3 — the selection (or a frame\'s members) as the canvas draws it'), CANVAS, owner('ke-read', 'download-receiver'),
      note='homed (lane P, 6f82c20d6; G1 closed): the frame PNG lands through the same receiver as B2, and the Studio\'s Capture section says where. Screen leg UNVERIFIED.')
homed('lane-1:B4', cite(RI, '// B4: applying a view reports the members that have left the Scene'), CANVAS, owner('ke-research', note='Views are saved in the Scene\'s research material; applying one reads the open Scene.'))
GRAPH = reach('graph', 'Graph', condition='none')
homed('lane-1:C1', cite(CR + 'knowledge/graphNavigation.ts', 'export function projectUnresolvedGraph(reading: GraphReading): GraphReading {'), GRAPH, owner('graph'),
      note='PATH §7 records the Graph op at 88 s cold with AIKit timing out at 20 s: the graph may stand without AIKit\'s rows until warm.')
homed('lane-1:C2', cite(CR + 'knowledge/GraphCanvas.tsx', "import {NavigationMinimap,type NavigationMinimapController} from '../shared/NavigationMinimap.tsx';"), GRAPH, owner('graph'))
homed('lane-1:C3', cite(RI, '{current&&host.showInGraph&&'), reach('lens', 'Canvas', extra=' › a bound card › Show in graph → the Graph and source pane centred on its subject'),
      owner('graph-hop'),
      note='The register\'s implemented evidence cites desktop/cradle/src/library/techneSummon.tsx, which the candidate does not reach (legacy desktop); the candidate\'s route is the frame\'s graph summon answered by native/hostedSummons.ts, and Expressions › browser › Knowledge › Graph (WorldBrowser.tsx, native/knowledgeOpen.ts).')
homed('lane-1:C4', cite(CR + 'knowledge/GraphCanvas.tsx', 'emphasizedGraphRelations'), GRAPH, owner('graph'))
homed('lane-1:D1', cite(UI + 'frame/InstrumentsSection.tsx', 'openInstrument(instrumentPayload(entry))'),
      reach('rail', 'Graph', extra=', or says on the Instruments line that it draws no node for it'), owner('suite-reading', 'ke-read'),
      note='homed (lane N, 3a8fbc2d6; G2 closed): the browser\'s Instruments is the rail — the stage\'s lenses turn the one stage, which keeps its open Scene, and the Graph (the atlas\'s graph view) opens turned to the subject held now, THE selection, through the atlas\'s own focus (registerAtlasHost.ts focusGraphOnOpen → techne/subject/graphFocus.ts navigate), with no second navigation state; with no node for it, the Instruments line says so. One atlas per session: a Graph opened beside the Earth is held and turns nothing (lane N\'s carry). The definition\'s localStorage clause stays superseded (the book holds pane state). Screen leg UNVERIFIED.')
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
homed('lane-2:T21', cite(UI + 'projections/atlas/places/placesHost.ts', 'function followSpatialFocus('),
      reach('carry', 'Timeline', extra=' turns to the place, and its clock stands in the window', condition='open-work+wiki-scene'),
      owner('spatial-focus', 'time-window', 'techne-reading'))
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
homed('lane-3:E22', cite(UI + 'components/expressions/studio/ExpressionsStudio.tsx', "...(link ? [{icon: 'link' as const, label: `Copy address: ${link}`"),
      reach('studio', 'head', extra=', whose link mark names the frame\'s address in words and copies it whole (only a native work has an address)'), owner('frame-address', 'ke-read'),
      note='homed (lane P, 6f82c20d6; G3 closed): the frame announces its address (scene, t, marker) with its state (app.ts hostAddress); the boundary validates it through the frame\'s own deep-link grammar (protocol.ts readHostedAddress); the shell keeps it beside the open work in the book\'s engine checkpoint (panels/expressions.tsx engineCheckpoint) and reopens the frame there (protocol.ts entryAtAddress); the Studio\'s head names it and copies it. No OS URL scheme is registered, so an address opens only from inside the app (lane P\'s carry). Screen leg UNVERIFIED.')
homed('lane-3:E23', cite(FSJ + 'focusMode.ts', "// lane-3 E23: focus mode is the app's presenting mode"), stage('focus mode'), owner('ke-read'))
homed('lane-3:E24', cite(FSJ + 'transport.ts', '* Working-view transport (lane-3 E24'), stage('working-view transport (J/K/L)'), owner('ke-read'),
      note='The shell\'s one transport (F7) binds Expressions\' scene play/stop and arm; the frame\'s J/K shuttle and frame stepping are in-frame only.')
homed('lane-3:E25', cite(FSJ + 'snapModel.ts', '* Timeline snap model (lane-3 E25'), stage('Timeline (snap)'), owner('ke-edit'))
homed('lane-3:E26', cite(FSJ + 'app.ts', '// ——— E26 collections as bins'), stage('Library (collections)'), owner('ke-index'))

# ── lane 4 (Places: the atlas, alone — lane O, 92a7d38d5, ticket R1) ─────────
# The 31 Places targets' homes on the atlas, as tickets/T-PLACES-ONTO-ATLAS.md lists them: the M4 World / Places plate, the globe's
# own gestures, and Technē's transport over the atlas's time. The frame's Places map is removed, so no home here retires. A behaviour
# lane O judged not worth keeping is recorded with its reason in the row's note; what waits on an owner is a gap with its ticket.
PP = AT + 'places/PlacesPlate.tsx'
O = 're-homed on the atlas (lane O, 92a7d38d5; R1 closed: the frame\'s Places map is removed, so this home no longer retires): '
def place(target, component, extra, *owners_, kind='atlas', note=''):
    homed(target, component, reach(kind, 'Places', extra=extra, condition='none'), owner(*owners_), note=O + note)

place('lane-4:T1', cite(AT + 'AtlasProjectionPanel.tsx', "export const GLOBE_GESTURES = 'Drag to turn it (north stays up)"),
      'the globe itself: drag turns it (north stays up), its words in the Info view\'s hover', 'atlas-own', kind='globe',
      note='spin is the atlas\'s own drag, its words in the Info view\'s hover (GLOBE_GESTURES). Not kept, lane O\'s judgement: pitch and bearing — the atlas\'s rig is north-up by its own law (src/globe/controls.ts:1-5) and MapLibre\'s camera does not port onto the three.js rig; a roll would be new code, not a port.')
place('lane-4:T2', cite(AT + 'places/placesHost.ts', 'export function turnAtlasTo('),
      'the plate\'s Locations › a place (it turns the Earth), or the session\'s spatial focus', 'suite-reading',
      note='a place chosen on the plate\'s Locations, or named by the session\'s spatial focus, turns the Earth through places/placesHost.ts turnAtlasTo at the atlas\'s own framing for its precision (2.25 or 2.6 globe radii); an unlocated place turns nothing.')
place('lane-4:T3', cite(AT + 'src/globe/controls.ts', 'A north-up, inertial orbit rig'),
      'the globe itself: Escape steps back to the atlas\'s world view', 'atlas-own', kind='globe',
      note='Not kept as a control, lane O\'s judgement: the rig never leaves north (src/globe/controls.ts:1), so there is no bearing to reset; "home" is the atlas\'s own world view, and Escape steps back to it.')
place('lane-4:T4', cite(PP, '<Reading name="Imagery"'),
      'the plate\'s Landmass › Imagery', 'atlas-own',
      note='the plate\'s Landmass names the imagery the atlas draws (NASA Blue Marble, NASA GIBS tiles close in). Not kept, lane O\'s judgement: the opt-in stack of live providers (OSM, Esri, Sentinel-2) over an offline pack — the providers are not suite owners and the MapLibre stack does not port to the atlas\'s globe.')
place('lane-4:T5', cite(PP, 'no terrain source is disclosed'),
      'the plate\'s Landmass › Terrain', 'atlas-own',
      note='its honesty clause stands on the plate\'s Landmass ("no terrain source is disclosed", never a fake horizon). Not kept, lane O\'s judgement: the terrain layer itself — no terrain source is in the suite.')
place('lane-4:T6', cite(AT + 'src/globe/engine.ts', 'private shell: AtmosphereShell;'),
      'the globe itself: its atmosphere and limb', 'atlas-own', kind='globe',
      note='the globe\'s own atmosphere shell and aura (src/globe/engine.ts), tinted by the field\'s palette; nothing to port.')
place('lane-4:T7', cite(PP, 'NASA Blue Marble, with NASA GIBS tiles close in'),
      'the plate\'s Landmass › Imagery', 'atlas-own',
      note='the imagery the atlas draws is named on the plate\'s Landmass, never over the globe.')
place('lane-4:T8', cite(PP, 'handle.ctl.setFilter(narrowed(row) ? rest : {...rest, kinds: [row.locus]})'),
      'the plate\'s Relations › a relation (a press narrows the Earth to its locus; "all" clears it)', 'suite-reading',
      note='the legend is the plate\'s Relations rows (places/placesModel.ts relationRows: the hard geography order, then the owner\'s own vocabulary); a press narrows the globe to the relation\'s locus through the atlas\'s one filter — presentation only, the reading is never rewritten; a relation shares its locus with others of its kind, and the row says which.')
place('lane-4:T9', cite(AT + 'places/placesModel.ts', 'export function placeRows('),
      'the plate\'s Locations › a region\'s row ("not on the Earth", with the owner\'s reason)', 'suite-reading',
      note='a region is listed on the plate\'s Locations with the owner\'s reason, never drawn as a point (provider/suiteReading.ts locateFacet holds a polygon facet with its reason). Not kept, lane O\'s judgement: drawing regions as polygons — a polygon layer on the globe would be new geometry, not a port.')
place('lane-4:T10', cite(PP, '<PrecisionMark marker={row.marker}'),
      'the plate\'s Locations › each row\'s precision mark, and the precision chips', 'suite-reading',
      note='every Locations row wears the cradle authority\'s marker (solid · halo · outline · no-coordinate: places/placesModel.ts placeRows over project.ts precisionMarker), with the precision chips, never upgraded; the Earth draws each occurrence by its precision (src/globe/presences.ts).')
place('lane-4:T11', cite(PP, '{routes.map(row =>'),
      'the plate\'s Relations › a subject\'s walk (walkable at two stops)', 'suite-reading',
      note='each subject\'s TRAVELLED_TO places are listed on the plate\'s Relations as its walk, walkable at two stops (places/placesModel.ts routeRows); the Earth draws it as its own thread walk.')
place('lane-4:T12', cite(PP, '{within.map(row =>'),
      'the plate\'s Relations › "a in b" (listed, not drawn)', 'suite-reading',
      note='the declared LOCATED_IN hierarchy is carried verbatim and listed on the plate\'s Relations, "listed honestly but not drawn" (the target\'s own clause). Not kept, lane O\'s judgement: drawing the edges — the atlas\'s arcs are walk arcs.')
place('lane-4:T13', cite(AT + 'places/placesModel.ts', 'export function provenanceLine('),
      'the plate\'s Locations › a row\'s title, and the chosen row\'s provenance line', 'suite-reading',
      note='each Locations row says owner · reading · revision · evidence, naming an absence rather than inventing a source (places/placesModel.ts provenanceLine); the chosen row shows it in full.')
place('lane-4:T14', cite(AT + 'places/placesTransport.ts', 'export function atlasTimeBindings('),
      'punch-in and punch-out read the window\'s two edges; M0\'s Deep time device scrubs it', 'atlas-window', kind='atlas-transport',
      note='the atlas\'s one deep-time clock is a face of the shared window (sharedClock.ts bindSharedTimeClock); the window\'s two edges are read on the transport\'s punch-in and punch-out (places/placesTransport.ts atlasTimeBindings); the scrubber is M0\'s Deep time device. The frame\'s docked time control is removed.')
place('lane-4:T15', cite(AT + 'places/placesTransport.ts', 'export function atlasTimeBindings('),
      'Walk (Play) and Stop press the atlas\'s one time button', 'atlas-window', kind='atlas-transport',
      note='Technē\'s Walk (Play) presses the atlas\'s one time button — the walk that stands, else the Earth\'s clock, which commits the window as it plays — and Stop pauses what plays (places/placesTransport.ts); refused, by name, while the Earth is not open.')
place('lane-4:T16', cite(PP, 'One season: the time window narrows what is placed, never the imagery'),
      'the plate\'s Landmass › One season', 'atlas-own',
      note='"One season: the time window narrows what is placed, never the imagery" on the plate\'s Landmass.')
place('lane-4:T17', cite(PP, 'onClick={press}><Icon name="draw" size={11} /> Place'),
      'the plate\'s Locations › ✎ Place (a subject selected on the Earth), then a click on the globe → the draft offered to the Wiki\'s time-and-place editor (Open the editor)', 'wiki-facts',
      note='the plate\'s ✎ Place arms the tool for the subject the Earth has selected; the next click on the globe (places/placesHost.ts pointUnder) becomes the frame\'s own draft (places/placeTool.ts draftAt over psychogeographic/placeAuthoring.ts), offered only to the Wiki\'s time-and-place editor (WikiFactsEditor offerConstellationRoute), where the person chooses a source and saves. No Scene is needed: the subject\'s own node owns the facts; a save rereads the world and redraws the subject in place.')
place('lane-4:T18', cite(AT + 'places/placeTool.ts', 'export function placeAnswered('),
      'the plate\'s Locations › the Place tool\'s line (the owner\'s answer)', 'wiki-facts',
      note='the editor\'s save refuses a missing or stale basis, and the plate shows the owner\'s words unchanged (places/placeTool.ts placeAnswered over placeAuthoring.ts constellationResultNotice).')
place('lane-4:T19', cite(AT + 'places/placeTool.ts', 'export function draftAt('),
      'the plate\'s Locations › one of the subject\'s located places, then ✎ Place and a click', 'wiki-facts',
      note='choose one of the subject\'s located places in Locations, then Place: the click is a move proposal at the place\'s own precision, citing its evidence, refused by name without one and never for an exact fix (places/placeTool.ts draftAt over placeAuthoring.ts moveProposal). A click, not a drag: the atlas\'s drag is its own orbit.')
gap('lane-4:T20', 'not-built',
    'Named map views are not ported to the atlas: their home is Technē\'s Capture ("View → scene"), which has no binding or owner write from the shell yet, and the frame\'s writer (it needed an open Scene) was removed with the map.',
    'G4', where=cite(UI + 'shell/modeGrammar.ts', "{id: 'capture', label: 'View → scene', fn: 'the current view becomes a scene'},"),
    note='a gap now (lane O, 92a7d38d5; was homed on the frame\'s Places map, removed): Scenes saved before keep their place views as inert, validated data (fsj/tests/places-views.test.mjs). The atlas\'s state and filter ride its own linkable address (src/app/controller.ts syncHash), which is not a named view.')
place('lane-4:T21', cite(PP, 'handle.ctl.setFilter(narrowed(row) ? rest : {...rest, kinds: [row.locus]})'),
      'the plate\'s Relations › a relation (the atlas\'s one filter)', 'suite-reading',
      note='the plate\'s Relations rows narrow the atlas\'s one filter (T8\'s control), which the atlas keeps as its own state on its linkable address (src/app/controller.ts syncHash). Not ported, lane O\'s judgement: persistence per Scene — no Scene stands under the atlas; Scenes saved before keep their layers record as inert, validated data.')
place('lane-4:T22', cite(PP, '{field.map(result =>'),
      'the plate\'s Locations › Find a place…', 'suite-reading',
      note='the plate\'s Find narrows the world\'s own places (places/placesModel.ts findPlaceRows) and lists the field\'s own search results beneath, each chosen through the controller\'s chooseResult; ⌘K still opens the atlas\'s own search.')
place('lane-4:T23', cite(PP, 'setWindowSaid(writeSharedWindow(disclosureSession,'),
      'the plate\'s Locations › a place with a validity › Window to its validity (written only while a session stands: a work open in Technē)', 'atlas-window',
      note='the chosen place\'s "Window to its validity" writes the place\'s own validity to the shared window through the session\'s compare-and-set writer (sharedClock.ts writeSharedWindow), so the Timeline and the Earth stand in it; with no session standing the writer says so. "Open source" is the subject\'s own page in Graph and source.')
place('lane-4:T24', cite(AT + 'places/placesHost.ts', 'function followSpatialFocus('),
      'the globe itself: it turns to the session\'s spatial focus when it mounts, and on every change', 'spatial-focus', kind='globe',
      note='the Earth honours the spatial focus standing when it mounts, and every change after (places/placesHost.ts followSpatialFocus); a ref the world does not hold turns nothing, with no error.')
gap('lane-4:T25', 'not-built',
    'Tour recording is not ported to the atlas: its home is Technē\'s Record ("Record walk"), whose writer waits for the journey owner, and the frame\'s tour recorder and playback were removed with the map.',
    'G5', where=cite(UI + 'shell/modeGrammar.ts', "{id: 'record', label: 'Record walk', fn: 'record a new walk from your encounters'},"),
    note='a gap now (lane O, 92a7d38d5; was homed on the frame\'s Places map, removed): playback stands without a recorded tour — the atlas walks a subject\'s thread in date order on Technē\'s Walk (src/state/store.ts startThread; src/ui/time-control.ts). Scenes saved before keep their tours as inert, validated data (fsj/src/placeTourRecord.ts).')
gap('lane-4:T26', 'not-built',
    'No tour stop is bound to a Journey beat: binding a stop to a beat is M3′ Journey\'s, not M4′\'s, and no stop is recorded on the atlas to bind.',
    'G6', where=cite(FSJ + 'placeTourRecord.ts', 'export function resolveTourBindings('),
    note='a gap now (lane O, 92a7d38d5; was homed on the frame\'s Places map, removed). Not kept on M4′, lane O\'s judgement: the binding is M3′ Journey\'s, and the target itself says M4′ "renders nothing journey-owned"; the binding law stays in the Scene material (fsj/src/placeTourRecord.ts).')
place('lane-4:T27', cite(PP, '<Reading name="Sun" value={sunWords} />'),
      'the plate\'s Sky › Sun, and Day and night', 'ql-sun',
      note='the plate\'s Sky says the Sun\'s words — placed where the QL owner states it, or the owner\'s reason — and whether the Earth is lit by the sky\'s Sun; the same words stand in the Info view\'s hover (AtlasProjectionPanel.tsx earthWords), never over the globe. The owner read is the atlas\'s own (inhabitants/qlSkyEarthAdapter.ts admitDatedSubsolar, kernel nara_identity · transit), no longer the frame\'s Nara facade.')
place('lane-4:T28', cite(PP, '<ol className="places-ladder" aria-label="Frames">'),
      'the plate\'s Sky › Frames', 'suite-reading', 'ql-sun', 'atlas-window',
      note='the five rungs by world.ts\'s labels on the plate\'s Sky ("Frames"), each read from what the Earth holds — the QL Sun, the window, the places declared, those drawn and their walks, and Nara, which no owner discloses here; none is shown present that is not.')
place('lane-4:T29', cite(AT + 'src/globe/controls.ts', 'if (this.autoRotate && !this.interacted && !this.opts.reduced) {'),
      'the globe itself: it turns slowly only until first touched, never under reduced motion', 'atlas-own', kind='globe',
      note='the atlas\'s own stillness is kept: it turns slowly only until first touched, and never under reduced motion (src/globe/controls.ts); flights ease and finish. Lane O judged it against the manual (DLW.md §2: a planet turning slowly under its star).')
place('lane-4:T30', cite(PP, '<StandingTag standing={row.standing} />', 218),
      'the plate\'s Locations and Relations › the "mythic" tag and the dashed swatch', 'suite-reading',
      note='one grammar on the plate — a dashed swatch and a "mythic" tag wherever a mythic place or relation is named (PlacesPlate.tsx, placesPlate.css); the suite provider reads MYTH_LOCATED_AT as a myth episode, never a historical event (provider/suiteReading.ts locusOfRelation).')

# ── lane 5 (Journey and Palace) ──────────────────────────────────────────────
JN = reach('lens', 'Journey', condition='open-work+wiki-scene')
JI = FSJ + 'journeyInstrument.tsx'
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
# The nine Palace targets' homes on the atlas, as tickets/T-PALACES-ONTO-ATLAS.md lists them (lane U, b5a935661; 30ba8692f's World ›
# Palaces): the M5′ plate, the palace's floor in the Earth pane, and Technē's transport, every act through palaces/palaceSession.ts to
# its owner. The frame's Palace lens is removed, so no home here retires; lane U judged nothing not worth keeping.
U = ('re-homed on the atlas (lane U, b5a935661, with 30ba8692f\'s World › Palaces; R2 closed: the frame\'s Palace lens is removed, so '
     'this home no longer retires and no longer needs an open work or a Wiki-bound Scene — a palace is a register\'s own native '
     'Expression, entered on the Earth from the M5′ fold, M4′\'s Locations kind palace or the browser\'s World › Palaces): ')
UNSEEN = ' Screen leg UNVERIFIED.'
def palace(target, component, kind, extra, *owners_, note=''):
    homed(target, component, reach(kind, 'Palace', extra=extra, condition='none'), owner(*owners_), note=U + note + UNSEEN)
palace('lane-5:T14', cite(PL + 'PalacePlate.tsx', 'function WholeSection({here}: {here: PalaceInside}) {'), 'palace-plate',
       'its Integral whole (folded to its strip until pressed): each region in M′ order with its office and standing, each entry with Open', 'palace-reading',
       note='the integral whole is read through the owner the frame\'s Palace reached — the boundary\'s techne-reading channel, readWikiSceneTechne scope "expression" (palaces/palaceOwners.ts) — at the register\'s overview Scene, and refused by name unless it answers for this palace\'s own Expression at this revision (palaceSession.ts readWhole); palaceWholeView moved verbatim to m0m5/palace/whole.ts. The floor\'s rooms are the whole\'s journey region, the palace\'s own Scenes.')
palace('lane-5:T15', cite(PS, 'export function moveRooms(points: Record<string, BoardPoint>): void {'), 'palace-floor',
       'drag a room (one gesture, one save); shift-drag a marquee to select rooms (the plate\'s Rooms shows them); drag the floor to pan, wheel to zoom; Snap off · grid on the plate\'s Rooms', 'palace-presence',
       note='the arrangement law moved to m0m5/palace/board.ts (the frame\'s own snap copied unchanged), keyed by the room\'s Scene ref; the floor plan is the board — a drag is one move saved once through the presence owner (palaceSession.ts moveRooms), the viewport saved once settled; nothing reaches the plan or the kernel. Replaced, not ported (lane U): the Research Canvas\'s card vocabulary — the floor draws the mockup\'s rooms instead.')
palace('lane-5:T16', cite(PS, 'export function openRoom(key: string): void {'), 'palace-floor',
       'double-click a room (a region opens its one Expression, any other room its own Scene), click an object it holds (the subject door); the plate\'s Rooms (double-click), Integral whole (each entry) and Portals open the same way', 'palace-doors',
       note='an object opens through its owner (palaceSession.ts openRoom, openObject, openEntry, openMember over palaceOwners.ts open): a region\'s one Expression in the stage, a room\'s Scene through the owner\'s selection ask, a subject through the subject door, an entry with its ref as its instrument pane\'s subject, a source on Graph and source; what its route refuses is named (m0m5/palace/whole.ts palaceOpenRoute). The trail step records on the shared session only while it stands on this palace\'s reading, else says why (m0m5/palace/basis.ts palaceTrailStep); the floor draws the guided path\'s honest edges (palacesModel.ts floorEdges).')
palace('lane-5:T17', cite(PL + 'palaceTransport.ts', 'export function palaceWalkBindings(state: PalaceState,'), 'palace-transport',
       'Walk (Play) walks one locus per dwell and wraps, Stop holds it still; Walk pace reads the dwell, Stop n/N the locus of how many; the plate\'s Path holds Start, ← and →; the floor accents the room the walk stands in', 'palace-reading', 'palace-presence',
       note='the walk is the one transport\'s while a palace stands (palaceTransport.ts palaceWalkBindings, bound in shell/modeTransports.tsx); outside a palace the atlas\'s own time serves the button. The walk visits the whole\'s loci from the named start (m0m5/palace/whole.ts palaceWalkSteps over recall.ts), and its position persists through the presence owner (palaceSession.ts moveWalk). No owner sets a pace yet: the dwell is the walk\'s own, and the transport\'s title says so.')
palace('lane-5:T18', cite(PL + 'PalaceFloor.tsx', 'export function roomWhy(room: PalaceRoom, standing: PalaceStandingView | null): string {'), 'palace-floor',
       'each room says why it stands where it does in the Info view\'s hover; the plate\'s Path › Guide on · off says it for the room the walk stands in, and its Integral whole tags each region\'s standing', 'palace-reading',
       note='the standing law moved verbatim to m0m5/palace/whole.ts (palaceStanding: warranted QL structure with its warrant class and provenance, an Expression owner\'s composition, or free mnemonic composition; every hand-made region free); the guide is these words (PalaceFloor.tsx roomWhy, PalacePlate.tsx PathSection).')
palace('lane-5:T19', cite(PS, 'export async function acceptReturn(): Promise<void> {'), 'palace-plate',
       'its Return (folded until pressed): Propose Return writes nothing; Accept and return · Refuse; the owner\'s answer in one line', 'ke-invoke',
       note='the atlas calls the boundary\'s routed Return itself — the cradle owners\' kernel-expression channel with operation invoke_action (palaceOwners.ts invoke → expressions-boundary cradle.ts frameAction): the owner re-reads the reading the proposal came from and decides, and only then dispatches through the kernel\'s action seam; an invoked receipt returns to the Earth, the M0′ ground (palaceSession.ts returnToGround). The proposal law stays m0m5/palace/return.ts.')
palace('lane-5:T20', cite(PS, 'export async function save(): Promise<void> {'), 'palace-plate',
       'its Compose (folded until pressed): a new region; the kernel\'s Expressions, each into a region or as a region; Save composition · Revert; its Rooms › ↑ ↓ along the path, ○ empty, × remove; the floor dashes an unsaved region', 'ke-compose',
       note='one Save is one CAS-gated edit of the palace\'s Expression through the kernel `expression` op (m0m5/palace/basis.ts palaceEditRequest), planned against the document the draft began at (m0m5/palace/composition.ts planRegions); a replay sends nothing, a conflict keeps the draft, the readback is checked, and the palace then stands at the owner\'s new revision with its whole read again. The Open\'s trail step its frame home carried (palaceHop.ts, removed) is lane-5 T16\'s.')
palace('lane-5:T21', cite(PS, 'function persist(next: PalaceComposition, reading: TechneReading): void {'), 'palace-plate',
       'its line under the sections (a refused store, told once); entering restores the arrangement, walk position, bookmarks and viewport before the palace is drawn', 'palace-presence',
       note='the same presence owner, unchanged (m0m5/palace/presence.ts, its keys and state-registry entry as they were), over the atlas\'s workspace memory instead of the webview\'s raw storage (palacesHost.ts bindPalaces, AtlasProjectionPanel.tsx atlasMemoryStorage); entering restores before the palace is drawn and says a notice once (palaceSession.ts enterPalace); a refused store degrades to an unpersisted palace, told once (palaceSession.ts persist).')
homed('lane-5:T22', cite(FSJ + 'app.ts', '// T22: each saved card names its origin'), stage('Library'), owner('library'))
homed('lane-5:T23', cite(EB + 'timeWindow.ts', 'const crossed = crossToExpression(session, target);'), JN, owner('crossing', 'techne-reading'))
palace('lane-5:T24', cite(PS, 'export function bookmarkHere(name: string): boolean {'), 'palace-plate',
       'its Path: Start (the named start), a name and Bookmark, each bookmark (press to jump, ✎ rename, × delete); its Portals › ↩ the Earth (the return to ground); entering at a door stands the walk in that room', 'palace-presence',
       note='the bookmark law moved verbatim (m0m5/palace/bookmarks.ts); the acts are palaceSession.ts bookmarkHere, jumpBookmark, renameBookmark, deleteBookmark and walkToStart, each through the presence owner; the frame\'s Return to ground is the return to the Earth (palaceSession.ts returnToGround), and entering at a door names a room the walk does not hold (palaceSession.ts enterPalace).')

# ── what changed for the Wiki-bound homes (ticket T) ─────────────────────────
DOOR_NOTE = ('the Wiki-bound Scene this home reads has a second door (lane N, 3a8fbc2d6; S1 closed): Technē › browser › Locations or Places '
             '› a subject (double-click or Enter) opens the Scene that carries it, through the owner\'s reverse query and selection ask '
             '(techne/subject/openSubject.ts openWorldSubject); Examine in the Graph and source pane stays the other door. Seen natively at '
             '11475cc3d: choosing a subject opened the stage, but the asked Scene did not open and nothing said so (lane S, open). Screen leg UNVERIFIED.')
DOOR_EXTRA = {
    'lane-2:T6': ' Its lane-4 consumer, the frame\'s Places map, is removed (lane O, 92a7d38d5); the atlas reads the session window through projections/atlas/sharedClock.ts, not this projection.',
}
for target, row in ROWS.items():
    if row['home'] and row['home']['condition'] == 'open-work+wiki-scene' and target != 'lane-2:T21':
        NOTES[target] = DOOR_NOTE + DOOR_EXTRA.get(target, '')
NOTES['lane-2:T21'] = ('re-homed on the atlas (lane O, 92a7d38d5; R1 closed: the frame\'s Places map is removed, so this home no longer retires): '
                       '"Show on the globe" keeps its two owner writes (the event\'s place as the session\'s spatial focus, its validity as the window) '
                       'and now ends by saying the Earth atlas turns to it; the atlas follows the focus (places/placesHost.ts followSpatialFocus → '
                       'turnAtlasTo) and its clock stands in the one shared window. The target\'s other half, a place on the Earth framing the '
                       'Timeline, is lane-4 T23\'s "Window to its validity". ' + DOOR_NOTE)

# ── the build tickets (ticket T, 15 Oct): G1, G2, G3, R1 and S1 closed in code (lanes N, O, P) and leave the list; ticket X, 15 Oct:
# R2 closed in code (lane U, b5a935661; 30ba8692f) and leaves it too ──────────
# Ranked by what can be built now: G4 writes through an owner that stands; G5 and G6 wait on the journey owner (G6 after G5, and it
# is M3′'s).
TICKETS = [
    {'id': 'G4', 'rank': 1, 'kind': 'gap', 'title': 'Technē\'s Capture keeps the atlas\'s view in a Scene',
     'what': 'Bind Technē\'s Capture ("View → scene", shell/modeGrammar.ts) to an owner write that keeps the atlas\'s view — its camera, the filter in force and the window — as a named view in a Scene (the Scene\'s research material through the kernel `expression` op edit, which still admits the frame\'s place views), and restore one from the M4 plate. Homes lane-4 T20; the same writer would carry the per-Scene layer state lane-4 T21 does not keep.',
     'targets': ['lane-4:T20']},
    {'id': 'G5', 'rank': 2, 'kind': 'gap', 'title': 'Record a walk on the atlas (the journey owner\'s writer)',
     'what': 'Technē\'s Record ("Record walk", shell/modeGrammar.ts) waits for the journey owner: once it stands, bind Record to capture the atlas\'s camera waypoints with their holds and captions — presentation, never a dated-place claim or a minted route — as a walk the owner keeps, replayed on the atlas\'s one time button (Technē\'s Walk). Homes lane-4 T25; a subject\'s thread already walks.',
     'targets': ['lane-4:T25']},
    {'id': 'G6', 'rank': 3, 'kind': 'gap', 'title': 'M3′ Journey binds a walk\'s stop to its beat',
     'what': 'Binding a stop to a Journey beat is M3′ Journey\'s (lane O\'s judgement; M4′ renders nothing journey-owned): once G5 records walks, let the Journey lens bind a stop to a beat by ref, under the material\'s own law (fsj/src/placeTourRecord.ts resolveTourBindings: a deleted beat leaves the stop intact and unbound). Homes lane-4 T26.',
     'targets': ['lane-4:T26']},
]

head = subprocess.run(['git', '-C', str(REPO), 'rev-parse', f'{REV}^{{commit}}'], capture_output=True, text=True, check=True).stdout.strip()
assert len(ROWS) == 126, len(ROWS)
used = sorted({key for r in ROWS.values() if r['owner_op'] for key in r['owner_op']['chains']})
OWNER_OPS = {key: {'op': OWNERS[key][0], 'calls': OWNERS[key][1]} for key in used}
OUT.write_text(json.dumps({'recorded_on': '2026-10-15', 'candidate_head': head, 'routes': ROUTES, 'owner_ops': OWNER_OPS, 'rows': ROWS, 'notes': NOTES, 'tickets': TICKETS}, indent=1, ensure_ascii=False) + '\n')
print(f'wrote {OUT}: {len(ROWS)} rows, {sum(1 for r in ROWS.values() if r["home"])} homed, {sum(1 for r in ROWS.values() if r["gap"])} gaps at {head[:10]}')
