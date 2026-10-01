import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {register} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createAttachedContribution,contributionBody} from '../../../shared-field/contribution-return.mjs';
import {createExploreEntry} from '../../../shared-field/explore.mjs';
import {createContribution} from '../../../shared-field/social.mjs';
import {createParticipant} from '../../../shared-field/index.mjs';

register('./ts-transpile-hook.mjs',import.meta.url);
register('./knowledge-render-hook.mjs',import.meta.url);
globalThis.__CRADLE_WALK__=false;
const contributionSource=process.env.CONTRIBUTION_PRESENTATION_SOURCE?pathToFileURL(process.env.CONTRIBUTION_PRESENTATION_SOURCE).href:new URL('../src/shared/contributionPresentation.tsx',import.meta.url).href;
const {ContributionText,RawDisclosure,changeLine}=await import(contributionSource);
const {RememberReceipt}=await import('../src/context/ContextActions.tsx');
const {MethodMaterial,HarnessTimer}=await import('../src/contributions/automations/Automations.tsx');
const {conversationsFromReading}=await import('../src/workspace/left/ChatRows.tsx');
const {SituationView}=await import('../src/context/SituationView.tsx');
const {SituationProvider}=await import('../src/context/SituationContext.tsx');
const {buildSituationFrame}=await import('../src/context/situation.ts');
const panelSource=process.env.CONTRIBUTION_PANEL_SOURCE?pathToFileURL(process.env.CONTRIBUTION_PANEL_SOURCE).href:new URL('../src/explore/ContributionPanel.tsx',import.meta.url).href;
const {ContributionPanel,AttributedContribution,ContributionStatus,SourceProposal,ExpressionProposal,DraftFields,presentationBasis,contributionParticipantName,reviewBelongsToBasis}=await import(panelSource);

const scratch=process.env.CONTEXTUAL_TEST_DIRECTORY??fileURLToPath(new URL('../../../target/native-presentation-tests/',import.meta.url));
await mkdir(scratch,{recursive:true});
const directory=await mkdtemp(join(scratch,'contextual-'));
await mkdir(join(directory,'Work'),{recursive:true});
await mkdir(join(directory,'Control/user'),{recursive:true});
test.after(()=>rm(directory,{recursive:true,force:true}));
const nativeEnv={...process.env,CENTRAL_ROOT:directory,AIKIT_HOME:join(directory,'aikit-home')};
const ctrl=process.env.OI_CTRL_BIN??'ctrl';
const aikit=process.env.OI_AIKIT_BIN??process.env.AIKIT_BIN??'aikit';
const native=(binary,args,env=nativeEnv)=>{
  try{return JSON.parse(execFileSync(binary,args,{cwd:directory,env,encoding:'utf8',timeout:45000,maxBuffer:16*1024*1024}));}
  catch(error){if(typeof error.stdout==='string'&&error.stdout.trim().startsWith('{'))return JSON.parse(error.stdout);throw error;}
};
const render=(Component,props)=>renderToStaticMarkup(createElement(Component,props));
// Observe closed details semantics, including tooltips and announced labels.
// Canonical data bindings do not become visible/announced text.
const defaultText=html=>execFileSync('python3',['-c',String.raw`
from html.parser import HTMLParser
import sys
class DefaultText(HTMLParser):
    def __init__(self): super().__init__(); self.details=[]; self.output=[]
    def visible(self): return all(item[0] or item[1] for item in self.details)
    def handle_starttag(self,tag,attributes):
        attrs=dict(attributes)
        if tag=='details': self.details.append(['open' in attrs,False])
        if tag=='summary' and self.details: self.details[-1][1]=True
        if self.visible(): self.output.extend(attrs[key] for key in ['aria-label','title'] if attrs.get(key))
    def handle_endtag(self,tag):
        if tag=='summary' and self.details: self.details[-1][1]=False
        if tag=='details': self.details.pop()
    def handle_data(self,text):
        if self.visible(): self.output.append(text)
parser=DefaultText(); parser.feed(sys.stdin.read()); print(' '.join(parser.output))
`],{input:html,encoding:'utf8'});

