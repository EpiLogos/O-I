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

// ── be2n (DLW build ruling 2026-11-11): the follow-ups of the review of be2l (O-I #967) ─────────────────────────────────────────────
const said2n=which=>`The ${which} holds characters that are not shown here. Show raw has it as it was sent.`;
const both2n='The command and the folder hold characters that are not shown here. Show raw has them as they were sent.';
const open2n='<details class="chat-permission-raw" open="">',closed2n='<details class="chat-permission-raw"><summary>';

// be2n ruling 2: blank means it shows nothing, and is judged by plain white space alone. A command or a folder made only of U+FEFF, a
// line or paragraph separator or a no-break space was sent: it is a command, it reads "nothing visible" and it gets the line. One of
// plain white space only is no command. A no-break or ideographic space at an end is not cut before the comparison.
test('a command or folder of only U+FEFF, a separator or a no-break space reads nothing visible and gets the line; plain white space alone is none (be2n ruling 2)',async()=>{
 const {card,drawn}=await card2l();
 for(const blank of ['\u{feff}','\u{2028}','\u{2029}','\u{a0}',' \u{feff}\u{a0}\n\u{2028} ']){
  const request=consent2l({command:blank,cwd:blank});
  assert.deepEqual(card.describePermission(request),{wants:'wants to run a command',target:'nothing visible',where:'nothing visible',full:undefined,differs:both2n},JSON.stringify(blank));
  const markup=drawn(request);
  assert.ok(markup.includes('<code>nothing visible</code><span> in nothing visible</span>')&&markup.includes(open2n),markup);
  assert.ok(!/[\p{Cf}\u{2028}\u{2029}]/u.test(markup),JSON.stringify(markup));
 }
 assert.deepEqual(card.describePermission(consent2l({command:' \t\r\n',cwd:'  '})),{wants:'wants to run a command',target:'Run',where:undefined,full:undefined,differs:undefined},
  'plain white space alone is no command and no folder: the title stands, with no line');
 assert.equal(card.describePermission(consent2l({command:'ls\u{a0}',cwd:'/srv/app'})).differs,said2n('command'),'a no-break space at the end is not shown, and the line says so');
 assert.equal(card.describePermission(consent2l({command:'ls',cwd:'/srv/app\u{3000}'})).differs,said2n('folder'),'an ideographic space at the end of the folder likewise');
 assert.equal(card.describePermission(consent2l({command:'ls',cwd:'\u{feff}'})).where,'nothing visible');
 assert.equal(card.describePermission({native_request_id:'r3',tool_call:{kind:'\u{feff}',title:'\u{a0}',rawInput:{}},choices:[]}).differs,said2n('title'),'a title of only a no-break space was given, and shows nothing');
});

// be2n ruling 3: a title that stands as the target, or a request given as one string, is compared with what was sent as a path is. A
// prefix is cut from a title with its plain spaces only, so an invisible character after the colon is still compared. A title that is
// not drawn (a command or a path stands as the target) is not compared.
test('a title or a one-string request that stands as the target is compared like a path, and gets the line (be2n ruling 3)',async()=>{
 const {card,drawn}=await card2l();
 const titled=(kind,title,rest={})=>({native_request_id:'r4',tool_call:{kind,title,rawInput:{},...rest},choices:consent2l({}).choices});
 const search=titled('search','Search the w\u{200b}eb for r\u{202e}ates');
 assert.deepEqual(card.describePermission(search),{wants:'wants to search',target:'Search the web for rates',where:undefined,full:undefined,differs:said2n('title')});
 assert.ok(drawn(search).includes(`<p class="chat-permission-differs" role="note">${said2n('title')}</p>`)&&drawn(search).includes(open2n),drawn(search));
 assert.deepEqual(card.describePermission(titled('search','Search:\u{feff}rates')),{wants:'wants to search',target:'rates',where:undefined,full:undefined,differs:said2n('title')},
  'the prefix is cut with its plain spaces only');
 assert.deepEqual(card.describePermission(titled('execute','bash:\u{feff}ls')),{wants:'wants to run a command',target:'ls',where:undefined,full:undefined,differs:said2n('command')},
  'a command read from the title likewise');
 const whole={native_request_id:'r5',tool_call:'Read the no\u{200b}tes',choices:[]};
 assert.deepEqual(card.describePermission(whole),{wants:'wants permission',target:'Read the notes',where:undefined,full:undefined,differs:said2n('request')});
 assert.ok(drawn(whole).includes(open2n));
 for(const plain of [titled('search','Search:  the web '),{native_request_id:'r6',tool_call:' Read the notes\n',choices:[]},
  titled('edit','Ed\u{200b}it',{locations:[{path:'/home/x/plan.md'}]}),titled('execute','Ru\u{200b}n',{rawInput:{command:'ls'}})]){
  assert.equal(card.describePermission(plain).differs,undefined,JSON.stringify(plain.tool_call));
  assert.ok(drawn(plain).includes(closed2n)&&!drawn(plain).includes('chat-permission-differs'));
 }
});

