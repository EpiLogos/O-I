import test from 'node:test';
import assert from 'node:assert/strict';
import {readableSessionTitle} from '../src/encounter/sessionTitle.ts';
import {modelChoices,modelDisplayName,modelSelectionReason} from '../src/agent/chat/modelPresentation.ts';
import {harnessChip} from '../src/agent/chat/harness.ts';

test('native session locators cannot become conversation titles',()=>{
 assert.equal(readableSessionTitle('agent-session/oi-chat-1789939200000','O-I'),'O-I conversation');
 assert.equal(readableSessionTitle('session-space/desk','O-I'),'O-I conversation');
 assert.equal(readableSessionTitle('aikit://agent-session/x'), 'Conversation');
 assert.equal(readableSessionTitle('  Research next steps  ','O-I'),'Research next steps');
 assert.equal(readableSessionTitle(undefined), 'Conversation');
});

// be2j ruling 2 (DLW build ruling 2026-11-09): a conversation's title is someone's words (an agent's purpose, a space's label): it is shown
// on one line, plain (shared/plainText.ts oneLineText), so no bidi control reorders the row and nothing invisible stands in it.
test('a conversation title is shown on one line, plain: no bidi control, control or invisible character stands in it (be2j)',async()=>{
 assert.equal(readableSessionTitle('Plan \u202ethe\u202c\u200b launch\n\u3164notes','O-I'),'Plan the launch notes');
 assert.equal(readableSessionTitle('\u200b\u2066','O\u202e-I'),'O-I conversation','a title with nothing visible left gives way to its place, plain');
 const {register}=await import('node:module');
 register('./ts-transpile-hook.mjs',import.meta.url);globalThis.__CRADLE_WALK__=false;
 const {conversationsFromReading}=await import('../src/workspace/left/ChatRows.tsx');
 const rows=conversationsFromReading([{definition:{id:'space-a'},label:'Desk\u202e work',agent_sessions:{'agent-session/a':{purpose:'Fix\u2066 it\u2069'},'agent-session/b':{purpose:'\u200b'}}}],'O-I');
 assert.deepEqual(rows.map(row=>row.title),['Fix it','Desk work · Conversation 2']);
});

// be2k ruling 1 (DLW build ruling 2026-11-10): the permission card is where a person decides to run a command. The command, where it runs,
// the path and the agent's name are the harness's or the agent's words, shown plain (shared/plainText.ts); a command keeps its line breaks;
// Show raw keeps the request verbatim and writes each character of the set as its escape.
test('the permission card shows the command, its place, the path and the agent plain; a command keeps its lines; Show raw writes the set as escapes (be2k)',async()=>{
 const {register}=await import('node:module');
 register('./ts-transpile-hook.mjs',import.meta.url);globalThis.__CRADLE_WALK__=false;
 const {describePermission,PermissionCard}=await import('../src/agent/chat/PermissionCard.tsx');
 const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 const request={native_request_id:'r1',tool_call:{kind:'execute',title:'Run',rawInput:{command:'rm -rf ./build\u202e\nls \u200bdocs',cwd:'/srv/\u2066app\u2069'},locations:[]},
  choices:[{option_id:'a',kind:'allow_once',label:'Allow\u202e once'},{option_id:'p',label:'Yes, in this \u2066project\u200b'},{option_id:'r',kind:'reject_once',label:'Reject'}]};
 assert.deepEqual(describePermission(request),{wants:'wants to run a command',target:'rm -rf ./build\nls docs',where:'/srv/app',full:undefined,
  differs:'The command and the folder hold characters that are not shown here. Show raw has them as they were sent.'});
 assert.deepEqual(describePermission({native_request_id:'r2',tool_call:{kind:'edit',title:'Edit',locations:[{path:'/home/x/no\u202etes/pla\u200bn.md'}],rawInput:{}},choices:[]}),
  {wants:'wants to edit a file',target:'plan.md',where:'x/notes',full:'/home/x/notes/plan.md',differs:'The path holds characters that are not shown here. Show raw has it as it was sent.'});
 const markup=renderToStaticMarkup(createElement(PermissionCard,{request,agentName:'Guar\u202edian',onAnswer(){}})).replace(/<!-- -->/g,'');
 assert.ok(!/[\u202a-\u202e\u2066-\u2069\u200b]/.test(markup),'nothing of the set is drawn');
 assert.match(markup,/<strong>Guardian wants to run a command<\/strong>/);
 assert.match(markup,/rm -rf \.\/build\nls docs/,'the command keeps its line break');
 assert.match(markup,/title="Allow once"[^>]*>This time<\/button>/,'a scope the harness names keeps its label plain as its title');
 assert.match(markup,/>Yes, in this project<\/button>/,'a scope without a kind is drawn by its label, plain');
 assert.match(markup,/Allow\\u202e once/,'Show raw writes the override as its escape');
});

