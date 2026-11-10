import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
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
  assert.deepEqual(out.star,{argv:[...head,'--star','star:keepers','--kind','page','--label=- the second plate','--by','field-window','--json']},'shown at a star: recorded at that star, its label one argument');
  assert.deepEqual(out.field,{argv:[...head,'--field','--kind','page','--label=- the second plate','--by','field-window','--json']},'shown to the field: at every star');
  assert.deepEqual(out.public,out.field,'shown to the public: so to the field too');
  for (const key of ['starless','fieldAtStar','nobody']) assert.match(out[key].refused,/one star, or to the field or the public/,key);
  assert.match(out.spaced.refused,/A part is told to AIKit by its own ref/);
  assert.match(out.starSpaced.refused,/star is told to AIKit by its own ref/);
  for (const key of ['world','worldGap']) assert.match(out[key].refused,/A world is told to AIKit by its whole ref/,key);
  for (const key of ['control','nbsp','long','dash']) assert.match(out[key].refused,/A part is told to AIKit by its own ref/,key);
  assert.equal(out.fits.argv[6],'part:'+'\u00e9'.repeat(253),'512 bytes is a ref AIKit takes');
  assert.equal(out.feff.argv[6],'part:\ufeffzero','U+FEFF is no whitespace to Rust, so AIKit takes it');
  assert.deepEqual(out.emptyStar,{argv:[...head,'--field','--kind','page','--label=- the second plate','--by','field-window','--json']},'a star of \'\' is no star, as the field reads it');
  assert.deepEqual(out.emptyStarWithdraw.argv.slice(-5),['--field','--withdraw','--by','field-window','--json']);
  for (const key of ['lines','longLabel']) assert.ok(!out[key].argv.some((arg)=>arg.startsWith('--label')),key+': a label AIKit would refuse is left out, never the part');
  assert.ok(out.fullLabel.argv.includes('--label='+'x'.repeat(160)),'160 characters is a label AIKit takes');
  assert.ok(!out.spacedKind.argv.includes('--kind'),'and a kind it would refuse');
  assert.deepEqual(out.withdrawStar,{argv:['aikit','gateway','disclose','--world','world:me','--part','place:the-study','--star','star:keepers','--withdraw','--by','field-window','--json']});
  assert.deepEqual(out.withdrawField,{argv:['aikit','gateway','disclose','--world','world:me','--part','place:the-study','--field','--withdraw','--by','field-window','--json']},
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
// script the test writes (answer, in WINDOW): per verb, or per ref for replies; `hang` never answers and ignores SIGTERM (it ends itself
// after 20 s, whatever happens); `usage` ends as a usage error does (2, nothing on stdout), and `{usage: arg}` names on stderr, as clap
// does, the argument it does not take; `{thenHang: envelope}` answers, and then runs on as `hang` does. It is a shell, which starts in
// milliseconds where node may take longer than a run's limit on a loaded machine (#953's review, finding 6; #955's review, finding 4;
// 601g ruling 4). Each run is kept in a file of its own, run-<ms>-<pid> (a count of the fields that follow, then each field, every one
// ending in NUL), each end in end-<ms>-<pid>, and the script is read from answers/, a link each answer swaps whole. Run with --warm it
// records nothing: inWindow runs it so once before the window does, since macOS checks a file the first time it is run (some 110 ms on a
// quiet machine here, and past the 1.5 s limit once at load 17), and every run after that starts in milliseconds.
const FAKE_AIKIT=`#!/bin/sh
[ "$1" = --warm ] && exit 0
LC_ALL=C; export LC_ALL
dir=\${FAKE_AIKIT_DIR:-\${0%/*}}
stamp() { now=$(date +%s%N); case $now in ''|*[!0-9]*) now=$(perl -MTime::HiRes=time -e 'printf "%.0f", time*1e9');; esac; now=\${now%??????}; }
plain() { rest=$1; out=; while [ -n "$rest" ]; do c=\${rest%"\${rest#?}"}; rest=\${rest#?}; case $c in [A-Za-z0-9]) out=$out$c;; *) out=\${out}_;; esac; done; }
stamp; at=$now
verb=$2; key=$verb
if [ "$verb" = replies ]; then key="replies $3"
elif [ "$verb" = disclose ]; then
  list=; world=; prev=
  for arg in "$@"; do
    if [ "$arg" = --list ]; then list=1; fi
    if [ "$prev" = --world ] && [ -z "$world" ]; then world=$arg; fi
    prev=$arg
  done
  if [ -n "$list" ]; then key="disclose --list $world"; fi
fi
if [ -n "\${OI_POSITION_REF+set}" ]; then position="=$OI_POSITION_REF"; else position=-; fi
if [ -n "\${OI_OCCUPANT_GENERATION+set}" ]; then generation="=$OI_OCCUPANT_GENERATION"; else generation=-; fi
printf '%s\\0' "$(($# + 4))" "$$" "$at" "$position" "$generation" "$@" > "$dir/run-$at-$$"
plain "$key"; counted=$dir/count-$out; script=$dir/answers/a-$out
n=0; if [ -f "$counted" ]; then read -r n < "$counted"; fi
echo "$((n + 1))" > "$counted"
mode=answer; code=1
said='{"schema":1,"ok":false,"error":{"code":"fake.unscripted","message":"nothing is scripted for '"$key"'","details":{}}}'
if [ -f "$script.last" ]; then
  read -r last < "$script.last"
  i=$n; if [ "$i" -gt "$last" ]; then i=$last; fi
  { read -r mode; IFS= read -r said; read -r code; } < "$script.$i"
fi
ended() { stamp; printf '%s\\0' "$key" > "$dir/end-$now-$$"; }
case $mode in
  hang) trap '' TERM; sleep 20 </dev/null >/dev/null 2>&1; exit 3;;
  usage) printf 'error: unexpected argument %sfound\\n' "\${said:+$said }" >&2; exit 2;;
  thenHang) printf '%s\\n' "$said"; ended; trap '' TERM; sleep 20 </dev/null >/dev/null 2>&1; exit 3;;
esac
delay=
case $verb in ''|*[!A-Za-z0-9]*) ;; *) if [ -f "$dir/answers/d-$verb" ]; then read -r delay < "$dir/answers/d-$verb"; fi;; esac
if [ -z "$delay" ] && [ -f "$dir/answers/d" ]; then read -r delay < "$dir/answers/d"; fi
if [ -n "$delay" ] && [ "$delay" != 0 ]; then sleep "$delay" </dev/null >/dev/null 2>&1; fi
ended
printf '%s\\n' "$said"
exit "$code"
`;
// The window under test, over a field held in memory with the keys field-lib worldReading gives and the acts the held client takes.
const WINDOW=`
const FAKE=process.env.FAKE_AIKIT_DIR;
// the fake's script: each answer a file of its own (its mode, what it prints, its exit code) under answers.<n>, linked as answers whole
let scripted=0;
const scriptOf=(said)=>said==='hang'?'hang\\n\\n3':said==='usage'?'usage\\n\\n2':said&&typeof said==='object'&&typeof said.usage==='string'?'usage\\n\\''+said.usage+'\\'\\n2'
  :said&&typeof said==='object'&&said.thenHang?'thenHang\\n'+JSON.stringify(said.thenHang)+'\\n3':'answer\\n'+JSON.stringify(said)+'\\n'+(said?.ok===false?1:0);
const answer=(answers)=>{
  const at=join(FAKE,'answers.'+(++scripted)), plain=(key)=>key.replace(/[^A-Za-z0-9]/g,'_');
  mkdirSync(at);
  for(const [key,list] of Object.entries(answers)){
    if(key==='delays'||key==='delay'||!Array.isArray(list)||!list.length)continue;
    list.forEach((said,i)=>writeFileSync(join(at,'a-'+plain(key)+'.'+i),scriptOf(said)+'\\n'));
    writeFileSync(join(at,'a-'+plain(key)+'.last'),(list.length-1)+'\\n');
  }
  for(const [verb,ms] of Object.entries(answers.delays??{}))if(/^[A-Za-z0-9]+$/.test(verb))writeFileSync(join(at,'d-'+verb),(Number(ms)/1000)+'\\n');
  if(answers.delay!==undefined)writeFileSync(join(at,'d'),(Number(answers.delay)/1000)+'\\n');
  symlinkSync(at,join(FAKE,'answers.next'));
  renameSync(join(FAKE,'answers.next'),join(FAKE,'answers'));
};
// what the fake kept, each run or end a file of its own; one still being written is read on the next look
const fakeFiles=(prefix)=>readdirSync(FAKE).filter((name)=>name.startsWith(prefix)).map((name)=>{try{return {name,fields:readFileSync(join(FAKE,name),'utf8').split('\\0')};}catch{return null;}}).filter(Boolean);
const runs=(verb)=>fakeFiles('run-').map(({name,fields})=>{
  const count=Number(fields[0]);
  if(fields.length!==count+2)return null;
  const [,pid,at,position,generation,...args]=fields.slice(0,count+1);
  return {argv:['aikit',...args],pid:Number(pid),at:Number(at),position:position==='-'?null:position.slice(1),generation:generation==='-'?null:generation.slice(1),name};
}).filter(Boolean).sort((a,b)=>a.at-b.at||(a.name<b.name?-1:1)).filter((run)=>!verb||run.argv[2]===verb).map(({name,...run})=>run);
const runEnds=()=>fakeFiles('end-').map(({name,fields})=>{const [,at,pid]=/^end-(\\d+)-(\\d+)$/.exec(name)??[];return at&&fields.length===2?{key:fields[0],pid:Number(pid),at:Number(at)}:null;})
  .filter(Boolean).sort((a,b)=>a.at-b.at);
const until=async(ready,what,ms=15000)=>{const end=Date.now()+ms;while(!ready()){if(Date.now()>end)throw new Error('never: '+what+'; the window said: '+JSON.stringify(said.slice(-6)));await new Promise((r)=>setTimeout(r,10));}};
const pause=(ms)=>new Promise((r)=>setTimeout(r,ms));
const field={worlds:[],clearings:[],gatherings:[],asks:[],carried:[],settled:[],settleTries:[],refuse:{},refuseAct:{},throwOn:{},taken:[],reads:0,asked:{}};
const ACTS=['clearing-open','clearing-withdraw','star-leave','star-close'];
// slow: before the field takes it; lag: after the field took it, before its answer comes back
const hold={async request(r){
  field.asked[r.kind]=(field.asked[r.kind]??0)+1;
  if(r.kind==='world-agent-settle')field.settleTries.push([r.ask_ref,r.words]);
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
  if(r.kind==='worlds')return {ok:true,data:JSON.parse(JSON.stringify({worlds:field.worlds,clearings:field.clearings,gatherings:field.gatherings,stars:[],agent_ask:{state:field.askState??'held'},agent_asks:field.asks}))};
  if(r.kind==='clearing-open'){field.clearings.push({world_ref:r.world_ref,part_ref:r.part_ref,star_ref:r.star_ref||null,audience:r.audience,shown:r.shown});return {ok:true,data:{schema:'oi.shared-field.clearing-result/v1',state:'open'}};}
  if(r.kind==='clearing-withdraw'){field.clearings=field.clearings.filter((c)=>!(c.world_ref===r.world_ref&&c.part_ref===r.part_ref&&(c.star_ref??'')===(r.star_ref??'')));return {ok:true,data:{schema:'oi.shared-field.clearing-result/v1',state:'withdrawn'}};}
  if(r.kind==='star-leave'){field.gatherings=field.gatherings.filter((g)=>!(g.star_ref===r.star_ref&&g.world_ref===r.world_ref));field.clearings=field.clearings.filter((c)=>!(c.star_ref===r.star_ref&&c.world_ref===r.world_ref));return {ok:true,data:{state:'left'}};}
  if(r.kind==='star-close'){field.gatherings=field.gatherings.filter((g)=>g.star_ref!==r.star_ref);field.clearings=field.clearings.filter((c)=>c.star_ref!==r.star_ref);field.asks=field.asks.filter((a)=>a.star_ref!==r.star_ref);return {ok:true,data:{state:'closed'}};}
  // refuseWords: words the field refuses as the module's refuseFieldTimeLeaks does, in its words
  if(r.kind==='world-agent-settle'&&field.refuseWords?.test(r.words))return {ok:false,error:{kind:'refused',message:'Why the ask is settled refuses local-only material: local-home-path at $[0]'}};
  if(r.kind==='world-agent-settle'){const a=field.asks.find((x)=>x.ask_ref===r.ask_ref);if(!a||a.answer||a.settled)return {ok:false,error:{kind:'refused',message:'That ask is answered, settled or taken back'}};field.settled.push(r);a.settled={words:r.words};return {ok:true,data:{state:'settled'}};}
  if(r.kind==='world-agent-answer'){field.carried.push(r);if(field.refuse[r.ask_ref])return {ok:false,error:{kind:'refused',message:field.refuse[r.ask_ref]}};const a=field.asks.find((x)=>x.ask_ref===r.ask_ref);if(a)a.answer={agent:r.agent,words:r.words,cites:r.cites};return {ok:true,data:{state:'answered'}};}
  return {ok:false,error:{kind:'malformed',message:'not this field\\'s'}};
}
const said=[], events=[];
const record=join(FAKE,'agent-relay.json');
const open=(more)=>agentWindow({request:(r)=>hold.request(r),record:()=>record,say:(w)=>said.push(w),event:(line)=>events.push(line),pace:{first:20,most:80,retry:60000},timeoutMs:5000,reconcile:false,...more});
// what AIKit lists it holds of what a world shows: the record disclose answers with (disclosed, above), read whole; each part as told by
// this window (its teller field-window, ai-kit #609) unless it names another teller, or none (null: told by hand)
const listing=(world_ref,parts)=>ok({schema:'aikit.world-star-disclosure/v1',act:'listed',changed:false,disclosure:{schema:'aikit.world-star-disclosure/v1',world_ref,
  parts:parts.map(({teller='field-window',...part})=>teller===null?part:{...part,teller})}});
const lists=()=>runs('disclose').filter((r)=>r.argv.includes('--list')).map((r)=>r.argv[r.argv.indexOf('--world')+1]);
// what the window told AIKit, each tell its own (--by field-window, F11), which is left out here
const tells=()=>runs('disclose').filter((r)=>!r.argv.includes('--list')).map((r)=>{
  const by=r.argv.indexOf('--by');
  if(by<0||r.argv[by+1]!=='field-window')throw new Error('told without --by field-window: '+r.argv.join(' '));
  return [...r.argv.slice(3,by),...r.argv.slice(by+2,-1)].join(' ');
});
// what node:fs gives field-lib (and this script), changed until the restore it returns is called: each patch makes its function of the real one
const patchFs=async(patches)=>{
  const fs=(await import('node:fs')).default, {syncBuiltinESMExports}=await import('node:module'), was={};
  for(const [name,make] of Object.entries(patches)){was[name]=fs[name];fs[name]=make(was[name]);}
  syncBuiltinESMExports();
  return ()=>{Object.assign(fs,was);syncBuiltinESMExports();};
};
const live={event:'status',state:'live'};
const moved=(table,ref='x')=>({event:'transaction',cursor:'tx:1:1',changes:[{table,op:'update',ref}],more:0});
`;
function inWindow(body){
  const here=fileURLToPath(new URL('.',import.meta.url));
  const dir=mkdtempSync(join(tmpdir(),'oi-agent-window-'));
  writeFileSync(join(dir,'aikit'),FAKE_AIKIT,{mode:0o755});
  const warmed=spawnSync(join(dir,'aikit'),['--warm'],{timeout:60000});
  assert.ifError(warmed.error);
  assert.equal(warmed.status,0,'the fake AIKit runs');
  // the window runs as an agent's shell may have started it: standing at a Position, which AIKit's person's gate refuses
  const env={...process.env,OI_AIKIT_PROGRAM:join(dir,'aikit'),FAKE_AIKIT_DIR:dir,OI_POSITION_REF:'central:position:project:Keeper:scribe',OI_OCCUPANT_GENERATION:'actuation:generation:scribe-1'};
  const script=`import {agentWindow} from './field-lib.ts';
import {existsSync,mkdirSync,readdirSync,readFileSync,renameSync,symlinkSync,writeFileSync} from 'node:fs';
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
  const disclose=(...rest)=>['aikit','gateway','disclose','--world','world:me',...rest,'--by','field-window','--json'];
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
// not undone; a run that hangs is stopped at its limit, and the window goes on to the next. The fake is a shell, which starts in
// milliseconds, so the 1.5 s limit stops the hung run alone: node may take longer than that to start on a loaded machine, and a run
// stopped before it began took the next one's answer (#953's review, finding 6).
test('a failed or hung AIKit run is said in words, the act is not undone, a hung run is stopped, and the queue goes on',()=>{
  const out=inWindow(`
answer({disclose:[no('gateway.disclose_invalid','world:me names no World whole.'),'hang',ok(disclosed('world:me','shown'))]});
const w=open({timeoutMs:1500});
field.worlds=[{world_ref:'world:me',mine:true}];
const act=(request)=>w.act(request,()=>hold.request(request));
const show=(part)=>act({kind:'clearing-open',world_ref:'world:me',part_ref:part,audience:'field',shown:{kind:'page'}});
const refused=await show('part:one');
const started=Date.now();
const hung=await show('part:two');
const took=Date.now()-started;
const after=await show('part:three');
const pid=runs('disclose').find((run)=>run.argv[6]==='part:two').pid;
let alive=true; try{process.kill(pid,0);}catch{alive=false;}
const dashed=await show('-part:dash');
process.env.OI_AIKIT_PROGRAM=join(FAKE,'no-such-aikit');
const missing=await show('part:four');
await w.close();
// the window closes while a run hangs: the run is stopped then, not at its limit
process.env.OI_AIKIT_PROGRAM=join(FAKE,'aikit');
answer({disclose:['hang']});
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
  shown:field.clearings.map((c)=>c.part_ref),ran:runs('disclose').map((run)=>run.argv[6]),said,closeTook,closedOn,hungAlive}));`);
  assert.equal(out.refused.told,false);
  assert.match(out.refused.words,/^AIKit refused: world:me names no World whole\./,'AIKit\'s own words');
  assert.equal(out.hung.told,false);
  assert.match(out.hung.words,/did not answer within 1\.5 s, and was stopped/);
  assert.ok(out.took>=1400&&out.took<8000,`stopped at its limit (${out.took} ms)`);
  assert.equal(out.alive,false,'the run that hung is gone');
  assert.deepEqual(out.after,{told:true,parts:1,words:null},'and the next run goes on');
  assert.match(out.dashed.words,/A part is told to AIKit by its own ref/,'a ref AIKit would refuse is never run');
  assert.match(out.missing.words,/could not be started/);
  assert.deepEqual(out.ran,['part:one','part:two','part:three','part:five'],'nothing ran for the dashed ref or the missing program');
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
process.env.OI_AIKIT_PROGRAM=join(FAKE,'aikit');
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
const starts=runs('replies').map((r)=>r.at), ends=runEnds().filter((e)=>e.key.startsWith('replies')).map((e)=>e.at);
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
  // in the window's own words of what happened, never AIKit's (601f ruling 4)
  assert.deepEqual(settledIn('elsewhere'),['Its agent\'s answer cannot reach it']);
  assert.deepEqual(settledIn('ended'),['The world\'s agent cannot answer it'],'an ask AIKit ended, in the window\'s words and not AIKit\'s');
  assert.deepEqual(settledIn('refused'),['Its agent\'s answer cannot reach it']);
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
  assert.equal(out.settled[0].words,'It was not passed to the world\'s agent','in the window\'s own words (601f ruling 4)');
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
// else OI_AIKIT_BIN, the name the installed app gives its AIKit, else aikit on the PATH; trimmed. An OI_AIKIT_PROGRAM set but blank, or a
// path that is not absolute, is refused in words and nothing runs: never the machine's own AIKit by accident (601b bound 4). A blank
// OI_AIKIT_BIN names no AIKit, as the kernel reads it (601d; review of #947 finding 7).
test('the window runs the AIKit its host names, trimmed, and refuses a blank or relative name in words, running nothing; a blank OI_AIKIT_BIN names none (#942 follow-ups 3 and 7; 601d)',()=>{
  const out=inWindow(`
