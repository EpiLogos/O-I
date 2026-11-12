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
  choices:[{option_id:'a',kind:'allow_once',label:'Allow\u202e once'},{option_id:'p',kind:'allow_project',label:'Yes, in this \u2066project\u200b'},{option_id:'r',kind:'reject_once',label:'Reject'}]};
 assert.deepEqual(describePermission(request),{wants:'wants to run a command',target:'rm -rf ./build\nls docs',where:'/srv/app',full:undefined,
  differs:'The command and the folder hold characters that are not shown here. Show raw has them as they were sent.'});
 assert.deepEqual(describePermission({native_request_id:'r2',tool_call:{kind:'edit',title:'Edit',locations:[{path:'/home/x/no\u202etes/pla\u200bn.md'}],rawInput:{}},choices:[]}),
  {wants:'wants to edit a file',target:'plan.md',where:'x/notes',full:'/home/x/notes/plan.md',differs:'The path holds characters that are not shown here. Show raw has it as it was sent.'});
 const markup=renderToStaticMarkup(createElement(PermissionCard,{request,agentName:'Guar\u202edian',onAnswer(){}})).replace(/<!-- -->/g,'');
 assert.ok(!/[\u202a-\u202e\u2066-\u2069\u200b]/.test(markup),'nothing of the set is drawn');
 assert.match(markup,/<strong>Guardian wants to run a command<\/strong>/);
 assert.match(markup,/rm -rf \.\/build\nls docs/,'the command keeps its line break');
 assert.match(markup,/title="Allow once"[^>]*>This time<\/button>/,'a scope the harness names keeps its label plain as its title');
 assert.match(markup,/>Yes, in this project<\/button>/,'a scope whose kind has no fixed word is drawn by its label, plain');
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
 const request=consent2l({command:'rm -rf ./build',cwd:'/srv/app'},[{option_id:'p',kind:'allow_project',label:'Yes, in this \u{2066}project\u{200b}'},{option_id:'a',kind:'allow_once',label:'Allow once'},{option_id:'r',kind:'reject_once',label:'Reject'}]);
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

// ── be2p (DLW build ruling 2026-11-11): the follow-ups of the review of O-I #969 ─────────────────────────────────────────────────────
const all2p=(node,is,found=[])=>{
 if(Array.isArray(node)){for(const child of node)all2p(child,is,found);return found;}
 if(!node||typeof node!=='object')return found;
 if(is(node))found.push(node);
 return all2p(node.props?.children,is,found);
};
/** The card for one request, its buttons by what they are, and every answer a press sends with the words it leaves. */
const pressed2p=(card,request,scope)=>{
 const sent=[];
 const tree=card.PermissionCardView({request,agentName:'Guardian',scope:scope??request.choices.find(choice=>choice.kind?.startsWith('allow'))?.option_id,setScope(){},onAnswer:(decision,summary)=>sent.push([decision,summary])});
 const of=name=>all2p(tree,node=>node.type==='button'&&String(node.props?.className).split(' ').includes(name));
 const press=button=>{sent.length=0;button.props.onClick();return sent[0];};
 return {allow:of('chat-permission-allow'),refuse:of('chat-permission-refuse'),own:of('chat-permission-choice'),press};
};
const KINDS_2P={
 // The reviewer's three cases (review of #969, F1).
 allowNow:[{option_id:'go',label:'Allow now'},{option_id:'stop',label:'Deny'}],
 mixed:[{option_id:'once',kind:'allow_once',label:'Allow'},{option_id:'session',label:'Allow for this session, no more prompts'}],
 onlyYes:[{option_id:'yes-forever',label:'Yes, and do not ask again'}],
 // And the ones beside them.
 yesNo:[{option_id:'y',label:'Yes'},{option_id:'n',label:'No'}],
 kinds:[{option_id:'a',kind:'allow_once',label:'Allow once'},{option_id:'w',kind:'allow_always',label:'Always'},{option_id:'r',kind:'reject_once',label:'Reject'}],
 neverOnly:[{option_id:'a',kind:'allow_once',label:'Allow'},{option_id:'never',kind:'reject_always',label:'Never'}],
 both:[{option_id:'a',kind:'allow_once',label:'Allow'},{option_id:'never',kind:'reject_always',label:'Never'},{option_id:'r',kind:'reject_once',label:'Not now'}],
 unknownKind:[{option_id:'a',kind:'allow_once',label:'Allow'},{option_id:'x',kind:'other',label:'No thanks'}],
 none:[],
};

