import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {ReactFlowProvider} from '@xyflow/react';
import {ImageNode} from '../packages/canvas/src/nodes/ImageNode';
import {NoteNode} from '../packages/canvas/src/nodes/NoteNode';
import {GroupNode} from '../packages/canvas/src/nodes/GroupNode';
import {ResourceNode} from '../packages/canvas/src/nodes/ResourceNode';
import {CanvasView,availableMenu} from '../packages/canvas/src/CanvasView';

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

const menu=availableMenu([{type:'item',label:'Edit note',onClick:()=>{}},{type:'separator'},{type:'item',label:'Duplicate',onClick:()=>{}},{type:'separator'},{type:'item',label:'Unsupported'}],{'Edit note':true,Duplicate:false});
assert.deepEqual(menu.map(item=>item.label),['Edit note']);