const {mkdirSync,symlinkSync}=await import('node:fs');
const bin=join(FAKE,'bin');
mkdirSync(bin);
symlinkSync(join(FAKE,'aikit'),join(bin,'aikit'));
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
process.env.OI_AIKIT_PROGRAM='  '+join(FAKE,'aikit')+'\\t';tried.padded=await show('part:padded');
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
  assert.equal(out.tried.blankBin.told,true,'a blank OI_AIKIT_BIN names no AIKit: aikit on the PATH runs, as the kernel reads it');
  assert.deepEqual(out.ran,['part:padded','part:bin','part:blank-bin','part:path']);
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
    ['ask:ends','The world\'s agent cannot answer it'],
    ['ask:old','The world\'s agent cannot answer it'],
    ['ask:lost','It may have reached the world\'s agent, but its answer cannot be read'],
    ['ask:gone','It may have reached the world\'s agent, but its answer cannot be read: the window relaying it stopped before AIKit answered'],
  ],'each ending settled once, in the window\'s own words of why the answer cannot reach the world that asked (601f ruling 4)');
  assert.equal(out.said.length,1,'a settle the field cannot take now is said once');
  assert.match(out.said[0],/^ask:ends could not be settled in the field, so the world that asked reads it waiting still; it is tried again later: The field is busy$/);
});

// 601c rulings 2 and 6 (DLW build ruling 2026-11-09): what AIKit holds of what the person's worlds show is set right against the field
// when the window goes live and whenever what its worlds show changes. What the field shows and AIKit lacks is told: a part shown from
// the person's other device, or before this window started, or whose tell failed, or told under another name. What AIKit holds and the
// field no longer shows is taken back: a part at a star its holder closed, at a star the world was turned away from, one whose withdraw
// failed. Another's world is never listed nor told; what AIKit holds as the field shows it is not told again.
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
const tellEnded=runEnds().find((e)=>e.pid===told.pid).at, listBegan=runs('disclose').filter((r)=>r.argv.includes('--list'))[1].at;
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


// F11 (DLW build ruling 2026-11-09; rulings-f11.md, the O-I half; ai-kit #609): the window tells AIKit as its own (`--by field-window`)
// and sets right only the parts it told. A part AIKit holds as told by hand (no teller) or by another teller is the person's own record:
// never withdrawn nor told over, its text kept; where the field shows such a part in the same place, the window leaves it as it stands and
// says so once, and once more should it come back after it has gone. One told by hand that the field does not show is said once to be
// shown still, at its star or at every star, with the command that takes it back (601g ruling 1; #955's review, finding 1). A part the
// window told is told again when its kind or label changed, never with --text (AIKit keeps the text it has), and withdrawn once the field
// shows it no more.
test('the window sets right only what it told: a part told by hand or by another is left as it stands and said once, and its own are told again without their text, or withdrawn (F11; 601g ruling 1)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:'world:me',mine:true,linked:true}];
field.clearings=[
  {world_ref:'world:me',part_ref:'page:hand',star_ref:null,audience:'field',shown:{kind:'page',label:'As the field shows it'}},
  {world_ref:'world:me',part_ref:'page:another',star_ref:'star:s',audience:'star',shown:{kind:'page',label:'As the field shows it'}},
  {world_ref:'world:me',part_ref:'page:mine',star_ref:'star:s',audience:'star',shown:{kind:'page',label:'Its new name'}}];
const hand={part_ref:'page:hand',kind:'page',label:'As the person named it',text:'What the person wrote of it.',teller:null};
const another={part_ref:'page:another',star_ref:'star:s',kind:'note',label:'As another told it',teller:'another-window'};
const goneByHand={part_ref:'page:gone-by-hand',star_ref:'star:t',kind:'page',text:'Kept by hand.',teller:null};
const everywhereByHand={part_ref:'page:everywhere-by-hand',kind:'page',teller:null};
const AIKIT=[hand,another,{part_ref:'page:mine',star_ref:'star:s',kind:'page',label:'Its old name',text:'What it shows, in words.'},goneByHand,
  {part_ref:'page:gone-mine',star_ref:'star:t',kind:'page'},everywhereByHand];
const RIGHT=[hand,another,{part_ref:'page:mine',star_ref:'star:s',kind:'page',label:'Its new name',text:'What it shows, in words.'},goneByHand,everywhereByHand];
const WITHOUT=RIGHT.filter((part)=>part!==hand);
answer({'disclose --list world:me':[listing('world:me',AIKIT),listing('world:me',RIGHT),listing('world:me',WITHOUT),listing('world:me',RIGHT)],
  disclose:[ok(disclosed('world:me','shown'))]});
const w=open({reconcile:true});
const clearing=moved('world_clearing',JSON.stringify(['world:me','page:x','']));
w.saw(live);
await until(()=>lists().length===1&&runs('disclose').length===3,'set right on going live');
await pause(200);
w.saw(clearing);
await until(()=>lists().length===2,'set right again, AIKit as the window left it');
await pause(200);
// the person takes back by hand what they told by hand, which the field still shows: AIKit lacks it now
w.saw(clearing);
await until(()=>lists().length===3&&runs('disclose').length===6,'told, once AIKit lacks it');
// and tells it by hand again
w.saw(clearing);
await until(()=>lists().length===4,'set right once more');
await pause(300);
await w.close();
console.log(JSON.stringify({raw:runs('disclose').filter((r)=>!r.argv.includes('--list')).map((r)=>r.argv.slice(3).join(' ')),said}));`);
  assert.deepEqual(out.raw,[
    '--world world:me --part page:mine --star star:s --kind page --label=Its new name --by field-window --json',
    '--world world:me --part page:gone-mine --star star:t --withdraw --by field-window --json',
    '--world world:me --part page:hand --field --kind page --label=As the field shows it --by field-window --json',
  ],'its own part told again under its new name, its own part the field shows no more withdrawn, and a part AIKit lacks told; nothing of a part told by hand or by another');
  assert.ok(out.raw.every((told)=>!told.includes('--text')),'never with --text: AIKit keeps the text a part has');
  const HAND='AIKit holds page:hand of world:me, shown to the whole field, as told by hand, not by this window: the window leaves it as it stands, and does not tell AIKit what the field shows of it there';
  assert.deepEqual(out.said.filter((words)=>/^AIKit holds .* as told by hand/.test(words)),[HAND,HAND],'said once while it stands, and once more when it comes back');
  assert.deepEqual(out.said.filter((words)=>/as told by another-window/.test(words)),
    ['AIKit holds page:another of world:me, shown at star:s, as told by another-window, not by this window: the window leaves it as it stands, and does not tell AIKit what the field shows of it there']);
  assert.deepEqual(out.said.filter((words)=>/is still shown to your agent/.test(words)),[
    'page:gone-by-hand is still shown to your agent at star:t. It was told by hand, so this window leaves it. Take it back with `aikit gateway disclose --world world:me --part page:gone-by-hand --star star:t --withdraw`.',
    'page:everywhere-by-hand is still shown to your agent at every star. It was told by hand, so this window leaves it. Take it back with `aikit gateway disclose --world world:me --part page:everywhere-by-hand --field --withdraw`.',
  ],'a part told by hand that the field does not show is left, and said once, with the command that takes it back (601g ruling 1)');
});

// 601g ruling 1 (#955's review, finding 1), the Withdraw's path: a part told before AIKit kept tellers has none, as one told by hand has.
// The person withdraws it in the field; AIKit refuses the window's withdraw of it by name; the window, which never takes back the person's
// own record, says once that AIKit still shows it, with the command that takes it back, in its own lines and in the Withdraw's answer, and
// the setting right that follows says nothing more of it. A part another teller told is that teller's: its refusal is said as AIKit says it.
test('a Withdraw of a part told by hand, which AIKit refuses the window, says once that AIKit still shows it and how to take it back, in the window and in its answer (601g ruling 1)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:'world:me',mine:true}];
field.clearings=[
  {world_ref:'world:me',part_ref:'page:by-hand',star_ref:'star:s',audience:'star',shown:{kind:'page',label:'By hand'}},
  {world_ref:'world:me',part_ref:'page:another',star_ref:'star:s',audience:'star',shown:{kind:'page',label:'By another'}}];
// ai-kit #610's refusal of a withdrawal by name of a part another told, or no one
const notYours=(part,by)=>refusal('gateway.disclose_not_its_teller',part+' is shown at star:s as told '+by+', not by field-window.','Nothing was withdrawn.',
  'Only the one that told a part tells it again or takes it back by name; the person tells any part again, or takes it back, by hand (no --by).');
answer({'disclose --list world:me':[listing('world:me',[{part_ref:'page:by-hand',star_ref:'star:s',kind:'page',label:'By hand',teller:null},
    {part_ref:'page:another',star_ref:'star:s',kind:'page',label:'By another',teller:'another-window'}])],
  disclose:[notYours('page:by-hand','by hand'),notYours('page:another','by another-window')]});
const w=open({reconcile:true});
w.saw(live);
await until(()=>lists().length===1,'set right on going live');
const withdraw=(part)=>{const r={kind:'clearing-withdraw',world_ref:'world:me',part_ref:part,star_ref:'star:s'};return w.act(r,()=>hold.request(r));};
const byHand=await withdraw('page:by-hand');
w.saw(moved('world_clearing',JSON.stringify(['world:me','page:by-hand','star:s'])));
await until(()=>lists().length===3,'what AIKit holds read for the refused withdraw, and set right after it');
const another=await withdraw('page:another');
w.saw(moved('world_clearing',JSON.stringify(['world:me','page:another','star:s'])));
await until(()=>lists().length===5,'set right after the second Withdraw');
await pause(200);
await w.close();
console.log(JSON.stringify({byHand:byHand.data.aikit,another:another.data.aikit,said,shown:field.clearings.length,
  tells:runs('disclose').filter((r)=>!r.argv.includes('--list')).map((r)=>r.argv.slice(3).join(' '))}));`);
  const LEFT='page:by-hand is still shown to your agent at star:s. It was told by hand, so this window leaves it. Take it back with `aikit gateway disclose --world world:me --part page:by-hand --star star:s --withdraw`.';
  assert.deepEqual(out.byHand,{told:false,parts:1,words:LEFT},'the Withdraw answers that AIKit still shows the part, and how to take it back');
  assert.deepEqual(out.said.filter((words)=>/is still shown to your agent/.test(words)),[LEFT],'said once: the setting right after it says nothing more of it');
  assert.equal(out.another.told,false);
  assert.match(out.another.words,/^AIKit refused: page:another is shown at star:s as told by another-window, not by field-window\./,'another teller\'s part: AIKit\'s refusal, as it says it');
  assert.ok(!out.said.some((words)=>/page:another is still shown/.test(words)),'and nothing is said of it as told by hand');
  assert.deepEqual(out.tells,['--world world:me --part page:by-hand --star star:s --withdraw --by field-window --json','--world world:me --part page:another --star star:s --withdraw --by field-window --json'],
    'the window withdraws each by name once, and takes back nothing by hand');
  assert.equal(out.shown,0,'and the field\'s own acts stand');
});

