import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';

// Exercise the actual CLI over a pipe, including the loader and its process
// exit. A large real unknown-target response reproduces the snapshot failure
// without requiring a network service or manufacturing owner replies.
for(const kind of ['status','snapshot'])test(`field CLI drains a large ${kind} envelope before exit`,()=>{
  const target='unconfigured-'+('x'.repeat(100000));
  const env={...process.env,OI_SHARED_FIELD_TARGET:target};
  delete env.SPACETIMEDB_URI;delete env.SPACETIMEDB_DATABASE;
  const result=spawnSync(fileURLToPath(new URL('./field.sh',import.meta.url)),[],{env,input:JSON.stringify({kind}),encoding:'utf8',maxBuffer:1024*1024,timeout:15000});
  assert.ifError(result.error);
  assert.equal(result.status,kind==='status'?0:1,result.stderr);
  assert.ok(Buffer.byteLength(result.stdout)>65536);
  const envelope=JSON.parse(result.stdout);
  assert.equal(envelope.ok,kind==='status');
  assert.ok((envelope.data?.reason??envelope.error.message).includes(target));
});

// Held (`--held`, O-I #858): the native host's one client answers each line by
// id and, when its host lets go (end of input), drains every answer before it
// exits — however large — and answers what was asked before it ends.
test('held field CLI answers every line by id and drains large answers before exit',()=>{
  const target='unconfigured-'+('x'.repeat(100000));
  const env={...process.env,OI_SHARED_FIELD_TARGET:target};
  delete env.SPACETIMEDB_URI;delete env.SPACETIMEDB_DATABASE;
  const input=[{id:1,request:{kind:'status'}},{id:2,request:{kind:'snapshot'}},{id:3,request:{kind:'observe'}}].map((line)=>JSON.stringify(line)).join('\n')+'\n';
  const result=spawnSync(fileURLToPath(new URL('./field.sh',import.meta.url)),['--held'],{env,input,encoding:'utf8',maxBuffer:4*1024*1024,timeout:15000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const lines=result.stdout.trim().split('\n').map((line)=>JSON.parse(line));
  const answers=new Map(lines.filter((line)=>typeof line.id==='number').map((line)=>[line.id,line]));
  assert.deepEqual([...answers.keys()].sort(),[1,2,3],'every request answered once, by its id');
  assert.equal(answers.get(1).ok,true);
  assert.ok(answers.get(1).data.reason.includes(target));
  for(const id of [2,3]){
    assert.equal(answers.get(id).ok,false);
    assert.equal(answers.get(id).error.kind,'unbound','an unbound target is absence, by id');
    assert.ok(answers.get(id).error.message.includes(target));
  }
  assert.ok(lines.some((line)=>line.event==='status'&&line.state==='unbound'),'the held client says where it stands');
  assert.ok(Buffer.byteLength(result.stdout)>3*65536);
});

// Observation is the held client's (O-I #858): its cursor is the transaction, and a one-shot run takes none, so it never
// waits on the field for one, nor names a cursor by hashing a whole snapshot. A one-shot run says so, before the network.
test('a one-shot observe is refused as the held client\'s, without the network',()=>{
  const env={...process.env,OI_SHARED_FIELD_TARGET:'unconfigured-observe'};
  delete env.SPACETIMEDB_URI;delete env.SPACETIMEDB_DATABASE;
  const result=spawnSync(fileURLToPath(new URL('./field.sh',import.meta.url)),[],{env,input:JSON.stringify({kind:'observe',cursor:'sha256:00'}),encoding:'utf8',timeout:15000});
  assert.ifError(result.error);
  assert.equal(result.status,1,result.stderr);
  const envelope=JSON.parse(result.stdout);
  assert.equal(envelope.ok,false);
  assert.equal(envelope.error.kind,'refused','refused as the held client\'s, not answered as an unbound target');
  assert.match(envelope.error.message,/--held/);
});

// A field back in view (O-I #858): the held client's cursor moves once when a field that was in view on its connection comes
// back into view after it was out of it — what moved there meanwhile sent nothing, so what the window holds of it is read
// again — and never for a field first brought into view, one still in view, or one let go. The rule the held client keeps
// (field-lib `backInView`), asked through the client's own toolchain, without the network.
test('a field back in view after it was out of it moves the cursor once, and nothing else does',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const cases=[
    // [what was in view on this connection, what is in view now (null: nothing yet), what comes into view, moves]
    [['f'],[],['f'],true,'a field back in view after its glance lapsed'],
    ['whole',[],['f'],true,'a field back in view after the whole field was let go'],
    ['whole',['g'],'whole',true,'the whole field back in view after a narrower view'],
    [['f','g'],['g'],'whole',true,'the whole field back, with a field that was out of view'],
    [[],[],['f'],false,'a field first brought into view'],
    [[],null,['f'],false,'the first view on a connection'],
    [['f'],['f'],['f','g'],false,'a field still in view, beside one first brought in'],
    [['f','g'],['f','g'],['f'],false,'a field let go'],
    ['whole','whole',['f'],false,'narrowing from the whole field'],
    [['f'],['f'],'whole',false,'the whole field first brought into view, nothing seen out of it'],
  ];
  const script=`import {backInView} from './field-lib.ts';const cases=${JSON.stringify(cases)};`+
    `console.log(JSON.stringify(cases.map(([seen,prior,want])=>backInView(seen,prior??undefined,want))));`;
  const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const moved=JSON.parse(result.stdout.trim().split('\n').at(-1));
  cases.forEach(([,, ,moves,what],index)=>assert.equal(moved[index],moves,what));
});

// Contributions to a world (O-I #858, SF07), a claim of the same work among them (SF09), read none of a field's scoped rows: they are held beside the worlds, so a glance for one of
// their acts brings no field into view and moves no cursor of a field the window does not read. Asked through the client's own toolchain.
test('acts on contributions to a world bring no field into view',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const kinds=['world-contribute','world-claim-same','world-contribution-accept','world-contribution-refuse','world-contribution-take-back'];
  const script=`import {requestScope} from './field-lib.ts';console.log(JSON.stringify(${JSON.stringify(kinds)}.map((kind)=>requestScope({kind}))));`;
  const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const scopes=JSON.parse(result.stdout.trim().split('\n').at(-1));
  kinds.forEach((kind,index)=>assert.deepEqual(scopes[index],[],kind));
});

// A watch (O-I #858; DLW build ruling 2026-11-06) is held beside the worlds, the caller's own: Watch and Unwatch bring no field into view
// and move no cursor of a field the window does not read.
test('Watch and Unwatch bring no field into view',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const kinds=['world-watch','world-unwatch'];
  const script=`import {requestScope} from './field-lib.ts';console.log(JSON.stringify(${JSON.stringify(kinds)}.map((kind)=>requestScope({kind}))));`;
  const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const scopes=JSON.parse(result.stdout.trim().split('\n').at(-1));
  kinds.forEach((kind,index)=>assert.deepEqual(scopes[index],[],kind));
});

// A star handed on (O-I #858, SF03): Hand on, Keep and Take on are acts on a star beside the worlds, and bring no field into view.
test('Hand on, Keep and Take on of a star bring no field into view',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const kinds=['star-hand-on','star-keep','star-take-on'];
  const script=`import {requestScope} from './field-lib.ts';console.log(JSON.stringify(${JSON.stringify(kinds)}.map((kind)=>requestScope({kind}))));`;
  const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const scopes=JSON.parse(result.stdout.trim().split('\n').at(-1));
  kinds.forEach((kind,index)=>assert.deepEqual(scopes[index],[],kind));
});

// A world's agent asked at a star (O-I #858, SF10): Ask, Answer and Unask are the two worlds' own acts beside the worlds, and bring no
// field into view.
test('Ask, Answer and Unask of a world\'s agent bring no field into view',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const kinds=['world-agent-ask','world-agent-answer','world-agent-unask'];
  const script=`import {requestScope} from './field-lib.ts';console.log(JSON.stringify(${JSON.stringify(kinds)}.map((kind)=>requestScope({kind}))));`;
  const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const scopes=JSON.parse(result.stdout.trim().split('\n').at(-1));
  kinds.forEach((kind,index)=>assert.deepEqual(scopes[index],[],kind));
});

// AIKit's own output (ai-kit 0348d944) as its CLI prints it with `--json`, each shape from its source (601b ruling 6, DLW build ruling
// 2026-11-09): nothing ties the window to AIKit but AIKit's own words.
const AIKIT_SHAPES=`
const SENT='aikit:communique:01sent', LINE='aikit:sender-of:'+SENT, KEEPER='project:Keeper', LIBRARIAN='central:position:project:Keeper:librarian', G7='actuation:generation:g7';
// the envelope: crates/aikit-cli/src/json.rs success (l.100-108) and failure (l.115-130); a failure is printed on stdout too (main.rs l.91-97)
const ok=(data)=>({schema:1,ok:true,context:{context_id:null,session_id:null,project_root:null},data,warnings:[]});
const no=(code,message)=>({schema:1,ok:false,error:{code,message,details:{}}});
// a three-part refusal: crates/aikit-cli/src/gateway_contact.rs three_part (l.94-105), its message the three parts in one sentence and
// each part in details; one that kept nothing says so in its consequence, nothing_sent (l.1127-1129), as gateway.unknown_position does
// (l.1292-1297); one refused after the Communique was kept says otherwise, as gateway.communique_instance_binding_lost does (l.2662-2674)
const refusal=(code,fact,consequence,action)=>({schema:1,ok:false,error:{code,message:fact+' '+consequence+' '+action,details:{fact,consequence,action}}});
const NOTHING_SENT='Nothing was sent; no Communique was recorded.';
// a Communique record: crates/aikit-adapters/src/gateway_communique.rs Communique (l.308-361), attribution in kebab-case (l.127-135)
const communique=(more)=>({schema:'aikit.communique/v1',communique_ref:'aikit:communique:01reply',sequence:2,from_position_ref:LIBRARIAN,from_generation_ref:G7,
  attribution:'verified',attribution_basis:'Actuation reads '+G7+' as the occupant of '+LIBRARIAN,to_position_ref:LINE,body:'',sent_at_unix_ms:1762646400000,
  received_at_unix_ms:1762646400000,state:'held',delivered_to_generation_ref:null,delivered_at_unix_ms:null,escalated_custody_ref:null,reply_to:SENT,
  origin_gateway_ref:'agency-gateway/a',transitions:[],...more});
// an answer's body as crates/aikit-cli/tests/gateway_contact.rs reads one back (l.3656-3660), and the one decline (l.3905-3907;
// gateway_world_agent.rs DECLINE_WORDS and WAITING_WORDS, l.85-88)
const answerBody=(words,cites,more)=>JSON.stringify({schema:'oi.world-agent-answer/v1',words,cites,...more});
const DECLINE="The world's agent couldn't answer this from what the world shows here.", WAITING="Waiting for the world's agent.";
// a replies reading: crates/aikit-cli/src/gateway_contact.rs replies (l.3707-3806), as tests/gateway_contact.rs asserts it (l.3610-3612 the
// wait, l.3646-3660 a reply on the line back, l.4089-4125 a relayed ask read and unread)
const replies=(found,more)=>({schema:'aikit.communique-replies/v1',communique_ref:SENT,to_position_ref:LIBRARIAN,reply_line:LINE,
  waiting:found.length?null:WAITING,declined:null,replies:found,relayed:false,complete:true,remote_replies:null,...more});
// one Position of a who reading: gateway_contact.rs l.4001-4008, occupied as occupied_row writes it (l.4454-4467); the reading l.4309-4318
const position=(position_ref,handle,generation)=>({position_ref,handle,label:null,role_ref:null,inherited:false,definition:'present',
  occupancy:generation?{state:'occupied',generation_ref:generation,generation_ordinal:1,kind:'agent',agent_ref:null,agency_ref:null,agent_session_ref:null,
    workcell_ref:'workcell:a',since_unix_ms:1762646400000,presence:null,attention:null,observed_via:'local'}:{state:'vacant',observed_via:'local'},communiques:{undelivered:0}});
const who=(...positions)=>({schema:'aikit.population-reading/v1',project_world_ref:KEEPER,local_world_ref:null,local_workcell_ref:'workcell:a',positions,agents:[],remotes:[],absences:[]});
const W=who(position(LIBRARIAN,'@Thoth',G7));
// what send answers the window, which stands at no Position: tests/gateway_contact.rs l.3588-3598 (attribution unknown)
const sent=(ref)=>({communique:communique({communique_ref:ref,sequence:1,from_position_ref:null,from_generation_ref:null,attribution:'unknown',
  attribution_basis:'no Position was named',to_position_ref:LIBRARIAN,body:'{}',reply_to:null,state:'pending'})});
// what disclose answers: crates/aikit-cli/src/gateway_world_agent.rs disclose (l.486-491), its record WorldDisclosure (l.277-281)
const disclosed=(world_ref,act)=>({schema:'aikit.world-star-disclosure/v1',act,changed:true,disclosure:{schema:'aikit.world-star-disclosure/v1',world_ref,parts:[]}});
`;

