// The import-free category id list (timelineCategoryIds.ts) is the vendored timeline's own list, in its order.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const compiled=await build({stdin:{contents:"export {TIMELINE_CATEGORY_IDS} from './timelineCategoryIds.ts';export {TIMELINE_CATEGORIES} from '../../vendor/research-canvas/packages/canvas/src/timeline/categories.ts';",resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts'},tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
test('the import-free category ids are the vendored timeline categories, in order', ()=>{
 assert.deepEqual([...api.TIMELINE_CATEGORY_IDS], api.TIMELINE_CATEGORIES.map(category=>category.id));
});