// 601g ruling 8 (#955's review, finding 9): an AIKit older than --by refuses it as an argument it does not take. The window says once,
// plainly, that AIKit is older than it, and how to update it; it does not try again at the slowing pace, nor on each move of the field;
// an act of the person's still tells it once, its answer saying the same. Once AIKit takes a tell, what was let pass is set right.
test('an AIKit too old for --by is said once to be older than the window, is asked nothing more in a loop, and is set right once it takes a tell (601g ruling 8)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:'world:me',mine:true}];
field.clearings=[{world_ref:'world:me',part_ref:'page:a',star_ref:null,audience:'field',shown:{kind:'page'}}];
answer({'disclose --list world:me':[listing('world:me',[])],disclose:[{usage:'--by'}]});
const w=open({reconcile:true,pace:{first:20,most:80,retry:100}});
const told=()=>runs('disclose').filter((r)=>!r.argv.includes('--list')).length;
w.saw(live);
await until(()=>lists().length===1&&told()===1,'set right on going live, the tell refused');
await pause(1500);
const paced={lists:lists().length,told:told()};
w.saw(moved('world_clearing',JSON.stringify(['world:me','page:a',''])));
await pause(300);
const onMove={lists:lists().length,told:told()};
const show=(part)=>{const r={kind:'clearing-open',world_ref:'world:me',part_ref:part,audience:'field',shown:{kind:'page'}};return w.act(r,()=>hold.request(r));};
const refused=await show('page:b');
// AIKit is updated: it takes --by now
answer({'disclose --list world:me':[listing('world:me',[])],disclose:[ok(disclosed('world:me','shown'))]});
const taken=await show('page:c');
// the two Shows told, then one list, and the field's three parts told
let setRight=true;
await until(()=>lists().length===onMove.lists+1&&told()===onMove.told+5,'set right once AIKit takes a tell').catch(()=>{setRight=false;});
await pause(300);
await w.close();
console.log(JSON.stringify({paced,onMove,refused:refused.data.aikit,taken:taken.data.aikit,said,setRight,
  last:runs('disclose').filter((r)=>!r.argv.includes('--list')).slice(-3).map((r)=>r.argv[r.argv.indexOf('--part')+1])}));`);
  const OLD='AIKit is older than this window; update it with `oi update`.';
  assert.deepEqual(out.paced,{lists:1,told:1},'not asked again at the slowing pace');
  assert.deepEqual(out.onMove,{lists:1,told:1},'nor on a move of the field');
  assert.deepEqual(out.refused,{told:false,parts:1,words:OLD},'an act of the person\'s tells it once, and its answer says why it was not told');
  assert.deepEqual(out.said.filter((words)=>/older than this window/.test(words)),[OLD],'said once, plainly');
  assert.ok(!out.said.some((words)=>/as a usage error does/.test(words)),'never as a usage error');
  assert.deepEqual(out.taken,{told:true,parts:1,words:null});
  assert.ok(out.setRight,'once AIKit takes a tell, what the field shows is set right');
  assert.deepEqual(out.last.sort(),['page:a','page:b','page:c'],'all of it');
});

// 601c-CI (DLW build ruling 2026-11-09): a retry is due when its own timer fires. #947 lost its retries on CI: the Linux runner's event
// loop reads a coarse clock, so a retry's timer could fire while Date.now() still read a millisecond short of the moment the window had
// set, and the pass that timer started found the ask not yet due, passed it by, and left no timer to look again. A wall clock set back
// does the same every time; here it is set back a minute while an ask AIKit kept nothing of, and then a settle the field could not take,
// wait for their retries.
test('a retry comes when its own timer fires, whatever the wall clock reads: an ask AIKit kept nothing of, and a settle the field could not take (601c-CI)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:KEEPER,mine:true},{world_ref:'world:asker',mine:false}];
field.gatherings=[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
field.clearings=[{world_ref:KEEPER,part_ref:'page:at-the-star',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'At the star'}}];
const ask=(ref,at)=>({ask_ref:ref,star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?',asked_at_micros:at,answer:null});
const state=(key)=>{try{return JSON.parse(readFileSync(record,'utf8')).asks[key]?.state??null;}catch{return null;}};
const realNow=Date.now, setBack=()=>{Date.now=()=>realNow()-60000;};
answer({send:[refusal('gateway.sender_not_current','The Position you send from is no longer current.',NOTHING_SENT,'Read it with aikit gateway who --json.'),ok(sent(SENT))],
  ['replies '+SENT]:[ok(replies([]))]});
field.asks=[ask('ask:back','1')];
const w=open({pace:{first:20,most:80,retry:50}});
w.saw(live);
await until(()=>said.some((words)=>/^ask:back was not relayed to its agent, and is offered again later/.test(words)),'refused, with nothing kept');
setBack();
let offered=true;
await until(()=>state('ask:back@1')==='sent','offered again when its timer fired',5000).catch(()=>{offered=false;});
Date.now=realNow;
await w.close();
// a usage error: kept as unsure, saying nothing was sent, and settled in the field
answer({send:['usage']});
field.asks=[ask('ask:settle','2')];
field.refuseAct['world-agent-settle']='The field is busy.';
const v=open({pace:{first:20,most:80,retry:50}});
v.saw(live);
await until(()=>said.some((words)=>/^ask:settle could not be settled in the field/.test(words)),'its settle refused once');
delete field.refuseAct['world-agent-settle'];
setBack();
let settled=true;
await until(()=>field.settled.some((r)=>r.ask_ref==='ask:settle'),'settled when its timer fired',5000).catch(()=>{settled=false;});
Date.now=realNow;
await v.close();
console.log(JSON.stringify({offered,settled,sends:runs('send').map((r)=>JSON.parse(r.argv[r.argv.indexOf('--body')+1]).ask_ref),record:JSON.parse(readFileSync(record,'utf8')).asks}));`);
  assert.ok(out.offered,'an ask AIKit kept nothing of is offered again when its timer fires, the wall clock set back');
  assert.equal(out.record['ask:back@1'].state,'sent');
  assert.ok(out.settled,'a settle the field could not take is tried again when its timer fires, the wall clock set back');
  assert.deepEqual(out.sends,['ask:back','ask:back','ask:settle'],'each sent as often as it was offered, and the usage error never again');
});

// 601c-CI rulings 2 and 3: the reconcile never starves an ask. No ask waits for it, and its runs and the asks' take turns in AIKit's one
// queue, so while AIKit hangs on every list the reconcile asks for, an ask due again waits behind at most the one list under way, and the
// reconcile, its turn kept, still lists every world of the person's.
test('while AIKit hangs on every list the reconcile asks for, an ask refused before AIKit kept anything is offered again at its pace, behind at most the one list under way, and every world is still listed (601c-CI)',()=>{
  const out=inWindow(`
const MINE=[KEEPER,'project:Archive','project:Garden'];
field.worlds=[...MINE.map((world_ref)=>({world_ref,mine:true,linked:true})),{world_ref:'world:asker',mine:false}];
field.gatherings=[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
field.clearings=[{world_ref:KEEPER,part_ref:'page:at-the-star',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'At the star'}}];
field.asks=[{ask_ref:'ask:due',star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?',asked_at_micros:'1',answer:null}];
const state=(key)=>{try{return JSON.parse(readFileSync(record,'utf8')).asks[key]?.state??null;}catch{return null;}};
answer({send:[refusal('gateway.sender_not_current','The Position you send from is no longer current.',NOTHING_SENT,'Read it with aikit gateway who --json.'),ok(sent(SENT))],
  ['replies '+SENT]:[ok(replies([]))],...Object.fromEntries(MINE.map((world)=>['disclose --list '+world,['hang']]))});
const w=open({reconcile:true,timeoutMs:2000,pace:{first:20,most:80,retry:50}});
w.saw(live);
await until(()=>state('ask:due@1')==='sent','offered again and sent while every list hangs',30000);
await until(()=>new Set(lists()).size===3,'every world listed',15000);
await w.close();
const [first,again]=runs('send').map((r)=>r.at);
const between=runs('disclose').filter((r)=>r.argv.includes('--list')&&r.at>first&&r.at<again).length;
console.log(JSON.stringify({between,lists:[...new Set(lists())].sort(),sends:runs('send').length}));`);
  assert.equal(out.sends,2);
  assert.ok(out.between<=1,`the ask offered again waited behind at most the one list under way (${out.between} lists began between its sends)`);
  assert.deepEqual(out.lists,['project:Archive','project:Garden','project:Keeper'],'and the reconcile still lists every world');
});

// 601c-CI2 ruling 1 (DLW build ruling 2026-11-09): an act the person makes while the reconcile runs makes no ask wait for the rest of it.
// The person's tells go first, as ever; the reconcile stops where it stands, to begin again after them, and asks for no run of its own
// while the asks' pass is under way, so an ask due waits behind at most the one list under way, whatever the person shows meanwhile.
test('a Show made while AIKit hangs on the reconcile\'s list makes no ask wait for the rest of the reconcile: the ask due again waits behind at most the one list under way, the Show is told first, and every world is still listed (601c-CI2)',()=>{
  const out=inWindow(`
const MINE=[KEEPER,'project:Archive','project:Garden'];
field.worlds=[...MINE.map((world_ref)=>({world_ref,mine:true,linked:true})),{world_ref:'world:asker',mine:false}];
field.gatherings=[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
field.clearings=[{world_ref:KEEPER,part_ref:'page:at-the-star',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'At the star'}}];
field.asks=[{ask_ref:'ask:due',star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?',asked_at_micros:'1',answer:null}];
const state=(key)=>{try{return JSON.parse(readFileSync(record,'utf8')).asks[key]?.state??null;}catch{return null;}};
answer({send:[refusal('gateway.sender_not_current','The Position you send from is no longer current.',NOTHING_SENT,'Read it with aikit gateway who --json.'),ok(sent(SENT))],
  ['replies '+SENT]:[ok(replies([]))],disclose:[ok(disclosed(KEEPER,'shown'))],...Object.fromEntries(MINE.map((world)=>['disclose --list '+world,['hang']]))});
const w=open({reconcile:true,timeoutMs:2500,pace:{first:20,most:80,retry:250}});
w.saw(live);
await until(()=>said.some((words)=>/^ask:due was not relayed to its agent, and is offered again later/.test(words)),'refused, with nothing kept');
await until(()=>lists().length>=1,'a list under way');
// the person shows a part while that list hangs, before the ask is due again
const show={kind:'clearing-open',world_ref:KEEPER,part_ref:'page:new',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'New'}};
const showing=w.act(show,()=>hold.request(show));
await until(()=>state('ask:due@1')==='sent','offered again and sent while every list hangs',30000);
await showing;
await until(()=>new Set(lists()).size===3,'every world listed',30000);
await w.close();
const [first,again]=runs('send').map((r)=>r.at);
const between=runs('disclose').filter((r)=>r.argv.includes('--list')&&r.at>first&&r.at<again).length;
const told=runs('disclose').find((r)=>!r.argv.includes('--list'));
console.log(JSON.stringify({between,lists:[...new Set(lists())].sort(),sends:runs('send').length,tells:tells(),toldFirst:!!told&&told.at<again}));`);
  assert.equal(out.sends,2);
  assert.ok(out.between<=1,`the ask offered again waited behind at most the one list under way, a Show made meanwhile (${out.between} lists began between its sends)`);
  assert.deepEqual(out.tells,['--world project:Keeper --part page:new --star star:keepers --kind page --label=New'],'the Show is told once');
  assert.ok(out.toldFirst,'and before the ask is sent again: an ask waits for the person\'s tells');
  assert.deepEqual(out.lists,['project:Archive','project:Garden','project:Keeper'],'and the reconcile, begun again after it, still lists every world');
});

// 601c-CI2 ruling 1, what it costs: the person's tells no longer wait for a reconcile, so the reconcile stops for them. One that asked
// AIKit to take back a part on a reading of the field from before the person showed it never runs that, and reads the field anew.
test('a Show made while the reconcile\'s withdraw of that part waits in AIKit\'s queue is never undone by it: the withdraw, asked for on a reading the Show has passed, is not run, and the reconcile reads the field anew (601c-CI2)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:KEEPER,mine:true},{world_ref:'world:asker',mine:false}];
field.gatherings=[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
field.clearings=[{world_ref:KEEPER,part_ref:'page:at-the-star',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'At the star'}}];
const ask=(ref)=>({ask_ref:ref,star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?',asked_at_micros:'1',answer:null});
const REFUSED=refusal('gateway.sender_not_current','The Position you send from is no longer current.',NOTHING_SENT,'Read it with aikit gateway who --json.');
field.asks=[ask('ask:read')];
const held=[{part_ref:'page:at-the-star',star_ref:'star:keepers',kind:'page',label:'At the star'},{part_ref:'page:old',star_ref:'star:keepers',kind:'page',label:'Old'}];
// the ask is sent and its replies read hang, one after another, and AIKit takes a while over each disclose, so the next read is asked
// for while the list runs, and what the reconcile asks for after the list waits behind that read
answer({send:[ok(sent(SENT))],['replies '+SENT]:['hang'],['disclose --list '+KEEPER]:[listing(KEEPER,held)],disclose:[ok(disclosed(KEEPER,'shown'))],delays:{disclose:600}});
const w=open({reconcile:true,timeoutMs:2000,pace:{first:20,most:80,retry:60000}});
w.look();
await until(()=>runs('replies').length>=1,'its replies read, AIKit hanging on it');
// AIKit holds page:old, which the field does not show: the reconcile asks for it to be taken back
w.reconcile();
await until(()=>runEnds().some((e)=>e.key==='disclose --list '+KEEPER),'AIKit\\'s record listed, behind the read',10000);
await pause(60);
// and the person shows page:old before that withdraw has run
const show={kind:'clearing-open',world_ref:KEEPER,part_ref:'page:old',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'Old'}};
await w.act(show,()=>hold.request(show));
await until(()=>lists().length>=2,'set right again, reading the field anew',30000);
await w.close();
const part=(r)=>r.argv[r.argv.indexOf('--part')+1];
console.log(JSON.stringify({order:runs('disclose').map((r)=>r.argv.includes('--list')?'list':(r.argv.includes('--withdraw')?'withdraw ':'show ')+part(r))}));`);
  const shown=out.order.indexOf('show page:old');
  assert.ok(shown>=0,`the Show is told (${out.order.join(', ')})`);
  assert.deepEqual(out.order.slice(shown+1).filter((step)=>step!=='list'),[],`nothing takes back what was shown after it is told (${out.order.join(', ')})`);
});

// 601c-CI2 ruling 1, what it rests on: the reconcile waits for the asks' pass, and the asks' pass for the person's tells, so a tell never
// waits for the reconcile. A Show made while the reconcile waits its turn behind the asks' pass, that pass with an ask still to relay,
// holds nothing up: the Show is told, the ask relayed after it, and the reconcile goes on after them.
test('a Show made while the reconcile waits behind the asks\' pass, an ask still to relay, holds nothing up: the Show is told, the second ask is sent after it, and the reconcile lists after them (601c-CI2)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:KEEPER,mine:true},{world_ref:'world:asker',mine:false}];
field.gatherings=[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
field.clearings=[{world_ref:KEEPER,part_ref:'page:at-the-star',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'At the star'}}];
const ask=(ref)=>({ask_ref:ref,star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?',asked_at_micros:'1',answer:null});
const REFUSED=refusal('gateway.sender_not_current','The Position you send from is no longer current.',NOTHING_SENT,'Read it with aikit gateway who --json.');
const SENT2='aikit:communique:02sent';
field.asks=[ask('ask:first'),ask('ask:second')];
answer({send:[ok(sent(SENT)),ok(sent(SENT2))],['replies '+SENT]:[ok(replies([]))],['replies '+SENT2]:[ok(replies([]))],
  // AIKit lists what it holds once the Show is told, the part it told among them: every list comes after that tell
  ['disclose --list '+KEEPER]:[listing(KEEPER,[{part_ref:'page:at-the-star',star_ref:'star:keepers',kind:'page',label:'At the star'},{part_ref:'page:new',star_ref:'star:keepers',kind:'page',label:'New'}])],
  disclose:[ok(disclosed(KEEPER,'shown'))],delays:{send:600}});
const w=open({reconcile:true,pace:{first:20,most:80,retry:60000}});
w.saw(live);
await until(()=>runs('send').length===1,'the first ask being sent');
const show={kind:'clearing-open',world_ref:KEEPER,part_ref:'page:new',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'New'}};
const showing=w.act(show,()=>hold.request(show));
let went=true;
await until(()=>runs('send').length===2&&lists().length>=1,'the second ask sent and AIKit\\'s record listed',10000).catch(()=>{went=false;});
const answered=await Promise.race([showing.then(()=>true),pause(1000).then(()=>false)]);
if(!await Promise.race([w.close().then(()=>true),pause(5000).then(()=>false)])){
  throw new Error('the window never closed: the Show\\'s tell waits on the reconcile, the reconcile on the asks\\' pass, and the asks\\' pass on that tell');
}
const told=runs('disclose').find((r)=>!r.argv.includes('--list')), second=runs('send')[1], listed=runs('disclose').find((r)=>r.argv.includes('--list'));
console.log(JSON.stringify({went,answered,tells:tells(),secondAfterTell:!!told&&!!second&&second.at>told.at,listedAfter:!!listed&&!!second&&listed.at>second.at}));`);
  assert.ok(out.went,'the second ask is sent and AIKit\'s record listed: nothing waits on what waits on it');
  assert.ok(out.answered,'and the Show answers');
  assert.deepEqual(out.tells,['--world project:Keeper --part page:new --star star:keepers --kind page --label=New']);
  assert.ok(out.secondAfterTell,'the second ask is sent after the Show is told');
  assert.ok(out.listedAfter,'and the reconcile lists after the asks\' pass');
});

