import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

test('actual hosted chooser renders every native instrument as one accessible tab group with no extra panel or hide control',async()=>{
 const source=fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/',import.meta.url));
 const scratch=await mkdtemp(join(tmpdir(),'oi-lens-chooser-'));
 try{
  const compiled=await build({stdin:{contents:"export {LensChooser} from './lensStudio.ts';export {IconTab,IconTabStrip} from '../../../src/workspace/primitives/IconTabStrip.tsx';export {createElement} from 'react';export {renderToStaticMarkup} from 'react-dom/server';",resolveDir:source},tsconfig:join(source,'../tsconfig.json'),alias:{react:join(source,'../../node_modules/react'),'react-dom':join(source,'../../node_modules/react-dom')},loader:{'.css':'empty'},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'});
  const file=join(scratch,'chooser.cjs');await writeFile(file,compiled.outputFiles[0].text);
  const api=createRequire(import.meta.url)(file);
  const ids=['project','canvas','timeline','journey','place','palace'];
  for(const active of ids){
   const html=api.renderToStaticMarkup(api.createElement(api.LensChooser,{active}));
   assert.equal((html.match(/role="tablist"/g)||[]).length,1);
   assert.equal((html.match(/role="tab"/g)||[]).length,6);
   const tabs=[...html.matchAll(/<button\b[^>]*role="tab"[^>]*>/g)].map(row=>row[0]);
   assert.deepEqual(tabs.map(row=>/data-lens="([^"]+)"/.exec(row)?.[1]),ids);
   assert.equal(tabs.filter(row=>row.includes('aria-selected="true"')).length,1);
   for(const [index,row] of tabs.entries()){
    assert.ok(row.includes('data-action="lens"'),'activation stays on native delegated operation');
    assert.ok(row.includes(`tabindex="${ids[index]===active?'0':'-1'}"`));
    assert.ok(!row.includes('lens-studio'),'no separate instrument panel is addressed');
    assert.match(row,/aria-label="M[0-5]′ [^"]+"/);
    assert.match(row,/title="M[0-5]′ — [^"]+"/);
   }
   assert.equal((html.match(/class="lens-glyph"/g)||[]).length,6);
   assert.equal((html.match(/<svg\b/g)||[]).length,6,'exactly the six instrument SVGs');
   assert.ok(!html.includes('lens-hide')&&!html.includes('lens-bar'),'the chooser lives in the masthead; there is no floating bar to hide');
  }
  // Existing shell callers keep their Glyph and radio semantics after the
  // optional native-engine SVG slot is added to the same primitive.
  const original=api.renderToStaticMarkup(api.createElement(api.IconTab,{label:'Chat',icon:'chat',selected:true}));
  assert.match(original,/<svg\b/);assert.match(original,/role="tab"/);
  const choice=api.renderToStaticMarkup(api.createElement(api.IconTab,{label:'Native choice',icon:'chat',selected:true,choice:true}));
  assert.match(choice,/role="radio"/);assert.match(choice,/aria-checked="true"/);assert.ok(!choice.includes('aria-selected'));
 }finally{await rm(scratch,{recursive:true,force:true});}
});