// The AIKit gateway seam of a world's agent (SF10): the asked world's window relays the ask as `aikit gateway send`, addressed as it
// was asked — a name looked up in the world asked, never in the one the window's folder stands in — carrying as its only sources what
// that world shows at the star (or to the field or the public); the reply AIKit verified from the Position the ask reached becomes the
// answer, as that agent.
test('an ask of a world\'s agent relays through AIKit\'s gateway as it was addressed, with what its world shows there as its only sources, and a verified reply answers as that agent',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const script=`import {agentAskRelay,agentAnswerRequest} from './field-lib.ts';${AIKIT_SHAPES}
const A=KEEPER, B='world:asker', star='star:keepers', other='star:elsewhere';
const ask=(by,address,more)=>({ask_ref:'ask:one',star_ref:star,world_ref:B,to_world_ref:A,by,address,words:'What does the fourth plate show?',...more});
const clearings=[
  {world_ref:A,part_ref:'page:at-the-star',star_ref:star,audience:'star',shown:{kind:'page',label:'At the star'}},
  {world_ref:A,part_ref:'page:to-the-field',star_ref:null,audience:'field',shown:{kind:'page',label:'To the field'}},
  {world_ref:A,part_ref:'page:at-another-star',star_ref:other,audience:'star',shown:{kind:'page',label:'Elsewhere'}},
  {world_ref:B,part_ref:'page:the-askers',star_ref:star,audience:'star',shown:{kind:'page',label:'Not A\\'s'}}];
const named=who(position(LIBRARIAN,'@Thoth',G7),position('central:position:project:Keeper:scribe','@Seshat',null));
const reply=(more)=>communique({reply_to:'communique:sent',body:answerBody('The circle opens there.',[{part_ref:'page:at-the-star',star_ref:star}]),...more});
console.log(JSON.stringify({
  role:agentAskRelay(ask('role','librarian'),clearings,named), name:agentAskRelay(ask('name','Thoth'),clearings), instance:agentAskRelay(ask('instance',G7),clearings,named),
  gone:agentAskRelay(ask('instance','actuation:generation:g1'),clearings,named), whole:agentAskRelay(ask('name','Thoth',{to_world_ref:'project'}),clearings),
  answer:agentAnswerRequest(ask('role','librarian'),reply({}),named), unverified:agentAnswerRequest(ask('role','librarian'),reply({attribution:'unknown'}),named),
  elsewhere:agentAnswerRequest(ask('role','librarian'),reply({from_position_ref:'central:position:project:Other:librarian'}),named),
  prose:agentAnswerRequest(ask('role','librarian'),reply({body:'Just words.'}),named),
  offered:agentAnswerRequest(ask('role','librarian'),reply({body:answerBody('Take the task.',[],{offer_ref:'offer:mine'})}),named)}));`;
  const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const out=JSON.parse(result.stdout.trim().split('\n').at(-1));
  const to=(relay)=>relay.argv.slice(0,relay.argv.indexOf('--body'));
  assert.deepEqual(to(out.role),['aikit','gateway','send','--to','central:position:project:Keeper:librarian'],'by its role: its world\'s Position');
  assert.deepEqual(to(out.name),['aikit','gateway','send','--to','@Thoth','--project-world','project:Keeper'],'by its name: its handle, in the world asked');
  assert.deepEqual(to(out.instance),['aikit','gateway','send','--to','central:position:project:Keeper:librarian','--instance','actuation:generation:g7'],'the exact instance running, at the Position it occupies');
  assert.match(out.gone.refused,/not running/,'an instance not running is not sent to');
  assert.match(out.whole.refused,/world asked is not named whole/,'a name is looked up only in a world named whole');
  const body=JSON.parse(out.role.argv[out.role.argv.indexOf('--body')+1]);
  assert.equal(body.schema,'oi.world-agent-ask/v1');
  assert.deepEqual(body.sources.map((source)=>source.part_ref),['page:at-the-star','page:to-the-field'],'its only sources are what its world shows at that star or to the field: nothing at another star, nothing of another world');
  assert.equal(out.role.argv.at(-1),'--json');
  assert.deepEqual(out.answer.request,{kind:'world-agent-answer',ask_ref:'ask:one',world_ref:'project:Keeper',agent:{name:'Thoth',role:'librarian',instance:'actuation:generation:g7'},
    words:'The circle opens there.',cites:[{part_ref:'page:at-the-star',star_ref:'star:keepers'}]},'a verified reply answers as the agent that sent it');
  assert.match(out.unverified.refused,/verified/,'a reply AIKit did not verify answers for no one');
  assert.match(out.elsewhere.refused,/no Position of the world asked/,'nor one from another world\'s Position');
  assert.match(out.prose.refused,/oi\.world-agent-answer\/v1/,'an answer names what it answered from');
  assert.equal(out.offered.request.offer_ref,'offer:mine','the task its world offered there rides with the answer, for the field to check');
});

