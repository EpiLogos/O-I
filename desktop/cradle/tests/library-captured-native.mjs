// Read-only replay of an unchanged, actual admitted snapshot and a live native
// Expression owner. No constructed snapshot or substituted owner transport.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const [snapshotPath,bridge,evidenceDirectory]=process.argv.slice(2);
assert.ok(snapshotPath&&bridge&&evidenceDirectory,'Pass the actual captured snapshot, live native bridge and evidence directory');
register('./ts-transpile-hook.mjs',import.meta.url);
register('./knowledge-render-hook.mjs',import.meta.url);
const {sharedLibraryItems}=await import('../src/library/providers.ts');
const {nativeExpressionsProvider}=await import('../src/library/nativeExpressionsProvider.ts');
const {LibraryResults}=await import('../src/library/LibraryResults.tsx');
const {LibraryItemDisclosure,libraryProviderName}=await import('../src/library/presentation.tsx');
const originalBytes=await readFile(snapshotPath);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const envelope=JSON.parse(originalBytes),snapshot=envelope.data;
assert.equal(envelope.ok,true);assert.equal(snapshot.schema,'oi.shared-field.snapshot/v1');
const snapshotBefore=JSON.stringify(snapshot);
const items=sharedLibraryItems(snapshot,'shared');
assert.equal(JSON.stringify(snapshot),snapshotBefore,'the adapter must not rewrite the actual owner reading');
assert.equal(items.length,snapshot.entries.length);
const guideRef='world:shared-expression:ann/artifact:shared-continuation-guide';
const guide=items.find(item=>item.ref===guideRef);
assert.ok(guide,'the actual admitted snapshot must contain the reported guide');
assert.equal(guide.title,'Shared continuation guide');
assert.equal(guide.ownerRef,'world:shared-expression:ann');
assert.equal(guide.owner,'Ann · Mac — continue one shared undertaking');
assert.equal(guide.revision,snapshot.entries.find(entry=>entry.ref===guideRef).revision);
const defaultText=html=>execFileSync('python3',['-c',String.raw`
from html.parser import HTMLParser
import sys
class Text(HTMLParser):
 def __init__(self): super().__init__(); self.details=[]; self.output=[]
 def visible(self): return all(opened or summary for opened,summary in self.details)
 def handle_starttag(self,tag,attributes):
  attrs=dict(attributes)
  if tag=='details': self.details.append(['open' in attrs,False])
  if tag=='summary' and self.details: self.details[-1][1]=True
  if self.visible(): self.output.extend(attrs[key] for key in ['aria-label','title'] if attrs.get(key))
 def handle_endtag(self,tag):
  if tag=='summary' and self.details: self.details[-1][1]=False
  if tag=='details': self.details.pop()
 def handle_data(self,value):
  if self.visible(): self.output.append(value)
p=Text(); p.feed(sys.stdin.read()); print(' '.join(p.output))
`],{input:html,encoding:'utf8'});
const render=(Component,props)=>renderToStaticMarkup(createElement(Component,props));
const buttons=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(buttons):[...(node.type==='button'?[node]:[]),...buttons(node.props?.children)];
const contentText=node=>typeof node==='string'?node:!node||typeof node!=='object'?'':Array.isArray(node)?node.map(contentText).join(''):contentText(node.props?.children);
const selected=[],opened=[];
const props={items,coverage:[],selectedRef:guide.ref,onSelect:item=>selected.push(item),onOpen:(item,how)=>opened.push({item,how})};
const tree=LibraryResults(props),controls=buttons(tree);
const guideControls=controls.filter(control=>control.props.role==='option'&&contentText(control.props.children).startsWith(guide.title));
assert.equal(guideControls.length,1,'the actual guide must have a distinguishable named row');guideControls[0].props.onClick();
controls.find(control=>control.props.children==='Open page').props.onClick();
assert.equal(selected[0],guide);assert.equal(opened[0].item,guide);assert.equal(opened[0].item.ref,guideRef);assert.equal(opened[0].how,'page');
const html=render(LibraryResults,props),text=defaultText(html);
assert.match(text,/Shared continuation guide/);assert.match(text,/Ann · Mac — continue one shared undertaking/);
for(const item of items)assert.ok(!text.includes(item.ref),`ordinary Library text must not expose native identity ${item.ref}`);
assert.ok(html.includes(guideRef));assert.match(html,/Source and identity/);assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/);
assert.equal(hash(await readFile(snapshotPath)),hash(originalBytes),'the original native capture remains byte-identical');

const provider=nativeExpressionsProvider({kind:'bridge',url:bridge});
assert.equal(provider.id,'expressions');assert.equal(libraryProviderName(provider.id),'Expressions');
const native=await provider.list({scope:'local',mode:'expressions',text:''},new AbortController().signal);
assert.equal(native.coverage.provider,'expressions');assert.equal(native.coverage.state,'complete',native.coverage.reason);
assert.ok(native.items.length,'the real owner must disclose retained Expressions');
const response=await fetch(`${bridge}/op`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'expression',request:{operation:'index'}}),signal:AbortSignal.timeout(30000)});
assert.equal(response.status,200);const index=await response.json();assert.equal(index.ok,true,index.error);assert.equal(index.outcome.result,'expression');assert.equal(index.outcome.data.schema,'oi.expression-index/v1');
let collectionRows=0;
for(const item of native.items){
 const row=index.outcome.data.expressions.find(candidate=>candidate.expression_ref===item.ref);
 assert.ok(row,'each displayed composition retains its actual native index identity');
 assert.equal(item.title,row.title);assert.equal(item.revision,String(row.revision));assert.deepEqual(item.nativeCollections,row.collections);
 assert.equal(item.summary,row.collections.length?`In ${row.collections.length} ${row.collections.length===1?'collection':'collections'}`:'Not assigned to a collection');
 const detailHtml=render(LibraryItemDisclosure,{item});
 assert.match(detailHtml,/Native collections/);
 for(const ref of row.collections)assert.ok(detailHtml.includes(ref),'deliberate source disclosure retains each exact collection identity');
 assert.doesNotMatch(defaultText(detailHtml),/expression:/);
 if(row.collections.length)collectionRows++;
}
await writeFile(join(evidenceDirectory,'library-admitted-capture-replay.html'),html);
await writeFile(join(evidenceDirectory,'library-admitted-capture-default.txt'),text);
await writeFile(join(evidenceDirectory,'library-expression-provider-live-readback.json'),JSON.stringify({provider:native,index},null,2));
await writeFile(join(evidenceDirectory,'library-admitted-capture-replay.json'),JSON.stringify({snapshot_path:snapshotPath,snapshot_sha256:hash(originalBytes),snapshot_entries:snapshot.entries.length,shared_library_items:items.length,guide:{ref:guide.ref,title:guide.title,owner:guide.owner,ownerRef:guide.ownerRef,revision:guide.revision},native_expression_items:native.items.length,native_collection_rows:collectionRows,scope:'read-only actual-capture/server-markup and original callbacks; mounted/browser/OS acceptance not claimed'},null,2));
console.log(`PASS actual unchanged admitted snapshot (${items.length} entries) -> sharedLibraryItems -> production Library/default announced labels/exact guide selection; live native Expression index (${native.items.length} items, ${collectionRows} with collections) -> production provider/counts/source disclosure. Snapshot SHA-256 ${hash(originalBytes)}.`);