// be2p ruling 1: Refuse is the harness's choice of a reject kind, and where it offers none Refuse sends the cancelled outcome. It is never
// a choice picked by a word in its label: "Allow now" holds "no", and so do "not" and "know".
test('Refuse never sends an allow: it sends a choice of a reject kind, or the cancelled outcome, and never one picked by its label (be2p ruling 1)',async()=>{
 const {card}=await card2l();
 const refused=Object.fromEntries(Object.entries(KINDS_2P).map(([name,choices])=>{
  const face=pressed2p(card,consent2l({command:'ls'},choices));
  assert.equal(face.refuse.length,1,`${name}: one Refuse`);
  return [name,face.press(face.refuse[0])];
 }));
 const CANCELLED=[{outcome:'cancelled'},'Cancelled: the request offered no refusing choice \u{b7} ls'];
 assert.deepEqual(refused,{
  allowNow:CANCELLED,mixed:CANCELLED,onlyYes:CANCELLED,yesNo:CANCELLED,unknownKind:CANCELLED,none:CANCELLED,
  kinds:[{outcome:'selected',option_id:'r'},'Refused \u{b7} ls'],
  neverOnly:[{outcome:'selected',option_id:'never'},'Refused \u{b7} always \u{b7} ls'],
  both:[{outcome:'selected',option_id:'r'},'Refused \u{b7} ls'],
 });
 // Whatever the choices, what Refuse sends is of a reject kind or is no choice at all.
 for(const [name,choices] of Object.entries(KINDS_2P)){
  const [decision]=refused[name];
  if(decision.outcome==='selected')assert.match(choices.find(choice=>choice.option_id===decision.option_id).kind,/^reject/,name);
  assert.deepEqual(card.refusalOf(consent2l({command:'ls'},choices)),decision,name);
 }
 // Before the press, Refuse says that it cancels where the request offers no refusal, and says nothing more where it offers one.
 const titled=name=>pressed2p(card,consent2l({command:'ls'},KINDS_2P[name])).refuse[0].props.title;
 assert.deepEqual([titled('allowNow'),titled('mixed'),titled('onlyYes'),titled('kinds'),titled('neverOnly')],
  [card.REFUSE_CANCELS,card.REFUSE_CANCELS,card.REFUSE_CANCELS,undefined,undefined]);
 assert.equal(card.REFUSE_CANCELS,'Refuse cancels the request: it offers no refusing choice.');
});

