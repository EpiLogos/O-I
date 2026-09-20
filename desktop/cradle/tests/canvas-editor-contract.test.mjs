import test from 'node:test';
import assert from 'node:assert/strict';
import {markdownEdit,languageFor} from '../src/editor/commands.ts';
import {exactText,selectionSnapshot} from '../src/context/selectionModel.ts';
import {renderMarkdown} from '../src/material/markdown.ts';
import {parseMaterialViewPrefs,encodeMaterialViewPrefs} from '../src/material/lifecycle.ts';
import {detectFormat,materialCapabilities} from '../src/material/detect.ts';
const apply=(doc,edit)=>doc.slice(0,edit.from)+edit.insert+doc.slice(edit.to);
const binding={id:'file:1',ref:'source:1',kind:'file',title:'doc.md',project:'demo'};
test('format hint and deliberate override precede filename guessing',()=>{assert.equal(languageFor('file.txt','text/markdown'),'markdown');assert.equal(languageFor('file.md',null,'python'),'python');assert.equal(languageFor('file.TSX'),'tsx');});
test('inline formatting changes only the selected occurrence',()=>{const doc='---\ncustom: preserved\n---\nsame 🙂\nsame 🙂\n';const start=doc.lastIndexOf('same');const e=markdownEdit(doc,start,start+4,'bold');assert.equal(apply(doc,e),'---\ncustom: preserved\n---\nsame 🙂\n**same** 🙂\n');});
test('bold toggles in one bounded edit',()=>{const doc='one **two** three';assert.equal(apply(doc,markdownEdit(doc,6,9,'bold')),'one two three');});
test('selection ending at line start does not include the next line',()=>{const doc='first\nsecond\nthird';assert.equal(apply(doc,markdownEdit(doc,0,6,'bullet')),'- first\nsecond\nthird');});
test('line zero stays zero even when the document begins with newline',()=>{const e=markdownEdit('\ntext',0,0,'heading1');assert.equal(e.from,0);assert.equal(apply('\ntext',e),'# \ntext');});
test('nested lists and heading controls preserve outside source',()=>{const doc='before\none\ntwo\nafter';const e=markdownEdit(doc,7,14,'numbered');assert.equal(apply(doc,e),'before\n1. one\n2. two\nafter');});
test('inline/fenced code chooses a delimiter longer than selected runs',()=>{const e=markdownEdit('a```b',0,5,'fence');assert.ok(e.insert.startsWith('````\n'));});
test('invalid range fails without touching source',()=>assert.throws(()=>markdownEdit('test',-1,4,'bold'),RangeError));
test('exact selection never picks another identical paragraph',()=>{assert.equal(exactText({text:'same',start:5,end:9},'same same'),true);assert.equal(exactText({text:'same',start:4,end:8},'same same'),false);assert.equal(exactText({text:'same'},'same same'),false);});
test('selection snapshots require revision, exact UTF-16 and nonempty identity',()=>{const c={bindingId:binding.id,kind:'text',text:'🙂',start:3,end:5};const s=selectionSnapshot(c,binding,{revision:'r1',workingCopy:true});assert.deepEqual(s.anchor,{kind:'text',start:3,end:5});assert.equal(s.working_copy,true);assert.throws(()=>selectionSnapshot({...c,end:4},binding,{revision:'r1'}));assert.throws(()=>selectionSnapshot(c,binding));});
test('observation needs a document generation, not only a CSS selector',()=>{const c={bindingId:binding.id,kind:'element',text:'button',selector:'button',observationKey:'k'};assert.throws(()=>selectionSnapshot(c,binding));assert.equal(selectionSnapshot({...c,documentId:'doc1'},binding).anchor.document_id,'doc1');});
test('oversized selections fail, never silently truncate',()=>assert.throws(()=>selectionSnapshot({bindingId:binding.id,kind:'text',text:'x'.repeat(65537),start:0,end:65537},binding,{revision:'r1'})));
const preview=text=>renderMarkdown(text,{resolveAsset:path=>'https://example.test/'+path});
test('Markdown preview renders tasks tables quotes and strike with the actual parser',()=>{const html=preview('> quote\n\n- [x] task\n\n~~old~~\n\n| A | B |\n|---|---|\n| 1 | 2 |');for(const tag of ['<blockquote>','type="checkbox"',' checked','<del>','<table>','<th>'])assert.ok(html.includes(tag),tag);});
test('literal numeric words are not mistaken for HTML placeholders',()=>{assert.ok(preview('text 0 and 23 words').includes('text 0 and 23 words'));});
test('renderer emits exact literal source spans including unicode and CRLF',()=>{const doc='same\r\n\r\nsame 🙂';const html=preview(doc);assert.ok(html.includes('data-source-start="8"'));assert.ok(html.includes('same 🙂'));assert.equal(doc,'same\r\n\r\nsame 🙂');});
test('raw HTML and executable URLs cannot acquire preview authority',()=>{const html=preview('<script>alert(1)</script>\n\n[x](javascript:alert)');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('&lt;script&gt;'));});
test('resolved URL attributes are escaped independently of Markdown syntax',()=>{const html=renderMarkdown('[x](a.md)',{resolveAsset:()=> 'https://example.test/" onmouseover="evil&x'});assert.ok(html.includes('&quot;'));assert.ok(!html.includes(' onmouseover="'));});
test('split view preference round trips without changing source state',()=>{assert.deepEqual(parseMaterialViewPrefs(encodeMaterialViewPrefs({view:'split',zoom:1.25})),{view:'split',zoom:1.25});});
test('binary office formats are never routed into a UTF-8 editor',()=>{for(const ext of ['docx','xlsx','pptx','odt','pages'])assert.equal(detectFormat({path:'file.'+ext}),'unsupported');assert.equal(materialCapabilities('unsupported').edit,false);assert.equal(materialCapabilities('markdown').split,true);});

import {scopeGuard,selectionScopeKey,newerContext} from '../src/context/scopeGuard.ts';
test('async selection freezes destination and refuses a switched conversation',()=>{
 let current=selectionScopeKey('demo','agent-session/one');const guard=scopeGuard(()=>current);guard();
 current=selectionScopeKey('demo','agent-session/two');assert.throws(guard,/destination changed/);
});
test('project changes and an unbound-to-bound change invalidate preparation requests',()=>{
 let current=selectionScopeKey('one');const unbound=scopeGuard(()=>current);
 current=selectionScopeKey('two');assert.throws(unbound);
 const project=scopeGuard(()=>current);current=selectionScopeKey('two','agent-session/test');assert.throws(project);
});
test('delayed native reads never roll a newer preparation revision back',()=>{
 const latest={revision:3,items:['new']};assert.equal(newerContext(latest,{revision:1,items:[]}),latest);
 assert.deepEqual(newerContext(latest,{revision:4,items:[]}),{revision:4,items:[]});
});