// be2n ruling 3: the card draws a command in `code`; its line breaks, tabs and runs of spaces are kept by a white-space rule, so a
// second line is seen as one and never joined to the first.
test('the card\'s code keeps a command\'s line breaks: the style sheet says white-space pre-wrap (be2n ruling 3)',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('../src/agent/panel/panel.css',import.meta.url),'utf8');
 const rule=/\.chat-permission-target code\{([^}]*)\}/.exec(css)?.[1]??'';
 assert.match(rule,/(^|;)white-space:pre-wrap(;|$)/,rule);
 const {drawn}=await card2l();
 assert.ok(drawn(consent2l({command:'ls\nrm -rf ~'})).includes('<p class="chat-permission-target"><code>ls\nrm -rf ~</code></p>'),'the break is in the code the rule styles');
});

// be2n ruling 5: "nothing visible" is the card's word for a command or a folder that shows nothing. A command or a folder that is
// exactly those two words is someone's words: it stands in quotes, with no line, so the two are never taken for each other.
test('a command or folder that is exactly "nothing visible" is shown in quotes; one that shows nothing is not (be2n ruling 5)',async()=>{
 const {card,drawn}=await card2l();
 const {shownOrNothing,NOTHING_VISIBLE}=await import('../src/shared/plainText.ts');
 assert.deepEqual([shownOrNothing(''),shownOrNothing('nothing visible'),shownOrNothing('nothing'),shownOrNothing('Nothing visible'),NOTHING_VISIBLE],
  ['nothing visible','"nothing visible"','nothing','Nothing visible','nothing visible']);
 const real=consent2l({command:'nothing visible',cwd:'nothing visible'});
 assert.deepEqual(card.describePermission(real),{wants:'wants to run a command',target:'"nothing visible"',where:'"nothing visible"',full:undefined,differs:undefined});
 assert.ok(drawn(real).includes('<code>&quot;nothing visible&quot;</code><span> in &quot;nothing visible&quot;</span>')&&drawn(real).includes(closed2n),drawn(real));
 assert.equal(card.describePermission(consent2l({command:'\u{200b}',cwd:'/srv'})).target,'nothing visible');
});

// be2n ruling 1: one helper gives every place that answers a request the line and the raw form the card has. Allow and Refuse name the
// harness's own choice by its id and carry no word of the request, shown or sent.
test('permissionAsSent gives the line and the raw form the card draws, and an answer carries only the choice (be2n ruling 1)',async()=>{
 const {card,drawn}=await card2l();
 const laced=consent2l({command:'rm -rf ./build\u{202e}\nls',cwd:'/srv/app'});
 const sent=card.permissionAsSent(laced);
 assert.equal(sent.differs,said2n('command'));
 assert.ok(sent.raw.includes('rm -rf ./build\\u202e\\nls')&&!/[\p{Cf}]/u.test(sent.raw),sent.raw);
 const escaped=text=>text.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 assert.ok(drawn(laced).includes(`<summary>Show raw</summary><pre>${escaped(sent.raw)}</pre>`),'the card draws the helper\'s raw form');
 const plain=card.permissionAsSent(consent2l({command:'ls',cwd:'/srv/app'}));
 assert.equal(plain.differs,undefined);
 assert.equal(plain.raw,JSON.stringify({tool_call:consent2l({command:'ls',cwd:'/srv/app'}).tool_call,choices:consent2l({}).choices},null,1));
 const find=(node,is)=>{
  if(Array.isArray(node)){for(const child of node){const found=find(child,is);if(found)return found;}return undefined;}
  if(!node||typeof node!=='object')return undefined;
  return is(node)?node:find(node.props?.children,is);
 };
 const answers=[];
 const tree=card.PermissionCardView({request:laced,agentName:'Guardian',scope:'a',setScope(){},onAnswer:decision=>answers.push(decision)});
 find(tree,node=>node.props?.className==='chat-permission-allow').props.onClick();
 find(tree,node=>String(node.props?.className).includes('chat-permission-refuse')).props.onClick();
 assert.deepEqual(answers,[{outcome:'selected',option_id:'a'},{outcome:'selected',option_id:'r'}]);
});