// The line back (ai-kit #601): the window that relays an ask stands at no Position, so AIKit holds each reply on the line back to it
// (`aikit:sender-of:<ref>`), and the window reads its agent's answers by the ref `aikit gateway send` answered (`aikit gateway replies`,
// `aikit.communique-replies/v1`), never from an inbox. Only a verified reply to that ask, on that line, answers it. Every reading has one
// shape (601b ruling 5): `refused` lists the replies it could not use, empty when none; a reading that could not be had is refused for
// its own cause, AIKit's words where AIKit said no; a reading that could not reach where the ask was relayed is said, never taken for no
// answer; and replies none of which can be used settle the ask in words once AIKit waits no more (601b ruling 2).
test('the window reads its agent\'s answers by the ref it holds, only a verified reply on the line back answers, and every reading settles or says why not',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const script=`import {agentRepliesRelay,agentRepliesAnswers} from './field-lib.ts';${AIKIT_SHAPES}
const ask={ask_ref:'ask:one',star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?'};
const reply=(more)=>communique({body:answerBody('The second plate.',[{part_ref:'page:at-the-star',star_ref:'star:keepers'}]),...more});
const unreadable={state:'unreadable',code:'gateway.remote_replies_unreadable',error:'connect ECONNREFUSED 127.0.0.1:7'};
console.log(JSON.stringify({
  relay:agentRepliesRelay(ok(sent(SENT)).data), nothing:agentRepliesRelay({}), unprefixed:agentRepliesRelay({communique:{communique_ref:'communique:sent'}}),
  read:agentRepliesAnswers(ask,SENT,replies([reply({})]),W), printed:agentRepliesAnswers(ask,SENT,ok(replies([reply({})])),W),
  stray:agentRepliesAnswers(ask,SENT,replies([reply({reply_to:'aikit:communique:other'}),reply({to_position_ref:LIBRARIAN})]),W),
  claimed:agentRepliesAnswers(ask,SENT,replies([reply({attribution:'claimed'})]),W),
  other:agentRepliesAnswers(ask,SENT,replies([],{communique_ref:'aikit:communique:other'}),W),
  shape:agentRepliesAnswers(ask,SENT,{schema:'aikit.communique-inbox/v1'},W),
  failed:agentRepliesAnswers(ask,SENT,no('gateway.replies_to_a_position','aikit:communique:01sent was sent from Position central:position:project:Keeper:scribe, so its replies are addressed to that Position.'),W),
  unread:agentRepliesAnswers(ask,SENT,replies([],{relayed:true,complete:false,remote_replies:unreadable}),W),
  endedUnread:agentRepliesAnswers(ask,SENT,replies([],{relayed:true,complete:false,waiting:null,declined:{words:DECLINE,basis:'it waited 24 hours with no answer'},remote_replies:unreadable}),W),
  waitingBeside:agentRepliesAnswers(ask,SENT,replies([reply({})],{waiting:WAITING}),W),
  nohandle:agentRepliesAnswers(ask,SENT,replies([reply({})]),who(position(LIBRARIAN,null,G7))),
  prose:agentRepliesAnswers(ask,SENT,replies([reply({body:'It is the second plate.'})]),W),
  proseWaiting:agentRepliesAnswers(ask,SENT,replies([reply({body:'It is the second plate.'})],{waiting:WAITING}),W),
  proseUnread:agentRepliesAnswers(ask,SENT,replies([reply({body:'It is the second plate.'})],{relayed:true,complete:false,remote_replies:unreadable}),W)}));`;
  const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const out=JSON.parse(result.stdout.trim().split('\n').at(-1));
  assert.deepEqual(out.relay,{argv:['aikit','gateway','replies','aikit:communique:01sent','--json'],communique_ref:'aikit:communique:01sent'},'read by the ref the send answered');
  assert.match(out.nothing.refused,/ref/,'no ref, nothing to read');
  assert.match(out.unprefixed.refused,/ref/,'only a Communique\'s own ref is read by');
  assert.equal(out.read.complete,true);
  assert.deepEqual(out.read.refused,[],'one shape: nothing refused is an empty list');
  assert.deepEqual(out.read.answers.map((a)=>a.request),[{kind:'world-agent-answer',ask_ref:'ask:one',world_ref:'project:Keeper',agent:{name:'Thoth',role:'librarian',instance:'actuation:generation:g7'},
    words:'The second plate.',cites:[{part_ref:'page:at-the-star',star_ref:'star:keepers'}]}],'a verified reply on the line back answers as that agent');
  assert.deepEqual(out.read.answers.map((a)=>a.declined),[false],'an answer is no decline');
  assert.equal(out.read.settled,null);
  assert.deepEqual(out.printed,out.read,'AIKit\'s envelope, as it prints it, reads as its data');
  assert.deepEqual(out.stray.answers,[],'a reply to something else, or one not on the line back, answers nothing');
  assert.equal(out.stray.refused.length,2);
  out.stray.refused.forEach((words)=>assert.match(words,/not a reply to this ask/));
  assert.match(out.stray.settled,/^Its agent's reply could not be read as an answer: That reply is not a reply to this ask/,'and the ask settles, in words');
  assert.deepEqual(out.claimed.answers,[],'a Claimed reply answers for no one');
  assert.match(out.claimed.refused[0],/verified/);
  assert.match(out.claimed.settled,/^Its agent's reply could not be read as an answer: Only a reply AIKit verified/);
  assert.match(out.other.refused[0],/another ask/,'a reading of another ref is not this ask\'s');
  assert.equal(out.other.complete,false);
  assert.match(out.shape.refused[0],/aikit\.communique-replies\/v1/);
  assert.equal(out.shape.complete,false);
  assert.equal(out.shape.settled,null,'a reading not had settles nothing');
  assert.match(out.failed.refused[0],/so its replies are addressed to that Position/,'AIKit\'s own cause, when AIKit said no');
  assert.doesNotMatch(out.failed.refused[0],/communique-replies\/v1/,'never the schema in its place');
  assert.equal(out.failed.complete,false);
  assert.equal(out.unread.complete,false,'where it was relayed could not be read: not "no answer"');
  assert.match(out.unread.unread,/could not be read/);
  assert.doesNotMatch(out.unread.unread,/ECONNREFUSED|127\.0\.0\.1/,'in plain words, without the transport\'s raw cause');
  assert.equal(out.endedUnread.ended,null,'an ask AIKit ended is not ended here while where it was relayed could not be read');
  assert.match(out.endedUnread.unread,/could not be read/);
  assert.equal(out.waitingBeside.waiting,null,'a reply that answers is never read beside words for the wait');
  assert.equal(out.waitingBeside.answers.length,1);
  assert.match(out.nohandle.settled,/^Its agent's reply could not be read as an answer: AIKit names no handle/,'a verified reply whose agent AIKit names no handle for settles the ask');
  assert.equal(out.nohandle.complete,true);
  assert.match(out.prose.settled,/^Its agent's reply could not be read as an answer: The reply is not an answer in oi\.world-agent-answer\/v1/,'a verified reply that is no answer settles it once AIKit waits no more');
  assert.equal(out.proseWaiting.settled,null,'while AIKit still says it waits, it waits');
  assert.equal(out.proseWaiting.waiting,"Waiting for the world's agent.");
  assert.equal(out.proseUnread.settled,null,'nor while where it was relayed could not be read: an answer may wait there');
  assert.equal(out.proseUnread.refused.length,1);
  assert.match(out.proseUnread.unread,/could not be read/);
});

// What AIKit answers from (ai-kit #601; DLW build ruling 2026-11-09): only its own record of what the world shows at the star, which the
// person's window writes on each Show and Withdraw (`aikit gateway disclose`), never the ask's `sources`. A ref is one AIKit takes as a
// plain ref (601b ruling 4: its `plain_ref`, by bytes, with no whitespace or control character as Rust reads them), never one that
// begins with a dash, and a world is named whole; a star of '' is no star, as the field reads it; a kind or label AIKit would refuse is
// left out, never the part. A decline is AIKit's one plain answer, carried as the answer it is so the asker never waits on it; while
// nothing has answered, AIKit's words for the wait are read.
test('the window tells AIKit what its world shows on each Show and Withdraw, carries a decline as the answer it is, and reads AIKit\'s words for the wait',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const script=`import {agentDiscloseRelay,agentRepliesAnswers} from './field-lib.ts';${AIKIT_SHAPES}
const star='star:keepers';
const ask={ask_ref:'ask:one',star_ref:star,world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?'};
const reply=(body)=>communique({body});
const open=(more)=>({kind:'clearing-open',world_ref:'world:me',part_ref:'day-entry:0123456789abcdef',audience:'star',star_ref:star,shown:{kind:'page',label:'- the second plate'},...more});
console.log(JSON.stringify({
  star:agentDiscloseRelay(open({})),
  field:agentDiscloseRelay(open({audience:'field',star_ref:undefined})), public:agentDiscloseRelay(open({audience:'public',star_ref:undefined})),
  starless:agentDiscloseRelay(open({star_ref:undefined})), fieldAtStar:agentDiscloseRelay(open({audience:'field'})), nobody:agentDiscloseRelay(open({audience:'nobody'})),
  spaced:agentDiscloseRelay(open({part_ref:'day entry'})), starSpaced:agentDiscloseRelay(open({star_ref:'star:a b'})),
  world:agentDiscloseRelay(open({world_ref:'project'})), worldGap:agentDiscloseRelay(open({world_ref:'world::me'})),
  control:agentDiscloseRelay(open({part_ref:'part:a\\u0007b'})), nbsp:agentDiscloseRelay(open({part_ref:'part:a\\u00a0b'})),
  long:agentDiscloseRelay(open({part_ref:'part:'+'\\u00e9'.repeat(300)})), fits:agentDiscloseRelay(open({part_ref:'part:'+'\\u00e9'.repeat(253)})),
  dash:agentDiscloseRelay(open({part_ref:'-x'})), feff:agentDiscloseRelay(open({part_ref:'part:\\ufeffzero'})),
  emptyStar:agentDiscloseRelay(open({audience:'field',star_ref:''})),
  emptyStarWithdraw:agentDiscloseRelay({kind:'clearing-withdraw',world_ref:'world:me',part_ref:'place:the-study',star_ref:''}),
  lines:agentDiscloseRelay(open({shown:{kind:'page',label:'two\\nlines'}})), longLabel:agentDiscloseRelay(open({shown:{kind:'page',label:'x'.repeat(161)}})),
  fullLabel:agentDiscloseRelay(open({shown:{kind:'page',label:'x'.repeat(160)}})), spacedKind:agentDiscloseRelay(open({shown:{kind:'a page',label:'L'}})),
  withdrawStar:agentDiscloseRelay({kind:'clearing-withdraw',world_ref:'world:me',part_ref:'place:the-study',star_ref:star}),
  withdrawField:agentDiscloseRelay({kind:'clearing-withdraw',world_ref:'world:me',part_ref:'place:the-study'}),
  other:agentDiscloseRelay({kind:'world-put',world_ref:'world:me'}),
  declined:agentRepliesAnswers(ask,SENT,replies([reply(answerBody(DECLINE,[],{declined:true}))]),W),
  waiting:agentRepliesAnswers(ask,SENT,replies([]),W),
  none:agentRepliesAnswers(ask,SENT,replies([],{waiting:null}),W),
  ended:agentRepliesAnswers(ask,SENT,replies([],{waiting:null,declined:{words:DECLINE,
    basis:'the ask ended: declined: it waited 24 hours, and no occupant of central:position:project:Keeper:librarian answered it'}}),W),
  endedAnswered:agentRepliesAnswers(ask,SENT,replies([reply(answerBody(DECLINE,[],{declined:true}))],{declined:{words:'stale',basis:'stale'}}),W)}));`;
  const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const out=JSON.parse(result.stdout.trim().split('\n').at(-1));
  const head=['aikit','gateway','disclose','--world','world:me','--part','day-entry:0123456789abcdef'];
  assert.deepEqual(out.star,{argv:[...head,'--star','star:keepers','--kind','page','--label=- the second plate','--json']},'shown at a star: recorded at that star, its label one argument');
  assert.deepEqual(out.field,{argv:[...head,'--field','--kind','page','--label=- the second plate','--json']},'shown to the field: at every star');
  assert.deepEqual(out.public,out.field,'shown to the public: so to the field too');
  for (const key of ['starless','fieldAtStar','nobody']) assert.match(out[key].refused,/one star, or to the field or the public/,key);
  assert.match(out.spaced.refused,/A part is told to AIKit by its own ref/);
  assert.match(out.starSpaced.refused,/star is told to AIKit by its own ref/);
  for (const key of ['world','worldGap']) assert.match(out[key].refused,/A world is told to AIKit by its whole ref/,key);
  for (const key of ['control','nbsp','long','dash']) assert.match(out[key].refused,/A part is told to AIKit by its own ref/,key);
  assert.equal(out.fits.argv[6],'part:'+'\u00e9'.repeat(253),'512 bytes is a ref AIKit takes');
  assert.equal(out.feff.argv[6],'part:\ufeffzero','U+FEFF is no whitespace to Rust, so AIKit takes it');
  assert.deepEqual(out.emptyStar,{argv:[...head,'--field','--kind','page','--label=- the second plate','--json']},'a star of \'\' is no star, as the field reads it');
  assert.deepEqual(out.emptyStarWithdraw.argv.slice(-3),['--field','--withdraw','--json']);
  for (const key of ['lines','longLabel']) assert.ok(!out[key].argv.some((arg)=>arg.startsWith('--label')),key+': a label AIKit would refuse is left out, never the part');
  assert.ok(out.fullLabel.argv.includes('--label='+'x'.repeat(160)),'160 characters is a label AIKit takes');
  assert.ok(!out.spacedKind.argv.includes('--kind'),'and a kind it would refuse');
  assert.deepEqual(out.withdrawStar,{argv:['aikit','gateway','disclose','--world','world:me','--part','place:the-study','--star','star:keepers','--withdraw','--json']});
  assert.deepEqual(out.withdrawField,{argv:['aikit','gateway','disclose','--world','world:me','--part','place:the-study','--field','--withdraw','--json']},
    'withdrawn from the field: exactly that clearing, never what it shows at a star');
  assert.match(out.other.refused,/Only a Show or a Withdraw/);
  assert.equal(out.declined.answers.length,1);
  assert.equal(out.declined.answers[0].declined,true,'a decline is marked for the window');
  assert.deepEqual(out.declined.answers[0].request.cites,[]);
  assert.match(out.declined.answers[0].request.words,/couldn't answer this from what the world shows here/,'and carried as the answer it is, so the asker never waits on it');
  assert.equal(out.declined.waiting,null);
  assert.equal(out.waiting.waiting,"Waiting for the world's agent.",'AIKit\'s own words for the wait');
  assert.deepEqual(out.waiting.answers,[]);
  assert.equal(out.waiting.settled,null,'waiting is no settling');
  assert.equal(out.none.waiting,null);
  assert.equal(out.none.ended,null,'an ask with nothing yet is not ended');
  assert.equal(out.none.settled,null,'nor settled');
  // An ask AIKit ended with no reply sent (ai-kit #602 be2c; DLW build ruling 2026-11-09: a day waited with no occupant to answer it)
  // reads declined: its words are carried, so the window never waits on it, and no answer is made up for an agent that said nothing.
  assert.equal(out.ended.ended,"The world's agent couldn't answer this from what the world shows here.",'an ask ended unanswered reads declined');
  assert.deepEqual(out.ended.answers,[],'no answer is made up for it');
  assert.equal(out.ended.waiting,null);
  assert.equal(out.endedAnswered.ended,null,'a reply sent is the answer, never the ended words beside it');
  assert.equal(out.endedAnswered.answers.length,1);
});

// The person's window runs the seams (601b, DLW build ruling 2026-11-09). A fake AIKit (`OI_AIKIT_PROGRAM`; never the machine's own,
// nor its ~/.aikit) keeps each argv it is given and the Position variables it ran with, and answers as AIKit's CLI prints, from a
// script the test writes: per verb, or per ref for replies; `hang` never answers and ignores SIGTERM (it ends itself after 20 s, whatever
// happens); `usage` ends as a usage error does (2, nothing on stdout).
const FAKE_AIKIT=`#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
const dir=path.dirname(fs.realpathSync(process.argv[1]));
const argv=['aikit',...process.argv.slice(2)];
fs.appendFileSync(path.join(dir,'runs.jsonl'),JSON.stringify({argv,pid:process.pid,at:Date.now(),position:process.env.OI_POSITION_REF??null,generation:process.env.OI_OCCUPANT_GENERATION??null})+'\\n');
const answers=JSON.parse(fs.readFileSync(path.join(dir,'answers.json'),'utf8'));
const key=argv[2]==='replies'?'replies '+argv[3]:argv[2]==='disclose'&&argv.includes('--list')?'disclose --list '+argv[argv.indexOf('--world')+1]:argv[2];
const counted=path.join(dir,'count-'+key.replace(/[^A-Za-z0-9]/g,'_'));
const n=fs.existsSync(counted)?Number(fs.readFileSync(counted,'utf8')):0;
fs.writeFileSync(counted,String(n+1));
const list=answers[key]??[];
const said=list.length?list[Math.min(n,list.length-1)]:{schema:1,ok:false,error:{code:'fake.unscripted',message:'nothing is scripted for '+key,details:{}}};
if(said==='hang'){process.on('SIGTERM',()=>{});setTimeout(()=>process.exit(3),20000);}
else if(said==='usage'){process.stderr.write('error: unexpected argument found\\n');process.exitCode=2;}
else setTimeout(()=>{fs.appendFileSync(path.join(dir,'ends.jsonl'),JSON.stringify({key,pid:process.pid,at:Date.now()})+'\\n');process.stdout.write(JSON.stringify(said)+'\\n');process.exitCode=said.ok===false?1:0;},Number(answers.delays?.[argv[2]]??answers.delay??0));
`;
// The window under test, over a field held in memory with the keys field-lib worldReading gives and the acts the held client takes.
const WINDOW=`
const FAKE=process.env.FAKE_AIKIT_DIR;
const answer=(answers)=>writeFileSync(join(FAKE,'answers.json'),JSON.stringify(answers));
const lines=(name)=>existsSync(join(FAKE,name))?readFileSync(join(FAKE,name),'utf8').trim().split('\\n').filter(Boolean).map((line)=>JSON.parse(line)):[];
const runs=(verb)=>lines('runs.jsonl').filter((run)=>!verb||run.argv[2]===verb);
const until=async(ready,what,ms=15000)=>{const end=Date.now()+ms;while(!ready()){if(Date.now()>end)throw new Error('never: '+what+'; the window said: '+JSON.stringify(said.slice(-6)));await new Promise((r)=>setTimeout(r,10));}};
const pause=(ms)=>new Promise((r)=>setTimeout(r,ms));
const field={worlds:[],clearings:[],gatherings:[],asks:[],carried:[],settled:[],refuse:{},refuseAct:{},throwOn:{},taken:[],reads:0};
const ACTS=['clearing-open','clearing-withdraw','star-leave','star-close'];
// slow: before the field takes it; lag: after the field took it, before its answer comes back
const hold={async request(r){
  if(field.slow?.[r.kind])await pause(field.slow[r.kind]);
  if(field.throwOn[r.kind])throw new Error(field.throwOn[r.kind]);
  const out=taken(r);
  if(field.lag?.[r.kind])await pause(field.lag[r.kind]);
  return out;
}};
function taken(r){
  if(r.kind==='worlds')field.reads++;
  if(field.refuseAct[r.kind])return {ok:false,error:{kind:'refused',message:field.refuseAct[r.kind]}};
  if(ACTS.includes(r.kind))field.taken.push({kind:r.kind,ref:r.part_ref??r.star_ref,at:Date.now()});
  if(r.kind==='worlds')return {ok:true,data:JSON.parse(JSON.stringify({worlds:field.worlds,clearings:field.clearings,gatherings:field.gatherings,stars:[],agent_ask:{state:'held'},agent_asks:field.asks}))};
  if(r.kind==='clearing-open'){field.clearings.push({world_ref:r.world_ref,part_ref:r.part_ref,star_ref:r.star_ref||null,audience:r.audience,shown:r.shown});return {ok:true,data:{schema:'oi.shared-field.clearing-result/v1',state:'open'}};}
  if(r.kind==='clearing-withdraw'){field.clearings=field.clearings.filter((c)=>!(c.world_ref===r.world_ref&&c.part_ref===r.part_ref&&(c.star_ref??'')===(r.star_ref??'')));return {ok:true,data:{schema:'oi.shared-field.clearing-result/v1',state:'withdrawn'}};}
  if(r.kind==='star-leave'){field.gatherings=field.gatherings.filter((g)=>!(g.star_ref===r.star_ref&&g.world_ref===r.world_ref));field.clearings=field.clearings.filter((c)=>!(c.star_ref===r.star_ref&&c.world_ref===r.world_ref));return {ok:true,data:{state:'left'}};}
  if(r.kind==='star-close'){field.gatherings=field.gatherings.filter((g)=>g.star_ref!==r.star_ref);field.clearings=field.clearings.filter((c)=>c.star_ref!==r.star_ref);field.asks=field.asks.filter((a)=>a.star_ref!==r.star_ref);return {ok:true,data:{state:'closed'}};}
  if(r.kind==='world-agent-settle'){const a=field.asks.find((x)=>x.ask_ref===r.ask_ref);if(!a||a.answer||a.settled)return {ok:false,error:{kind:'refused',message:'That ask is answered, settled or taken back'}};field.settled.push(r);a.settled={words:r.words};return {ok:true,data:{state:'settled'}};}
  if(r.kind==='world-agent-answer'){field.carried.push(r);if(field.refuse[r.ask_ref])return {ok:false,error:{kind:'refused',message:field.refuse[r.ask_ref]}};const a=field.asks.find((x)=>x.ask_ref===r.ask_ref);if(a)a.answer={agent:r.agent,words:r.words,cites:r.cites};return {ok:true,data:{state:'answered'}};}
  return {ok:false,error:{kind:'malformed',message:'not this field\\'s'}};
}
const said=[], events=[];
const record=join(FAKE,'agent-relay.json');
const open=(more)=>agentWindow({request:(r)=>hold.request(r),record:()=>record,say:(w)=>said.push(w),event:(line)=>events.push(line),pace:{first:20,most:80,retry:60000},timeoutMs:5000,reconcile:false,...more});
// what AIKit lists it holds of what a world shows: the record disclose answers with (disclosed, above), read whole
const listing=(world_ref,parts)=>ok({schema:'aikit.world-star-disclosure/v1',act:'listed',changed:false,disclosure:{schema:'aikit.world-star-disclosure/v1',world_ref,parts}});
const lists=()=>runs('disclose').filter((r)=>r.argv.includes('--list')).map((r)=>r.argv[r.argv.indexOf('--world')+1]);
const tells=()=>runs('disclose').filter((r)=>!r.argv.includes('--list')).map((r)=>r.argv.slice(3,-1).join(' '));
const live={event:'status',state:'live'};
const moved=(table)=>({event:'transaction',cursor:'tx:1:1',changes:[{table,op:'update',ref:'x'}],more:0});
`;
function inWindow(body){
  const here=fileURLToPath(new URL('.',import.meta.url));
  const dir=mkdtempSync(join(tmpdir(),'oi-agent-window-'));
  writeFileSync(join(dir,'aikit.cjs'),FAKE_AIKIT,{mode:0o755});
  writeFileSync(join(dir,'answers.json'),'{}');
  // the window runs as an agent's shell may have started it: standing at a Position, which AIKit's person's gate refuses
  const env={...process.env,OI_AIKIT_PROGRAM:join(dir,'aikit.cjs'),FAKE_AIKIT_DIR:dir,OI_POSITION_REF:'central:position:project:Keeper:scribe',OI_OCCUPANT_GENERATION:'actuation:generation:scribe-1'};
  const script=`import {agentWindow} from './field-lib.ts';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';${AIKIT_SHAPES}${WINDOW}
(async()=>{${body}})().then(()=>process.exit(0),(error)=>{console.error(error);process.exit(1);});`;
  try{
    const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,env,encoding:'utf8',timeout:120000});
    assert.ifError(result.error);
    assert.equal(result.status,0,result.stderr);
    return JSON.parse(result.stdout.trim().split('\n').at(-1));
  }finally{rmSync(dir,{recursive:true,force:true});}
}

// 601b ruling 1 and 3: the window tells AIKit each Show and each Withdraw the field takes, one at a time and in the order the field took
// them, as an argv with no shell, its Position variables removed; star-leave and star-close take back the parts of the person's own
// worlds the field takes back there, and nothing of anyone else's.
test('the window tells AIKit each Show and Withdraw it takes, in order and with no shell, and takes back what star-leave and star-close take back of its own worlds',()=>{
  const out=inWindow(`
const w=open();
answer({disclose:[ok(disclosed('world:me','shown'))]});
field.worlds=[{world_ref:'world:me',mine:true},{world_ref:'world:you',mine:false}];
field.gatherings=[{star_ref:'star:s',world_ref:'world:me',state:'gathered'},{star_ref:'star:s',world_ref:'world:you',state:'gathered'},{star_ref:'star:t',world_ref:'world:me',state:'gathered'}];
const odd='part:\`id\`;$(id)|x&y';
const act=(request)=>w.act(request,()=>hold.request(request));
const shown=await act({kind:'clearing-open',world_ref:'world:me',part_ref:odd,audience:'star',star_ref:'star:s',shown:{kind:'page',label:'The odd one'}});
const essay=await act({kind:'clearing-open',world_ref:'world:me',part_ref:'part:essay',audience:'field',shown:{kind:'page',label:'The essay'}});
const back=await act({kind:'clearing-withdraw',world_ref:'world:me',part_ref:'part:essay'});
await act({kind:'clearing-open',world_ref:'world:me',part_ref:'part:two',audience:'star',star_ref:'star:s',shown:{kind:'page',label:'Two'}});
field.clearings.push({world_ref:'world:you',part_ref:'part:yours',star_ref:'star:s',audience:'star',shown:{kind:'page',label:'Yours'}});
const left=await act({kind:'star-leave',star_ref:'star:s',world_ref:'world:me'});
await act({kind:'clearing-open',world_ref:'world:me',part_ref:'part:three',audience:'star',star_ref:'star:t',shown:{kind:'page',label:'Three'}});
const turned=await act({kind:'star-leave',star_ref:'star:s',world_ref:'world:you'});
const closed=await act({kind:'star-close',star_ref:'star:t'});
const spoken=await act({kind:'star-say',star_ref:'star:t'});
field.slow={'clearing-open':80};
await Promise.all([act({kind:'clearing-open',world_ref:'world:me',part_ref:'part:late',audience:'field',shown:{kind:'page'}}),act({kind:'clearing-withdraw',world_ref:'world:me',part_ref:'part:late'})]);
await w.close();
console.log(JSON.stringify({shown:shown.data.aikit,essay:essay.data.aikit,back:back.data.aikit,left:left.data.aikit,turned:turned.data.aikit,closed:closed.data.aikit,
  other:spoken,runs:runs('disclose').map((r)=>r.argv),env:runs().map((r)=>[r.position,r.generation])}));`);
  const odd='part:`id`;$(id)|x&y';
  const disclose=(...rest)=>['aikit','gateway','disclose','--world','world:me',...rest,'--json'];
  assert.deepEqual(out.runs,[
    disclose('--part',odd,'--star','star:s','--kind','page','--label=The odd one'),
    disclose('--part','part:essay','--field','--kind','page','--label=The essay'),
    disclose('--part','part:essay','--field','--withdraw'),
    disclose('--part','part:two','--star','star:s','--kind','page','--label=Two'),
    disclose('--part',odd,'--star','star:s','--withdraw'),
    disclose('--part','part:two','--star','star:s','--withdraw'),
    disclose('--part','part:three','--star','star:t','--kind','page','--label=Three'),
    disclose('--part','part:three','--star','star:t','--withdraw'),
    disclose('--part','part:late','--field','--kind','page'),
    disclose('--part','part:late','--field','--withdraw'),
  ],'each act told once, in order; what leaving and closing take back of the person\'s own worlds, and nothing of another\'s; a ref as it is, no shell between');
  assert.deepEqual(out.shown,{told:true,parts:1,words:null});
  assert.deepEqual(out.back,{told:true,parts:1,words:null});
  // a leave or a close answers once the field has acted, and AIKit is told after it (#942 follow-up 1)
  const after='The field has acted; AIKit is told what it took back of your worlds after it, in order';
  assert.deepEqual(out.left,{told:null,parts:2,words:after});
  assert.deepEqual(out.turned,{told:true,parts:0,words:null},'turning another world away takes back nothing of this person\'s');
  assert.deepEqual(out.closed,{told:null,parts:1,words:after});
  assert.equal(out.other.data?.aikit,undefined,'any other act tells AIKit nothing');
  out.env.forEach((pair)=>assert.deepEqual(pair,[null,null],'the window stands at no Position'));
});

// 601b ruling 1, bound 2: a run AIKit refuses, one it cannot start and one that hangs are each said in words, and the field's own act is
// not undone; a run that hangs is stopped at its limit, and the window goes on to the next.
test('a failed or hung AIKit run is said in words, the act is not undone, a hung run is stopped, and the queue goes on',()=>{
  const out=inWindow(`
const w=open({timeoutMs:1500});
field.worlds=[{world_ref:'world:me',mine:true}];
answer({disclose:[no('gateway.disclose_invalid','world:me names no World whole.'),'hang',ok(disclosed('world:me','shown')),'hang']});
const act=(request)=>w.act(request,()=>hold.request(request));
const show=(part)=>act({kind:'clearing-open',world_ref:'world:me',part_ref:part,audience:'field',shown:{kind:'page'}});
const refused=await show('part:one');
const started=Date.now();
const hung=await show('part:two');
const took=Date.now()-started;
const after=await show('part:three');
const pid=runs('disclose')[1].pid;
let alive=true; try{process.kill(pid,0);}catch{alive=false;}
const dashed=await show('-part:dash');
process.env.OI_AIKIT_PROGRAM=join(FAKE,'no-such-aikit');
const missing=await show('part:four');
await w.close();
// the window closes while a run hangs: the run is stopped then, not at its limit
process.env.OI_AIKIT_PROGRAM=join(FAKE,'aikit.cjs');
const w2=open({timeoutMs:10000});
const pending=w2.act({kind:'clearing-open',world_ref:'world:me',part_ref:'part:five',audience:'field',shown:{kind:'page'}},()=>hold.request({kind:'clearing-open',world_ref:'world:me',part_ref:'part:five',audience:'field',shown:{kind:'page'}}));
await until(()=>runs('disclose').length===4,'the fifth Show told');
const closing=Date.now();
await w2.close();
const closeTook=Date.now()-closing;
const closedOn=(await pending).data.aikit;
const gone=(pid)=>{try{process.kill(pid,0);return false;}catch{return true;}};
await until(()=>gone(runs('disclose')[3].pid),'the run under way stopped',3000);
const hungAlive=!gone(runs('disclose')[3].pid);
console.log(JSON.stringify({refused:refused.data.aikit,hung:hung.data.aikit,took,after:after.data.aikit,alive,dashed:dashed.data.aikit,missing:missing.data.aikit,
  shown:field.clearings.map((c)=>c.part_ref),ran:runs('disclose').length,said,closeTook,closedOn,hungAlive}));`);
  assert.equal(out.refused.told,false);
  assert.match(out.refused.words,/^AIKit refused: world:me names no World whole\./,'AIKit\'s own words');
  assert.equal(out.hung.told,false);
  assert.match(out.hung.words,/did not answer within 1\.5 s, and was stopped/);
  assert.ok(out.took>=1400&&out.took<8000,`stopped at its limit (${out.took} ms)`);
  assert.equal(out.alive,false,'the run that hung is gone');
  assert.deepEqual(out.after,{told:true,parts:1,words:null},'and the next run goes on');
  assert.match(out.dashed.words,/A part is told to AIKit by its own ref/,'a ref AIKit would refuse is never run');
  assert.match(out.missing.words,/could not be started/);
  assert.equal(out.ran,4,'nothing ran for the dashed ref or the missing program');
  assert.deepEqual(out.shown,['part:one','part:two','part:three','-part:dash','part:four','part:five'],'the field\'s own act is not undone');
  assert.ok(out.closeTook<3000,`closing the window stops the run under way at once (${out.closeTook} ms), not at its limit`);
  assert.match(out.closedOn.words,/The window closed while AIKit was asked/);
  assert.equal(out.hungAlive,false,'and that run is gone');
  assert.ok(out.said.some((words)=>/did not answer within/.test(words)),'and the window says so');
});

// 601b ruling 1 scope, bound 1: each waiting ask of one of the person's worlds is relayed through AIKit's gateway once, across restarts:
// the window keeps what it relayed before it sends, and AIKit takes each send as a new Communique unless it is the same ask still waiting
// (ai-kit gateway_communique.rs, asks_waiting_are_bounded_answered_once_and_never_inbox_mail), so the window's own record is what holds it
// to once. A restarted window reads on by the ref it kept; an ask whose send may have reached AIKit is never sent again, and is said.
test('a waiting ask is relayed once, and a restarted window reads on by the ref it kept and never relays it again',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:KEEPER,mine:true},{world_ref:'world:asker',mine:false}];
field.gatherings=[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
field.clearings=[{world_ref:KEEPER,part_ref:'page:at-the-star',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'At the star'}}];
const ask=(ref,at)=>({ask_ref:ref,star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'name',address:'Thoth',words:'Which plate?',asked_at_micros:at,answer:null});
field.asks=[ask('ask:one','1'),ask('ask:elsewhere','5')];
field.asks[1].to_world_ref='world:asker';
const AGAIN='aikit:communique:02again';
const LATER='aikit:communique:04later';
answer({send:[ok(sent(SENT)),ok(sent(AGAIN)),refusal('gateway.unknown_position','No Position with handle @Thoth is defined in project:Keeper.',NOTHING_SENT,'List the Positions and their handles with aikit gateway who --json.'),
    ok(sent(LATER)),'hang',refusal('gateway.communique_instance_binding_lost','The gateway on this Workcell answered for aikit:communique:07kept with no instance (a durable Position route), but it was handed actuation:generation:g7: the exact-instance binding was lost.',
      'Its record there must not be taken as an exact-instance route, and no route is reported over it.','Upgrade that gateway.'),ok(sent('aikit:communique:06twice'))],
  ['replies '+SENT]:[ok(replies([]))],['replies '+AGAIN]:[ok(replies([],{communique_ref:AGAIN,reply_line:'aikit:sender-of:'+AGAIN}))],
  ['replies '+LATER]:[ok(replies([],{communique_ref:LATER,reply_line:'aikit:sender-of:'+LATER}))],delays:{send:300}});