// be2p ruling 1: Allow is the harness's choice of an allow kind. A choice with no kind, or a kind that is neither, is not offered as
// Allow and not as a scope of it: it stands under its own label and sends its own id.
test('Allow is a choice of an allow kind alone; a choice of neither kind stands under its own label and sends its own id (be2p ruling 1)',async()=>{
 const {card,drawn}=await card2l();
 const face=name=>pressed2p(card,consent2l({command:'ls'},KINDS_2P[name]));
 const labels=buttons=>buttons.map(button=>button.props.children);
 // No kinds at all: no Allow, each choice by its own label.
 const allowNow=face('allowNow');
 assert.deepEqual([allowNow.allow.length,labels(allowNow.own)],[0,['Allow now','Deny']]);
 assert.deepEqual(allowNow.own.map(allowNow.press),[[{outcome:'selected',option_id:'go'},'Answered \u{b7} Allow now \u{b7} ls'],[{outcome:'selected',option_id:'stop'},'Answered \u{b7} Deny \u{b7} ls']]);
 const onlyYes=face('onlyYes');
 assert.deepEqual([onlyYes.allow.length,labels(onlyYes.own)],[0,['Yes, and do not ask again']]);
 assert.deepEqual(onlyYes.press(onlyYes.own[0]),[{outcome:'selected',option_id:'yes-forever'},'Answered \u{b7} Yes, and do not ask again \u{b7} ls']);
 const yesNo=face('yesNo');
 assert.deepEqual([yesNo.allow.length,labels(yesNo.own),yesNo.own.map(button=>yesNo.press(button)[0].option_id)],[0,['Yes','No'],['y','n']]);
 // One allow kind beside a choice with none: Allow is the kind's, with no "For how long"; the other stands under its own words.
 const mixed=face('mixed');
 assert.deepEqual([mixed.allow.length,labels(mixed.own)],[1,['Allow for this session, no more prompts']]);
 assert.deepEqual(mixed.press(mixed.allow[0]),[{outcome:'selected',option_id:'once'},'Allowed \u{b7} ls']);
 assert.deepEqual(mixed.press(mixed.own[0]),[{outcome:'selected',option_id:'session'},'Answered \u{b7} Allow for this session, no more prompts \u{b7} ls']);
 assert.ok(!drawn(consent2l({command:'ls'},KINDS_2P.mixed)).includes('chat-permission-scopes'),'a choice with no kind is not a scope of Allow');
 // A scope the card was left on that is not an allow kind does not make Allow send it.
 const left=pressed2p(card,consent2l({command:'ls'},KINDS_2P.mixed),'session');
 assert.deepEqual(left.press(left.allow[0])[0],{outcome:'selected',option_id:'once'});
 // A kind that is neither is listed too.
 const unknown=face('unknownKind');
 assert.deepEqual([labels(unknown.own),unknown.press(unknown.own[0])],[['No thanks'],[{outcome:'selected',option_id:'x'},'Answered \u{b7} No thanks \u{b7} ls']]);
 // Kinds throughout: Allow with its scopes, Refuse, and nothing listed by label.
 const kinds=face('kinds');
 assert.deepEqual([kinds.allow.length,kinds.own.length],[1,0]);
 assert.deepEqual(kinds.press(kinds.allow[0]),[{outcome:'selected',option_id:'a'},'Allowed \u{b7} this time \u{b7} ls']);
 const always=pressed2p(card,consent2l({command:'ls'},KINDS_2P.kinds),'w');
 assert.deepEqual(always.press(always.allow[0]),[{outcome:'selected',option_id:'w'},'Allowed \u{b7} always \u{b7} ls']);
 // Nothing offered: no Allow, nothing listed, and Refuse cancels.
 assert.deepEqual([face('none').allow.length,face('none').own.length],[0,0]);
 // A label with nothing visible in it still stands as a button, and says so; one laced is drawn plain and gets the line.
 const blank=pressed2p(card,consent2l({command:'ls'},[{option_id:'z',label:'\u{200b}'}]));
 assert.deepEqual([labels(blank.own),blank.press(blank.own[0])],[['nothing visible'],[{outcome:'selected',option_id:'z'},'Answered \u{b7} nothing visible \u{b7} ls']]);
 assert.equal(card.describePermission(consent2l({command:'ls'},[{option_id:'z',label:'Yes\u{202e}'}]),{labels:true}).differs,'The label of a choice holds characters that are not shown here. Show raw has it as it was sent.');
 assert.equal(card.describePermission(consent2l({command:'ls'},[{option_id:'a',kind:'allow_once',label:'Yes\u{202e}'},{option_id:'r',kind:'reject_once',label:'No\u{202e}'}]),{labels:true}).differs,undefined,'a label the card does not draw gets no line');
});

