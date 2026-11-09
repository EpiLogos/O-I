import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

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

// The AIKit gateway seam of a world's agent (SF10): the asked world's window relays the ask as `aikit gateway send`, addressed as it
// was asked, carrying as its only sources what that world shows at the star (or to the field or the public); the reply AIKit verified
// from the Position the ask reached becomes the answer, as that agent.
test('an ask of a world\'s agent relays through AIKit\'s gateway as it was addressed, with what its world shows there as its only sources, and a verified reply answers as that agent',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const script=`import {agentAskRelay,agentAnswerRequest} from './field-lib.ts';
const A='project:Keeper', B='world:asker', star='star:keepers', other='star:elsewhere';
const ask=(by,address)=>({ask_ref:'ask:one',star_ref:star,world_ref:B,to_world_ref:A,by,address,words:'What does the fourth plate show?'});
const clearings=[
  {world_ref:A,part_ref:'page:at-the-star',star_ref:star,audience:'star',shown:{kind:'page',label:'At the star'}},
  {world_ref:A,part_ref:'page:to-the-field',star_ref:null,audience:'field',shown:{kind:'page',label:'To the field'}},
  {world_ref:A,part_ref:'page:at-another-star',star_ref:other,audience:'star',shown:{kind:'page',label:'Elsewhere'}},
  {world_ref:B,part_ref:'page:the-askers',star_ref:star,audience:'star',shown:{kind:'page',label:'Not A\\'s'}}];
const who={schema:'aikit.population-reading/v1',positions:[
  {position_ref:'central:position:project:Keeper:librarian',handle:'@Thoth',occupancy:{state:'occupied',generation_ref:'actuation:generation:g7'}},
  {position_ref:'central:position:project:Keeper:scribe',handle:'@Seshat',occupancy:{state:'vacant'}}]};
const reply=(more)=>({schema:'aikit.communique/v1',attribution:'verified',from_position_ref:'central:position:project:Keeper:librarian',from_generation_ref:'actuation:generation:g7',
  reply_to:'communique:sent',body:JSON.stringify({schema:'oi.world-agent-answer/v1',words:'The circle opens there.',cites:[{part_ref:'page:at-the-star',star_ref:star}]}),...more});
console.log(JSON.stringify({
  role:agentAskRelay(ask('role','librarian'),clearings,who), name:agentAskRelay(ask('name','Thoth'),clearings), instance:agentAskRelay(ask('instance','actuation:generation:g7'),clearings,who),
  gone:agentAskRelay(ask('instance','actuation:generation:g1'),clearings,who),
  answer:agentAnswerRequest(ask('role','librarian'),reply({}),who), unverified:agentAnswerRequest(ask('role','librarian'),reply({attribution:'unknown'}),who),
  elsewhere:agentAnswerRequest(ask('role','librarian'),reply({from_position_ref:'central:position:project:Other:librarian'}),who),
  prose:agentAnswerRequest(ask('role','librarian'),reply({body:'Just words.'}),who),
  offered:agentAnswerRequest(ask('role','librarian'),reply({body:JSON.stringify({schema:'oi.world-agent-answer/v1',words:'Take the task.',cites:[],offer_ref:'offer:mine'})}),who)}));`;
  const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const out=JSON.parse(result.stdout.trim().split('\n').at(-1));
  const to=(relay)=>relay.argv.slice(0,relay.argv.indexOf('--body'));
  assert.deepEqual(to(out.role),['aikit','gateway','send','--to','central:position:project:Keeper:librarian'],'by its role: its world\'s Position');
  assert.deepEqual(to(out.name),['aikit','gateway','send','--to','@Thoth'],'by its name: its handle');
  assert.deepEqual(to(out.instance),['aikit','gateway','send','--to','central:position:project:Keeper:librarian','--instance','actuation:generation:g7'],'the exact instance running, at the Position it occupies');
  assert.match(out.gone.refused,/not running/,'an instance not running is not sent to');
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
// `aikit.communique-replies/v1`), never from an inbox. Only a reply to that ask, on that line, answers it; a reading that could not reach
// where the ask was relayed is said, never taken for no answer.
test('the window reads its agent\'s answers by the ref it holds, only a reply on the line back to that ask answers, and an unread workcell is said',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const script=`import {agentRepliesRelay,agentRepliesAnswers} from './field-lib.ts';
const A='project:Keeper', star='star:keepers', sent='aikit:communique:01sent', line='aikit:sender-of:'+sent;
const ask={ask_ref:'ask:one',star_ref:star,world_ref:'world:asker',to_world_ref:A,by:'role',address:'librarian',words:'Which plate?'};
const who={schema:'aikit.population-reading/v1',positions:[{position_ref:'central:position:project:Keeper:librarian',handle:'@Thoth',occupancy:{state:'occupied',generation_ref:'actuation:generation:g7'}}]};
const reply=(more)=>({schema:'aikit.communique/v1',attribution:'verified',from_position_ref:'central:position:project:Keeper:librarian',from_generation_ref:'actuation:generation:g7',
  to_position_ref:line,reply_to:sent,body:JSON.stringify({schema:'oi.world-agent-answer/v1',words:'The second plate.',cites:[{part_ref:'page:at-the-star',star_ref:star}]}),...more});
const reading=(replies,more)=>({schema:'aikit.communique-replies/v1',communique_ref:sent,to_position_ref:'central:position:project:Keeper:librarian',reply_line:line,
  replies,relayed:false,complete:true,remote_replies:null,...more});
console.log(JSON.stringify({
  relay:agentRepliesRelay({communique:{communique_ref:sent}}), nothing:agentRepliesRelay({}),
  read:agentRepliesAnswers(ask,sent,reading([reply({})]),who),
  stray:agentRepliesAnswers(ask,sent,reading([reply({reply_to:'aikit:communique:other'}),reply({to_position_ref:'central:position:project:Keeper:librarian'})]),who),
  other:agentRepliesAnswers(ask,sent,reading([],{communique_ref:'aikit:communique:other'}),who),
  shape:agentRepliesAnswers(ask,sent,{schema:'aikit.communique-inbox/v1'},who),
  unread:agentRepliesAnswers(ask,sent,reading([],{relayed:true,complete:false,remote_replies:{state:'unreadable',code:'gateway.remote_replies_unreadable',error:'connect ECONNREFUSED 127.0.0.1:7'}}),who)}));`;
  const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const out=JSON.parse(result.stdout.trim().split('\n').at(-1));
  assert.deepEqual(out.relay,{argv:['aikit','gateway','replies','aikit:communique:01sent','--json'],communique_ref:'aikit:communique:01sent'},'read by the ref the send answered');
  assert.match(out.nothing.refused,/ref/,'no ref, nothing to read');
  assert.equal(out.read.complete,true);
  assert.deepEqual(out.read.refused,[]);
  assert.deepEqual(out.read.answers.map((a)=>a.request),[{kind:'world-agent-answer',ask_ref:'ask:one',world_ref:'project:Keeper',agent:{name:'Thoth',role:'librarian',instance:'actuation:generation:g7'},
    words:'The second plate.',cites:[{part_ref:'page:at-the-star',star_ref:'star:keepers'}]}],'a verified reply on the line back answers as that agent');
  assert.deepEqual(out.read.answers.map((a)=>a.declined),[false],'an answer is no decline');
  assert.deepEqual(out.stray.answers,[],'a reply to something else, or one not on the line back, answers nothing');
  assert.equal(out.stray.refused.length,2);
  out.stray.refused.forEach((words)=>assert.match(words,/not a reply to this ask/));
  assert.match(out.other.refused,/another ask/,'a reading of another ref is not this ask\'s');
  assert.match(out.shape.refused,/aikit\.communique-replies\/v1/);
  assert.equal(out.unread.complete,false,'where it was relayed could not be read: not "no answer"');
  assert.match(out.unread.unread,/could not be read/);
  assert.doesNotMatch(out.unread.unread,/ECONNREFUSED|127\.0\.0\.1/,'in plain words, without the transport\'s raw cause');
});