const provenance=[{kind:'source',ref:'source:contextual-native-reading',source_system:'central',revision:'r1'}];
const attach=(kind,content)=>createAttachedContribution({contribution_ref:`oi:contribution:contextual-${kind}`,field_ref:'oi:field:contextual-reading',contributor_participant_ref:'participant:contextual-reading',created_at:new Date().toISOString(),target:{kind:'thing',ref:'world:shared-expression:ann/artifact:shared-continuation-guide'},provenance,body:{kind,content}});
const admitted=(ref,label)=>createExploreEntry({ref,label,kind:'curated-artifact',world_ref:'world:shared-expression:ann',revision:'r1',summary:'Written material for continuing shared work.',provenance});

test('real SharedField contribution admission retains exact references while ordinary attachments use the supplied owner names',()=>{
  const identity='world:shared-expression:ann/artifact:shared-continuation-guide';
  const contract=attach('reference',{kind:'artifact',ref:identity});
  assert.equal(contributionBody(contract).content.ref,identity);
  const named=render(ContributionText,{contract,subjects:[admitted(identity,'Shared continuation guide')]});
  assert.match(defaultText(named),/Attaches Shared continuation guide/);
  assert.doesNotMatch(defaultText(named),/world:|oi:contribution|source:contextual/);
  assert.ok(named.includes(identity));assert.ok(named.includes(contract.contribution_ref));
  assert.doesNotMatch(named,/<details[^>]*\sopen(?:[\s=>])/);
  const unnamed=render(ContributionText,{contract,subjects:[admitted(identity,identity)]});
  assert.match(defaultText(unnamed),/Attaches an unnamed reference/);assert.doesNotMatch(defaultText(unnamed),/world:/);
});

test('real structured relation contribution distinguishes its endpoints and preserves its complete source',()=>{
  const contract=attach('relation-proposal',{relation:{kind:'relation',ref:'relation:contextual-link'},from:{kind:'thing',ref:'world:contextual/from'},to:{kind:'thing',ref:'world:contextual/to'}});
  const html=render(ContributionText,{contract,subjects:[admitted('world:contextual/from','Ann’s guide'),admitted('world:contextual/to','Bea’s continuation')]});
  assert.match(defaultText(html),/Ann’s guide.*Bea’s continuation/);assert.doesNotMatch(defaultText(html),/relation:|world:/);
  assert.ok(html.includes('world:contextual/from'));assert.ok(html.includes('world:contextual/to'));
});

test('native admitted technical prose remains authored material and is not reference-scrubbed',()=>{
  const prose='Use world:keep:authored-prose and {"kind":"authored example"} in the source command.';
  assert.equal(defaultText(render(ContributionText,{contract:attach('prose',prose)})).trim(),prose);
});

test('a real native contribution with an unsupported carried format keeps its complete original source available',()=>{
  const contract=createContribution({...attach('prose','Carried source material'),representation:{kind:'owner:unknown-format/v2',payload:{title:'Retained native source',ref:'world:contextual/unsupported'}}});
  const html=render(ContributionText,{contract});
  assert.match(defaultText(html),/Unsupported contributed material/);assert.doesNotMatch(defaultText(html),/world:|owner:/);
  assert.ok(html.includes(contract.contribution_ref));assert.ok(html.includes('owner:unknown-format/v2'));assert.ok(html.includes('world:contextual/unsupported'));
  assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/);
});