// ── be2o (DLW build ruling 2026-11-11): the follow-ups of the review of be2n (O-I #968) ─────────────────────────────────────────────
const find2o=(node,is)=>{
 if(Array.isArray(node)){for(const child of node){const found=find2o(child,is);if(found)return found;}return undefined;}
 if(!node||typeof node!=='object')return undefined;
 return is(node)?node:find2o(node.props?.children,is);
};

// be2o ruling 5: the answer names the harness's choice by the id the harness gave, byte for byte. An id that cleaning would change (a
// bidi override, a space at its end, a byte-order mark, a zero-width space) is sent as it came, from Allow, from a chosen scope and from Refuse.
test('Allow and Refuse send the option id as it was given, never a cleaned form (be2o ruling 5)',async()=>{
 const {card}=await card2l();
 const ONCE='opt\u{202e}-1 ',ALWAYS=' \u{feff}',NO='no\u{200b}';
 const request=consent2l({command:'ls'},[{option_id:ONCE,kind:'allow_once',label:'Allow once'},{option_id:ALWAYS,kind:'allow_always',label:'Always'},{option_id:NO,kind:'reject_once',label:'Reject'}]);
 const answers=[];
 const press=scope=>{
  const tree=card.PermissionCardView({request,agentName:'Guardian',scope,setScope(){},onAnswer:decision=>answers.push(decision)});
  find2o(tree,node=>node.props?.className==='chat-permission-allow').props.onClick();
  find2o(tree,node=>String(node.props?.className).includes('chat-permission-refuse')).props.onClick();
 };
 press(ONCE);press(ALWAYS);
 assert.deepEqual(answers,[{outcome:'selected',option_id:ONCE},{outcome:'selected',option_id:NO},{outcome:'selected',option_id:ALWAYS},{outcome:'selected',option_id:NO}]);
 assert.deepEqual(answers.map(answer=>answer.option_id.length),[ONCE.length,NO.length,ALWAYS.length,NO.length],'not one character shorter');
});

// be2o ruling 4: the label of a choice is what a person picks "for how long" by. Where the card draws the labels (more than one allow
// choice) and one is not shown as it was sent, the line says so and Show raw opens. A face that draws no label says nothing of it.
test('a choice\'s label that is not shown as it was sent gets the line on the card, and only where the card draws the labels (be2o ruling 4)',async()=>{
 const {card,drawn}=await card2l();
 const LABEL='The label of a choice holds characters that are not shown here. Show raw has it as it was sent.';
 const laced=[{option_id:'a',kind:'allow_once',label:'Allow once'},{option_id:'p',label:'Yes, for every\u{202e} command'},{option_id:'r',kind:'reject_once',label:'Reject'}];
 const request=consent2l({command:'ls',cwd:'/srv/app'},laced);
 const markup=drawn(request);
 assert.ok(markup.includes(`<p class="chat-permission-differs" role="note">${LABEL}</p>`),markup);
 assert.ok(markup.includes(open2n)&&markup.includes('>Yes, for every command</button>')&&markup.includes('Yes, for every\\u202e command'),markup);
 assert.equal(card.describePermission(request,{labels:true}).differs,LABEL);
 assert.equal(card.describePermission(request).differs,undefined,'a face that draws no label has no line for one');
 assert.equal(card.permissionAsSent(request).differs,undefined,'so the queue and the Thread carry none');
 const both=consent2l({command:'ls\u{200b}',cwd:'/srv/app'},laced);
 assert.equal(card.describePermission(both,{labels:true}).differs,'The command and the label of a choice hold characters that are not shown here. Show raw has them as they were sent.');
 // One allow choice: no label is drawn, so a laced one gets no line. A laced Refuse label is never drawn either.
 const one=consent2l({command:'ls'},[{option_id:'a',kind:'allow_once',label:'Allow\u{202e} once'},{option_id:'r',kind:'reject_once',label:'Re\u{200b}ject'}]);
 assert.ok(!drawn(one).includes('chat-permission-differs')&&drawn(one).includes(closed2n),drawn(one));
 const plain=consent2l({command:'ls'},[{option_id:'a',kind:'allow_once',label:'Allow once'},{option_id:'p',label:'Yes, in this project'},{option_id:'r',kind:'reject_once',label:'Reject'}]);
 assert.ok(!drawn(plain).includes('chat-permission-differs')&&drawn(plain).includes(closed2n),drawn(plain));
});