const first=open();
first.saw(live);
await until(()=>runs('send').length>=1,'the first send begun');
const during=JSON.parse(readFileSync(record,'utf8')).asks['ask:one@1']?.state;
await until(()=>runs('replies').length>=2,'the first window reads its answers');
await first.close();
const sends=runs('send').length;
const second=open();
second.saw(live);
const reads=runs('replies').length;
await until(()=>runs('replies').length>=reads+2,'the restarted window reads on');
await second.close();
const sendsAfterRestart=runs('send').length;
const kept=JSON.parse(readFileSync(record,'utf8'));
kept.asks['ask:two@2']={ask_ref:'ask:two',state:'relaying',at:Date.now()};
writeFileSync(record,JSON.stringify(kept));
field.asks=[ask('ask:one','3'),ask('ask:two','2')];
const third=open();
third.saw(live);
await until(()=>runs('send').length>=2&&said.some((words)=>/ask:two/.test(words)),'the new ask relayed, the unfinished one said');
await pause(200);
await third.close();
const sendsThird=runs('send').length;
// AIKit refused the send: nothing was sent, so it is offered again, later
field.asks=[ask('ask:later','4')];
const fourth=open({timeoutMs:1500,pace:{first:20,most:80,retry:50}});
fourth.saw(live);
await until(()=>JSON.parse(readFileSync(record,'utf8')).asks['ask:later@4']?.state==='sent','the refused ask offered again and sent');
// a send that hangs may have reached AIKit: it is stopped, kept as unsure, and never sent again
field.asks=[ask('ask:hung','5')];
fourth.saw(moved('star_agent_ask'));
await until(()=>JSON.parse(readFileSync(record,'utf8')).asks['ask:hung@5']?.state==='unsure','the hung send kept as unsure');
// AIKit refused after it kept the Communique: what it may have sent is never sent again
field.asks=[ask('ask:kept','8')];
fourth.saw(moved('star_agent_ask'));
await until(()=>JSON.parse(readFileSync(record,'utf8')).asks['ask:kept@8']?.state==='unsure','the send refused after AIKit kept it, kept as unsure');
await pause(300);
fourth.saw(moved('star_agent_ask'));
await pause(300);
await fourth.close();
const sendsFourth=runs('send').length;
// AIKit could not be started: nothing was sent, so the ask is offered again, and sent once AIKit can be started
process.env.OI_AIKIT_PROGRAM=join(FAKE,'no-such-aikit');
field.asks=[ask('ask:missing','7')];
const missingWindow=open({pace:{first:20,most:80,retry:50}});
missingWindow.saw(live);
await until(()=>said.some((words)=>/ask:missing was not relayed to its agent, and is offered again later: AIKit could not be started/.test(words)),'the missing program said');
const missingKept=JSON.parse(readFileSync(record,'utf8')).asks['ask:missing@7']??null;
process.env.OI_AIKIT_PROGRAM=join(FAKE,'aikit.cjs');
await until(()=>JSON.parse(readFileSync(record,'utf8')).asks['ask:missing@7']?.state==='sent','offered again once AIKit can be started');
await missingWindow.close();
const sendsMissing=runs('send').length;
// a record that cannot be read relays nothing
const kept4=JSON.parse(readFileSync(record,'utf8'));
writeFileSync(record,'{not a record');
field.asks=[ask('ask:six','6')];
const fifth=open();
fifth.saw(live);
await pause(300);
await fifth.close();
const send=runs('send')[0].argv;
console.log(JSON.stringify({sends,during,sendsAfterRestart,sendsThird,sendsFourth,missingKept,sendsMissing,sendsAtEnd:runs('send').length,to:send.slice(0,send.indexOf('--body')),body:JSON.parse(send[send.indexOf('--body')+1]),
  again:runs('send')[1].argv.slice(0,4),record:kept4,said}));`);
  assert.equal(out.sends,1,'relayed once; an ask of a world not the person\'s is not theirs to relay');
  assert.equal(out.during,'relaying','kept before it is sent');
  assert.deepEqual(out.to,['aikit','gateway','send','--to','@Thoth','--project-world','project:Keeper']);
  assert.equal(out.body.ask_ref,'ask:one');
  assert.deepEqual(out.body.sources.map((source)=>source.part_ref),['page:at-the-star']);
  assert.equal(out.sendsAfterRestart,1,'a restarted window never relays it again');
  assert.equal(out.sendsThird,2,'an ask taken back and asked again under its name is a new ask, relayed once');
  assert.equal(out.sendsFourth,6,'a send AIKit refused, keeping nothing, is offered again; one that hung, or that AIKit refused after keeping it, is never sent again');
  assert.deepEqual([out.record.asks['ask:later@4'].state,out.record.asks['ask:later@4'].communique_ref],['sent','aikit:communique:04later']);
  assert.equal(out.record.asks['ask:hung@5'].state,'unsure');
  assert.equal(out.record.asks['ask:kept@8'].state,'unsure');
  assert.ok(out.said.some((words)=>/ask:kept may have reached AIKit, but its answers cannot be read, so it is not relayed again: AIKit refused: The gateway on this Workcell/.test(words)));
  assert.ok(out.said.some((words)=>/ask:later was not relayed to its agent, and is offered again later: AIKit refused: No Position with handle @Thoth is defined in project:Keeper\. Nothing was sent/.test(words)));
  assert.ok(out.said.some((words)=>/ask:hung may have reached AIKit/.test(words)));
  assert.equal(out.missingKept,null,'a send AIKit could not start keeps nothing, so it is offered again');
  assert.equal(out.sendsMissing,7,'and sent once AIKit can be started');
  assert.equal(out.record.asks['ask:missing@7'].state,'sent');
  assert.equal(out.sendsAtEnd,7,'a record that cannot be read relays nothing');
  assert.ok(out.said.some((words)=>/cannot be read/.test(words)),'and says so');
  assert.equal(out.record.schema,'oi.shared-field.agent-relay/v1');
  assert.deepEqual([out.record.asks['ask:one@1'].state,out.record.asks['ask:one@1'].communique_ref],['sent','aikit:communique:01sent']);
  assert.deepEqual([out.record.asks['ask:one@3'].state,out.record.asks['ask:one@3'].communique_ref],['sent','aikit:communique:02again']);
  assert.equal(out.record.asks['ask:two@2'].state,'relaying','an ask whose send may have reached AIKit is never sent again');
  assert.ok(out.said.some((words)=>/ask:two may have reached AIKit/.test(words)),'and that is said');
});

// 601b bound 3: replies are read one at a time, backing off while nothing comes, and the reads stop when the ask is taken back, its
// world leaves the star, or the window closes.
test('an ask\'s replies are read one at a time at a slowing pace, and the reads stop when it is taken back, its world leaves, or the window closes',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:KEEPER,mine:true},{world_ref:'world:asker',mine:false}];
const gather=()=>[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
field.gatherings=gather();
const ask=(ref,at)=>({ask_ref:ref,star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?',asked_at_micros:at,answer:null});
const script=(ref)=>({send:[ok(sent(ref))],['replies '+ref]:[ok(replies([],{communique_ref:ref,reply_line:'aikit:sender-of:'+ref}))],delay:15});
const count=(ref)=>runs('replies').filter((r)=>r.argv[3]===ref).length;
answer(script(SENT));
field.asks=[ask('ask:one','1')];
const w=open();
w.saw(live);
await until(()=>count(SENT)>=9,'nine reads');
field.asks=[];
w.saw(moved('star_agent_ask'));
await pause(80);
const starts=runs('replies').map((r)=>r.at), ends=lines('ends.jsonl').filter((e)=>e.key.startsWith('replies')).map((e)=>e.at);
const atTakeBack=count(SENT); await pause(400); const afterTakeBack=count(SENT);
const TWO='aikit:communique:02two', THREE='aikit:communique:03three';
answer(script(TWO));
field.asks=[ask('ask:two','2')];
w.saw(moved('star_agent_ask'));
await until(()=>count(TWO)>=2,'the second ask read');
field.gatherings=field.gatherings.filter((g)=>g.world_ref!==KEEPER);
w.saw(moved('world_gathering'));
await pause(80);
const atLeave=count(TWO); await pause(400); const afterLeave=count(TWO);
answer(script(THREE));
field.gatherings=gather();
field.asks=[ask('ask:three','3')];
w.saw(moved('world_gathering'));
await until(()=>count(THREE)>=1,'the third ask read');
await w.close();
const atClose=count(THREE); await pause(400); const afterClose=count(THREE);
// what the person did is told before the reads already queued: a Show's disclose goes ahead of them
const busy=['aikit:communique:11a','aikit:communique:12b','aikit:communique:13c','aikit:communique:14d'];
answer({send:[0,0,0,...busy.map((ref)=>ok(sent(ref)))],...Object.fromEntries(busy.map((ref)=>['replies '+ref,[ok(replies([],{communique_ref:ref,reply_line:'aikit:sender-of:'+ref}))]])),
  disclose:[ok(disclosed(KEEPER,'shown'))],delay:120});
field.asks=busy.map((ref,i)=>ask('ask:busy-'+i,String(10+i)));
const w2=open({pace:{first:10,most:10,retry:60000}});
w2.saw(live);
await until(()=>busy.every((ref)=>count(ref)>=2),'four asks read');
const show={kind:'clearing-open',world_ref:KEEPER,part_ref:'page:now',audience:'field',shown:{kind:'page'}};
const actAt=Date.now();
const shown=await w2.act(show,()=>hold.request(show));
const toldAt=runs('disclose').at(-1).at;
const ahead=runs('replies').filter((r)=>r.at>=actAt&&r.at<toldAt).length;
await w2.close();
console.log(JSON.stringify({starts,ends,atTakeBack,afterTakeBack,atLeave,afterLeave,atClose,afterClose,shown:shown.data.aikit,ahead}));`);
  assert.ok(out.starts.length>=9&&out.ends.length>=out.starts.length-1);
  for (let i=0;i+1<out.starts.length&&i<out.ends.length;i++){
    assert.ok(out.starts[i+1]>=out.ends[i],`read ${i+2} began after read ${i+1} ended: one at a time`);
    const rest=out.starts[i+1]-out.ends[i];
    assert.ok(rest>=(i===0?35:75),`backing off while nothing comes: ${rest} ms before read ${i+2}`);
    assert.ok(rest<1500,`and never slower than its most (80 ms here): ${rest} ms before read ${i+2}`);
  }
  assert.equal(out.afterTakeBack,out.atTakeBack,'taken back: no more reads');
  assert.equal(out.afterLeave,out.atLeave,'its world left the star: no more reads');
  assert.equal(out.afterClose,out.atClose,'the window closed: no more reads');
  assert.deepEqual(out.shown,{told:true,parts:1,words:null});
  assert.ok(out.ahead<=1,`a Show is told ahead of the reads already queued (${out.ahead} began between)`);
});