test('real native source-proposal admission presents its authored HTML headings, table and code in the canonical sandbox',()=>{
  const authored='<h2>Continue shared work</h2><p>Keep <strong>attribution</strong>.</p><table><tr><th>Owner</th></tr><tr><td>Ann</td></tr></table><pre><code>{"subject":"world:keep:authored-code"}</code></pre><script>window.nativeWrite()</script>';
  const contract=attach('source-proposal',{operation:'entry.add',entry_id:'entry:contextual-html',contribution_id:'oi:contribution:contextual-html-body',html:authored});
  assert.equal(contributionBody(contract).content.html,authored);
  const html=render(ContributionText,{contract});
  assert.match(html,/<iframe/,'the production component must present the admitted HTML as formatted material');
  const frame=JSON.parse(execFileSync('python3',['-c',String.raw`
from html.parser import HTMLParser
import json,sys
class Frames(HTMLParser):
    def handle_starttag(self,tag,attributes):
        if tag=='iframe': print(json.dumps(dict(attributes)))
parser=Frames(); parser.feed(sys.stdin.read())
`],{input:html,encoding:'utf8'}));
  assert.equal(frame.sandbox,'allow-same-origin');assert.match(frame.srcdoc,/Content-Security-Policy/);
  assert.ok(frame.srcdoc.includes('<h2>Continue shared work</h2>'));assert.ok(frame.srcdoc.includes('<table>'));assert.ok(frame.srcdoc.includes('<pre><code>'));
  assert.ok(frame.srcdoc.includes('world:keep:authored-code'));assert.ok(!frame.srcdoc.includes('<script>'));
  assert.ok(html.includes('window.nativeWrite()'),'the closed exact source still retains original authored material');
  assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/);
});

test('a real Central remember write and read presents its status while preserving exact owner provenance',()=>{
  const selection='Keep shared work attributable; native reference world:keep:authored-selection.';
  const receipt=native(ctrl,['--json','action','run','central.remember',JSON.stringify({selection,source_ref:'source:contextual-native-source',destination:'remembered'})]);
  assert.equal(receipt.ok,true,JSON.stringify(receipt));assert.equal(receipt.data.note.provenance.selection,selection);
  const ownerRead=native(ctrl,['--json','action','run',receipt.data.read_path.action,JSON.stringify(receipt.data.read_path.input)]);
  assert.equal(ownerRead.ok,true,JSON.stringify(ownerRead));assert.ok(JSON.stringify(ownerRead).includes(selection));
  const outcome={state:'invoked',owner_operation:'central.remember',data:receipt.data};
  const html=render(RememberReceipt,{outcome}),text=defaultText(html);
  assert.match(text,/Selection remembered/);assert.match(text,/generated proposal awaiting your recognition/);
  assert.doesNotMatch(text,/source:|remembered:|central\.remember|world:/);
  assert.ok(html.includes(receipt.data.note.ref));assert.ok(html.includes(receipt.data.read_path.action));assert.ok(html.includes(selection));
  assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/);
  const refused=native(ctrl,['--json','action','run','central.remember',JSON.stringify({selection:'',source_ref:'source:contextual-native-source',destination:'remembered'})]);
  assert.equal(refused.ok,false);
  const refusal=render(RememberReceipt,{outcome:{state:'owner_refused',owner_operation:'central.remember',message:refused.error.message}});
  assert.match(defaultText(refusal),/owner refused/);assert.doesNotMatch(defaultText(refusal),/central\.remember|source:/);
  assert.ok(refusal.includes(refused.error.message.replaceAll('"','&quot;')));
});