// be2p ruling 1: the words the card leaves are made from the answer that was sent, by the kind of the choice it names. The button that
// was pressed has no say in them.
test('the words after an answer say what was sent: Allowed, Refused, Cancelled, or the choice\'s own label (be2p ruling 1)',async()=>{
 const {card}=await card2l();
 const words=(choices,decision)=>card.answerSummary(consent2l({command:'ls'},choices),decision);
 const pick=option_id=>({outcome:'selected',option_id});
 assert.equal(words(KINDS_2P.kinds,pick('a')),'Allowed \u{b7} this time \u{b7} ls');
 assert.equal(words(KINDS_2P.kinds,pick('w')),'Allowed \u{b7} always \u{b7} ls');
 assert.equal(words(KINDS_2P.kinds,pick('r')),'Refused \u{b7} ls');
 assert.equal(words(KINDS_2P.both,pick('never')),'Refused \u{b7} always \u{b7} ls');
 assert.equal(words(KINDS_2P.kinds,{outcome:'cancelled'}),'Cancelled: the request offered no refusing choice \u{b7} ls');
 assert.equal(words(KINDS_2P.allowNow,pick('go')),'Answered \u{b7} Allow now \u{b7} ls','a choice with no kind is not called allowed');
 assert.equal(words(KINDS_2P.allowNow,pick('stop')),'Answered \u{b7} Deny \u{b7} ls','nor refused');
 assert.equal(words(KINDS_2P.kinds,pick('gone')),'Answered \u{b7} a choice the request does not list \u{b7} ls');
 assert.equal(words([{option_id:'s',kind:'allow_session',label:'For this \u{2066}session\u{200b}'},{option_id:'a',kind:'allow_once',label:'Allow'}],pick('s')),'Allowed \u{b7} For this session \u{b7} ls','an allow kind with no fixed word carries its label, plain');
 assert.equal(card.answerSummary({native_request_id:'r',tool_call:{},choices:KINDS_2P.kinds},pick('r')),'Refused','no target, no tail');
 // On every card of the cases above, each button's words name the kind of the choice its press sent.
 for(const [name,choices] of Object.entries(KINDS_2P)){
  const request=consent2l({command:'ls'},choices),face=pressed2p(card,request);
  for(const button of [...face.allow,...face.own,...face.refuse]){
   const [decision,summary]=face.press(button);
   const kind=decision.outcome==='selected'?choices.find(choice=>choice.option_id===decision.option_id).kind??'':undefined;
   const first=summary.split(/ \u{b7} |: /u)[0];
   assert.equal(first,kind===undefined?'Cancelled':kind.startsWith('allow')?'Allowed':kind.startsWith('reject')?'Refused':'Answered',`${name}: ${JSON.stringify(decision)} left "${summary}"`);
  }
 }
});

// ── be2q (DLW build ruling 2026-11-11): the follow-ups of the review of O-I #970 ─────────────────────────────────────────────────────
// Ruling 3: where Refuse will send the cancelled outcome, the card says so in a line of its own beside the buttons, before the press,
// and not only in the button's title. One helper words it for every face that has a refusing button.
test('where Refuse will cancel, the card says so in standing words beside it; one helper words it for every face (be2q ruling 3)',async()=>{
 const {card,drawn}=await card2l();
 assert.equal(card.cancelsLine('Refuse'),'Refuse cancels the request: it offers no refusing choice.');
 assert.equal(card.cancelsLine('Deny'),'Deny cancels the request: it offers no refusing choice.');
 assert.equal(card.REFUSE_CANCELS,card.cancelsLine('Refuse'));
 const LINE='<p class="chat-permission-cancels" role="note">Refuse cancels the request: it offers no refusing choice.</p>';
 for(const name of ['allowNow','mixed','onlyYes','yesNo','unknownKind','none']){
  const request=consent2l({command:'ls'},KINDS_2P[name]),markup=drawn(request);
  assert.equal(markup.split(LINE).length,2,`${name}: the line stands on the card, once`);
  assert.ok(markup.indexOf(LINE)<markup.indexOf('chat-permission-actions'),`${name}: above the buttons, so it is read before them`);
  assert.equal(card.cancelsSaid(request,'Deny'),card.cancelsLine('Deny'),name);
  assert.deepEqual(card.refusalOf(request),{outcome:'cancelled'},name);
 }
 for(const name of ['kinds','neverOnly','both']){
  const request=consent2l({command:'ls'},KINDS_2P[name]);
  assert.ok(!drawn(request).includes('chat-permission-cancels'),`${name}: a request that offers a refusal has no such line`);
  assert.equal(card.cancelsSaid(request,'Deny'),undefined,name);
 }
});