// 601b ruling 1 scope and ruling 2: an answer or a decline reaches the field as world-agent-answer, as the agent that sent it; a reply
// none of which can be used, an ask AIKit ended, and an answer the field refuses (three times) each settle the ask in words and its
// reads stop; while where it was relayed cannot be read, it is read on.
test('an answer or a decline reaches the field as that agent, and an unusable reply, an ended ask or a refused answer settles in words',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:KEEPER,mine:true},{world_ref:'world:asker',mine:false}];
field.gatherings=[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
const names=['answered','declined','elsewhere','ended','refused','unread'];
const ref=(name)=>'aikit:communique:01'+name;
field.asks=names.map((name,at)=>({ask_ref:'ask:'+name,star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?',asked_at_micros:String(at+1),answer:null}));
field.refuse['ask:refused']='Your agent shows nothing your world has not shown there';
const on=(name,found,more)=>replies(found.map((c)=>({...c,reply_to:ref(name),to_position_ref:'aikit:sender-of:'+ref(name)})),{communique_ref:ref(name),reply_line:'aikit:sender-of:'+ref(name),...more});
const plate=answerBody('The second plate.',[{part_ref:'page:at-the-star',star_ref:'star:keepers'}]);
const OTHER='central:position:project:Other:librarian';
answer({send:names.map((name)=>ok(sent(ref(name)))),who:[no('gateway.unavailable','The gateway is not running.'),ok(W)],
  ['replies '+ref('answered')]:[ok(on('answered',[])),ok(on('answered',[communique({body:plate})]))],
  ['replies '+ref('declined')]:[ok(on('declined',[communique({body:answerBody(DECLINE,[],{declined:true})})]))],
  ['replies '+ref('elsewhere')]:[ok(on('elsewhere',[communique({from_position_ref:OTHER,body:answerBody('Not here.',[],{declined:true})})],{to_position_ref:OTHER}))],
  ['replies '+ref('ended')]:[ok(on('ended',[],{waiting:null,declined:{words:DECLINE,basis:'it waited 24 hours with no answer'}}))],
  ['replies '+ref('refused')]:[ok(on('refused',[communique({body:answerBody('From my diary.',[{part_ref:'page:diary',star_ref:'star:keepers'}])})]))],
  ['replies '+ref('unread')]:[ok(on('unread',[],{relayed:true,complete:false,remote_replies:{state:'unreadable',code:'gateway.remote_replies_unreadable',error:'down'}}))]});
const count=(name)=>runs('replies').filter((r)=>r.argv[3]===ref(name)).length;
const w=open();
w.saw(live);
const settledAll=()=>{try{const asks=JSON.parse(readFileSync(record,'utf8')).asks;return ['answered','declined','elsewhere','ended','refused'].every((name)=>['answered','settled','ended'].includes(asks['ask:'+name+'@'+String(names.indexOf(name)+1)]?.state));}catch{return false;}};
await until(()=>settledAll()&&count('unread')>=3,'every ask settled but the unread one');
w.saw(moved('star_agent_ask'));
await pause(80);
const at=Object.fromEntries(names.map((name)=>[name,count(name)]));
await pause(400);
const later=Object.fromEntries(names.map((name)=>[name,count(name)]));
await w.close();
console.log(JSON.stringify({carried:field.carried,record:JSON.parse(readFileSync(record,'utf8')).asks,at,later,who:runs('who').map((r)=>r.argv),said,settled:field.settled,events}));`);
  const entry=(name,at)=>out.record[`ask:${name}@${at}`];
  // each ending is settled in the field, in words of why its agent's answer cannot reach it, never as the agent (601c ruling 1)
  const settledIn=(name)=>out.settled.filter((r)=>r.ask_ref==='ask:'+name).map((r)=>r.words);
  assert.deepEqual(['answered','declined','unread'].map(settledIn),[[],[],[]],'an answered ask, a decline and one read on are not settled');
  assert.equal(settledIn('elsewhere').length,1);
  assert.match(settledIn('elsewhere')[0],/^Its agent's reply could not be read as an answer: The reply came from no Position of the world asked/);
  assert.deepEqual(settledIn('ended'),["The world's agent couldn't answer this from what the world shows here."],'AIKit\'s own words for an ask it ended');
  assert.equal(settledIn('refused').length,1);
  assert.match(settledIn('refused')[0],/^Its agent's answer was refused by the field: Your agent shows nothing your world has not shown there/);
  assert.deepEqual(out.events.map((e)=>[e.event,e.ask_ref,e.state]).sort(),[['agent-ask','ask:elsewhere','settled'],['agent-ask','ask:ended','ended'],['agent-ask','ask:refused','settled']],
    'and each goes out as an event line for the shell');
  const answered=out.carried.filter((request)=>request.ask_ref==='ask:answered');
  assert.deepEqual(answered,[{kind:'world-agent-answer',ask_ref:'ask:answered',world_ref:'project:Keeper',agent:{name:'Thoth',role:'librarian',instance:'actuation:generation:g7'},
    words:'The second plate.',cites:[{part_ref:'page:at-the-star',star_ref:'star:keepers'}]}],'the answer reaches the field once, as the agent that sent it');
  assert.deepEqual([entry('answered',1).state,entry('answered',1).declined],['answered',false]);
  const declined=out.carried.filter((request)=>request.ask_ref==='ask:declined');
  assert.equal(declined.length,1);
  assert.equal(declined[0].words,"The world's agent couldn't answer this from what the world shows here.",'a decline reaches the field as the answer it is');
  assert.deepEqual([entry('declined',2).state,entry('declined',2).declined],['answered',true]);
  assert.equal(entry('elsewhere',3).state,'settled');
  assert.match(entry('elsewhere',3).words,/^Its agent's reply could not be read as an answer: The reply came from no Position of the world asked/);
  assert.equal(out.carried.filter((request)=>request.ask_ref==='ask:elsewhere').length,0,'nothing is made up for it');
  assert.deepEqual([entry('ended',4).state,entry('ended',4).words],['ended',"The world's agent couldn't answer this from what the world shows here."]);
  assert.equal(out.carried.filter((request)=>request.ask_ref==='ask:ended').length,0,'no answer is made up for an agent that said nothing');
  assert.equal(out.carried.filter((request)=>request.ask_ref==='ask:refused').length,3,'an answer the field refuses is carried three times');
  assert.equal(entry('refused',5).state,'settled');
  assert.match(entry('refused',5).words,/refused by the field: Your agent shows nothing your world has not shown there/);
  assert.equal(entry('unread',6).state,'sent','where it was relayed could not be read: it is read on');
  for (const name of ['answered','declined','elsewhere','ended','refused']) assert.equal(out.later[name],out.at[name],`${name}: settled, its reads stop`);
  assert.ok(out.later.unread>out.at.unread,'the unread one is read on');
  out.who.forEach((argv)=>assert.deepEqual(argv,['aikit','gateway','who','--project-world','project:Keeper','--json'],'its agent\'s handle is read in the world asked'));
  assert.ok(out.said.some((words)=>/could not be read as an answer/.test(words)));
  assert.ok(out.said.some((words)=>/who answered could not be read now: AIKit refused: The gateway is not running/.test(words)),'a who not had now refuses no answer: the replies are read again');
});

// O-I #942's follow-ups (601c, DLW build ruling 2026-11-09; review-oi-942b findings 1-8 and the mutations that survived).

// Follow-up 1: AIKit never gates the field. Only the field's own acts go one at a time; what AIKit is told of them goes in a queue of its
// own, in the order the field took them. A leave or a close answers once the field has acted, and AIKit is told afterwards; a Show waits
// for its own telling only so long, inside the host's limit for a client call. A close takes back only the person's own parts (M5).
test('AIKit never gates the field: acts reach it while AIKit hangs, AIKit is told in the order the field took them, and a close answers once the field has acted (#942 follow-up 1)',()=>{
  const out=inWindow(`
const w=open({timeoutMs:3000,toldWithinMs:4500});
field.worlds=[{world_ref:'world:me',mine:true},{world_ref:'world:you',mine:false}];
field.gatherings=[{star_ref:'star:c',world_ref:'world:me',state:'gathered'},{star_ref:'star:c',world_ref:'world:you',state:'gathered'}];
const parts=Array.from({length:12},(_,i)=>'part:c'+i);
for(const part of parts)field.clearings.push({world_ref:'world:me',part_ref:part,star_ref:'star:c',audience:'star',shown:{kind:'page'}});
field.clearings.push({world_ref:'world:you',part_ref:'part:yours',star_ref:'star:c',audience:'star',shown:{kind:'page'}});
answer({disclose:['hang','hang',ok(disclosed('world:me','withdrawn'))]});
const act=(request)=>w.act(request,()=>hold.request(request));
const show=(part)=>act({kind:'clearing-open',world_ref:'world:me',part_ref:part,audience:'field',shown:{kind:'page'}});
const began=Date.now();
const one=show('part:one'), two=show('part:two');
await until(()=>field.taken.length===2,'both Shows taken');
const bothTaken=Date.now()-began;
const closing=Date.now();
const closed=await act({kind:'star-close',star_ref:'star:c'});
const closeTook=Date.now()-closing;
const [first,second]=await Promise.all([one.then((e)=>({...e,at:Date.now()-began})),two.then((e)=>({...e,at:Date.now()-began}))]);
await until(()=>runs('disclose').length===14,'every part taken back told',20000);
await w.close();
console.log(JSON.stringify({bothTaken,closeTook,closed:closed.data.aikit,first:first.data.aikit,second:second.data.aikit,secondAt:second.at,
  runs:runs('disclose').map((r)=>[r.argv[6],r.argv.includes('--withdraw')])}));`);
  assert.ok(out.bothTaken<1000,`two Shows fired together both reach the field while AIKit hangs (${out.bothTaken} ms)`);
  assert.ok(out.closeTook<1000,`a close with twelve parts answers once the field has acted (${out.closeTook} ms), not after AIKit is told`);
  assert.deepEqual(out.closed,{told:null,parts:12,words:'The field has acted; AIKit is told what it took back of your worlds after it, in order'});
  assert.equal(out.first.told,false);
  assert.match(out.first.words,/did not answer within 3 s, and was stopped/,'a Show still says what came of its own telling when it comes in time');
  assert.equal(out.second.told,null,'a Show whose telling waits behind another answers inside its limit');
  assert.match(out.second.words,/^The field took it; AIKit is still being told/);
  assert.ok(out.secondAt<5800,`and does so before its telling ends (${out.secondAt} ms)`);
  assert.deepEqual(out.runs,[['part:one',false],['part:two',false],...Array.from({length:12},(_,i)=>['part:c'+i,true])],
    'AIKit is told in the order the field took the acts, and a close takes back only the person\'s own parts there');
});

// Follow-up 2: AIKit's refusal words are read honestly. A refusal AIKit makes before it records anything (asks_waiting_full, by its code;
// a consequence that begins "Nothing was sent;") sends the ask back to waiting, offered again on the back-off. A usage error (exit 2, no
// answer) is unsure but says nothing was sent; the window's own close stopping a send is not unsure, so a window opened again sends it.
// Every ending reaches the shell as an event line (follow-up 5).
test('a refusal AIKit makes before it records anything sends the ask back to waiting, a usage error says nothing was sent, and the window\'s own close leaves no ask unsure (#942 follow-ups 2 and 5)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:KEEPER,mine:true},{world_ref:'world:asker',mine:false}];
field.gatherings=[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
field.clearings=[{world_ref:KEEPER,part_ref:'page:at-the-star',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'At the star'}}];
const ask=(ref,at)=>({ask_ref:ref,star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?',asked_at_micros:at,answer:null});
const state=(key)=>{try{return JSON.parse(readFileSync(record,'utf8')).asks[key]?.state??null;}catch{return null;}};
// ai-kit gateway_communique.rs ASKS_WAITING_FULL_WORDS (l.69-70), refused by AikitError::new (l.998-1003): its details are empty
const FULL="This world's agent has too many questions waiting; ask again later.";
const AGAIN='aikit:communique:05again';
answer({send:[no('agency_gateway.asks_waiting_full',FULL),
    refusal('gateway.sender_not_current','The Position you send from is no longer current.','Nothing was sent; no Communique was recorded. Name the current one.','Read it with aikit gateway who --json.'),
    ok(sent(SENT)),'usage','hang',ok(sent(AGAIN))],
  ['replies '+SENT]:[ok(replies([]))],['replies '+AGAIN]:[ok(replies([],{communique_ref:AGAIN,reply_line:'aikit:sender-of:'+AGAIN}))]});
field.asks=[ask('ask:full','1')];
const w=open({pace:{first:20,most:80,retry:50}});
w.saw(live);
await until(()=>state('ask:full@1')==='sent','the ask AIKit had no room for offered again, and sent');
await w.close();
field.asks=[ask('ask:usage','2')];
const w2=open({pace:{first:20,most:80,retry:50}});
w2.saw(live);
await until(()=>state('ask:usage@2')==='unsure','the usage error kept as unsure');
await pause(200); w2.saw(moved('star_agent_ask')); await pause(200);
await w2.close();
field.asks=[ask('ask:closing','3')];
const w3=open({timeoutMs:10000});
w3.saw(live);
await until(()=>runs('send').length===5,'the send begun');
await pause(100);
await w3.close();
const afterClose=state('ask:closing@3');
const w4=open();
w4.saw(live);
await until(()=>state('ask:closing@3')==='sent','sent by the window opened again');
await w4.close();
console.log(JSON.stringify({sends:runs('send').map((r)=>JSON.parse(r.argv[r.argv.indexOf('--body')+1]).ask_ref),afterClose,said,events,settled:field.settled,record:JSON.parse(readFileSync(record,'utf8')).asks}));`);
  assert.deepEqual(out.settled.map((r)=>r.ask_ref),['ask:usage'],'only the ask kept unsure is settled in the field');
  assert.match(out.settled[0].words,/^It was not passed to the world's agent: AIKit did not take what it was asked .*nothing was sent$/);
  assert.deepEqual(out.sends,['ask:full','ask:full','ask:full','ask:usage','ask:closing','ask:closing'],'refused before AIKit recorded anything: offered again; a usage error: never again; stopped by the window\'s own close: sent again');
  assert.ok(out.said.some((w)=>/^ask:full was not relayed to its agent, and is offered again later: AIKit refused: This world's agent has too many questions waiting; ask again later\.$/.test(w)),'AIKit\'s own words for a full wait');
  assert.ok(out.said.some((w)=>/^ask:full was not relayed to its agent, and is offered again later: AIKit refused: The Position you send from is no longer current\. Nothing was sent;/.test(w)),'a consequence that begins "Nothing was sent;" kept nothing');
  assert.equal(out.record['ask:usage@2'].state,'unsure');
  assert.match(out.record['ask:usage@2'].words,/nothing was sent/);
  assert.ok(out.said.some((w)=>/^ask:usage was not relayed, and is not offered again: AIKit did not take what it was asked .*nothing was sent/.test(w)),'a usage error says nothing was sent');
  assert.ok(!out.said.some((w)=>/ask:usage may have reached AIKit/.test(w)),'and never that it may have reached AIKit');
  assert.equal(out.afterClose,null,'a send the window\'s own close stopped is kept as nothing, never as unsure');
  assert.ok(out.said.some((w)=>/^ask:closing was being relayed when the window closed; it is offered again when the window opens again/.test(w)));
  assert.equal(out.record['ask:closing@3'].state,'sent');
  const usage=out.events.find((e)=>e.ask_ref==='ask:usage');
  assert.deepEqual(usage&&[usage.event,usage.state],['agent-ask','unsure'],'its ending reaches the shell as an event line');
  assert.match(usage.words,/nothing was sent/);
});

// 601c ruling 3 (DLW build ruling 2026-11-09): AIKit says in data whether a refusal kept anything, `details.recorded`, in the string
// every AIKit detail is rendered as (its details are a map of strings). "false": it kept nothing, whatever its words say, and the ask is
// offered again on the back-off. "true": it may have kept the ask, whatever its words say, and it is never sent again. A value that is
// neither (a JSON false among them, which AIKit never renders) is unknown, and counts as kept. An AIKit that does not say yet is read by its
// codes and words (#942 follow-up 2, the test before).
test('a refusal that says in data it recorded nothing is offered again, and one that says it recorded something, or cannot say, is never sent again, whatever its words (601c ruling 3)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:KEEPER,mine:true},{world_ref:'world:asker',mine:false}];
field.gatherings=[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
field.clearings=[{world_ref:KEEPER,part_ref:'page:at-the-star',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'At the star'}}];
const ask=(ref,at)=>({ask_ref:ref,star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?',asked_at_micros:at,answer:null});
const state=(key)=>{try{return JSON.parse(readFileSync(record,'utf8')).asks[key]?.state??null;}catch{return null;}};
// a three-part refusal (refusal, above) that also says in data whether it recorded anything
const saying=(code,fact,consequence,recorded)=>{const r=refusal(code,fact,consequence,'Ask again.');r.error.details.recorded=recorded;return r;};
answer({send:[saying('gateway.communique_instance_binding_lost','The instance the ask was bound to is gone.','The Communique was kept for it.','false'),ok(sent(SENT)),
    saying('gateway.sender_not_current','The Position you send from is no longer current.',NOTHING_SENT,'true'),
    saying('gateway.sender_not_current','The Position you send from is no longer current.',NOTHING_SENT,false)],
  ['replies '+SENT]:[ok(replies([]))]});
const one=async(ref,at,until_)=>{field.asks=[ask(ref,at)];const w=open({pace:{first:20,most:80,retry:50}});w.saw(live);await until(until_,ref);await pause(200);w.saw(moved('star_agent_ask'));await pause(200);await w.close();};
await one('ask:none','1',()=>state('ask:none@1')==='sent');
await one('ask:kept','2',()=>state('ask:kept@2')==='unsure');
await one('ask:unknown','3',()=>state('ask:unknown@3')==='unsure');
console.log(JSON.stringify({sends:runs('send').map((r)=>JSON.parse(r.argv[r.argv.indexOf('--body')+1]).ask_ref),said,record:JSON.parse(readFileSync(record,'utf8')).asks}));`);
  assert.deepEqual(out.sends,['ask:none','ask:none','ask:kept','ask:unknown'],'recorded false: offered again; recorded true, or neither: never again');
  assert.ok(out.said.some((w)=>/^ask:none was not relayed to its agent, and is offered again later: AIKit refused: The instance the ask was bound to is gone\./.test(w)),'recorded false, though its words say it was kept');
  for (const name of ['kept','unknown']) {
    assert.equal(out.record[`ask:${name}@${name==='kept'?2:3}`].state,'unsure',name);
    assert.ok(out.said.some((w)=>new RegExp(`^ask:${name} may have reached AIKit, but its answers cannot be read, so it is not relayed again: AIKit refused: The Position you send from is no longer current\\. Nothing was sent;`).test(w)),`${name}: though its words say nothing was sent`);
  }
});

// Follow-up 4: at most once, whole. The record is claimed under its lock (O_EXCL), and read again there before each change, so two
// windows on one record send an ask once; an ask AIKit ended or the window settled is never let go while it is still in the field, even
// with the record past its cap (lowered here through its seam); once it has left the field it may go. M3: the record is the person's
// alone (0600), and a record that cannot be written relays nothing, says so once, and is tried again on the back-off.
test('a record two windows share sends an ask once, an ended or settled ask still in the field is never let go, and a record that cannot be written relays nothing (#942 follow-up 4)',()=>{
  const out=inWindow(`
const {chmodSync,statSync,readdirSync}=await import('node:fs');
field.worlds=[{world_ref:KEEPER,mine:true},{world_ref:'world:asker',mine:false}];
field.gatherings=[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
field.clearings=[{world_ref:KEEPER,part_ref:'page:at-the-star',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'At the star'}}];
const ask=(ref,at)=>({ask_ref:ref,star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?',asked_at_micros:at,answer:null});
const sendsOf=(ref)=>runs('send').filter((r)=>JSON.parse(r.argv[r.argv.indexOf('--body')+1]).ask_ref===ref).length;
const ENDED=['aikit:communique:21p1','aikit:communique:22p2','aikit:communique:23p3'];
const endedReplies=(ref)=>ok(replies([],{communique_ref:ref,reply_line:'aikit:sender-of:'+ref,waiting:null,declined:{words:DECLINE,basis:'it waited 24 hours with no answer'}}));
answer({send:[ok(sent(SENT)),...ENDED.map((ref)=>ok(sent(ref))),ok(sent('aikit:communique:31n1')),ok(sent('aikit:communique:32n2')),ok(sent('aikit:communique:34n3')),ok(sent('aikit:communique:33ro'))],
  ['replies '+SENT]:[ok(replies([]))],...Object.fromEntries(ENDED.map((ref)=>['replies '+ref,[endedReplies(ref)]])),
  ['replies aikit:communique:31n1']:[ok(replies([],{communique_ref:'aikit:communique:31n1',reply_line:'aikit:sender-of:aikit:communique:31n1'}))],
  ['replies aikit:communique:32n2']:[ok(replies([],{communique_ref:'aikit:communique:32n2',reply_line:'aikit:sender-of:aikit:communique:32n2'}))],
  ['replies aikit:communique:34n3']:[ok(replies([],{communique_ref:'aikit:communique:34n3',reply_line:'aikit:sender-of:aikit:communique:34n3'}))],
  ['replies aikit:communique:33ro']:[ok(replies([],{communique_ref:'aikit:communique:33ro',reply_line:'aikit:sender-of:aikit:communique:33ro'}))],delays:{send:300}});
// two windows on one record, both live, one new ask
field.asks=[ask('ask:two','1')];
const a=open(), b=open();
a.saw(live); b.saw(live);
await until(()=>runs('send').length>=1,'sent');
await pause(700);
a.saw(moved('star_agent_ask')); b.saw(moved('star_agent_ask'));
await pause(300);
const twoSends=sendsOf('ask:two');
await a.close(); await b.close();
const mode=statSync(record).mode&0o777;
// the cap lowered to 2: three asks AIKit ended, still in the field, and more asks after them
const w=open({keptMost:2});
field.asks=[ask('ask:p1','11'),ask('ask:p2','12'),ask('ask:p3','13')];
w.saw(live);
await until(()=>['ask:p1@11','ask:p2@12','ask:p3@13'].every((k)=>JSON.parse(readFileSync(record,'utf8')).asks[k]?.state==='ended'),'three asks ended');
field.asks.push(ask('ask:n1','14'),ask('ask:n2','15'));
w.saw(moved('star_agent_ask'));
await until(()=>sendsOf('ask:n2')===1,'the later asks relayed');
for(let i=0;i<4;i++){w.saw(moved('star_agent_ask'));await pause(120);}
const endedSends=['ask:p1','ask:p2','ask:p3'].map(sendsOf);
// gone from the field, they may go
field.asks=[ask('ask:n1','14'),ask('ask:n2','15'),ask('ask:n3','16')];
w.saw(moved('star_agent_ask'));
await until(()=>sendsOf('ask:n3')===1,'a later ask relayed');
await pause(150);
await w.close();
const keptAfter=Object.keys(JSON.parse(readFileSync(record,'utf8')).asks);
// a record that cannot be written: nothing is relayed, it is said once, and tried again on the back-off
const ro=join(FAKE,'ro');
const {mkdirSync}=await import('node:fs');
mkdirSync(ro,{mode:0o700});
chmodSync(ro,0o500);
const roRecord=join(ro,'agent-relay.json');
field.asks=[ask('ask:ro','21')];
const r=open({record:()=>roRecord,pace:{first:20,most:80,retry:40}});
r.saw(live);
await pause(400);
for(let i=0;i<3;i++){r.saw(moved('star_agent_ask'));await pause(60);}
const roSends=sendsOf('ask:ro');
const roSaid=said.filter((words)=>/could not be kept/.test(words)).length;
chmodSync(ro,0o700);
await until(()=>{try{return JSON.parse(readFileSync(roRecord,'utf8')).asks['ask:ro@21']?.state==='sent';}catch{return false;}},'tried again once it can be written');
// kept again, then not: a new failure, said again
chmodSync(ro,0o500);
field.asks.push(ask('ask:ro2','23'));
r.saw(moved('star_agent_ask'));
await until(()=>said.filter((words)=>/could not be kept/.test(words)).length===2,'a failure after the record was kept again said again');
chmodSync(ro,0o700);
await until(()=>{try{return JSON.parse(readFileSync(roRecord,'utf8')).asks['ask:ro2@23']?.state==='sent';}catch{return false;}},'and tried again');
await r.close();
// a write that fails once its temp file is made (here the rename) leaves nothing beside the record
const {createRequire,syncBuiltinESMExports}=await import('node:module');
const fsc=createRequire(join(process.cwd(),'field-lib.ts'))('node:fs');
const realRename=fsc.renameSync;
const fails=join(FAKE,'fails');
mkdirSync(fails,{mode:0o700});
fsc.renameSync=(from,to)=>{if(String(to)===join(fails,'agent-relay.json'))throw Object.assign(new Error('EIO: i/o error, rename'),{code:'EIO'});return realRename(from,to);};
syncBuiltinESMExports();
field.asks=[ask('ask:fails','24')];
const f=open({record:()=>join(fails,'agent-relay.json'),pace:{first:20,most:80,retry:40}});
f.saw(live);
await until(()=>said.some((words)=>words.includes(fails)&&/EIO/.test(words)),'the failed write said');
const failsSends=sendsOf('ask:fails');
await f.close();
fsc.renameSync=realRename; syncBuiltinESMExports();
const failsLeft=readdirSync(fails);
console.log(JSON.stringify({twoSends,mode,endedSends,keptAfter,roSends,roSaid,failsSends,failsLeft,leftovers:readdirSync(FAKE).filter((name)=>/agent-relay\\.json\\./.test(name)),
  roLeftovers:readdirSync(ro).filter((name)=>name!=='agent-relay.json')}));`);
  assert.equal(out.twoSends,1,'two windows on one record send a new ask once');
  assert.equal(out.mode,0o600,'the record is the person\'s alone');
  assert.deepEqual(out.endedSends,[1,1,1],'an ask AIKit ended is never let go while it is still in the field, so it is never sent again');
  assert.ok(!out.keptAfter.some((key)=>/^ask:p/.test(key)),`once gone from the field, they may go (${out.keptAfter})`);
  assert.equal(out.roSends,0,'a record that cannot be written relays nothing');
  assert.equal(out.roSaid,1,'and says so once');
  assert.deepEqual(out.leftovers,[],'no lock or half-written record is left beside it');
  assert.deepEqual(out.roLeftovers,[]);
  assert.equal(out.failsSends,0,'a record whose write fails relays nothing');
  assert.deepEqual(out.failsLeft,[],'and leaves nothing beside it, though the write had begun');
});

// Follow-ups 3 and 7: the window runs the AIKit the host names: OI_AIKIT_PROGRAM, which the kernel sets when it launches the held client,
// else OI_AIKIT_BIN, the name the installed app gives its AIKit, else aikit on the PATH; trimmed. A name set but blank, or a path that is
// not absolute, is refused in words and nothing runs: never the machine's own AIKit by accident (601b bound 4).
test('the window runs the AIKit its host names, trimmed, and refuses a blank or relative name in words, running nothing (#942 follow-ups 3 and 7)',()=>{
  const out=inWindow(`
const {mkdirSync,symlinkSync}=await import('node:fs');
const bin=join(FAKE,'bin');
mkdirSync(bin);
symlinkSync(join(FAKE,'aikit.cjs'),join(bin,'aikit'));
process.env.PATH=bin+':'+process.env.PATH;
process.chdir(FAKE);
field.worlds=[{world_ref:'world:me',mine:true}];
answer({disclose:[ok(disclosed('world:me','shown'))]});
const w=open();
const show=async(part)=>{const request={kind:'clearing-open',world_ref:'world:me',part_ref:part,audience:'field',shown:{kind:'page'}};return (await w.act(request,()=>hold.request(request))).data.aikit;};
const tried={};
delete process.env.OI_AIKIT_BIN;
for(const [name,value] of [['blank',' '],['empty',''],['relative','bin/aikit']]){process.env.OI_AIKIT_PROGRAM=value;tried[name]=await show('part:'+name);}
const refusedRan=runs('disclose').length;
process.env.OI_AIKIT_PROGRAM='  '+join(FAKE,'aikit.cjs')+'\\t';tried.padded=await show('part:padded');
delete process.env.OI_AIKIT_PROGRAM;process.env.OI_AIKIT_BIN=join(bin,'aikit');tried.bin=await show('part:bin');
process.env.OI_AIKIT_BIN=' ';tried.blankBin=await show('part:blank-bin');
delete process.env.OI_AIKIT_BIN;tried.path=await show('part:path');
await w.close();
console.log(JSON.stringify({tried,refusedRan,ran:runs('disclose').map((r)=>r.argv[6])}));`);
  assert.match(out.tried.blank.words,/^OI_AIKIT_PROGRAM is set but names no program, so AIKit was not run$/);
  assert.match(out.tried.empty.words,/^OI_AIKIT_PROGRAM is set but names no program/);
  assert.match(out.tried.relative.words,/^OI_AIKIT_PROGRAM names bin\/aikit, a path that is not absolute, so AIKit was not run$/);
  assert.equal(out.refusedRan,0,'nothing ran for a blank, empty or relative name: never an AIKit on the PATH by accident');
  assert.deepEqual([out.tried.padded.told,out.tried.bin.told,out.tried.path.told],[true,true,true],'a padded absolute path, OI_AIKIT_BIN, and aikit on the PATH when neither is set');
  assert.match(out.tried.blankBin.words,/^OI_AIKIT_BIN is set but names no program/);
  assert.deepEqual(out.ran,['part:padded','part:bin','part:path']);
});

// Follow-up 8 and the mutations that survived (M2, M11): an ask is relayed only once AIKit has been told what the field took of the
// person's acts; a reading that throws is said and read on, never an unhandled rejection; unbinding stops the reads; a Show the field
// refuses is told to no one; and every table an ask's relay turns on moves the window to read the field.
test('an ask waits for AIKit to be told what the field took, a reading that throws is read on, unbinding stops the reads, a refused Show is told to no one, and every ask table moves the window (#942 follow-up 8)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:KEEPER,mine:true},{world_ref:'world:asker',mine:false}];
field.gatherings=[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
const ask=(ref,at)=>({ask_ref:ref,star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?',asked_at_micros:at,answer:null});
const TWO='aikit:communique:02two', THREE='aikit:communique:03three';
const plate=answerBody('The second plate.',[{part_ref:'page:new',star_ref:'star:keepers'}]);
answer({disclose:[ok(disclosed(KEEPER,'shown'))],send:[ok(sent(SENT)),ok(sent(TWO)),ok(sent(THREE))],who:[ok(W)],
  ['replies '+SENT]:[ok(replies([]))],
  ['replies '+TWO]:[ok(replies([communique({body:plate,reply_to:TWO,to_position_ref:'aikit:sender-of:'+TWO})],{communique_ref:TWO,reply_line:'aikit:sender-of:'+TWO}))],
  ['replies '+THREE]:[ok(replies([],{communique_ref:THREE,reply_line:'aikit:sender-of:'+THREE}))]});
// the field takes a Show late, and its answer is later still: the ask that waits is relayed only once AIKit has been told the Show,
// with what its world shows once the field took it
field.asks=[ask('ask:after','1')];
field.slow={'clearing-open':200};
field.lag={'clearing-open':400};
let bound=record;
const w=open({record:()=>bound});
const show={kind:'clearing-open',world_ref:KEEPER,part_ref:'page:new',audience:'star',star_ref:'star:keepers',shown:{kind:'page'}};
const shown=w.act(show,()=>hold.request(show));
w.saw(live);
await until(()=>field.taken.length===1,'the Show taken');
await shown;
await until(()=>runs('send').length===1,'the ask relayed');
const order=runs().filter((r)=>['disclose','send'].includes(r.argv[2])).map((r)=>r.argv[2]);
const bodyOf=(run)=>JSON.parse(run.argv[run.argv.indexOf('--body')+1]);
const firstSources=bodyOf(runs('send')[0]).sources.map((source)=>source.part_ref);
field.lag={}; field.slow={};
// an answer whose carrying throws: said, and read on
field.throwOn['world-agent-answer']='the field fell over';
field.asks.push(ask('ask:throws','2'));
w.saw(moved('star_agent_ask'));
await until(()=>said.some((words)=>/ask:throws: .*the field fell over/.test(words)),'the throw said');
delete field.throwOn['world-agent-answer'];
await until(()=>field.carried.some((r)=>r.ask_ref==='ask:throws'),'read on, and carried once the field takes it');
// unbound, the reads stop
field.asks.push(ask('ask:unbound','3'));
w.saw(moved('star_agent_ask'));
const count=(ref)=>runs('replies').filter((r)=>r.argv[3]===ref).length;
await until(()=>count(THREE)>=2,'read');
bound=null;
w.saw(moved('star_agent_ask'));
await pause(100);
const atUnbind=count(THREE); await pause(400); const afterUnbind=count(THREE);
bound=record;
// a Show the field refuses is told to no one (M2)
field.refuseAct['clearing-open']='This world shows nothing at a star it has not gathered at';
const disclosesBefore=runs('disclose').length;
const refusedShow={kind:'clearing-open',world_ref:KEEPER,part_ref:'page:refused',audience:'field',shown:{kind:'page'}};
const refused=await w.act(refusedShow,()=>hold.request(refusedShow));
// the act answers before any tell would run: give a tell the time it would take
await pause(600);
const disclosesAfter=runs('disclose').length;
delete field.refuseAct['clearing-open'];
// a Show the field takes while a pass reads it is told before the ask that pass relays: the relay waits for the tells too
field.asks.push(ask('ask:during','5'));
field.lag={worlds:300}; field.slow={'clearing-open':600};
w.saw(moved('star_agent_ask'));
await pause(100);
const during={kind:'clearing-open',world_ref:KEEPER,part_ref:'page:during',audience:'star',star_ref:'star:keepers',shown:{kind:'page'}};
const duringShown=w.act(during,()=>hold.request(during));
const sentDuring=()=>runs().findIndex((r)=>r.argv[2]==='send'&&bodyOf(r).ask_ref==='ask:during');
await until(()=>sentDuring()>=0,'the ask asked during a pass relayed');
await duringShown;
field.lag={}; field.slow={};
const duringOrder=[runs().findIndex((r)=>r.argv[2]==='disclose'&&r.argv.includes('page:during')),sentDuring()];
// every table an ask's relay turns on moves the window to read the field, and no other does (M11)
const reads={};
for(const table of ['star_agent_ask','star_agent_ask_settle','world_gathering','my_circle_gathering','shared_field','my_world','projection']){
  await pause(80); const before=field.reads; w.saw(moved(table)); await pause(80); reads[table]=field.reads-before;
}
await w.close();
console.log(JSON.stringify({order,firstSources,atUnbind,afterUnbind,refused,disclosesBefore,disclosesAfter,duringOrder,reads}));`);
  assert.deepEqual(out.order,['disclose','send'],'AIKit is told the Show the field took before an ask is relayed');
  assert.deepEqual(out.firstSources,['page:new'],'and the ask is relayed with what its world shows once the field took the Show');
  assert.ok(out.duringOrder[0]>=0&&out.duringOrder[0]<out.duringOrder[1],`a Show taken while a pass read the field is told before that pass relays its ask: ${out.duringOrder}`);
  assert.equal(out.afterUnbind,out.atUnbind,'unbound: no more reads');
  assert.equal(out.refused.ok,false);
  assert.equal(out.disclosesAfter,out.disclosesBefore,'a Show the field refused is told to no one');
  for(const table of ['star_agent_ask','star_agent_ask_settle','world_gathering','my_circle_gathering','shared_field','my_world'])assert.ok(out.reads[table]>=1,`${table} moves the window to read the field`);
  assert.equal(out.reads.projection,0,'and a table no ask turns on does not');
});

// 601c ruling 1: an ask the window ended is settled in the field (world-agent-settle), so the world that asked reads it closed. One the
// field cannot settle now is said once and tried again later; a window started again settles what an earlier one ended and the field
// still reads waiting (an earlier window's record, kept before the field kept settling); one settled or answered is not settled again.
test('an ask the window ended is settled in the field, tried again while the field cannot, and settled by a window started again (601c ruling 1)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:KEEPER,mine:true},{world_ref:'world:asker',mine:false}];
field.gatherings=[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
const ask=(ref,at)=>({ask_ref:ref,star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?',asked_at_micros:at,answer:null});
const ENDS='aikit:communique:41ends';
answer({send:[ok(sent(ENDS))],['replies '+ENDS]:[ok(replies([],{communique_ref:ENDS,reply_line:'aikit:sender-of:'+ENDS,waiting:null,declined:{words:DECLINE,basis:'it waited 24 hours with no answer'}}))]});
field.asks=[ask('ask:ends','1')];
field.refuseAct['world-agent-settle']='The field is busy';
const w=open({pace:{first:20,most:80,retry:60}});
w.saw(live);
await until(()=>said.some((words)=>/ask:ends could not be settled in the field/.test(words)),'the refused settle said');
await pause(30); w.saw(moved('star_agent_ask')); await pause(30);
delete field.refuseAct['world-agent-settle'];
await until(()=>field.settled.length===1,'tried again, and settled');
await pause(200); w.saw(moved('star_agent_ask_settle')); await pause(200);
await w.close();
// an earlier window's record: ended and unsure asks the field still reads waiting, and one it reads settled already
const kept=JSON.parse(readFileSync(record,'utf8'));
kept.asks['ask:old@2']={ask_ref:'ask:old',state:'ended',words:DECLINE,at:Date.now()};
kept.asks['ask:lost@3']={ask_ref:'ask:lost',state:'unsure',words:'AIKit did not answer within 30 s, and was stopped',at:Date.now()};
kept.asks['ask:gone@4']={ask_ref:'ask:gone',state:'relaying',window:'99999999:1',at:Date.now()};
writeFileSync(record,JSON.stringify(kept));
field.asks.push(ask('ask:old','2'),ask('ask:lost','3'),ask('ask:gone','4'));
const w2=open();
w2.saw(live);
await until(()=>field.settled.length===4,'what the earlier window ended settled');
await pause(150); w2.saw(moved('star_agent_ask')); await pause(150);
await w2.close();
console.log(JSON.stringify({settled:field.settled,said:said.filter((words)=>/could not be settled/.test(words))}));`);
  assert.deepEqual(out.settled.map((r)=>[r.ask_ref,r.words]),[
    ['ask:ends',"The world's agent couldn't answer this from what the world shows here."],
    ['ask:old',"The world's agent couldn't answer this from what the world shows here."],
    ['ask:lost','It may have reached the world\'s agent, but its answer cannot be read: AIKit did not answer within 30 s, and was stopped'],
    ['ask:gone','It may have reached the world\'s agent, but its answer cannot be read: the window relaying it stopped before AIKit answered'],
  ],'each ending settled once, in words of why the answer cannot reach the world that asked');
  assert.equal(out.said.length,1,'a settle the field cannot take now is said once');
  assert.match(out.said[0],/^ask:ends could not be settled in the field, so the world that asked reads it waiting still; it is tried again later: The field is busy$/);
});

// 601c rulings 2 and 6 (DLW build ruling 2026-11-09): what AIKit holds of what the person's worlds show is set right against the field
// when the window goes live and whenever what its worlds show changes. What the field shows and AIKit lacks is told: a part shown from
// the person's other device, or before this window started, or whose tell failed, or told under another name. What AIKit holds and the
// field no longer shows is taken back: a part at a star its holder closed, at a star the world was turned away from, one whose withdraw
// failed. Another's world is never listed nor told; nothing is told twice.
test('what AIKit holds of what the person\'s worlds show is set right against the field on going live and when what they show changes (601c rulings 2 and 6)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:'world:me',mine:true,linked:true},{world_ref:'world:two',mine:true,linked:true},{world_ref:'world:other',mine:false,linked:true}];
field.clearings=[
  {world_ref:'world:me',part_ref:'page:from-b',star_ref:'star:s',audience:'star',shown:{kind:'page',label:'Shown from B'}},
  {world_ref:'world:me',part_ref:'page:held',star_ref:null,audience:'field',shown:{kind:'page',label:'Held'}},
  {world_ref:'world:me',part_ref:'page:renamed',star_ref:'star:s',audience:'star',shown:{kind:'page',label:'Its new name'}},
  {world_ref:'world:me',part_ref:'page:public',star_ref:null,audience:'public',shown:{kind:'page'}},
  {world_ref:'world:me',part_ref:'page:rekinded',star_ref:null,audience:'field',shown:{kind:'place',label:'Rekinded'}},
  {world_ref:'world:me',part_ref:'page:private',star_ref:null,audience:'world',shown:{kind:'page',label:'Mine alone'}},
  {world_ref:'world:other',part_ref:'page:theirs',star_ref:'star:s',audience:'star',shown:{kind:'page',label:'Theirs'}}];
const RIGHT=[{part_ref:'page:held',kind:'page',label:'Held'},{part_ref:'page:public',kind:'page'},{part_ref:'page:rekinded',kind:'place',label:'Rekinded'},
  {part_ref:'page:from-b',star_ref:'star:s',kind:'page',label:'Shown from B'},{part_ref:'page:renamed',star_ref:'star:s',kind:'page',label:'Its new name'}];
answer({'disclose --list world:me':[listing('world:me',[{part_ref:'page:held',kind:'page',label:'Held',text:'What it shows, in words.'},{part_ref:'page:public',kind:'page'},{part_ref:'page:rekinded',kind:'page',label:'Rekinded'},
    {part_ref:'page:renamed',star_ref:'star:s',kind:'page',label:'Its old name'},
    {part_ref:'page:at-a-closed-star',star_ref:'star:closed',kind:'page',label:'At a star its holder closed'},
    {part_ref:'page:turned-away',star_ref:'star:t',kind:'page'},{part_ref:'page:private',kind:'page',label:'Mine alone'}]),listing('world:me',RIGHT)],
  'disclose --list world:two':[listing('world:two',[{part_ref:'page:withdraw-failed',kind:'page',label:'Its withdraw failed'}]),listing('world:two',[])],
  disclose:[ok(disclosed('world:me','shown'))]});
const w=open({reconcile:true});
w.saw(live);
await until(()=>lists().length===2&&tells().length===7,'set right on going live');
const first={lists:lists(),tells:tells()};
w.saw(moved('star_agent_ask'));
await pause(300);
const otherTable=lists().length;
w.saw(moved('world_clearing'));
await until(()=>lists().length===4,'set right when what the worlds show changes');
await pause(300);
await w.close();
console.log(JSON.stringify({first,otherTable,lists:lists(),tells:tells(),said}));`);
  assert.deepEqual(out.first.lists,['world:me','world:two'],'each of the person\'s own worlds is listed, never another\'s');
  assert.deepEqual(out.first.tells,[
    '--world world:me --part page:from-b --star star:s --kind page --label=Shown from B',
    '--world world:me --part page:renamed --star star:s --kind page --label=Its new name',
    '--world world:me --part page:rekinded --field --kind place --label=Rekinded',
    '--world world:me --part page:at-a-closed-star --star star:closed --withdraw',
    '--world world:me --part page:turned-away --star star:t --withdraw',
    '--world world:me --part page:private --field --withdraw',
    '--world world:two --part page:withdraw-failed --field --withdraw',
  ],'what the field shows and AIKit lacks is told; what AIKit holds and the field no longer shows is taken back; what stands as it is, is left');
  assert.equal(out.otherTable,2,'a change to no world\'s shows sets nothing right');
  assert.deepEqual(out.lists,['world:me','world:two','world:me','world:two']);
  assert.equal(out.tells.length,7,'set right, nothing more is told');
  assert.deepEqual(out.said,[],'nothing to say when all is set right');
});

// Rulings 2 and 6 go with the window's own acts: what the window tells AIKit of a Show it made is not told again by the setting right
// that follows. A list AIKit cannot give (an AIKit older than the list, which ends as a usage error does) or a tell AIKit refuses is said
// once, and tried again at the slowing pace and when the field next changes; while no field is bound, nothing is listed.
test('setting AIKit\'s record right follows the window\'s own tells, and one it cannot finish is said once and tried again later (601c rulings 2 and 6)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:'world:me',mine:true,linked:true}];
field.clearings=[];
let bound=null;
answer({'disclose --list world:me':[listing('world:me',[]),
    listing('world:me',[{part_ref:'page:new',star_ref:'star:s',kind:'page',label:'New'}]),
    'usage','usage',
    listing('world:me',[{part_ref:'page:new',star_ref:'star:s',kind:'page',label:'New'}]),
    listing('world:me',[{part_ref:'page:new',star_ref:'star:s',kind:'page',label:'New'},{part_ref:'page:gone',star_ref:'star:s',kind:'page'}]),
    listing('world:me',[{part_ref:'page:new',star_ref:'star:s',kind:'page',label:'New'},{part_ref:'page:gone',star_ref:'star:s',kind:'page'}]),
    listing('world:me',[{part_ref:'page:new',star_ref:'star:s',kind:'page',label:'New'}])],
  disclose:[ok(disclosed('world:me','shown')),no('gateway.disclose_invalid','The store is busy.'),ok(disclosed('world:me','withdrawn'))],delays:{disclose:150}});
// a window told not to (reconcile: false) never sets it right, live and moved as it may be
const off=open({record:()=>record});
off.saw(live); off.saw(moved('world_clearing'));
await pause(200);
const offLists=lists().length;
await off.close();
const w=open({reconcile:true,record:()=>bound,pace:{first:20,most:80,retry:100}});
w.saw(live);
await pause(300);
const unbound=lists().length;
bound=record;
w.saw(live);
await until(()=>lists().length===1,'listed once bound');
const act=(request)=>w.act(request,()=>hold.request(request));
// the field's news of the Show comes before its tell has run: what is set right waits for that tell
const showing=act({kind:'clearing-open',world_ref:'world:me',part_ref:'page:new',star_ref:'star:s',audience:'star',shown:{kind:'page',label:'New'}});
w.saw(moved('world_clearing'));
const shown=await showing;
await until(()=>lists().length===2,'set right after the Show');
await pause(200);
const afterShow=tells();
const told=runs('disclose').find((r)=>!r.argv.includes('--list'));
const tellEnded=lines('ends.jsonl').find((e)=>e.pid===told.pid).at, listBegan=runs('disclose').filter((r)=>r.argv.includes('--list'))[1].at;
// an AIKit older than the list: said once, though asked twice, and tried again later without a change
w.saw(moved('world_clearing'));
await until(()=>lists().length===3,'the list asked');
w.saw(moved('world_clearing'));
await until(()=>lists().length===5,'tried again at its pace, and listed');
// AIKit holds a part the field no longer shows, and refuses its withdraw once: said, and tried again at its pace
w.saw(moved('world_clearing'));
await until(()=>tells().length===3,'the withdraw tried again',8000);
await until(()=>lists().length===7,'and set right');
await pause(300);
await w.close();
const listed=lists().length, tellsThen=tells(), saidThen=[...said];
// left unset, the option is on: the window a host opens sets AIKit's record right
const plain=open({reconcile:undefined,record:()=>record});
plain.saw(live);
await until(()=>lists().length>listed,'a window opened without the option sets it right');
await plain.close();
console.log(JSON.stringify({offLists,unbound,shownAikit:shown.data.aikit,afterShow,afterTell:listBegan>=tellEnded,tells:tellsThen,lists:listed,said:saidThen}));`);
  assert.equal(out.offLists,0,'a window told not to set it right lists nothing');
  assert.equal(out.unbound,0,'while no field is bound, nothing is listed');
  assert.deepEqual(out.shownAikit,{told:true,parts:1,words:null});
  assert.deepEqual(out.afterShow,['--world world:me --part page:new --star star:s --kind page --label=New'],'the Show told once, by its own tell');
  assert.equal(out.afterTell,true,'and AIKit\'s record was listed only after that tell had run');
  assert.deepEqual(out.tells.slice(1),['--world world:me --part page:gone --star star:s --withdraw','--world world:me --part page:gone --star star:s --withdraw']);
  const unlisted=out.said.filter((w)=>/^What AIKit holds of what world:me shows could not be read/.test(w));
  assert.equal(unlisted.length,1,'an AIKit older than the list is said once');
  assert.match(unlisted[0],/so it is not set right against the field now: AIKit did not take what it was asked as it was given/);
  assert.ok(out.said.some((w)=>/^AIKit's record of what world:me shows was not all set right against the field; it is tried again later: AIKit refused: The store is busy\.$/.test(w)),'a refused tell is said');
});


// A service lost (O-I #858 TX14): what the held client says is the person's to read, in plain words, and never the transport's raw
// cause ("fetch failed", a URI and a timeout), which tells them nothing they can act on. A service that answers no one stands here: the
// held client's own connection to a port nothing listens on.
test('a lost service is said in plain words, without the transport\'s raw cause',()=>{
  const env={...process.env,SPACETIMEDB_URI:'ws://127.0.0.1:1',SPACETIMEDB_DATABASE:'oi-lost-service-test',
    OI_STATE_HOME:join(fileURLToPath(new URL('.',import.meta.url)),'node_modules','.cache','oi-lost-service-test')};
  delete env.OI_SHARED_FIELD_TARGET;
  const input=JSON.stringify({id:1,request:{kind:'worlds',aperture:'world'}})+'\n';
  const result=spawnSync(fileURLToPath(new URL('./field.sh',import.meta.url)),['--held'],{env,input,encoding:'utf8',timeout:30000});
  assert.ifError(result.error);
  const answer=result.stdout.trim().split('\n').map((line)=>JSON.parse(line)).find((line)=>line.id===1);
  assert.ok(answer,result.stderr);
  assert.equal(answer.ok,false);
  assert.equal(answer.error.kind,'unavailable');
  assert.match(answer.error.message,/not reachable now/);
  assert.match(answer.error.message,/comes back/,'and says what happens next');
  assert.doesNotMatch(answer.error.message,/fetch failed|ECONNREFUSED|ws:\/\/|did not answer within|socket|undici/i,'no raw cause reaches the person');
});