test('model choices preserve native selection IDs while rendering only disclosed names',()=>{
 const options=modelChoices([{modelId:'provider/model',name:'GPT 5.4'},{modelId:'provider/model',name:'GPT 5.4'},{modelId:'private:wire/123',name:'harness'}]);
 assert.deepEqual(options,[{modelId:'provider/model',name:'GPT 5.4'},{modelId:'private:wire/123',name:'Model name unavailable'}]);
 assert.equal(modelDisplayName('model:private-route'),undefined);
 assert.equal(modelDisplayName('harness'),undefined);
});

test('a disabled selector preserves the native owner reason even with no model observation',()=>{
 const reading={agent_session:'a',native_session_id:'s',standing:'native',model_observation:null,model_controls:{model_selection:false,reasoning_effort_selection:false,reason:'This harness pins its model at launch.'}};
 assert.equal(modelSelectionReason({phase:'ready',reading}),'This harness pins its model at launch.');
 assert.equal(modelSelectionReason({phase:'ready',reading:{...reading,model_controls:{model_selection:true,reasoning_effort_selection:false}}},true),'The model can change when this turn or update finishes.');
});

test('unknown harness protocols do not become visible transport strings',()=>{
 assert.equal(harnessChip({id:'native-wire/123',label:'Transport internals',protocol:'private-rpc-v5'}),'Harness');
 assert.equal(harnessChip({id:'pi',label:'Session',protocol:'pi-rpc'}),'Pi');
});

// ── be2l (DLW build ruling 2026-11-10): the follow-ups of the review of be2k ─────────────────────────────────────────────────────────
const consent2l=(rawInput,choices=[{option_id:'a',kind:'allow_once',label:'Allow once'},{option_id:'r',kind:'reject_once',label:'Reject'}])=>
 ({native_request_id:'r1',tool_call:{kind:'execute',title:'Run',rawInput,locations:[]},choices});
const card2l=async()=>{
 const {register}=await import('node:module');
 register('./ts-transpile-hook.mjs',import.meta.url);globalThis.__CRADLE_WALK__=false;
 const {createElement}=await import('react');
 const {renderToStaticMarkup}=await import('react-dom/server');
 const card=await import('../src/agent/chat/PermissionCard.tsx');
 return {card,drawn:(request,agentName='Guardian')=>renderToStaticMarkup(createElement(card.PermissionCard,{request,agentName,onAnswer(){}})).replace(/<!-- -->/g,'')};
};