// 601c-CI2 ruling 2: a retry's own timer stays the trigger that cannot be lost, and after a sleep a pass that runs for another reason (a
// move of the field, a wake) offers an ask whose time to be offered again the wall clock is clearly past, by more than a second, so a
// wake never waits out a timer the sleep held back. One not clearly past waits for its timer.
test('after a sleep, a move of the field offers an ask whose retry the wall clock is clearly past, without waiting out its timer; one a moment past still waits for it (601c-CI2)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:KEEPER,mine:true},{world_ref:'world:asker',mine:false}];
field.gatherings=[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
field.clearings=[{world_ref:KEEPER,part_ref:'page:at-the-star',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'At the star'}}];
const ask=(ref)=>({ask_ref:ref,star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?',asked_at_micros:'1',answer:null});
const REFUSED=refusal('gateway.sender_not_current','The Position you send from is no longer current.',NOTHING_SENT,'Read it with aikit gateway who --json.');
field.asks=[ask('ask:slept')];
const state=(key)=>{try{return JSON.parse(readFileSync(record,'utf8')).asks[key]?.state??null;}catch{return null;}};
answer({send:[REFUSED,ok(sent(SENT))],['replies '+SENT]:[ok(replies([]))]});
// its retry ten minutes on (under RETRY_MOST_MS): the timer does not fire while this runs
const w=open({pace:{first:20,most:80,retry:600000}});
w.saw(live);
await until(()=>said.some((words)=>/^ask:slept was not relayed to its agent, and is offered again later/.test(words)),'refused, with nothing kept');
const realNow=Date.now;
// a moment past its time, short of a second past it: the field moves, and the ask is left to its timer
Date.now=()=>realNow()+600000+50;
w.saw(moved('star_agent_ask'));
await pause(300);
const early=runs('send').length;
// clearly past it, as after a sleep: the next move of the field offers it
Date.now=()=>realNow()+600000+2000;
w.saw(moved('star_agent_ask'));
let offered=true;
await until(()=>state('ask:slept@1')==='sent','offered by a move of the field, the wall clock clearly past its time',5000).catch(()=>{offered=false;});
Date.now=realNow;
await w.close();
console.log(JSON.stringify({early,offered,sends:runs('send').length}));`);
  assert.equal(out.early,1,'a moment past its time, a move of the field leaves the ask to its timer');
  assert.ok(out.offered,'clearly past its time, as after a sleep, a move of the field offers it without waiting out its timer');
  assert.equal(out.sends,2);
});

// 601c-CI2 ruling 3: a pass a retry's timer starts that cannot look at every ask (no field bound, the field or its asks not read, the
// record not read, or a throw part way) leaves a look to come at the retry's pace, so the ask is offered once it can be, with nothing in
// the field moving to wake the window.
test('a retry\'s pass that cannot look at every ask leaves a look to come, so the ask is offered once it can be: unbound, the field unread, its asks not held, the record unread, or a throw part way (601c-CI2)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:KEEPER,mine:true},{world_ref:'world:asker',mine:false}];
field.gatherings=[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
field.clearings=[{world_ref:KEEPER,part_ref:'page:at-the-star',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'At the star'}}];
const ask=(ref)=>({ask_ref:ref,star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?',asked_at_micros:'1',answer:null});
const REFUSED=refusal('gateway.sender_not_current','The Position you send from is no longer current.',NOTHING_SENT,'Read it with aikit gateway who --json.');
const stateIn=(file,key)=>{try{return JSON.parse(readFileSync(file,'utf8')).asks[key]?.state??null;}catch{return null;}};
const sendsOf=(ref)=>runs('send').filter((r)=>JSON.parse(r.argv[r.argv.indexOf('--body')+1]).ask_ref===ref).length;
let bound=null, records=0, keptWas='';
const cases={};
const early={
  unbound:{set(){bound=null;},clear(file){bound=file;},seen:()=>records},
  unread:{set(){field.refuseAct.worlds='The field is away.';},clear(){delete field.refuseAct.worlds;},seen:()=>field.reads},
  'not-held':{set(){field.askState='unsubscribed';},clear(){delete field.askState;},seen:()=>field.reads},
  'record-unread':{set(file){keptWas=readFileSync(file,'utf8');writeFileSync(file,'not a record');},clear(file){writeFileSync(file,keptWas);},
    seen:()=>said.filter((words)=>/^The record of the asks this window relayed cannot be read/.test(words)).length},
};
for(const [name,how] of Object.entries(early)){
  const file=join(FAKE,'relay-'+name+'.json'), ref='ask:'+name;
  field.asks=[ask(ref)];
  writeFileSync(join(FAKE,'count-send'),'0');
  answer({send:[REFUSED,ok(sent(SENT))],['replies '+SENT]:[ok(replies([]))]});
  bound=file;
  const w=open({record:()=>{records++;return bound;},pace:{first:20,most:80,retry:300}});
  w.saw(live);
  await until(()=>said.some((words)=>words.startsWith(ref+' was not relayed to its agent, and is offered again later')),ref+' refused');
  const before=how.seen();
  how.set(file);
  await until(()=>how.seen()>before,name+': its retry\\'s pass, which cannot look at every ask');
  await pause(100);
  const sentWhile=sendsOf(ref);
  how.clear(file);
  let offered=true;
  await until(()=>stateIn(file,ref+'@1')==='sent',ref+' offered once it can be, nothing moving',4000).catch(()=>{offered=false;});
  await w.close();
  cases[name]={sentWhile,offered};
}
// a throw part way: the ask looked at first, its settle refused once and then thrown at, stops the pass before the ask due again
{
  const file=join(FAKE,'relay-throw.json');
  field.asks=[ask('ask:unsure'),ask('ask:after')];
  writeFileSync(join(FAKE,'count-send'),'0');
  answer({send:['usage',REFUSED,ok(sent(SENT))],['replies '+SENT]:[ok(replies([]))]});
  field.refuseAct['world-agent-settle']='The field is busy.';
  bound=file;
  const w=open({record:()=>bound,pace:{first:20,most:80,retry:300}});
  w.saw(live);
  await until(()=>said.some((words)=>words.startsWith('ask:after was not relayed to its agent, and is offered again later')),'ask:after refused');
  delete field.refuseAct['world-agent-settle'];
  field.throwOn['world-agent-settle']='The field fell over.';
  await until(()=>said.some((words)=>/The field fell over/.test(words)),'the retries\\' pass thrown at part way');
  await pause(100);
  const sentWhile=sendsOf('ask:after');
  delete field.throwOn['world-agent-settle'];
  let offered=true;
  await until(()=>stateIn(file,'ask:after@1')==='sent','ask:after offered once the pass can look at it, nothing moving',4000).catch(()=>{offered=false;});
  const settled=field.settled.some((r)=>r.ask_ref==='ask:unsure');
  await w.close();
  cases.throw={sentWhile,offered,settled};
}
console.log(JSON.stringify(cases));`);
  const names=['unbound','unread','not-held','record-unread','throw'];
  assert.deepEqual(names.filter((name)=>out[name].sentWhile!==1),[],'none is offered while its pass cannot look at it');
  assert.deepEqual(names.filter((name)=>!out[name].offered),[],'each is offered once it can be, with nothing in the field moving');
  assert.ok(out.throw.settled,'and the ask before it, thrown at, is settled too');
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

// ── 601d (DLW build ruling 2026-11-09: rulings-601d.md on the review of O-I #947, and #952's review follow-ups) ────────────────────────
// The person's world asked, gathered at a star with the world that asks, and showing one part there.
const KEEPER_FIELD=`
field.worlds=[{world_ref:KEEPER,mine:true},{world_ref:'world:asker',mine:false}];
field.gatherings=[{star_ref:'star:keepers',world_ref:KEEPER,state:'gathered'},{star_ref:'star:keepers',world_ref:'world:asker',state:'gathered'}];
field.clearings=[{world_ref:KEEPER,part_ref:'page:at-the-star',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'At the star'}}];
const ask=(ref)=>({ask_ref:ref,star_ref:'star:keepers',world_ref:'world:asker',to_world_ref:KEEPER,by:'role',address:'librarian',words:'Which plate?',asked_at_micros:'1',answer:null});
const REFUSED=refusal('gateway.sender_not_current','The Position you send from is no longer current.',NOTHING_SENT,'Read it with aikit gateway who --json.');
const stateOf=(key)=>{try{return JSON.parse(readFileSync(record,'utf8')).asks[key]?.state??null;}catch{return null;}};
`;
// A window of another process holding the record's lock: it names itself in the lock as field-lib does on macOS, and as a window before
// 601g did on Linux (its pid and its start, as ps says it in UTC), keeps the lock until `hold` (ms, or a file to wait for until it holds
// two marks), claims the ask `key` in the record, lets the lock go, and stands `live` ms more.
const HOLDER=`const fs=require('node:fs'),{execFileSync}=require('node:child_process');
const [lock,record,key,hold,live]=process.argv.slice(2);
const ps=fs.existsSync('/bin/ps')?'/bin/ps':'/usr/bin/ps';
const start=execFileSync(ps,['-o','lstart=','-p',String(process.pid)],{encoding:'utf8',env:{...process.env,LC_ALL:'C',TZ:'UTC'}}).trim();
fs.writeFileSync(lock,process.pid+'\\n'+start,{flag:'wx',mode:0o600});
process.stdout.write('held\\n');
const release=()=>{
  const asks=fs.existsSync(record)?JSON.parse(fs.readFileSync(record,'utf8')).asks:{};
  asks[key]={ask_ref:key.split('@')[0],state:'relaying',window:process.pid+':1@'+start,at:Date.now()};
  fs.writeFileSync(record,JSON.stringify({schema:'oi.shared-field.agent-relay/v1',asks}));
  fs.rmSync(lock);
  process.stdout.write('released\\n');
  setTimeout(()=>process.exit(0),Number(live));
};
if(/^\\d+$/.test(hold))setTimeout(release,Number(hold));
else{const waiting=setInterval(()=>{let marks=0;try{marks=fs.readFileSync(hold).length;}catch{}if(marks>=2){clearInterval(waiting);release();}},5);}
`;

// Ruling 1 (review of #947 finding 1): at the shell's default aperture the held client holds the person's circle, whose clearings move
// as my_circle_clearing; at the whole field, as world_clearing. A clearing moved at either sets AIKit's record of what the person's
// worlds show right, with one list; a table that says nothing of what they show sets nothing right.
test('what the person\'s worlds show is set right at every aperture: a clearing moved in the circle (the shell\'s default) or in the whole field lists once (601d ruling 1)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:'world:me',mine:true,linked:true}];
answer({'disclose --list world:me':[listing('world:me',[])]});
const w=open({reconcile:true});
w.saw(live);
await until(()=>lists().length===1,'set right on going live');
const moves=[['my_circle_clearing',JSON.stringify(['world:me','page:x','star:s']),true],['world_clearing',JSON.stringify(['world:me','page:x','']),true],
  ['my_world','world:me',true],['star_agent_ask','ask:x',false],['projection','x',false]];
const counts={};
for(const [table,ref,sets] of moves){
  const before=lists().length;
  w.saw(moved(table,ref));
  if(sets)await until(()=>lists().length>before,table+' to set AIKit\\'s record right',5000).catch(()=>{});
  await pause(sets?200:500);
  counts[table]=lists().length-before;
}
await w.close();
console.log(JSON.stringify(counts));`);
  assert.deepEqual(out,{my_circle_clearing:1,world_clearing:1,my_world:1,star_agent_ask:0,projection:0},
    'a clearing moved at either aperture sets AIKit\'s record right, once; a table that says nothing of what the worlds show, never');
});

// Review of #947 finding 3: a clearing's change names its world (the module's clearingKey, ["world","part","star"]), so one moved in a
// world not the person's sets nothing right; a ref that cannot be read, or a transaction with more changes than it names, sets it right
// all the same. An AIKit older than the list (it ends as a usage error does) is asked again at the slowing pace, on going live and on a
// rebind, never on each move of the field.
test('a clearing moved in another\'s world sets nothing right, and an AIKit older than the list is not asked again on each move of the field (601d; review of #947 finding 3)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:'world:me',mine:true,linked:true},{world_ref:'world:other',mine:false,linked:true}];
answer({'disclose --list world:me':[listing('world:me',[])]});
const key=(world)=>JSON.stringify([world,'page:x','star:s']);
const w=open({reconcile:true});
w.saw(live);
await until(()=>lists().length===1,'set right on going live');
w.saw(moved('world_clearing',key('world:other')));
w.saw(moved('my_circle_clearing',key('world:other')));
await pause(600);
const others=lists().length-1;
w.saw(moved('my_circle_clearing',key('world:me')));
await until(()=>lists().length===2,'a clearing of the person\\'s own moved');
await pause(150);
w.saw(moved('world_clearing','not a key'));
await until(()=>lists().length===3,'a move whose ref cannot be read');
await pause(150);
w.saw({event:'transaction',cursor:'tx:1:2',changes:[{table:'world_clearing',op:'update',ref:key('world:other')}],more:3});
await until(()=>lists().length===4,'a transaction with more changes than it names');
await w.close();
// an AIKit older than the list
answer({'disclose --list world:me':['usage']});
const old=open({reconcile:true,pace:{first:20,most:80,retry:60000}});
const began=lists().length;
old.saw(live);
await until(()=>lists().length===began+1,'listed on going live');
await until(()=>said.some((words)=>/could not be read, so it is not set right/.test(words)),'the list AIKit cannot give, said');
for(let i=0;i<10;i++){old.saw(moved('my_circle_clearing',key('world:me')));await pause(60);}
await pause(500);
const moves=lists().length-began;
old.saw(live);
await until(()=>lists().length===began+2,'asked again on going live');
await pause(200);
old.reconcile();
await until(()=>lists().length===began+3,'and on a rebind');
await old.close();
console.log(JSON.stringify({others,moves}));`);
  assert.equal(out.others,0,'a clearing moved in a world not the person\'s sets nothing right');
  assert.equal(out.moves,1,'an AIKit older than the list is asked once, not on each of ten moves of the field');
});

// 601f ruling 4 (#953's review, finding 4): an ask is settled in the field in the window's own words of what happened, never with AIKit's
// reason, which no list of what not to carry holds back whole. Each of the 28 reasons the review found the field carried stays with the
// person, in the window's own ending line, and none reaches the field; nor do the words AIKit ended an ask in.
const REASONS=['/Users/ada/.aikit/gateway.json','/home/ada/.aikit/x','/private/tmp/x.json','AIKIT_GATEWAY_TOKEN=abc123','agent-session:0123abcd','/tmp/x',
  '~/notes','wss://relay.example','Bearer abcdefghij','10.1.2.3:8080','/root/.aikit/gateway.json','/usr/local/bin/aikit','/opt/homebrew/bin/aikit',
  '/Applications/O-I.app/Contents/Resources/aikit','/var/folders/zz/abc/T/x.json','/run/user/1000/aikit-gateway.sock','/nix/store/0123abcd-aikit/bin/aikit',
  '/Library/Application Support/aikit/x','C:\\Users\\ada\\AppData\\Local\\aikit\\gateway.json','./state/agents/librarian.json','~ada/.aikit/x','$HOME/.aikit/x',
  'localhost:7777','host ada-macbook.local','ada@example.com','sk-ant-api03-abcdefghijklmnop','ghp_abcdefghijklmnopqrstuvwxyz0123456789','session 0123abcd'];
test('an ask is settled in the field in the window\'s own words alone: no reason of AIKit\'s reaches the field, and each stays with the person (601f ruling 4)',()=>{
  assert.equal(REASONS.length,28);
  const out=inWindow(`${KEEPER_FIELD}
const REASONS=${JSON.stringify(REASONS)};
const ENDS='aikit:communique:31ends';
field.asks=[...REASONS.map((_,i)=>ask('ask:r'+i)),ask('ask:ends')];
// AIKit refuses each send in a reason that may say anything, and ends the last ask in words of its own
answer({send:[...REASONS.map((reason)=>no('gateway.binding_lost','The binding at '+reason+' was lost.')),ok(sent(ENDS))],
  ['replies '+ENDS]:[ok(replies([],{communique_ref:ENDS,reply_line:'aikit:sender-of:'+ENDS,waiting:null,declined:{words:'Declined: see /opt/homebrew/var/aikit/declines.json',basis:'it waited 24 hours'}}))]});
const w=open({pace:{first:20,most:80,retry:60000}});
w.saw(live);
await until(()=>field.settled.length===REASONS.length+1,'every ask settled',60000);
await w.close();
console.log(JSON.stringify({settled:Object.fromEntries(field.settled.map((r)=>[r.ask_ref,r.words])),tries:field.settleTries,events:events.map((e)=>[e.ask_ref,e.state,e.words])}));`);
  const PLAIN='It may have reached the world\'s agent, but its answer cannot be read';
  assert.deepEqual(out.settled,{...Object.fromEntries(REASONS.map((_,i)=>['ask:r'+i,PLAIN])),'ask:ends':'The world\'s agent cannot answer it'},'each settled in the window\'s own words of what happened');
  REASONS.forEach((reason,i)=>{
    assert.ok(!out.tries.some(([,words])=>words.includes(reason)),`never carried into the field: ${reason}`);
    const ending=out.events.find(([ref])=>ref==='ask:r'+i);
    assert.ok(ending?.[2]?.includes(reason),`and kept with the person, in the window's own ending line: ${reason}`);
  });
  assert.ok(!out.tries.some(([,words])=>words.includes('/opt/homebrew/var')),'nor the words AIKit ended an ask in');
  assert.ok(out.events.some(([ref,state,words])=>ref==='ask:ends'&&state==='ended'&&words.includes('/opt/homebrew/var')),'which stay with the person too');
});

// The field's own check of a settle's words (the module's FIELD_TIME_LEAKS, by refuseFieldTimeLeaks) mirrors field-now.mjs
// FIELD_TIME_LEAK_PATTERNS: each pattern the module refuses by, field-now knows by name and finds what it finds. The window carries no
// reason of AIKit's into a settle (601f ruling 4); this is the field's guard of its own.
test('field-now\'s check mirrors the module\'s: every pattern the module refuses a settle\'s words by, field-now knows and finds (601d ruling 2; 601f ruling 4)',async()=>{
  const src=readFileSync(new URL('./src/index.ts',import.meta.url),'utf8');
  const from=src.indexOf('const FIELD_TIME_LEAKS'), block=src.slice(from,src.indexOf('\n];',from));
  const module=[...block.matchAll(/^\s*\['([a-z-]+)', (\/.+\/[a-z]*)\],?$/gm)].map(([,name,literal])=>[name,new Function(`return ${literal}`)()]);
  const {FIELD_TIME_LEAK_PATTERNS,fieldTimeLeaks}=await import('../field-now.mjs');
  assert.equal(module.length,9,'each of the module\'s patterns is read');
  const known=new Set(FIELD_TIME_LEAK_PATTERNS.map((one)=>one.name));
  assert.deepEqual(module.map(([name])=>name).filter((name)=>!known.has(name)),[],'field-now knows each pattern the module refuses by');
  const SAMPLES=['agent-session:abc','aikit:session:0123abcd','session:a1','wss://relay.example','ws://h','10.1.2.3:8080','AIKIT_GATEWAY_TOKEN','Bearer abcdefghij',
    'redis://localhost','http://127.0.0.1:9','/Users/ada/notes','/home/ada/x','a /tmp/x','~/notes','(/etc/hosts)','/Volumes/D/x','file:///etc','x .central/y','native-token','owner-token'];
  for(const sample of SAMPLES){
    const caught=module.filter(([,pattern])=>pattern.test(sample)).map(([name])=>name);
    assert.ok(caught.length,`the module refuses ${sample}`);
    assert.ok(fieldTimeLeaks([sample]).length,`and field-now's check finds it: ${sample} (${caught.join(', ')})`);
  }
  assert.match(src,/refuseFieldTimeLeaks\(\[words\], 'Why the ask is settled'\)/,'and the module checks a settle\'s words by it');
});

// Ruling 3: the record's lock is what keeps two windows of different processes from claiming one ask. A window that finds the lock held by
// another still running waits for it, and then reads the claim that window made. The other window lets the lock go only once this one has
// judged it twice, so the wait is had on every run, however the two are scheduled (601f ruling 5), and a lock this window judged stale is
// taken over while its holder still holds it (601g ruling 3; #955's review, finding 3). They run in different time zones, and each reads
// the other's start the same (601f ruling 1; #953's review, finding 1): the holder names itself in UTC, this window runs in New York. (With
// underLock's body `return then()` it claims and sends as well; with startOf reading lstart in the local zone it judges the live holder's
// lock stale at once, takes it over and sends.)
test('a window waits for the record\'s lock another window holds, whatever time zone each runs in, and then finds the ask that window claimed: it relays nothing (601d ruling 3; 601f rulings 1 and 5; 601g ruling 3)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
process.env.TZ='America/New_York';
const {spawn}=await import('node:child_process');
writeFileSync(join(FAKE,'holder.cjs'),${JSON.stringify(HOLDER)});
const {appendFileSync}=await import('node:fs');
const lock=record+'.lock', tried=join(FAKE,'tried'), made=join(FAKE,'made'), judged=join(FAKE,'judged'), judging=new Set();
// the first time this window finds the lock held; each time it has judged it (read it whole and let it go); and the first time it makes
// it after that
const restore=await patchFs({openSync:(real)=>(file,flags,...rest)=>{
  let fd;
  try{fd=real(file,flags,...rest);}catch(error){if(file===lock&&error?.code==='EEXIST'&&!existsSync(tried))writeFileSync(tried,'');throw error;}
  if(file===lock&&flags==='wx'&&existsSync(tried)&&!existsSync(made))writeFileSync(made,'');
  if(file===lock&&flags==='r')judging.add(fd);
  return fd;
},closeSync:(real)=>(fd)=>{const done=real(fd);if(judging.delete(fd))appendFileSync(judged,'x');return done;}});
field.asks=[ask('ask:held')];
answer({send:[ok(sent(SENT))],['replies '+SENT]:[ok(replies([]))]});
const holder=spawn(process.execPath,[join(FAKE,'holder.cjs'),lock,record,'ask:held@1',judged,'60000'],{stdio:['ignore','pipe','inherit'],env:{...process.env,TZ:'UTC'}});
let heard='';
holder.stdout.on('data',(chunk)=>{heard+=chunk;});
await until(()=>heard.includes('held'),'the other window holding the lock');
// a keep given up while the holder is slow to let go (a loaded machine) is tried again soon
const w=open({pace:{first:20,most:80,retry:200}});
w.saw(live);
await until(()=>existsSync(made),'this window to make the lock, once the other let it go');
await until(()=>!existsSync(lock),'and to let it go');
await pause(400);
const claim=JSON.parse(readFileSync(record,'utf8')).asks['ask:held@1'];
await w.close();
restore();
holder.kill();
console.log(JSON.stringify({sends:runs('send').length,settled:field.settled.length,window:claim?.window??null,holder:holder.pid}));`);
  assert.equal(out.sends,0,'the ask the other window claimed is relayed by it alone');
  assert.equal(out.settled,0,'and is not settled as one whose window stopped relaying it: that window stands');
  assert.ok(String(out.window).startsWith(`${out.holder}:1@`),`and its claim stands (${out.window})`);
});

// 601f ruling 1 (#953's review, finding 1): a process's start reads the same in whatever time zone its reader runs, and the same a second
// later, as this window names it (on Linux from /proc, 601g ruling 5) and as a window before 601g named it there (ps's lstart, to the
// second, from the boot time), which this checks wherever it runs.
test('a process\'s start reads the same in every time zone, and the same a second later, however it was named (601f ruling 1; 601g ruling 5)',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const script=`import {startOf} from './field-lib.ts';
(async()=>{
const read=(zone)=>{process.env.TZ=zone;return startOf(process.pid);};
const readLstart=(zone)=>{process.env.TZ=zone;return startOf(process.pid,'Mon Jan  1 00:00:00 2001');};
const ZONES=['UTC','America/New_York','Asia/Kolkata','Pacific/Chatham'], zones=ZONES.map(read), lstarts=ZONES.map(readLstart);
await new Promise((resolve)=>setTimeout(resolve,1100));
console.log(JSON.stringify({zones,later:read('Asia/Kolkata'),lstarts,lstartLater:readLstart('Pacific/Chatham')}));
})();`;
  const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const out=JSON.parse(result.stdout.trim().split('\n').at(-1));
  assert.ok(out.zones[0],'its start is read');
  assert.deepEqual(out.zones,out.zones.map(()=>out.zones[0]),`one start in every zone (${out.zones.join(' | ')})`);
  assert.equal(out.later,out.zones[0],'and the same a second later');
  assert.match(out.lstarts[0]??'',/^[A-Z][a-z]{2} [A-Z][a-z]{2} [ \d]\d \d\d:\d\d:\d\d \d{4}$/,'its start as ps says it is read');
  assert.deepEqual(out.lstarts,out.lstarts.map(()=>out.lstarts[0]),`one lstart in every zone (${out.lstarts.join(' | ')})`);
  assert.equal(out.lstartLater,out.lstarts[0],'and the same a second later');
});

// 601g ruling 5 (#955's review, finding 8): on Linux a process's start is field 22 of its /proc stat line, starttime, in ticks since boot,
// which no step of the wall clock moves; the fields are counted after the name's last parenthesis, since a name may hold spaces and
// parentheses of its own. Where the platform is Linux the window names itself so, with the boot's id; elsewhere by ps's lstart.
test('a process\'s start on Linux is field 22 of its /proc stat line, counted after its name\'s last parenthesis, whatever the name holds (601g ruling 5)',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const script=`import {procStart,startOf} from './field-lib.ts';
import {readFileSync} from 'node:fs';
const line=(name)=>'4242 ('+name+') S 1 4242 4242 0 -1 4194560 120 0 0 0 1 2 0 0 20 0 1 0 987654 12345678 300 18446744073709551615 1 1 0 0 0';
const names=['node','tsx worker','a) S 1 2 3 (b','((x)) y','))','name with ) and ( and 1 2 3'];
const linux=process.platform==='linux';
console.log(JSON.stringify({read:names.map((name)=>procStart(line(name))),none:procStart('4242 node S 1'),short:procStart('4242 (node) S 1 2'),
  own:startOf(process.pid),linux,proc:linux?{ticks:procStart(readFileSync('/proc/self/stat','utf8')),boot:readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()}:null,
  lstart:startOf(process.pid,'Mon Jan  1 00:00:00 2001')}));`;
  const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const out=JSON.parse(result.stdout.trim().split('\n').at(-1));
  assert.deepEqual(out.read,out.read.map(()=>'987654'),`field 22, whatever the name holds (${JSON.stringify(out.read)})`);
  assert.equal(out.none,null,'a line with no name in parentheses names no start');
  assert.equal(out.short,null,'nor one that stops short of field 22');
  if(out.linux)assert.equal(out.own,`proc:${out.proc.boot}:${out.proc.ticks}`,'on Linux the window names itself by its ticks since boot, with the boot\'s id');
  else assert.equal(out.own,out.lstart,'elsewhere by ps\'s lstart');
  assert.match(out.lstart??'',/^[A-Z][a-z]{2} [A-Z][a-z]{2} [ \d]\d \d\d:\d\d:\d\d \d{4}$/,'and a start named by lstart is read by ps, on Linux too');
});

// 601g ruling 6 (#955's review, finding 7, m12): a lock names its holder's start, read before the lock is made (#953's review, finding
// 8), by a process that opened no window as well as by one that did: another window never finds it naming a pid alone, nor no one while
// its holder reads its start.
test('a lock made by a process that opened no window names its start, read before the lock is made (601g ruling 6)',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const dir=mkdtempSync(join(tmpdir(),'oi-cold-lock-'));
  const script=`import {startOf,underLock} from './field-lib.ts';
import fs from 'node:fs';
import cp from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {join} from 'node:path';
const file=join(process.env.LOCK_DIR,'agent-relay.json'), lock=file+'.lock', seen=[];
// each read of a start (ps on macOS, /proc on Linux) notes whether the lock stood then
const was={execFileSync:cp.execFileSync,readFileSync:fs.readFileSync};
cp.execFileSync=(...args)=>{if(Array.isArray(args[1])&&args[1].includes('lstart='))seen.push(fs.existsSync(lock));return was.execFileSync(...args);};
fs.readFileSync=(...args)=>{if(typeof args[0]==='string'&&/^\\/proc\\/\\d+\\/stat$/.test(args[0]))seen.push(fs.existsSync(lock));return was.readFileSync(...args);};
syncBuiltinESMExports();
const named=underLock(file,()=>was.readFileSync(lock,'utf8'));
Object.assign(cp,{execFileSync:was.execFileSync});
Object.assign(fs,{readFileSync:was.readFileSync});
syncBuiltinESMExports();
console.log(JSON.stringify({named:named.split('\\n'),pid:process.pid,start:startOf(process.pid),seen,left:fs.existsSync(lock)}));`;
  try{
    const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,env:{...process.env,LOCK_DIR:dir},encoding:'utf8',timeout:60000});
    assert.ifError(result.error);
    assert.equal(result.status,0,result.stderr);
    const out=JSON.parse(result.stdout.trim().split('\n').at(-1));
    assert.ok(out.start,'its start can be read');
    const [pidAndNonce='',start,...more]=out.named;
    assert.match(pidAndNonce,new RegExp(`^${out.pid} [0-9a-f]{24}$`),'the lock names its holder by pid, with a nonce of its own on that line (601g guard a)');
    assert.deepEqual([start,more],[out.start,[]],'and its start on the next, and nothing more');
    assert.deepEqual(out.seen,[false],'its start was read once, before the lock was made');
    assert.equal(out.left,false,'and the lock is let go');
  }finally{rmSync(dir,{recursive:true,force:true});}
});

// 601f ruling 3 (#953's review, finding 3): a stale lock is taken over only through a hard link. A file system that cannot make one
// (EPERM, EXDEV) never has the lock removed as it is found, which let two windows in: the window waits for it as for a live holder, and
// says once why. Here the lock's holder is gone, and every link fails.
test('a stale lock this file system cannot hand over is never removed: the window waits for it as for a live holder, relays nothing, and says why once (601f ruling 3)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
const cases={};
for(const code of ['EPERM','EXDEV']){
  field.asks=[ask('ask:'+code)];
  answer({send:[ok(sent(SENT))],['replies '+SENT]:[ok(replies([]))]});
  writeFileSync(record+'.lock','99999999');
  const restore=await patchFs({linkSync:()=>()=>{const error=new Error(code+': the link cannot be made');error.code=code;throw error;}});
  const at=said.length;
  const w=open();
  w.saw(live);
  await until(()=>said.slice(at).some((words)=>/could not be kept/.test(words)),code+': the record not kept',8000).catch(()=>{});
  await pause(300);
  await w.close();
  restore();
  cases[code]={sends:runs('send').length,lock:readFileSync(record+'.lock','utf8'),unkept:said.slice(at).filter((words)=>/could not be kept/.test(words))};
}
console.log(JSON.stringify(cases));`);
  for(const code of ['EPERM','EXDEV']){
    assert.equal(out[code].sends,0,`${code}: nothing is relayed`);
    assert.equal(out[code].lock,'99999999',`${code}: the stale lock is left as it was`);
    assert.equal(out[code].unkept.length,1,`${code}: said once (${JSON.stringify(out[code].unkept)})`);
    assert.match(out[code].unkept[0],new RegExp(`is stale, but this file system cannot hand it over \\(${code}\\), so the window waits for it as for a window still holding it: remove it if no window runs$`));
  }
});

