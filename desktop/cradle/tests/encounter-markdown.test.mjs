import test from 'node:test';
import assert from 'node:assert/strict';
import {renderMarkdown} from '../src/material/markdown.ts';

test('agent output cannot load images or acquire raw HTML execution authority',()=>{
 const source='![private read](https://example.test/pixel?secret=value)\n\n![local](../private.png)\n\n<script>globalThis.executed=true</script>';
 const rendered=renderMarkdown(source,{resolveAsset:()=>'',images:false});
 assert.equal(rendered.includes('<img'),false);
 assert.equal(rendered.includes('<script>'),false);
 assert.ok(rendered.includes('&lt;script&gt;'));
 assert.ok(rendered.includes('example.test/pixel?secret=value'));
});

test('source-preserving native proposal rendering keeps table cells and exact source text',()=>{
 const source='**Revised proposed row (proposal only)**\n\n| Field | Proposed acceptance content |\n|---|---|\n| Native-owner generation | Opaque process incarnation returned by **Describe**, not a producer_key |\n| Cursors | Native journal: World + agent session; temporal: world/workcell/day + act/passage |';
 const rendered=renderMarkdown(source,{resolveAsset:()=>'',images:false});
 assert.ok(rendered.includes('<table>'));
 assert.equal((rendered.match(/<th>/g)??[]).length,2);
 assert.equal((rendered.match(/<td>/g)??[]).length,4);
 for(const run of rendered.matchAll(/<span data-source-start="(\d+)" data-source-end="(\d+)">([^<]*)<\/span>/g)){
  assert.equal(run[3],source.slice(Number(run[1]),Number(run[2])));
 }
});