// What AIKit answers from (ai-kit #601; DLW build ruling 2026-11-09): only its own record of what the world shows at the star, which the
// person's window writes on each Show and Withdraw (`aikit gateway disclose`), never the ask's `sources`. A decline is AIKit's one plain
// answer, carried as the answer it is so the asker never waits on it; while nothing has answered, AIKit's words for the wait are read.
test('the window tells AIKit what its world shows on each Show and Withdraw, carries a decline as the answer it is, and reads AIKit\'s words for the wait',()=>{
  const here=fileURLToPath(new URL('.',import.meta.url));
  const script=`import {agentDiscloseRelay,agentRepliesAnswers} from './field-lib.ts';
const A='project:Keeper', star='star:keepers', sent='aikit:communique:01sent', line='aikit:sender-of:'+sent;
const ask={ask_ref:'ask:one',star_ref:star,world_ref:'world:asker',to_world_ref:A,by:'role',address:'librarian',words:'Which plate?'};
const who={schema:'aikit.population-reading/v1',positions:[{position_ref:'central:position:project:Keeper:librarian',handle:'@Thoth',occupancy:{state:'occupied',generation_ref:'actuation:generation:g7'}}]};
const declined=JSON.stringify({schema:'oi.world-agent-answer/v1',words:"The world's agent couldn't answer this from what the world shows here.",cites:[],declined:true});
const reply=(body)=>({schema:'aikit.communique/v1',attribution:'verified',from_position_ref:'central:position:project:Keeper:librarian',from_generation_ref:'actuation:generation:g7',
  to_position_ref:line,reply_to:sent,body});
const reading=(replies,more)=>({schema:'aikit.communique-replies/v1',communique_ref:sent,to_position_ref:'central:position:project:Keeper:librarian',reply_line:line,
  replies,relayed:false,complete:true,remote_replies:null,waiting:null,...more});
const open=(more)=>({kind:'clearing-open',world_ref:'world:me',part_ref:'day-entry:0123456789abcdef',audience:'star',star_ref:star,shown:{kind:'page',label:'- the second plate'},...more});
console.log(JSON.stringify({
  star:agentDiscloseRelay(open({})),
  field:agentDiscloseRelay(open({audience:'field',star_ref:undefined})), public:agentDiscloseRelay(open({audience:'public',star_ref:undefined})),
  starless:agentDiscloseRelay(open({star_ref:undefined})), fieldAtStar:agentDiscloseRelay(open({audience:'field'})), nobody:agentDiscloseRelay(open({audience:'nobody'})),
  spaced:agentDiscloseRelay(open({part_ref:'day entry'})), starSpaced:agentDiscloseRelay(open({star_ref:'star:a b'})),
  withdrawStar:agentDiscloseRelay({kind:'clearing-withdraw',world_ref:'world:me',part_ref:'place:the-study',star_ref:star}),
  withdrawField:agentDiscloseRelay({kind:'clearing-withdraw',world_ref:'world:me',part_ref:'place:the-study'}),
  other:agentDiscloseRelay({kind:'world-put',world_ref:'world:me'}),
  declined:agentRepliesAnswers(ask,sent,reading([reply(declined)]),who),
  waiting:agentRepliesAnswers(ask,sent,reading([],{waiting:"Waiting for the world's agent."}),who),
  none:agentRepliesAnswers(ask,sent,reading([]),who),
  ended:agentRepliesAnswers(ask,sent,reading([],{declined:{words:"The world's agent couldn't answer this from what the world shows here.",
    basis:'the ask ended: declined: it waited 24 hours, and no occupant of central:position:project:Keeper:librarian answered it'}}),who),
  endedAnswered:agentRepliesAnswers(ask,sent,reading([reply(declined)],{declined:{words:'stale',basis:'stale'}}),who)}));`;
  const result=spawnSync(join(here,'node_modules','.bin','tsx'),['-e',script],{cwd:here,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  const out=JSON.parse(result.stdout.trim().split('\n').at(-1));
  const head=['aikit','gateway','disclose','--world','world:me','--part','day-entry:0123456789abcdef'];
  assert.deepEqual(out.star,{argv:[...head,'--star','star:keepers','--kind','page','--label=- the second plate','--json']},'shown at a star: recorded at that star, its label one argument');
  assert.deepEqual(out.field,{argv:[...head,'--field','--kind','page','--label=- the second plate','--json']},'shown to the field: at every star');
  assert.deepEqual(out.public,out.field,'shown to the public: so to the field too');
  for (const key of ['starless','fieldAtStar','nobody']) assert.match(out[key].refused,/one star, or to the field or the public/,key);
  assert.match(out.spaced.refused,/its own ref/);
  assert.match(out.starSpaced.refused,/star is told to AIKit by its own ref/);
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
  assert.equal(out.none.waiting,null);
  assert.equal(out.none.ended,null,'an ask with nothing yet is not ended');
  // An ask AIKit ended with no reply sent (ai-kit #602 be2c; DLW build ruling 2026-11-09: a day waited with no occupant to answer it)
  // reads declined: its words are carried, so the window never waits on it, and no answer is made up for an agent that said nothing.
  assert.equal(out.ended.ended,"The world's agent couldn't answer this from what the world shows here.",'an ask ended unanswered reads declined');
  assert.deepEqual(out.ended.answers,[],'no answer is made up for it');
  assert.equal(out.ended.waiting,null);
  assert.equal(out.endedAnswered.ended,null,'a reply sent is the answer, never the ended words beside it');
  assert.equal(out.endedAnswered.answers.length,1);
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