// Ruling 5 (the review's F6): two choices that share an id. Each is drawn, under its own button, and a press sends that id. A refusing
// button never sends an id that a choice of another kind holds too: the answer names a choice by its id alone, so the harness could
// read it as the allow. It sends another refusal, or the cancelled outcome, and the card says which before the press. (That React is
// handed no two buttons under one key is read in a browser: approvals-drawn-be2q.test.mjs.)
test('two choices with one id are both drawn and each sends that id; Refuse never sends an id an allow also holds (be2q ruling 5)',async()=>{
 const {card,drawn}=await card2l();
 const labels=buttons=>buttons.map(button=>button.props.children);
  // Two of neither kind: both stand, each sends the id.
  const twin=consent2l({command:'ls'},[{option_id:'x',label:'First'},{option_id:'x',label:'Second'}]),face=pressed2p(card,twin);
  assert.deepEqual(labels(face.own),['First','Second']);
  assert.deepEqual(face.own.map(button=>face.press(button)[0]),[{outcome:'selected',option_id:'x'},{outcome:'selected',option_id:'x'}]);
  assert.equal(drawn(twin).split('chat-permission-choice').length,3,'both are in the drawn card');
  // Two allows of two kinds under one id (be2s ruling 5; DLW build ruling 2026-11-12): a plain Allow could grant the standing one, so
  // there is no Allow and no "For how long". Each stands under its own label and sends the id, and the words after say both.
  const scopes=consent2l({command:'ls'},[{option_id:'x',kind:'allow_once',label:'Once'},{option_id:'x',kind:'allow_always',label:'Always'},{option_id:'r',kind:'reject_once',label:'No'}]),both=pressed2p(card,scopes);
  assert.equal(drawn(scopes).split('role="radio"').length,1,'no scope is drawn');
  assert.deepEqual([both.allow.length,labels(both.own)],[0,['Once','Always']]);
  assert.deepEqual(both.own.map(button=>both.press(button)),[[{outcome:'selected',option_id:'x'},'Answered \u{b7} Once / Always \u{b7} ls'],[{outcome:'selected',option_id:'x'},'Answered \u{b7} Once / Always \u{b7} ls']]);
  assert.deepEqual(both.press(both.refuse[0])[0],{outcome:'selected',option_id:'r'});
  // Two allows of one kind under one id are that kind's own: Allow sends it.
  const same=pressed2p(card,consent2l({command:'ls'},[{option_id:'x',kind:'allow_once',label:'Once'},{option_id:'x',kind:'allow_once',label:'Again'}]));
  assert.deepEqual([same.own.length,same.press(same.allow[0])],[0,[{outcome:'selected',option_id:'x'},'Allowed \u{b7} this time \u{b7} ls']]);
  // What the Thread's Approve and the answer's Accept send (approvalOf): never an id another kind holds.
  const kinds=(...list)=>consent2l({command:'ls'},list.map(([option_id,kind])=>({option_id,kind,label:kind})));
  assert.equal(card.approvalOf(scopes),undefined);
  assert.equal(card.approvalOf(kinds(['x','allow_once'],['x','reject_once'])),undefined);
  assert.equal(card.approvalOf(kinds(['x','allow_once'],['x','other'])),undefined);
  assert.equal(card.approvalOf(kinds(['x','allow_once'],['x','allow_always'],['y','allow_once'])).option_id,'y');
  assert.deepEqual([card.approvalOf(kinds(['x','allow_once'],['x','reject_once'],['w','allow_always'])).option_id,card.approvesAlways(kinds(['x','allow_once'],['x','reject_once'],['w','allow_always']))],['w',true]);
  assert.deepEqual([card.approvalOf(kinds(['w','allow_always'],['w','reject_always'],['a','allow_once'])).option_id,card.approvesAlways(kinds(['w','allow_always'],['w','allow_once']))],['a',false]);
  // An allow and a reject of one id, in both orders: Refuse does not send it.
  for(const choices of [[{option_id:'x',kind:'allow_once',label:'Yes'},{option_id:'x',kind:'reject_once',label:'No'}],[{option_id:'x',kind:'reject_once',label:'No'},{option_id:'x',kind:'allow_once',label:'Yes'}]]){
   const request=consent2l({command:'ls'},choices),shared=pressed2p(card,request);
   assert.deepEqual(shared.press(shared.refuse[0]),[{outcome:'cancelled'},'Cancelled: the request offered no refusing choice \u{b7} ls']);
   assert.ok(drawn(request).includes('chat-permission-cancels'),'and the card says that Refuse cancels');
   // No plain Allow sends it either (be2s ruling 5): each of the two stands under its own label and sends the id.
   assert.deepEqual([shared.allow.length,labels(shared.own)],[0,choices.map(choice=>choice.label)]);
   assert.deepEqual(shared.own.map(button=>shared.press(button)),choices.map(()=>[{outcome:'selected',option_id:'x'},`Answered \u{b7} ${choices.map(choice=>choice.label).join(' / ')} \u{b7} ls`]));
  }
  // A reject whose id an allow holds, beside one of its own: Refuse sends the one of its own; of two sure ones, the one for this time.
  const beside=[{option_id:'x',kind:'reject_once',label:'No'},{option_id:'x',kind:'allow_once',label:'Yes'},{option_id:'n',kind:'reject_always',label:'Never'}];
  assert.deepEqual(card.refusalOf(consent2l({command:'ls'},beside)),{outcome:'selected',option_id:'n'});
  assert.deepEqual(card.refusalOf(consent2l({command:'ls'},[...beside,{option_id:'o',kind:'reject_once',label:'Not now'}])),{outcome:'selected',option_id:'o'});
  // Two rejects of one id are a refusal either way.
  assert.deepEqual(card.refusalOf(consent2l({command:'ls'},[{option_id:'x',kind:'reject_always',label:'Never'},{option_id:'x',kind:'reject_once',label:'No'}])),{outcome:'selected',option_id:'x'});
});

