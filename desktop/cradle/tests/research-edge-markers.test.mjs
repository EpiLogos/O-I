/** Render the actual adapted Research Canvas edge and actual XYFlow BaseEdge.
 * A source-pattern assertion cannot catch a dropped start-arrow prop. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

test('actual Canvas edge renders both arrow markers supplied by native direction presentation',async()=>{
 const scratch=await mkdtemp(join(tmpdir(),'oi-source-edge-markers-'));
 try{
  const result=await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {ReactFlowProvider,Position} from '@xyflow/react';import {AnnotatedEdge} from './vendor/research-canvas/packages/canvas/src/edges/AnnotatedEdge';export const render=(start,end)=>renderToStaticMarkup(<ReactFlowProvider><svg><AnnotatedEdge id="native-source-edge" data={{relationKind:'supports',readOnly:true}} sourceX={0} sourceY={0} targetX={100} targetY={100} sourcePosition={Position.Right} targetPosition={Position.Left} markerStart={start} markerEnd={end}/></svg></ReactFlowProvider>);`,resolveDir:resolve('expressions-app'),loader:'tsx'},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},logLevel:'silent'});
  const file=join(scratch,'edge.mjs');await writeFile(file,result.outputFiles[0].text);const {render}=await import(pathToFileURL(file).href);
  const both=render('url(#source-start)','url(#source-end)');assert.match(both,/marker-start="url\(#source-start\)"/);assert.match(both,/marker-end="url\(#source-end\)"/);
  const reverse=render('url(#source-start)',undefined);assert.match(reverse,/marker-start="url\(#source-start\)"/);assert.doesNotMatch(reverse,/marker-end=/);
  const undirected=render(undefined,undefined);assert.doesNotMatch(undirected,/marker-(?:start|end)=/);
 }finally{await rm(scratch,{recursive:true,force:true});}
});
