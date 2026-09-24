import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const temp=await mkdtemp(join(tmpdir(),'oi-settings-l6-'));
const entry=`import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {SettingsProductRows} from './src/workspace/settings/SettingsProductRows';import {settingsProducts} from './src/workspace/settings/settingsProducts';export function render(data){return renderToStaticMarkup(createElement(SettingsProductRows,{products:settingsProducts(data),place:{kind:'product',id:'seventh-owner'},onChoose:()=>{}}));}`;
await build({stdin:{contents:entry,resolveDir:resolve('.')},bundle:true,platform:'node',format:'cjs',jsx:'automatic',outfile:join(temp,'render.cjs')});
const {render}=createRequire(import.meta.url)(join(temp,'render.cjs'));
test.after(()=>rm(temp,{recursive:true,force:true}));
test('the production product navigation renders a newly discovered seventh owner',()=>{
 const ids=['oi','central','ai-kit','actuation','workcell','software-factory','seventh-owner'];
 const html=render({census:{state:'ok',value:{positions:ids.map(product_id=>({product_id}))}},registry:{state:'reading'},owners:{state:'reading'}});
 assert.equal((html.match(/data-settings-product=/g)||[]).length,7);
 assert.match(html,/aria-current="page" data-settings-product="seventh-owner"/);
 assert.match(html,/>Seventh owner<\/span>/);
});