// be2l rulings 1 and 4: the summary an answer leaves is made of the words the card showed. A choice the harness labels itself goes into
// "Allowed" plain; an agent whose name shows nothing is "The agent".
test('an answer\'s summary carries the chosen label plain, and an agent with nothing visible in its name is The agent (be2l rulings 1, 4)',async()=>{
 const {card,drawn}=await card2l();
 const request=consent2l({command:'rm -rf ./build',cwd:'/srv/app'},[{option_id:'p',label:'Yes, in this \u{2066}project\u{200b}'},{option_id:'a',kind:'allow_once',label:'Allow once'},{option_id:'r',kind:'reject_once',label:'Reject'}]);
 const find=(node,is)=>{
  if(Array.isArray(node)){for(const child of node){const found=find(child,is);if(found)return found;}return undefined;}
  if(!node||typeof node!=='object')return undefined;
  return is(node)?node:find(node.props?.children,is);
 };
 const answers=[];
 const tree=card.PermissionCardView({request,agentName:'Guardian',scope:'p',setScope(){},onAnswer:(decision,summary)=>answers.push([decision,summary])});
 find(tree,node=>node.props?.className==='chat-permission-allow').props.onClick();
 find(tree,node=>String(node.props?.className).includes('chat-permission-refuse')).props.onClick();
 assert.deepEqual(answers,[[{outcome:'selected',option_id:'p'},'Allowed · Yes, in this project · rm -rf ./build'],[{outcome:'selected',option_id:'r'},'Refused · rm -rf ./build']]);
 assert.ok(drawn(request,'\u{200b}\u{202e}').includes('<strong>The agent wants to run a command</strong>'));
});

// be2l ruling 5: where the card cannot show a command, a folder or a path as it was sent, it says so in one plain line and opens Show
// raw, which has the request with its escapes. What shows nothing reads "nothing visible"; Allow is still offered. A plain request has
// no such line and Show raw stays closed.
test('the permission card says when what it shows is not what was sent and opens Show raw; a plain request has no such line (be2l ruling 5)',async()=>{
 const {card,drawn}=await card2l();
 const said=which=>`The ${which} holds characters that are not shown here. Show raw has it as it was sent.`;
 const both='The command and the folder hold characters that are not shown here. Show raw has them as they were sent.';
 const open='<details class="chat-permission-raw" open="">',closed='<details class="chat-permission-raw"><summary>';
 const laced=consent2l({command:'rm -rf ./build\u{202e}\nls',cwd:'/srv/app'});
 assert.deepEqual(card.describePermission(laced),{wants:'wants to run a command',target:'rm -rf ./build\nls',where:'/srv/app',full:undefined,differs:said('command')});
 assert.ok(drawn(laced).includes(`<p class="chat-permission-differs" role="note">${said('command')}</p>`),drawn(laced));
 assert.ok(drawn(laced).includes(open),drawn(laced));
 const folder=consent2l({command:'ls',cwd:'/srv/\u{2066}app\u{2069}'});
 assert.equal(card.describePermission(folder).differs,said('folder'));
 assert.ok(drawn(folder).includes(open));
 assert.equal(card.describePermission(consent2l({command:'ls\u{200b}',cwd:'/srv/app\u{200b}'})).differs,both);
 const path={native_request_id:'r2',tool_call:{kind:'edit',title:'Edit',rawInput:{},locations:[{path:'/home/x/notes/plan\u{202e}.md'}]},choices:laced.choices};
 assert.deepEqual(card.describePermission(path),{wants:'wants to edit a file',target:'plan.md',where:'x/notes',full:'/home/x/notes/plan.md',differs:said('path')});
 const blank=consent2l({command:'\u{200b}\u{202e}',cwd:'\u{3164}'});
 assert.deepEqual(card.describePermission(blank),{wants:'wants to run a command',target:'nothing visible',where:'nothing visible',full:undefined,differs:both});
 const unseen=drawn(blank);
 assert.ok(unseen.includes('<code>nothing visible</code><span> in nothing visible</span>'),unseen);
 assert.ok(unseen.includes(open)&&unseen.includes('<button type="button" class="chat-permission-allow">Allow</button>'),unseen);
 const plain=consent2l({command:' ls -la\n\tdocs\n',cwd:'/srv/my app'});
 assert.deepEqual(card.describePermission(plain),{wants:'wants to run a command',target:'ls -la\n\tdocs',where:'/srv/my app',full:undefined,differs:undefined});
 assert.ok(!drawn(plain).includes('chat-permission-differs')&&drawn(plain).includes(closed),drawn(plain));
 for(const request of [laced,folder,blank,path])assert.ok(!/[\p{Cf}\u{2028}\u{2029}\u{3164}]/u.test(drawn(request)),JSON.stringify(drawn(request)));
});
