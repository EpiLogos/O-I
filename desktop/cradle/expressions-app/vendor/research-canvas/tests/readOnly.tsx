import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {ReactFlowProvider} from '@xyflow/react';
import {ImageNode} from '../packages/canvas/src/nodes/ImageNode';
import {NoteNode} from '../packages/canvas/src/nodes/NoteNode';
import {GroupNode} from '../packages/canvas/src/nodes/GroupNode';
import {ResourceNode} from '../packages/canvas/src/nodes/ResourceNode';
import {CanvasView,availableMenu,isNodeSelected} from '../packages/canvas/src/CanvasView';
import {StreetViewSurface} from '../packages/canvas/src/streetview/StreetViewSurface';
import {PsychogeographicMap} from '../packages/canvas/src/psychogeographic/PsychogeographicMap';
import {TimelineSurface} from '../packages/canvas/src/timeline/TimelineSurface';
import {createLiveServicePolicy} from '../packages/geography/src/policy';
import {readingInstruments} from '../../../field-studies-journeys/src/researchInstrumentsData';
import {readFile} from 'node:fs/promises';

const renderNode=(Component: any, data: Record<string, unknown>) => renderToStaticMarkup(
  <ReactFlowProvider><Component id="native:reading/item" type="image" data={data}
    selected={true} dragging={false} isConnectable={false} zIndex={0}
    positionAbsoluteX={0} positionAbsoluteY={0}/></ReactFlowProvider>
);
const image={src:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',caption:'Native caption',onCaptionChange:()=>{}};
assert.match(renderNode(ImageNode,image), /aria-label="Image caption"/);
const imageReadOnly=renderNode(ImageNode,{...image,readOnly:true});
assert.doesNotMatch(imageReadOnly, /aria-label="Image caption"/);
assert.match(imageReadOnly,/Native caption/);
for(const Component of [ImageNode,GroupNode,NoteNode,ResourceNode]){
  const markup=renderNode(Component,{...image,title:'Native reading',summary:'Actual body',readOnly:true});
  assert.doesNotMatch(markup,/class="node-resize-control[^\"]*"[^>]*style="display:flex"/);
  assert.match(markup,/node-resize-control/);
}
const canvas=renderToStaticMarkup(<CanvasView readOnly nodes={[]} edges={[]}/>);
assert.match(canvas,/aria-label="Zoom in"/);
assert.match(canvas,/aria-label="Fit view"/);
assert.doesNotMatch(canvas,/Add note|Edit note|Add resource/);
console.log('Research Canvas real component render: captions remain readable, resize/edit controls withheld, viewport controls retained.');

// host-selection-viewport-gesture.patch — optional selection/viewport/gesture
// capabilities are additive. ReactFlow defers node rendering past
// renderToStaticMarkup (the react-flow__nodes container is empty on a
// server render even with real node data), so the multi-selection reading
// is checked directly against the same pure `isNodeSelected` CanvasView
// uses to compute each node's `selected` flag — the real production logic,
// not a re-implementation.
assert.equal(isNodeSelected('note-a', 'note-a', undefined), true);
assert.equal(isNodeSelected('note-b', 'note-a', undefined), false);
assert.equal(isNodeSelected('note-a', null, ['note-a', 'note-b']), true);
assert.equal(isNodeSelected('note-b', null, ['note-a', 'note-b']), true);
assert.equal(isNodeSelected('note-c', null, ['note-a', 'note-b']), false);
// selectedNodeIds, when supplied, takes over from selectedNodeId entirely.
assert.equal(isNodeSelected('note-a', 'note-a', []), false);

// selectionOnDrag/onSelectionChange/onViewportChange/onMoveNodePreview/onMoveNodeEnd
// omitted entirely must render byte-identical markup to the pre-patch shape —
// this is a server render so the drag/pointer/viewport gestures themselves
// cannot fire here (they need a live DOM), but the wiring must not alter the
// mounted tree when unset.
const omittedNew=renderToStaticMarkup(<CanvasView nodes={[]} edges={[]} selectedNodeId="note-a"/>);
const explicitlyUndefined=renderToStaticMarkup(<CanvasView nodes={[]} edges={[]} selectedNodeId="note-a"
  selectedNodeIds={undefined} onSelectionChange={undefined} selectionOnDrag={undefined}
  onViewportChange={undefined} onMoveNodePreview={undefined} onMoveNodeEnd={undefined}/>);
assert.equal(omittedNew, explicitlyUndefined);
console.log('Research Canvas selection/viewport/gesture patch: isNodeSelected reads real multi-selection, omitted new props keep the original single-select markup.');

const menu=availableMenu([{type:'item',label:'Edit note',onClick:()=>{}},{type:'separator'},{type:'item',label:'Duplicate',onClick:()=>{}},{type:'separator'},{type:'item',label:'Unsupported'}],{'Edit note':true,Duplicate:false});
assert.deepEqual(menu.map(item=>item.label),['Edit note']);

const policy=createLiveServicePolicy();policy.optIn('street_view_browse','Explicit standalone test opt-in');policy.optIn('tile_refresh','Explicit standalone test opt-in');
const emptyImages=renderToStaticMarkup(<StreetViewSurface images={[]} offlineOnly policy={policy} resolveAsset={path=>path}/>);
assert.doesNotMatch(emptyImages,/Enable Mapillary|Browse Mapillary|redaction regions before publishing/);
assert.match(emptyImages,/No images in this Scene/);
const picture={id:'native-image',profileScope:'expression:retained',artifactPath:'scene-image:native-image',capturedAt:null,latitude:null,longitude:null,headingDegrees:null,redactionStatus:'pending' as const,redactionRegions:[],redactedArtifactPath:null,createdAt:'2026-09-24T00:00:00Z',updatedAt:'2026-09-24T00:00:00Z'};
const imageView=renderToStaticMarkup(<StreetViewSurface images={[picture]} offlineOnly policy={policy} resolveAsset={()=> 'data:image/png;base64,iVBORw0KGgo='} imageTitle={()=> 'Authored image title'}/>);
assert.match(imageView,/Authored image title/);assert.doesNotMatch(imageView,/<figcaption|scene-image:native-image|street-view-status/);
if(process.env.OI_RESEARCH_NATIVE_READING){
 const reading=JSON.parse(await readFile(process.env.OI_RESEARCH_NATIVE_READING,'utf8'));
 const adapters=await readingInstruments(reading);
 const map=renderToStaticMarkup(<PsychogeographicMap repository={adapters.places} projectId={reading.subject.subject_ref} tileSource={{kind:'geojson',url:'data:application/json,%7B%7D',attribution:'Offline'}} offlineOnly policy={policy}/>);
 assert.doesNotMatch(map,/Enable live tiles|Refresh tiles/);assert.match(map,/Globe/);assert.match(map,/Flat/);
 const timeline=renderToStaticMarkup(<TimelineSurface repository={adapters.timeline} constellationId={reading.subject.subject_ref} dataSource={adapters.dataSource} initialState={{centerYear:0,pixelsPerYear:1,selectedNodeId:null}} onOpenCanvasNode={()=>{}} onOpenNode={()=>{}}/>);
 assert.match(timeline,/Timeline navigation controls/);
 // These are real production adapter refusals, not substituted owner replies.
 await assert.rejects(adapters.timeline.getTimelineWalk('foreign:scope',{startYear:0,endYear:3000}),/does not address/);
 await assert.rejects(adapters.places.getRelatedNodesForPlace(reading.subject.subject_ref,'foreign:source'),/not found/);
 console.log('Native reading adapters reject foreign reads; actual hosted map/image components withhold live network controls, retain labels and omit absent metadata.');
}
