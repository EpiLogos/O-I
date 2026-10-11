import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(u).pathname}).outputText}}`)}`, import.meta.url)

const {toggleDetailSettings, openDetailSettings} = await import('../src/shell/compositionViews.ts')

test('Configure toggles the settings and keeps the family; Chosen controls opens that family', () => {
  assert.deepEqual(toggleDetailSettings(false, 'device'), {open: true, family: 'device'})
  assert.deepEqual(toggleDetailSettings(true, 'controls'), {open: false, family: 'controls'})
  assert.deepEqual(openDetailSettings('controls'), {open: true, family: 'controls'})
  assert.deepEqual(openDetailSettings('scene'), {open: true, family: 'scene'})
})