// be2o ruling 4: a path or a title that is exactly the fallback words is someone's words, and stands in quotes as a command does, so it
// is never read as "this shows nothing".
test('a path or a title that is exactly "nothing visible" is shown in quotes (be2o ruling 4)',async()=>{
 const {card,drawn}=await card2l();
 const choices=consent2l({}).choices;
 const path={native_request_id:'r3',tool_call:{kind:'edit',title:'Edit',rawInput:{},locations:[{path:'nothing visible'}]},choices};
 assert.deepEqual(card.describePermission(path),{wants:'wants to edit a file',target:'"nothing visible"',where:undefined,full:'nothing visible',differs:undefined});
 assert.ok(drawn(path).includes('<code>&quot;nothing visible&quot;</code>'),drawn(path));
 const inFolder={native_request_id:'r4',tool_call:{kind:'edit',title:'Edit',rawInput:{},locations:[{path:'/srv/nothing visible/nothing visible'}]},choices};
 assert.deepEqual([card.describePermission(inFolder).target,card.describePermission(inFolder).where],['"nothing visible"','srv/nothing visible']);
 const folder={native_request_id:'r5',tool_call:{kind:'edit',title:'Edit',rawInput:{},locations:[{path:'nothing visible/plan.md'}]},choices};
 assert.deepEqual([card.describePermission(folder).target,card.describePermission(folder).where],['plan.md','"nothing visible"']);
 const title={native_request_id:'r6',tool_call:{kind:'search',title:'Search: nothing visible',rawInput:{}},choices};
 assert.equal(card.describePermission(title).target,'"nothing visible"');
 const whole={native_request_id:'r7',tool_call:'nothing visible',choices};
 assert.equal(card.describePermission(whole).target,'"nothing visible"');
 assert.equal(card.describePermission({native_request_id:'r8',tool_call:{kind:'search',title:'Search: nothing visibly wrong',rawInput:{}},choices}).target,'nothing visibly wrong');
});

// be2o ruling 3: a face that draws the command on one line, or cuts it, says so. The helper gives the words; permissionAsSent closes them
// with the way to the raw form, once, and names a face's own cleaned part in the card's line.
test('a target drawn on one line or cut short is said so, with the way to the raw form said once (be2o ruling 3)',async()=>{
 const {card}=await card2l();
 const RAW='Show raw has it as it was sent.';
 assert.equal(card.targetOnOneLine(undefined),undefined);
 assert.equal(card.targetOnOneLine('ls -la'),undefined);
 assert.equal(card.targetOnOneLine('ls -la',80),undefined);
 assert.equal(card.targetOnOneLine('ls\nrm -rf ~'),'The command has 2 lines, drawn as one here.');
 assert.equal(card.targetOnOneLine('a\nb\nc',80),'The command has 3 lines, drawn as one here.');
 assert.equal(card.targetOnOneLine('x'.repeat(80),80),undefined,'eighty characters stand whole');
 assert.equal(card.targetOnOneLine('x'.repeat(81),80),'What it asks is cut short here.');
 assert.equal(card.targetOnOneLine('x'.repeat(81)),undefined,'a face that cuts nothing says nothing of a cut');
 assert.equal(card.targetOnOneLine(`ls\n${'x'.repeat(90)}`,80),'The command has 2 lines, drawn as one here. It is cut short here.');
 const two=consent2l({command:'ls\nrm -rf ~'}),said=card.describePermission(two);
 assert.equal(said.differs,undefined,'the card keeps the lines, so it has no line for them');
 assert.equal(card.permissionAsSent(two,said,{said:[card.targetOnOneLine(said.target)]}).differs,`The command has 2 lines, drawn as one here. ${RAW}`);
 assert.equal(card.permissionAsSent(two,said,{said:[undefined]}).differs,undefined);
 const laced=consent2l({command:'ls\u{202e}\nrm -rf ~'}),lacedSaid=card.describePermission(laced);
 assert.equal(card.permissionAsSent(laced,lacedSaid,{said:[card.targetOnOneLine(lacedSaid.target)]}).differs,`${said2n('command')} The command has 2 lines, drawn as one here.`,'the way to the raw form is said once');
 assert.equal(card.permissionAsSent(laced,lacedSaid,{parts:['tool']}).differs,'The command and the tool hold characters that are not shown here. Show raw has them as they were sent.');
 assert.equal(card.permissionAsSent(two,said,{parts:['tool']}).differs,said2n('tool'));
 assert.equal(card.permissionAsSent(two,said,{parts:[]}).differs,undefined);
 assert.equal(card.ends(' \tls \u{a0}\r\n'),'ls \u{a0}','ends cuts plain white space only');
});