// 601f rulings 3 and 5 (#953's review, findings 3 and 5): what a takeover or a release lets go is the lock it read, nonce and all, never one
// made anew meanwhile under the same inode (a file system that gives an inode again: ext4, xfs). Here every file reads as one inode: a live
// window's lock is made in the place of a stale one as this window names it to take it over, and in the place of this window's own lock
// (as a window that took it over past its time would) as it writes the record. Nor does a release where no hard link can be made let go
// a lock made in the place of its own (as after a stale one was removed by hand): it reads the lock whole first (601g ruling 6; #955's
// review, finding 7, m13).
test('a lock made anew under the same inode is never let go by a takeover or a release that read another, nor by a release with no hard links (601f rulings 3 and 5; 601g ruling 6)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
const {execFileSync}=await import('node:child_process');
const {unlinkSync}=await import('node:fs');
const ps=existsSync('/bin/ps')?'/bin/ps':'/usr/bin/ps';
// a live window's lock: the process that started this one, its start as field-lib reads it, and a nonce of its own
const LIVE=process.ppid+'\\n'+execFileSync(ps,['-o','lstart=','-p',String(process.ppid)],{encoding:'utf8',env:{...process.env,LC_ALL:'C',TZ:'UTC'}}).trim()+'\\nfeedfacefeedfacefeedface';
const lock=record+'.lock';
const oneInode=(real)=>(...args)=>{const stats=real(...args);if(!stats)return stats;const copy=Object.assign(Object.create(Object.getPrototypeOf(stats)),stats);copy.ino=1;return copy;};
const remake=()=>{unlinkSync(lock);writeFileSync(lock,LIVE);};
const cases={};
// a takeover: the stale lock is made anew by a live window as this one names it
field.asks=[ask('ask:taken')];
answer({send:[ok(sent(SENT))],['replies '+SENT]:[ok(replies([]))]});
writeFileSync(lock,'99999999');
let remade=false, at=said.length;
let restore=await patchFs({statSync:oneInode,fstatSync:oneInode,linkSync:(real)=>(from,to)=>{if(!remade&&from===lock){remade=true;remake();}return real(from,to);}});
let w=open();
w.saw(live);
await until(()=>said.slice(at).some((words)=>/could not be kept/.test(words)),'the live lock waited for',8000).catch(()=>{});
await w.close();
restore();
cases.takeover={remade,sends:runs('send').length,live:readFileSync(lock,'utf8')===LIVE};
// a release: this window's own lock is made anew by a live window as this one writes the record
unlinkSync(lock);
field.asks=[ask('ask:released')];
remade=false; at=said.length;
restore=await patchFs({statSync:oneInode,fstatSync:oneInode,renameSync:(real)=>(from,to)=>{const done=real(from,to);if(!remade&&to===record){remade=true;remake();}return done;}});
w=open();
w.saw(live);
await until(()=>remade,'the record written');
await until(()=>said.slice(at).some((words)=>/could not be kept/.test(words)),'the live lock waited for, as the ask is kept sent',8000).catch(()=>{});
await w.close();
restore();
cases.release={remade,live:existsSync(lock)&&readFileSync(lock,'utf8')===LIVE};
// a release where every link fails: this window's own lock is made anew by a live window as this one writes the record
unlinkSync(lock);
field.asks=[ask('ask:unlinked')];
remade=false; at=said.length;
restore=await patchFs({linkSync:()=>()=>{const error=new Error('EPERM: the link cannot be made');error.code='EPERM';throw error;},
  renameSync:(real)=>(from,to)=>{const done=real(from,to);if(!remade&&to===record){remade=true;remake();}return done;}});
w=open();
w.saw(live);
await until(()=>remade,'the record written');
await until(()=>said.slice(at).some((words)=>/could not be kept/.test(words)),'the live lock waited for, as the ask is kept sent',8000).catch(()=>{});
await w.close();
restore();
cases.unlinked={remade,live:existsSync(lock)&&readFileSync(lock,'utf8')===LIVE};
console.log(JSON.stringify(cases));`);
  assert.deepEqual(out.takeover,{remade:true,sends:0,live:true},'a takeover that read a stale lock never lets go the live one made in its place, and relays nothing');
  assert.deepEqual(out.release,{remade:true,live:true},'nor does a release let go another window\'s lock made in the place of its own');
  assert.deepEqual(out.unlinked,{remade:true,live:true},'nor a release where no hard link can be made');
});

// 601f ruling 5 (#953's review, finding 5): a lock that names this very process is stale (this process holds a lock only inside one
// underLock call, so one naming it was left): it is taken over, and the ask relayed.
test('a lock naming this window\'s own process is taken over, and the ask relayed (601f ruling 5)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
const {readdirSync}=await import('node:fs');
field.asks=[ask('ask:own')];
answer({send:[ok(sent(SENT))],['replies '+SENT]:[ok(replies([]))]});
writeFileSync(record+'.lock',String(process.pid));
const w=open();
w.saw(live);
let relayed=true;
await until(()=>stateOf('ask:own@1')==='sent','relayed',4000).catch(()=>{relayed=false;});
await w.close();
console.log(JSON.stringify({relayed,left:readdirSync(FAKE).filter((file)=>file.startsWith('agent-relay.json.lock'))}));`);
  assert.deepEqual(out,{relayed:true,left:[]},'taken over, the ask relayed, and nothing of the lock left');
});