test('real native Method discovery preserves written descriptions and keeps exact owner definitions available',async()=>{
  const id='skill/contextual/read-shared-work';
  const description='Explain the shared guide using world:keep:authored-command and {"kind":"authored example"} without changing its source.';
  const source=join(nativeEnv.AIKIT_HOME,'registries/personal/capsules',id);
  await mkdir(source,{recursive:true});
  await writeFile(join(source,'manifest.toml'),`schema = 1\nid = ${JSON.stringify(id)}\nkind = "skill"\nname = "Shared work reading"\ndescription = ${JSON.stringify(`METHOD: ${description}`)}\n\n[skill]\nexport_name = "shared-work-reading"\n`);
  await writeFile(join(source,'SKILL.md'),'Read the selected source and explain its written purpose, preserving quoted technical examples.\n');
  const reading=native(aikit,['--json','method','list']);
  assert.equal(reading.ok,true,JSON.stringify(reading));
  const admitted=reading.data.methods.filter(row=>row.id===id);assert.equal(admitted.length,1,'the native catalogue must admit the actual Method source');
  for(const row of admitted){
    const html=render(MethodMaterial,{row});
    assert.match(defaultText(html),new RegExp(row.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.ok(defaultText(html).includes(row.payload),'authored Method description stays verbatim');
    assert.equal(row.payload,description);
    assert.ok(html.includes(row.id));assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/);
  }
});

test('the native harness reconciliation reading shows timer names without announcing its raw job instructions',()=>{
  const reading=native(aikit,['--json','routine','list'],process.env);
  assert.equal(reading.ok,true,JSON.stringify(reading));
  for(const provider of reading.data.foreign_reconciliation.providers){
    for(const [index,job] of provider.jobs.entries()){
      const html=render(HarnessTimer,{job,index}),text=defaultText(html);
      assert.ok(!text.includes(job.job_id));assert.ok(html.includes(job.job_id));
      if(job.name)assert.ok(text.includes(job.name));
      if(!job.reconciled)assert.match(text,/not been adopted as a Routine/);
      if(job.reason)assert.ok(html.includes(job.reason.replaceAll('"','&quot;')));
    }
  }
});

test('composition uses the native surface title while exact paths and references remain in situation inspection',()=>{
  const location={ref:'central:file:contextual/native-file',central_root:'/native-ground',path:'Work/O-I/docs/shared-continuation.md'};
  const binding={id:'contextual-file',kind:'file',title:'Shared continuation guide',ref:location.ref,project:'O-I',location};
  const layout={root:{type:'group',id:'g1',tabs:[binding.id],pinned:[],active:binding.id},surfaces:{[binding.id]:binding},closedStack:[],focusedGroupId:'g1',agencyDepth:'panel',mode:'base'};
  const situation=buildSituationFrame({workspace:{id:'reading',name:'Continuation',project:'O-I',writing:'',layout},snapshot:{focus:{},surfaces:{},buffers:{}}});
  const html=renderToStaticMarkup(createElement(SituationProvider,{value:situation},createElement(SituationView))),text=defaultText(html);
  assert.match(text,/Shared continuation guide/);assert.doesNotMatch(text,/central:file:|Work\/O-I\/docs/);
  assert.ok(html.includes(location.ref));assert.ok(html.includes(location.path));
});

test('real SessionSpace stage, apply and read keeps named and unnamed conversations distinct without changing their targets',async()=>{
  const space='session-space/contextual-readable-native';
  const apply=async preview=>{const file=join(directory,'session-space-preview.json');await writeFile(file,JSON.stringify(preview));return native(aikit,['session-space','apply','--preview-json',`@${file}`]);};
  await apply(native(aikit,['session-space','create',space,'--label','Shared continuation review']));
  for(const attachment of [{agent_session:'agent-session/contextual-readable-named',purpose:'Review the shared guide',provenance:[]},{agent_session:'agent-session/contextual-readable-unnamed',provenance:[]},{agent_session:'agent-session/contextual-readable-raw-title',purpose:'agent-session/contextual-readable-raw-title',provenance:[]}]){
    const preview=native(aikit,['session-space','stage','--space',space,'--intent-json',JSON.stringify({operation:'attach-agent-session',attachment})]);
    await apply(preview);
  }
  const reading=native(aikit,['session-space','show',space]);
  assert.equal(Object.keys(reading.agent_sessions).length,3);
  const rows=conversationsFromReading([reading],'O-I');
  assert.equal(rows.length,3);assert.ok(rows.some(row=>row.title==='Review the shared guide'));
  assert.equal(new Set(rows.map(row=>row.title)).size,3);
  for(const row of rows){assert.ok(!row.title.includes(row.ref));assert.ok(Object.hasOwn(reading.agent_sessions,row.ref));assert.equal(row.space,space);assert.equal(row.project,'O-I');}
});

// The parent can supply a freshly read native Expression from the installed
// client's admitted private world. This never substitutes a service response.
if(process.env.CONTEXTUAL_EXPRESSION_READING){
  const reading=JSON.parse(await readFile(process.env.CONTEXTUAL_EXPRESSION_READING,'utf8'));
  const document=reading.document??reading.data?.document??reading.outcome?.data?.document??reading.representation?.payload?.composition;
  test('fresh native Expression scene and entity names describe changes while exact EX1 changes remain inspectable',()=>{
    assert.ok(document?.scenes?.length,'the owner reading must carry its actual ExpressionDocument');
    const scene=document.scenes[0],entity=Object.values(document.entities)[0];
    const change={change:'scene_remove',scene_ref:scene.scene_ref};
    const description=changeLine(change,document);
    assert.ok(description.includes(scene.title));assert.ok(!description.includes(scene.scene_ref));
    const html=render(RawDisclosure,{value:change,label:'Inspect exact change'});assert.ok(html.includes(scene.scene_ref));
    if(entity){const parameter={change:'parameter_set',entity_ref:entity.entity_ref,parameter:'glyph',value:'world:keep:authored-code'};const text=changeLine(parameter,document);assert.ok(text.includes(entity.title));assert.ok(text.includes(parameter.value));assert.ok(!text.includes(entity.entity_ref));}
  });
}

// A SessionSpace read can also be supplied from an independent native replay.
if(process.env.CONTEXTUAL_SESSION_SPACE_READING){
  const reading=JSON.parse(await readFile(process.env.CONTEXTUAL_SESSION_SPACE_READING,'utf8'));
  test('fresh native SessionSpace labels remain readable and every exact conversation target survives',()=>{
    const spaces=Array.isArray(reading)?reading:reading.spaces??[reading];
    const rows=conversationsFromReading(spaces,'O-I');assert.ok(rows.length);
    for(const row of rows){assert.ok(row.title);assert.ok(!row.title.includes(row.ref));assert.ok(spaces.some(space=>Object.hasOwn(space.agent_sessions,row.ref)));}
  });
}

if(process.env.CONTEXTUAL_HOSTED_EXPRESSION_READING){
  const envelope=JSON.parse(await readFile(process.env.CONTEXTUAL_HOSTED_EXPRESSION_READING,'utf8'));
  assert.equal(envelope.ok,true);
  const hosted=envelope.data;
  assert.equal(hosted.state,'hosted');
  const transport={kind:'bridge',url:process.env.CONTEXTUAL_NATIVE_BRIDGE_URL??'http://127.0.0.1:63273'};

  test('fresh admitted Expression reaches the complete production contribution panel with closed exact native source',()=>{
    const html=render(ContributionPanel,{transport,reading:hosted,subjects:[hosted.entry],onChanged:()=>{assert.fail('a read-only render cannot dispatch a native change');}}),text=defaultText(html);
    assert.match(text,/Contributions/);assert.match(html,/class="explore-contributions"/);
    assert.match(text,/Inspect current contribution source and authority/);
    for(const participant of hosted.participants)assert.ok(!text.includes(participant.participant_ref));
    assert.ok(!text.includes(hosted.entry.ref));assert.ok(html.includes(hosted.entry.ref));
    assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/);
  });

  test('native contribution contract renders participant names and exact action target bindings in the production panel',()=>{
    const participant=hosted.participants.find(row=>row.presentation?.chosen_name==='Ada');assert.ok(participant);
    const projection=hosted.projections.find(row=>row.state==='published');assert.ok(projection);
    const contract=createAttachedContribution({contribution_ref:'oi:contribution:contextual-panel-native',field_ref:hosted.field_ref,contributor_participant_ref:participant.participant_ref,created_at:new Date().toISOString(),target:{kind:hosted.entry.kind,ref:hosted.entry.ref,revision:projection.source.revision},provenance:[{kind:'projection-encounter',ref:projection.projection_ref,source_system:'o-i',revision:String(projection.projection_revision)}],body:{kind:'reference',content:{kind:hosted.entry.kind,ref:hosted.entry.ref}}});
    const row={contribution_ref:contract.contribution_ref,field_ref:contract.field_ref,contributor_participant_ref:contract.contributor_participant_ref,ingress_ref:null,contract};
    // A real SDK-created contract is supplied to the component's data boundary;
    // no transport or service response is substituted, and no hosted admission
    // is claimed for this newly constructed contract.
    const reading={...hosted,contributions:[...hosted.contributions,row]};
    const html=render(ContributionPanel,{transport,reading,subjects:[hosted.entry],onChanged:()=>{assert.fail('static reading must dispatch nothing');}}),text=defaultText(html);
    assert.match(text,/Ada/);assert.ok(text.includes(hosted.entry.label));
    assert.ok(!text.includes(participant.participant_ref));assert.ok(!text.includes(contract.contribution_ref));
    assert.match(html,/data-contribution-ref="oi:contribution:contextual-panel-native"/);
    assert.ok(html.includes(`data-contributor-ref="${participant.participant_ref}"`));
    assert.match(text,/Respond/);assert.match(text,/Propose to source/);
    assert.ok(html.includes(projection.projection_ref));assert.ok(html.includes(contract.target.ref));
    const admittedRow=render(AttributedContribution,{row,reading:hosted,subjects:[hosted.entry]});
    assert.match(defaultText(admittedRow),/Ada/);assert.ok(admittedRow.includes(contract.contribution_ref));
  });

  test('native participant admission without a chosen name gets a truthful ordinal rather than an invented identity name',()=>{
    const participant=createParticipant({participant_ref:'participant:contextual-panel-unnamed',field_ref:hosted.field_ref,identity:{kind:'human',ref:'human:contextual-panel-unnamed'},provenance:{source_system:'central',source_revision:'native-contextual-r1'}});
    const reading={participants:[...hosted.participants,participant]};
    assert.equal(contributionParticipantName(reading,participant.participant_ref),`Unnamed participant ${reading.participants.length}`);
    assert.equal(contributionParticipantName(reading,'participant:absent'),'Unnamed contributor');
  });

  test('actual carried composition names changes without claiming private native fields or changing its admitted schema',()=>{
    const basis=presentationBasis(hosted),document=basis.expression_document;
    assert.ok(document);assert.equal(document.schema,'oi.expression-composition/v1');assert.equal(document.revision,basis.expression_revision);
    const scene=document.scenes[0];
    const proposal={summary:'Keep the shared undertaking readable.',changes:[{change:'scene_remove',scene_ref:scene.scene_ref}]};
    const html=render(ExpressionProposal,{proposal,document}),text=defaultText(html);
    assert.ok(text.includes(scene.title));assert.ok(!text.includes(scene.scene_ref));
    assert.ok(!Object.hasOwn(document,'refinements'),'the filtered composition is not fabricated into a full private native document');
  });

  test('production reference and scene selectors read admitted names while retaining exact native option targets',()=>{
    const basis=presentationBasis(hosted),document=basis.expression_document;
    const reference=render(DraftFields,{kind:'reference',draft:{materialRef:hosted.entry.ref},setDraft:()=>{assert.fail('static selector reading must dispatch nothing');},anchors:[],scenes:document.scenes,subjects:[hosted.entry]});
    const referenceText=defaultText(reference);
    assert.ok(referenceText.includes(hosted.entry.label));assert.ok(!referenceText.includes(hosted.entry.ref));
    assert.ok(reference.includes(`value="${hosted.entry.ref}"`));assert.match(referenceText,/Use an exact native address/);
    assert.doesNotMatch(reference,/<details[^>]*\sopen(?:[\s=>])/);
    const scene=document.scenes[0];
    const revision=render(DraftFields,{kind:'expression-revision',draft:{summary:'Keep the shared undertaking readable.',sceneRef:scene.scene_ref},setDraft:()=>{assert.fail('static selector reading must dispatch nothing');},anchors:[],scenes:document.scenes,subjects:[hosted.entry]});
    assert.ok(defaultText(revision).includes(scene.title));assert.ok(!defaultText(revision).includes(scene.scene_ref));
    assert.ok(revision.includes(`value="${scene.scene_ref}"`));
  });

  test('held native review scope only matches its actual qualified World and source, including two Worlds with the same source identity',()=>{
    const basis=presentationBasis(hosted);assert.ok(basis);
    const current={source_world_ref:basis.source_world_ref,source_ref:basis.source_ref};
    assert.equal(reviewBelongsToBasis(basis,current),true);
    assert.equal(reviewBelongsToBasis(basis,{source_world_ref:basis.source_world_ref,expression_ref:basis.expression_ref}),true);
    const otherWorld=hosted.participants.map(row=>row.presentation?.world_ref).find(ref=>ref&&ref!==basis.source_world_ref);assert.ok(otherWorld,'the real publication includes its other World');
    assert.equal(reviewBelongsToBasis(basis,{...current,source_world_ref:otherWorld}),false);
    assert.equal(reviewBelongsToBasis(undefined,current),false);assert.equal(reviewBelongsToBasis(basis,undefined),false);
    assert.equal(reviewBelongsToBasis(basis,{source_world_ref:basis.source_world_ref}),false);
  });

  test('source review preserves admitted HTML structure and puts the exact owner anchor in structured binding',()=>{
    const proposal={operation:'entry.append',entry_id:'entry:contextual-source-anchor',contribution_id:'oi:contribution:contextual-source-html',html:'<h2>Continue shared work</h2><table><tr><th>Owner</th></tr><tr><td>Ann</td></tr></table><pre><code>world:keep:authored-code</code></pre>'};
    const html=render(SourceProposal,{proposal,anchors:[{kind:'entry',id:proposal.entry_id,label:'Shared guide opening'}]}),text=defaultText(html);
    assert.match(text,/Shared guide opening/);assert.ok(!text.includes(proposal.entry_id));assert.ok(html.includes(`data-source-anchor="${proposal.entry_id}"`));
    assert.match(html,/<iframe/);assert.ok(html.includes('&lt;table&gt;'));assert.ok(html.includes('&lt;pre&gt;&lt;code&gt;'));
  });

  test('native response and action receipts have meaningful status while their complete exact details stay inspectable',()=>{
    const refusal=native(ctrl,['--json','action','run','central.remember',JSON.stringify({selection:'',source_ref:hosted.entry.ref,destination:'remembered'})]);
    assert.equal(refusal.ok,false);
    const error=refusal.error.message;
    const html=render(ContributionStatus,{error}),text=defaultText(html);
    assert.match(text,/could not be completed/);assert.ok(!text.includes('central.remember'));assert.ok(html.includes(error.replaceAll('"','&quot;')));
    const receipt=native(ctrl,['--json','action','run','central.remember',JSON.stringify({selection:'Keep the shared guide attributable.',source_ref:hosted.entry.ref,destination:'remembered'})]);
    assert.equal(receipt.ok,true);
    const success=render(ContributionStatus,{message:{text:'The owner saved the selection.',source:receipt.data}});
    assert.match(defaultText(success),/saved the selection/);assert.ok(!defaultText(success).includes(receipt.data.note.ref));assert.ok(success.includes(receipt.data.note.ref));
  });
}