// Ruling 5 (the review's F6): a request whose one allow is the always kind. No "For how long" stands beside Allow to say so, so the
// button says it, and so do the words the answer leaves.
test('a lone allow of the always kind is called Allow always, on the button and after the answer (be2q ruling 5)',async()=>{
 const {card}=await card2l();
 const face=choices=>pressed2p(card,consent2l({command:'ls'},choices));
 const lone=face([{option_id:'w',kind:'allow_always',label:'Always'},{option_id:'r',kind:'reject_once',label:'Reject'}]);
 assert.equal(lone.allow[0].props.children,'Allow always');
 assert.deepEqual(lone.press(lone.allow[0]),[{outcome:'selected',option_id:'w'},'Allowed \u{b7} always \u{b7} ls']);
 const once=face([{option_id:'a',kind:'allow_once',label:'Allow'},{option_id:'r',kind:'reject_once',label:'Reject'}]);
 assert.equal(once.allow[0].props.children,'Allow');
 assert.deepEqual(once.press(once.allow[0]),[{outcome:'selected',option_id:'a'},'Allowed \u{b7} ls']);
 // Beside another allow the scopes say which, as before: the button stays Allow.
 const both=pressed2p(card,consent2l({command:'ls'},KINDS_2P.kinds),'w');
 assert.equal(both.allow[0].props.children,'Allow');
 assert.deepEqual(both.press(both.allow[0]),[{outcome:'selected',option_id:'w'},'Allowed \u{b7} always \u{b7} ls']);
 // An allow kind with no fixed word, alone: Allow, as before.
 const project=face([{option_id:'p',kind:'allow_project',label:'In this project'}]);
 assert.deepEqual([project.allow[0].props.children,project.press(project.allow[0])[1]],['Allow','Allowed \u{b7} ls']);
});