// 601f ruling 3 (#953's review, finding 3): the lock never has two holders, by the real lock code (underLock). Four processes enter it in
// turn, each entry marked by a file that only one can make at a time, and one entry in twenty ends its process while it holds the lock (as
// a window that dies does), leaving it stale: on a file system with no hard links (every link fails EPERM), and on one that gives every
// file one inode, each link taking 5 ms (a slow mount), so takers that judge one stale lock overlap in time. A process that ends is started
// again until 1600 entries are made, or eight seconds pass; the two run side by side.
const LOCK_WORKER=`import {underLock} from './field-lib.ts';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
const {LOCK_FILE:file,LOCK_MODE:mode,LOCK_DIR:dir}=process.env, until=Number(process.env.LOCK_UNTIL), most=Number(process.env.LOCK_MOST);
const slow=()=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5);
if(mode==='eperm')fs.linkSync=()=>{slow();const error=new Error('EPERM: operation not permitted, link');error.code='EPERM';throw error;};
if(mode==='ino'){
  const one=(real)=>(...args)=>{const stats=real(...args);if(!stats)return stats;const copy=Object.assign(Object.create(Object.getPrototypeOf(stats)),stats);copy.ino=1;return copy;};
  const link=fs.linkSync;
  fs.statSync=one(fs.statSync);fs.fstatSync=one(fs.fstatSync);fs.linkSync=(...args)=>{slow();return link(...args);};
}
syncBuiltinESMExports();
const inside=file+'.inside', mark=(name)=>fs.appendFileSync(dir+'/'+name,'x'), count=(name)=>{try{return fs.readFileSync(dir+'/'+name).length;}catch{return 0;}};
while(Date.now()<until&&count('entries')<most){
  try{
    underLock(file,()=>{
      let mine=true;
      try{fs.closeSync(fs.openSync(inside,'wx'));}catch(error){if(error.code!=='EEXIST')throw error;mine=false;mark('overlaps');}
      mark('entries');
      const held=Date.now()+2;while(Date.now()<held){}
      if(mine)fs.unlinkSync(inside);
      if(Math.random()<1/20){mark('ends');process.exit(0);}
    });
  }catch{mark('waits');}
}
`;
test('the record\'s lock never has two holders: 1600 entries by four processes that may end holding it, with no hard links and with one inode for every file (601f ruling 3)',async(t)=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const dir=mkdtempSync(join(tmpdir(),'oi-lock-stress-'));
  const size=(file)=>{try{return statSync(file).size;}catch{return 0;}};
  const enter=async(mode)=>{
      const at=join(dir,mode);
      mkdirSync(at);
      const until=Date.now()+8000;
      const env={...process.env,LOCK_FILE:join(at,'agent-relay.json'),LOCK_MODE:mode,LOCK_DIR:at,LOCK_UNTIL:String(until),LOCK_MOST:'1600'};
      const running=new Set();
      const start=()=>{
        const worker=spawn(join(here,'node_modules','.bin','tsx'),['-e',LOCK_WORKER],{cwd:here,env,stdio:['ignore','ignore','inherit']});
        running.add(worker);
        worker.once('exit',()=>{running.delete(worker);if(Date.now()<until&&size(join(at,'entries'))<1600)start();});
      };
      for(let i=0;i<4;i++)start();
      const stop=until+15000;
      while(running.size&&Date.now()<stop)await new Promise((resolve)=>setTimeout(resolve,50));
      // tsx hands a TERM on to the process it runs
      for(const worker of running)worker.kill('SIGTERM');
      return [mode,{entries:size(join(at,'entries')),overlaps:size(join(at,'overlaps')),ends:size(join(at,'ends')),waits:size(join(at,'waits'))}];
  };
  let seen;
  try{seen=Object.fromEntries(await Promise.all(['eperm','ino'].map(enter)));}
  finally{rmSync(dir,{recursive:true,force:true});}
  t.diagnostic(JSON.stringify(seen));
  for(const [mode,{entries,overlaps,ends}] of Object.entries(seen)){
    assert.equal(overlaps,0,`${mode}: never two holders (${JSON.stringify(seen[mode])})`);
    assert.ok(ends>=1,`${mode}: a process ended holding the lock, so a stale lock was had (${JSON.stringify(seen[mode])})`);
  }
  assert.ok(seen.ino.entries>=100,`with one inode for every file, stale locks are taken over and the entries go on (${JSON.stringify(seen.ino)})`);
});

// Ruling 3: a lock whose pid the system has given again (a running process that started after the lock named it) is stale, as is one
// older than any window holds it, whoever it names. Each is taken over, the ask relayed, and nothing of the lock left behind.
test('a lock naming a pid the system has given again, or one older than any window holds it, is taken over and the ask relayed (601d ruling 3)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
const {utimesSync,readdirSync}=await import('node:fs');
const cases={};
// a running process (the one that started this window), named with a start it never had; then one named by its pid alone, a minute old
for(const [name,content,ageS] of [['reused',process.ppid+'\\nMon Jan  1 00:00:00 2001',0],['old',String(process.ppid),60]]){
  field.asks=[ask('ask:'+name)];
  writeFileSync(join(FAKE,'count-send'),'0');
  answer({send:[ok(sent(SENT))],['replies '+SENT]:[ok(replies([]))]});
  writeFileSync(record+'.lock',content);
  if(ageS){const then=(Date.now()-ageS*1000)/1000;utimesSync(record+'.lock',then,then);}
  const w=open();
  w.saw(live);
  let relayed=true;
  await until(()=>stateOf('ask:'+name+'@1')==='sent',name+' relayed',4000).catch(()=>{relayed=false;});
  await w.close();
  cases[name]={relayed,left:readdirSync(FAKE).filter((file)=>file.startsWith('agent-relay.json.lock'))};
}
console.log(JSON.stringify({cases,unkept:said.filter((words)=>/could not be kept/.test(words))}));`);
  assert.deepEqual(out.cases,{reused:{relayed:true,left:[]},old:{relayed:true,left:[]}},'each stale lock is taken over, and nothing of it is left');
  assert.deepEqual(out.unkept,[],'and the record is kept each time');
});

// Ruling 3: taking a stale lock over is whole. The window first names the lock for itself under the lock's own inode
// (`<lock>.taken.<inode>`, a hard link one window alone can make), and lets the lock go only while that name still holds it. While another
// window holds that name, this one leaves the lock to it; once the name is gone, it takes the lock over.
test('a stale lock another window is taking over is left to it: this window takes it over only once that window\'s name for it is gone (601d ruling 3)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
const {linkSync,statSync,rmSync,readdirSync}=await import('node:fs');
field.asks=[ask('ask:taking')];
answer({send:[ok(sent(SENT))],['replies '+SENT]:[ok(replies([]))]});
// a lock whose holder is gone (no pid is this large), which another window is taking over
writeFileSync(record+'.lock','99999999');
const taking=record+'.lock.taken.'+statSync(record+'.lock').ino;
linkSync(record+'.lock',taking);
const w=open({pace:{first:20,most:80,retry:200}});
w.saw(live);
await until(()=>said.some((words)=>/could not be kept/.test(words)),'the record not kept while another window takes its lock over',5000).catch(()=>{});
const sentWhile=runs('send').length;
rmSync(taking);
let relayed=true;
await until(()=>stateOf('ask:taking@1')==='sent','relayed once the lock is this window\\'s to take over',6000).catch(()=>{relayed=false;});
await w.close();
console.log(JSON.stringify({sentWhile,relayed,left:readdirSync(FAKE).filter((file)=>file.startsWith('agent-relay.json.lock'))}));`);
  assert.equal(out.sentWhile,0,'while another window takes the stale lock over, this one leaves it, and sends nothing');
  assert.ok(out.relayed,'once that name is gone, it takes the lock over and relays the ask');
  assert.deepEqual(out.left,[],'and leaves no lock and no name of one behind');
});

// Ruling 3 (finding 5 b): a window is named by its process's start as well as its pid, so an ask a window sent before its process ended is
// read by the next window, though the system has given that pid to a running process since.
test('an ask sent by a window whose pid the system has given again is read by the next window (601d ruling 3; review of #947 finding 5)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
field.asks=[ask('ask:orphan')];
answer({['replies '+SENT]:[ok(replies([]))]});
writeFileSync(record,JSON.stringify({schema:'oi.shared-field.agent-relay/v1',asks:{'ask:orphan@1':{ask_ref:'ask:orphan',state:'sent',communique_ref:SENT,
  window:process.ppid+':1@Mon Jan  1 00:00:00 2001',at:Date.now()}}}));
const w=open();
w.saw(live);
let read=true;
await until(()=>runs('replies').length>0,'its replies read',4000).catch(()=>{read=false;});
await w.close();
console.log(JSON.stringify({read,window:JSON.parse(readFileSync(record,'utf8')).asks['ask:orphan@1'].window,me:process.pid}));`);
  assert.ok(out.read,'the next window reads the replies of an ask the window whose pid was given again sent');
  assert.ok(out.window.startsWith(`${out.me}:`),`and reads them as its own (${out.window})`);
});

// Ruling 4 (finding 4): an ask another window still standing relays or reads is left to it, and looked at again at the retry's slowing
// pace, so once that window is gone this one reads its replies, with nothing in the field moving.
test('an ask another standing window reads is looked at again, and read once that window is gone, with nothing in the field moving (601d ruling 4)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
const {spawn}=await import('node:child_process');
field.asks=[ask('ask:theirs')];
answer({['replies '+SENT]:[ok(replies([]))]});
const other=spawn(process.execPath,['-e','setTimeout(()=>{},800)'],{stdio:'ignore'});
const gone=new Promise((resolve)=>other.once('exit',resolve));
// a record kept before 601d names a window by its pid alone
writeFileSync(record,JSON.stringify({schema:'oi.shared-field.agent-relay/v1',asks:{'ask:theirs@1':{ask_ref:'ask:theirs',state:'sent',communique_ref:SENT,window:other.pid+':1',at:Date.now()}}}));
const w=open({pace:{first:20,most:80,retry:200}});
w.saw(live);
await pause(300);
const whileStanding=runs('replies').length;
await gone;
let read=true;
await until(()=>runs('replies').length>0,'its replies read once the other window is gone, nothing moving',6000).catch(()=>{read=false;});
await w.close();
console.log(JSON.stringify({whileStanding,read}));`);
  assert.equal(out.whileStanding,0,'while the other window stands, the ask is its own');
  assert.ok(out.read,'once it is gone, this window reads the ask\'s replies, with nothing in the field moving');
});

