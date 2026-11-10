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
