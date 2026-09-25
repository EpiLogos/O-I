// Invoked by the native CLI integration gate with its exact candidate binary.
// Real registration -> exact readback -> production desktop Explore renderer.
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {createWorldPresentation} from '../../../shared-field/presentation.mjs';

const binary=process.argv[2];
assert.ok(binary,'Pass the tested native oi executable');
const cradle=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temporary=await mkdtemp(join(tmpdir(),'oi-hosted-presentation-'));
try {
  const provenance=[{kind:'source',ref:'docs/OI-DESKTOP-P1-HOST-INTEGRATION-CONTRACT.md',source_system:'o-i'}];
  const presentation=createWorldPresentation({presentation_ref:'presentation:host-integration',world_ref:'project:o-i',title:'Host integration',revision:1,
    theme:{tokens:{surface:'#112233'}},provenance,
    regions:[{region_ref:'contract',role:'reading',bindings:[
      {binding_ref:'contract',component_ref:'oi.presentation/text/v1',subject_ref:'source:host-integration',props:{text:'Registration preserves the native subject reference.'},fallback:{title:'Contract'},provenance},
      {binding_ref:'unavailable',component_ref:'owner.component/unavailable',subject_ref:'owner:subject/retained',props:{},fallback:{title:'Unavailable native component',text:'The source remains available.'},provenance},
    ]}],
  });
  const source=join(temporary,'presentation.json');
  await writeFile(source,JSON.stringify(presentation));
  const env={...process.env,OI_HOME:join(temporary,'home')};
  const command=(...args)=>JSON.parse(execFileSync(binary,args,{env,encoding:'utf8'}));
  assert.equal(command('presentation','validate',source).valid,true);
  assert.equal(command('presentation','register',source).activation,'registered-data');
  const readback=command('presentation','show',presentation.presentation_ref);
  assert.deepEqual(readback,presentation);
  const bundle=join(temporary,'render.cjs');
  await build({stdin:{contents:`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {WorldPresentationView} from './src/explore/presentation'; export const render = presentation => renderToStaticMarkup(React.createElement(WorldPresentationView,{presentation,hosting:'preview'}));`,resolveDir:cradle,loader:'tsx'},
    bundle:true,platform:'node',format:'cjs',outfile:bundle,jsx:'automatic',nodePaths:[join(cradle,'node_modules')],loader:{'.css':'empty'},logLevel:'error'});
  const html=createRequire(import.meta.url)(bundle).render(readback);
  assert.ok(html.includes('Registration preserves the native subject reference.'));
  assert.ok(html.includes('data-presentation-ref="presentation:host-integration"'));
  assert.ok(html.includes('data-binding-ref="unavailable"'));
  assert.ok(html.includes('data-renderer-available="false"'));
  assert.ok(html.includes('Unavailable native component'));
  assert.ok(html.includes('--oi-world-surface:#112233'));
  assert.equal(command('presentation','show',presentation.presentation_ref).regions[0].bindings[1].subject_ref,'owner:subject/retained');
  console.log('PASS native register/show -> production Explore render; subject identity, accepted renderer, unavailable fallback and world theme preserved');
} finally {await rm(temporary,{recursive:true,force:true});}