// 601f ruling 2 (#953's review, finding 2): while another window holds an ask of the person's worlds, a move of the field that says
// nothing of asks looks at that ask's entry in the record alone, at most once a step of the retry's base pace however many moves come
// (601g ruling 2), and never reads the field for it. A move of what the person's worlds show still sets AIKit's record right, as it did.
test('while another window holds an ask, 200 moves of the field look at its entry at most once a step and read nothing of the field for it, and a clearing moved still sets AIKit right (601f ruling 2)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
const {spawn}=await import('node:child_process');
const other=spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{stdio:'ignore'});
field.asks=[ask('ask:theirs')];
answer({['replies '+SENT]:[ok(replies([]))],['disclose --list '+KEEPER]:[listing(KEEPER,[{part_ref:'page:at-the-star',star_ref:'star:keepers',kind:'page',label:'At the star'}])]});
writeFileSync(record,JSON.stringify({schema:'oi.shared-field.agent-relay/v1',asks:{'ask:theirs@1':{ask_ref:'ask:theirs',state:'sent',communique_ref:SENT,window:other.pid+':1',at:Date.now()}}}));
const w=open({reconcile:true,pace:{first:20,most:80,retry:5000}});
w.saw(live);
await until(()=>lists().length===1&&field.reads>=2,'the window live, and the ask left to the other window');
await pause(200);
const reads=field.reads, listed=lists().length;
let recordReads=0;
const restore=await patchFs({readFileSync:(real)=>(file,...rest)=>{if(file===record)recordReads++;return real(file,...rest);}});
for(let i=0;i<200;i++){w.saw(i===20?moved('world_clearing',JSON.stringify([KEEPER,'page:x','star:keepers'])):moved('field_presence'));await pause(2);}
await until(()=>lists().length===listed+1,'the clearing moved to set AIKit right');
await pause(200);
restore();
const storm={reads:field.reads-reads,recordReads,lists:lists().length-listed,replies:runs('replies').length};
await w.close();
other.kill();
console.log(JSON.stringify(storm));`);
  assert.equal(out.replies,0,'the ask is the other window\'s while it stands');
  assert.equal(out.lists,1,'the clearing moved sets AIKit\'s record right, once');
  assert.ok(out.reads<=1,`200 moves read the field ${out.reads} times: the setting right's once, and never a pass for the ask another window holds`);
  assert.ok(out.recordReads>=1&&out.recordReads<=2,`and look at its entry in the record once a step of the pace, not once a move (${out.recordReads} reads of the record)`);
});

// 601f rulings 2 and 5 (#953's review, findings 2 and 5): once the window that held an ask is gone, the next move of the field takes the ask
// up from its entry in the record alone, reading nothing of the field, with no timer of the window's due.
test('an ask another window held is taken up on the next move of the field once that window is gone, from its entry alone (601f rulings 2 and 5)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
const {spawn}=await import('node:child_process');
const other=spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{stdio:'ignore'});
const gone=new Promise((resolve)=>other.once('exit',resolve));
field.asks=[ask('ask:theirs')];
answer({['replies '+SENT]:[ok(replies([]))]});
writeFileSync(record,JSON.stringify({schema:'oi.shared-field.agent-relay/v1',asks:{'ask:theirs@1':{ask_ref:'ask:theirs',state:'sent',communique_ref:SENT,window:other.pid+':1',at:Date.now()}}}));
const w=open({pace:{first:20,most:80,retry:60000}});
w.saw(live);
await until(()=>field.reads>=1,'the window live');
await pause(300);
const whileStanding=runs('replies').length;
other.kill();
await gone;
const reads=field.reads;
w.saw(moved('field_presence'));
let read=true;
await until(()=>runs('replies').length>0,'its replies read on the move, the other window gone',4000).catch(()=>{read=false;});
const readsOnMove=field.reads-reads;
await w.close();
console.log(JSON.stringify({whileStanding,read,readsOnMove,window:JSON.parse(readFileSync(record,'utf8')).asks['ask:theirs@1'].window,me:process.pid}));`);
  assert.equal(out.whileStanding,0,'while the other window stands, the ask is its own');
  assert.ok(out.read,'once it is gone, a move of the field takes the ask up, with no timer due');
  assert.equal(out.readsOnMove,0,'from its entry alone: nothing of the field is read for it');
  assert.ok(out.window.startsWith(`${out.me}:`),`and this window reads it as its own (${out.window})`);
});

// 601g ruling 2 (#955's review, finding 2): the held look's step is the retry's base pace, never the slowing one, and a move inside it
// leaves one look at its end, never none. The window runs at the real pace (a retry of 30 s), on a clock of its own for its long waits: a
// timer of a second or more waits until the test moves that clock on (advance), so half an hour passes in moments. The other window stands
// 32 minutes, the retry's looks slowing to half an hour apart; a move then begins a step; the other window goes; a move 5 s into the step
// is looked at at the step's end, 25 s on, and the ask taken up then. Once nothing is held, an ask held anew is looked at a base step on,
// never at the half hour the first window's standing slowed the looks to.
test('a gone window\'s ask is taken up within a step of the retry\'s base pace after a move, however long that window stood, and an ask held anew is looked at at the base pace again (601g ruling 2)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
const {spawn}=await import('node:child_process');
const real=globalThis.setTimeout, realClear=globalThis.clearTimeout, waiting=new Map();
let now=0, made=0;
globalThis.setTimeout=(run,ms,...rest)=>{
  if(!(ms>=1000))return real(run,ms,...rest);
  const timer={virtual:++made,unref(){return timer;},ref(){return timer;},hasRef(){return true;}};
  waiting.set(timer,{at:now+ms,run:()=>run(...rest)});
  return timer;
};
globalThis.clearTimeout=(timer)=>{if(timer?.virtual)waiting.delete(timer);else realClear(timer);};
// the window's clock moved on by ms: each of its timers due on the way runs in turn, and what it began is let run
const advance=async(ms)=>{
  const end=now+ms;
  for(;;){
    const due=[...waiting].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
    if(!due)break;
    waiting.delete(due[0]);now=due[1].at;due[1].run();await pause(80);
  }
  now=end;
};
const stand=()=>{const other=spawn(process.execPath,['-e','setTimeout(()=>{},600000)'],{stdio:'ignore'});return {other,gone:new Promise((resolve)=>other.once('exit',resolve))};};
const first=stand();
field.asks=[ask('ask:theirs')];
answer({['replies '+SENT]:[ok(replies([]))]});
writeFileSync(record,JSON.stringify({schema:'oi.shared-field.agent-relay/v1',asks:{'ask:theirs@1':{ask_ref:'ask:theirs',state:'sent',communique_ref:SENT,window:first.other.pid+':1',at:Date.now()}}}));
const w=open({pace:{first:20,most:80,retry:30000}});
w.saw(live);
await until(()=>field.reads>=1,'the window live');
await pause(200);
await advance(32*60_000);
const passes=field.reads;
w.saw(moved('field_presence'));
await pause(200);
first.other.kill();
await first.gone;
await advance(5_000);
w.saw(moved('field_presence'));
await pause(200);
const atTheMove=runs('replies').length;
await advance(25_000);
let taken=true;
await until(()=>runs('replies').length>0,'taken up at the step\\'s end',8000).catch(()=>{taken=false;});
const window=JSON.parse(readFileSync(record,'utf8')).asks['ask:theirs@1'].window;
// an ask held anew by another window standing, once nothing was held: looked at again a base step on
const second=stand();
const kept=JSON.parse(readFileSync(record,'utf8'));
kept.asks['ask:anew@1']={ask_ref:'ask:anew',state:'sent',communique_ref:'aikit:communique:09anew',window:second.other.pid+':1',at:Date.now()};
writeFileSync(record,JSON.stringify(kept));
field.asks=[...field.asks,ask('ask:anew')];
const beforeAnew=field.reads;
w.saw(moved('star_agent_ask'));
await until(()=>field.reads>beforeAnew,'the ask held anew read');
await pause(200);
const heldAnew=field.reads;
await advance(30_000);
await pause(200);
const lookedAgain=field.reads-heldAnew;
await w.close();
second.other.kill();
console.log(JSON.stringify({passes,atTheMove,taken,window,me:process.pid,lookedAgain,anew:runs('replies').filter((r)=>r.argv[3]==='aikit:communique:09anew').length}));`);
  assert.ok(out.passes>=2&&out.passes<=8,`while the other window stood, the retry's looks slowed (${out.passes} reads of the field in 32 minutes)`);
  assert.equal(out.atTheMove,0,'a move inside the step is not looked at then');
  assert.ok(out.taken,'but at the step\'s end: the ask is taken up within a step of the base pace after the move');
  assert.ok(out.window.startsWith(`${out.me}:`),`and this window reads it as its own (${out.window})`);
  assert.equal(out.lookedAgain,1,'an ask held anew is looked at again a base step on');
  assert.equal(out.anew,0,'and is left to the window that holds it');
});

// 601g ruling 6 (#955's review, finding 7, m11): a move of the field while the asks' whole pass is under way leaves the asks another window
// holds to that pass, which looks at them itself: no look at their entries runs beside it (so the reconcile, which waits for the asks'
// pass, never runs while it is under way either).
test('a move while the asks\' pass is under way starts no look at the asks another window holds beside it (601g ruling 6)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
const {spawn}=await import('node:child_process');
const other=spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{stdio:'ignore'});
field.asks=[ask('ask:theirs')];
answer({['replies '+SENT]:[ok(replies([]))]});
writeFileSync(record,JSON.stringify({schema:'oi.shared-field.agent-relay/v1',asks:{'ask:theirs@1':{ask_ref:'ask:theirs',state:'sent',communique_ref:SENT,window:other.pid+':1',at:Date.now()}}}));
const w=open({pace:{first:20,most:80,retry:60000}});
w.saw(live);
await until(()=>field.reads>=1,'the window live, the ask left to the other window');
await pause(200);
let recordReads=0;
const restore=await patchFs({readFileSync:(real)=>(file,...rest)=>{if(file===record)recordReads++;return real(file,...rest);}});
field.slow={worlds:600};
const reads=field.reads;
w.saw(moved('star_agent_ask'));
await pause(150);
w.saw(moved('field_presence'));
const during=recordReads;
await until(()=>field.reads>reads,'the pass read the field');
await pause(300);
restore();
field.slow={};
await w.close();
other.kill();
console.log(JSON.stringify({during,recordReads,replies:runs('replies').length}));`);
  assert.equal(out.during,0,'a move while the pass reads the field looks at nothing beside it');
  assert.equal(out.recordReads,1,`the pass alone reads the record (${out.recordReads} reads)`);
  assert.equal(out.replies,0,'and the ask is the other window\'s still');
});

// #952's review, follow-up 1: a reconcile waits for every tell asked for before it ends, an act taken while it waits included (the loop in
// actsAllTold). Act 1, a Show, is told slowly; act 2, a Show of the part AIKit lists and the field does not show yet (its take slow), comes
// while the reconcile waits: the reconcile never takes that part back after it is told.
test('a second Show made while the reconcile waits for the first one\'s tell, its take slow, is not undone by the reconcile (#952\'s review, follow-up 1)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
const held=[{part_ref:'page:at-the-star',star_ref:'star:keepers',kind:'page',label:'At the star'},{part_ref:'page:old',star_ref:'star:keepers',kind:'page',label:'Old'}];
answer({['disclose --list '+KEEPER]:[listing(KEEPER,held)],disclose:[ok(disclosed(KEEPER,'shown'))],delays:{disclose:600}});
const w=open({reconcile:true,pace:{first:20,most:80,retry:60000}});
const s1={kind:'clearing-open',world_ref:KEEPER,part_ref:'page:a',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'A'}};
const a1=w.act(s1,()=>hold.request(s1));
await pause(60);
w.reconcile();
await pause(60);
field.slow={'clearing-open':900};
const s2={kind:'clearing-open',world_ref:KEEPER,part_ref:'page:old',star_ref:'star:keepers',audience:'star',shown:{kind:'page',label:'Old'}};
const a2=w.act(s2,()=>hold.request(s2));
await Promise.all([a1,a2]);
let n=-1; while(runs().length!==n){n=runs().length;await pause(1500);}
await w.close();
const part=(r)=>r.argv[r.argv.indexOf('--part')+1];
console.log(JSON.stringify({order:runs('disclose').map((r)=>r.argv.includes('--list')?'list':(r.argv.includes('--withdraw')?'withdraw ':'show ')+part(r))}));`);
  const shown=out.order.indexOf('show page:old');
  assert.ok(shown>=0,`the second Show is told (${out.order.join(', ')})`);
  assert.deepEqual(out.order.slice(shown+1).filter((step)=>step==='withdraw page:old'),[],`nothing takes back what was shown after it is told (${out.order.join(', ')})`);
});

// #952's review, follow-up 2: while the field is unread, a burst of moves leaves one look to come at a time (the `!lookLater` guard): no
// timer more is armed for each move, nor does the look to come slow once for each.
test('while the field is unread, a burst of moves leaves one look to come at a time (#952\'s review, follow-up 2)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
field.asks=[ask('ask:u')];
answer({send:[REFUSED,ok(sent(SENT))],['replies '+SENT]:[ok(replies([]))]});
const w=open({pace:{first:20,most:80,retry:300}});
w.saw(live);
await until(()=>said.some((words)=>words.startsWith('ask:u was not relayed to its agent, and is offered again later')),'refused');
field.refuseAct.worlds='The field is away.';
await pause(700);
const timers=()=>process.getActiveResourcesInfo().filter((kind)=>kind==='Timeout').length;
const t1=timers();
for(let i=0;i<20;i++){w.saw(moved('star_agent_ask'));await pause(5);}
await pause(20);
const t2=timers();
const r1=field.reads;
await pause(2000);
const r2=field.reads;
await w.close();
console.log(JSON.stringify({reads:r2-r1,armed:t2-t1}));`);
  assert.ok(out.armed<=1,`one look to come at a time, never one more for each move (${out.armed} timers more after 20 moves)`);
  assert.ok(out.reads<=12,`one look to come at a time (${out.reads} reads in 2 s)`);
});

// #952's review, follow-up 4: a reconcile that waited for a tell when the window closed reads nothing of the field after.
test('a reconcile waiting for a tell when the window closes reads nothing of the field after (#952\'s review, follow-up 4)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:'world:me',mine:true,linked:true}];
answer({disclose:[ok(disclosed('world:me','shown'))],delays:{disclose:1500},'disclose --list world:me':[listing('world:me',[])]});
const w=open({reconcile:true,toldWithinMs:100});
const show={kind:'clearing-open',world_ref:'world:me',part_ref:'page:new',audience:'field',shown:{kind:'page'}};
await w.act(show,()=>hold.request(show));
await until(()=>runs('disclose').length===1,'the Show being told');
w.reconcile();
await pause(150);
const before=field.reads;
await w.close();
console.log(JSON.stringify({reads:field.reads-before,lists:lists().length}));`);
  assert.equal(out.reads,0,'closed, the reconcile reads nothing of the field');
  assert.equal(out.lists,0,'and lists nothing');
});

// #952's review, follow-up 3: while what keeps a pass from looking at every ask lasts (here the field throws at every read), the look to
// come slows as a retry does, and the throw is said once; once the field reads again, the ask is offered, nothing moving.
test('while the field throws at every read, the look to come slows at the retry\'s pace and says the throw once (#952\'s review, follow-up 3)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
field.asks=[ask('ask:u')];
answer({send:[REFUSED,ok(sent(SENT))],['replies '+SENT]:[ok(replies([]))]});
const w=open({pace:{first:20,most:80,retry:100}});
w.saw(live);
await until(()=>said.some((words)=>words.startsWith('ask:u was not relayed to its agent, and is offered again later')),'refused');
field.throwOn.worlds='The field fell over.';
const before=field.asked.worlds??0;
await pause(3000);
const looks=(field.asked.worlds??0)-before;
delete field.throwOn.worlds;
let offered=true;
await until(()=>stateOf('ask:u@1')==='sent','offered once the field reads again, nothing moving',8000).catch(()=>{offered=false;});
await w.close();
console.log(JSON.stringify({looks,throws:said.filter((words)=>/The field fell over/.test(words)).length,offered}));`);
  assert.ok(out.looks>=3&&out.looks<=7,`the look to come slows while the field throws: ${out.looks} reads in 3 s`);
  assert.equal(out.throws,1,'and says the throw once');
  assert.ok(out.offered,'once the field reads again, the ask is offered');
});

// Review of #947 finding 8: a Show or a Withdraw answers within its time from its arrival (ANSWER_WITHIN_MS, inside the host's limit for
// one client call), however long the field's acts before it took: the wait for AIKit to be told is what remains of that time.
test('a Show answers within its time from its arrival, however long the acts before it took (601d; review of #947 finding 8)',()=>{
  const out=inWindow(`
field.worlds=[{world_ref:'world:me',mine:true}];
answer({disclose:[ok(disclosed('world:me','shown'))],delays:{disclose:4000}});
field.slow={'clearing-withdraw':900};
// its tell may take well past its answer's time, so a Show that waited for the tell from the act's take (the mutant told-from-take, about 3.9 s)
// is far past the upper bound, which leaves 1.4 s for a loaded runner (601f ruling 7)
const w=open({toldWithinMs:3000,answerWithinMs:1500});
const withdraw={kind:'clearing-withdraw',world_ref:'world:me',part_ref:'page:old'};
const show={kind:'clearing-open',world_ref:'world:me',part_ref:'page:new',audience:'field',shown:{kind:'page'}};
const first=w.act(withdraw,()=>hold.request(withdraw));
const arrived=Date.now();
const answered=await w.act(show,()=>hold.request(show));
const took=Date.now()-arrived;
await first;
await w.close();
console.log(JSON.stringify({took,aikit:answered.data.aikit}));`);
  assert.equal(out.aikit.told,null,'AIKit is still being told');
  assert.ok(out.took>=1400&&out.took<2900,`it answers at its time from its arrival, not after the acts before it and the whole wait (${out.took} ms)`);
});

// Review of #947 finding 9: what AIKit answered is what it did, though the window's close stopped the run after: an ask AIKit took as the
// window closed is kept as sent, never offered again by the next window as though nothing had begun.
test('an ask AIKit took as the window closed is kept as sent (601d; review of #947 finding 9)',()=>{
  const out=inWindow(`${KEEPER_FIELD}
field.asks=[ask('ask:closing')];
answer({send:[{thenHang:ok(sent(SENT))}],['replies '+SENT]:[ok(replies([]))]});
const w=open();
w.saw(live);
await until(()=>runEnds().some((end)=>end.key==='send'),'AIKit answered the send, and runs on');
await pause(100);
await w.close();
const kept=JSON.parse(readFileSync(record,'utf8')).asks['ask:closing@1']??null;
console.log(JSON.stringify({kept,said}));`);
  assert.equal(out.kept?.state,'sent','AIKit took it: it is kept as sent');
  assert.equal(out.kept?.communique_ref,'aikit:communique:01sent');
  assert.deepEqual(out.said.filter((words)=>/when the window closed/.test(words)),[],'never offered again as though nothing had begun');
});

// ── 601g's guards (DLW build ruling 2026-11-09, on 601g's PROPOSE for finding 6) ───────────────────────────────────────────────────────
// A window keeps running across `oi update`, so windows of two versions may keep one record and one lock. These run 80e32763's own
// field-lib (O-I main with #955 merged, the version before 601g; shared-field/fixtures/field-lib-80e32763.ts.txt, byte for byte) as the
// older window, against a 601g window's lock and record, on one state dir.
const OLD_LIB_BLOB='aa79dc8165cf12ed0827aa538de063936729d2be';
/** 80e32763's field-lib, written into dir with its four relative imports made absolute (so it reads this package's own bindings and
 * modules), an ES module as it is in its own package; its path. Its bytes are checked against git's blob id for 80e32763:shared-field/spacetimedb/field-lib.ts first. */
function oldLib(dir){
  const text=readFileSync(new URL('../fixtures/field-lib-80e32763.ts.txt',import.meta.url));
  assert.equal(createHash('sha1').update(`blob ${text.length}\0`).update(text).digest('hex'),OLD_LIB_BLOB,'the fixture is 80e32763\'s field-lib, byte for byte');
  const here=fileURLToPath(new URL('.',import.meta.url));
  let made=0;
  const out=text.toString('utf8').replace(/^(import .* from ')(\.\.?\/[^']+)(';)$/gm,(whole,head,spec,tail)=>{made+=1;return head+join(here,spec)+tail;});
  assert.equal(made,4,'its four relative imports, made absolute');
  const file=join(dir,'field-lib-80e32763.ts');
  writeFileSync(file,out);
  writeFileSync(join(dir,'package.json'),JSON.stringify({type:'module'}));
  return file;
}
/** A window's process as it runs on Linux, on any platform: process.platform reads linux, and /proc answers this boot's id and this
 * process's stat line (its starttime, field 22, 987654) through fs.readFileSync, the seam startOf reads a start on Linux by, whose line
 * the parse test reads with procStart. Run before field-lib is imported, so it reads its starts as it does on Linux. */
const AS_LINUX=`import fsAsLinux from 'node:fs';
import {syncBuiltinESMExports as syncAsLinux} from 'node:module';
Object.defineProperty(process,'platform',{value:'linux'});
const readAsLinux=fsAsLinux.readFileSync;
fsAsLinux.readFileSync=(file,...rest)=>{
  if(file==='/proc/sys/kernel/random/boot_id')return '6c1d2e3f-0a1b-4c2d-8e3f-405162738495\\n';
  const proc=/^\\/proc\\/(\\d+)\\/stat$/.exec(String(file));
  if(proc&&Number(proc[1])===process.pid)return process.pid+' (node) S 1 '+process.pid+' '+process.pid+' 0 -1 4194560 120 0 0 0 1 2 0 0 20 0 1 0 987654 12345678 300 18446744073709551615\\n';
  if(proc){const error=new Error('ENOENT: no such file or directory, open '+file);error.code='ENOENT';throw error;}
  return readAsLinux(file,...rest);
};
syncAsLinux();
`;
const PROC_NAMED='proc:6c1d2e3f-0a1b-4c2d-8e3f-405162738495:987654';
/** inWindow's script, with the field-lib at `lib` (601g's own unless named), imported once `preamble` has run. */
function windowScript(body,{lib='./field-lib.ts',preamble=''}={}){
  return `${preamble}
import {existsSync,mkdirSync,readdirSync,readFileSync,renameSync,symlinkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
let agentWindow;${AIKIT_SHAPES}${WINDOW}
(async()=>{({agentWindow}=await import(${JSON.stringify(lib)}));${body}})().then(()=>process.exit(0),(error)=>{console.error(error);process.exit(1);});`;
}
/** A script run as a process of its own, beside others: its exit code, the last line it printed, and what it said on stderr. */
function runScript(script,env){
  const here=fileURLToPath(new URL('.',import.meta.url));
  const child=spawn(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,env,stdio:['ignore','pipe','pipe']});
  let out='',err='';
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',(chunk)=>{out+=chunk;});child.stderr.on('data',(chunk)=>{err+=chunk;});
  const stop=setTimeout(()=>child.kill('SIGKILL'),120000);
  return new Promise((resolve)=>child.once('exit',(code)=>{clearTimeout(stop);resolve({code,last:out.trim().split('\n').at(-1)??'',err});}));
}
const fileMade=async(file,what,ended)=>{
  let gone=null;
  ended.then((ran)=>{gone=ran;});
  for(const end=Date.now()+60000;!existsSync(file);){
    if(gone)throw new Error(`${what}: it ended first (${gone.code}): ${gone.err}`);
    if(Date.now()>end)throw new Error(`never: ${what}`);
    await new Promise((resolve)=>setTimeout(resolve,10));
  }
};

// Guard a: a window of the version before 601g never takes over a lock a 601g window holds. The 601g window holds the record's lock two
// seconds (a lock that names no one is stale only past LOCK_EMPTY_MS, 5 s); the older window asks for it meanwhile, again as each ask
// gives up, and enters only once the 601g window has let it go. As on macOS, and as on Linux (AS_LINUX), where the 601g window names its
// start from /proc. (With the nonce on a line of its own, as at 80e32763, the older window reads the /proc start by ps on Linux, judges
// the live holder gone, and enters while the lock is held.)
test('a window of the version before 601g never takes over a lock a 601g window holds, on macOS or on Linux (601g guard a)',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'oi-older-lock-'));
  try{
    const old=oldLib(dir), out={};
    for(const as of ['native','linux']){
      const at=join(dir,as), record=join(at,'agent-relay.json'), held=join(at,'held'), lettingGo=join(at,'letting-go');
      mkdirSync(at);
      const holding=runScript(`${as==='linux'?AS_LINUX:''}
import {readFileSync,writeFileSync} from 'node:fs';
(async()=>{
const {underLock}=await import('./field-lib.ts');
underLock(${JSON.stringify(record)},()=>{
  writeFileSync(${JSON.stringify(held)},readFileSync(${JSON.stringify(record+'.lock')},'utf8'));
  for(const end=Date.now()+2000;Date.now()<end;)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);
  writeFileSync(${JSON.stringify(lettingGo)},'');
});
console.log(JSON.stringify({held:true}));
})().catch((error)=>{console.error(error);process.exit(1);});`,process.env);
      await fileMade(held,`the 601g window holding the lock (${as})`,holding);
      const taking=runScript(`import {existsSync} from 'node:fs';
(async()=>{
const {underLock}=await import(${JSON.stringify(old)});
let entered=null, refused=0, why=null;
for(let n=0;n<30&&!entered;n++){
  try{underLock(${JSON.stringify(record)},()=>{entered={whileHeld:!existsSync(${JSON.stringify(lettingGo)})};});}catch(error){refused+=1;why=String(error?.message??error);}
}
console.log(JSON.stringify({entered,refused,why}));
})().catch((error)=>{console.error(error);process.exit(1);});`,process.env);
      const [holder,taker]=await Promise.all([holding,taking]);
      assert.equal(holder.code,0,holder.err);
      assert.equal(taker.code,0,taker.err);
      out[as]={lock:readFileSync(held,'utf8'),...JSON.parse(taker.last)};
    }
    for(const as of ['native','linux']){
      assert.deepEqual(out[as].entered,{whileHeld:false},`the older window enters only once the 601g window has let the lock go (${as}; ${out[as].refused} asks given up first, the last for: ${out[as].why})`);
    }
    for(const as of ['native','linux'])assert.match(out[as].lock,/^\d+ [0-9a-f]{24}\n\S/,`the 601g window's lock names it <pid> <nonce>, then its start (${as}: ${JSON.stringify(out[as].lock)})`);
    assert.ok(out.linux.lock.endsWith(`\n${PROC_NAMED}`),`on Linux the 601g window's lock names its start from /proc (${JSON.stringify(out.linux.lock)})`);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

// Guard b: a window of the version before 601g never judges a live 601g window gone by its name in the record. The 601g window relays an
// ask, its entry naming it, and reads on; the older window keeps the same record over the same field, and on going live and on two moves
// of the field leaves that ask to the 601g window. On macOS the 601g window names its start as ps says it (`@`); on Linux (AS_LINUX), from
// /proc, after `#`, which the older window does not read as a start, so it goes by the pid alone. (With `@` before a /proc start, the older
// window reads that start by ps, judges the 601g window gone, and takes the ask over.)
test('a window of the version before 601g never judges a live 601g window gone by its name in the record, on macOS or on Linux (601g guard b)',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'oi-older-name-'));
  try{
    const old=oldLib(dir), out={};
    for(const as of ['native','linux']){
      const fake=join(dir,as);
      mkdirSync(fake);
      writeFileSync(join(fake,'aikit'),FAKE_AIKIT,{mode:0o755});
      assert.equal(spawnSync(join(fake,'aikit'),['--warm'],{timeout:60000}).status,0,'the fake AIKit runs');
      const env={...process.env,OI_AIKIT_PROGRAM:join(fake,'aikit'),FAKE_AIKIT_DIR:fake};
      const newer=runScript(windowScript(`${KEEPER_FIELD}
field.asks=[ask('ask:held')];
answer({send:[ok(sent(SENT))],['replies '+SENT]:[ok(replies([]))]});
const w=open({pace:{first:20,most:200,retry:60000}});
w.saw(live);
await until(()=>stateOf('ask:held@1')==='sent','relayed by the 601g window');
writeFileSync(join(FAKE,'named'),JSON.parse(readFileSync(record,'utf8')).asks['ask:held@1'].window);
await until(()=>existsSync(join(FAKE,'older-done')),'the older window done',60000);
const entry=JSON.parse(readFileSync(record,'utf8')).asks['ask:held@1'];
await w.close();
console.log(JSON.stringify({window:entry.window,state:entry.state}));`,{preamble:as==='linux'?AS_LINUX:''}),env);
      await fileMade(join(fake,'named'),`the 601g window naming itself in the record (${as})`,newer);
      const older=await runScript(windowScript(`${KEEPER_FIELD}
field.asks=[ask('ask:held')];
const w=open({pace:{first:20,most:80,retry:60000}});
try{
  w.saw(live);
  await until(()=>field.reads>=1,"the older window pass");
  await pause(400);
  w.saw(moved('field_presence'));
  await pause(400);
  w.saw(moved('star_agent_ask'));
  await until(()=>field.reads>=2,'its pass on the move');
  await pause(400);
}finally{await w.close();writeFileSync(join(FAKE,'older-done'),'');}
const entry=JSON.parse(readFileSync(record,'utf8')).asks['ask:held@1'];
console.log(JSON.stringify({window:entry.window,state:entry.state,said}));`,{lib:old}),env);
      const newest=await newer;
      assert.equal(older.code,0,older.err);
      assert.equal(newest.code,0,newest.err);
      out[as]={named:readFileSync(join(fake,'named'),'utf8'),older:JSON.parse(older.last),newer:JSON.parse(newest.last)};
    }
    for(const as of ['native','linux']){
      const {named,older,newer}=out[as];
      assert.deepEqual([older.window,older.state],[named,'sent'],`the older window leaves the ask to the 601g window that holds it (${as}: ${named})`);
      assert.deepEqual([newer.window,newer.state],[named,'sent'],`and it stands as the 601g window claimed it (${as})`);
    }
    assert.match(out.native.named,process.platform==='linux'?/^\d+:1#proc:[^@#]+:\d+$/:/^\d+:1@[A-Z][a-z]{2} /,`the 601g window's own name, as ps or /proc gives its start here (${out.native.named})`);
    assert.equal(out.linux.named.replace(/^\d+:/,''),`1#${PROC_NAMED}`,'on Linux the 601g window names its /proc start after #');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
