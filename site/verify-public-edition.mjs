/** Read-only acceptance of actual generated or deployed native publication bytes.
 * Uses the native admission/compiler and edition manifests, never a test corpus.
 * Missing native content is a failing acceptance, not a fabricated success. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { compilePublications } from './build-publications.mjs';
import { openPublication, publicAssetUrl } from './src/library/publication-model.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const check=(condition,message)=>{if(!condition)throw new Error(message);};

export async function verifyPublicEdition({read,expectedInputs,allowEmpty=false}) {
 const seedBytes=await read('data/library/published.json');
 const seed=JSON.parse(seedBytes.toString('utf8'));
 const manifests=JSON.parse((await read('data/library/edition-manifests.json')).toString('utf8'));
 const admitted=compilePublications([seed]);
 check(isDeepStrictEqual(seed,admitted.seed),'The deployed seed is not an exactly admitted public output.');
 const model=openPublication(seed,manifests);
 const sourceSetVerified=expectedInputs!==undefined;
 if(sourceSetVerified) {
  const expected=compilePublications(expectedInputs);
  check(isDeepStrictEqual(seed,expected.seed),'The deployed native set differs from the selected producer output.');
 }
 const editions=[];
 for(const record of model.records) {
  const projection=record.projection,manifest=model.manifestFor(projection);
  const directory=`data/library/editions/${sha(projection.projection_ref+'@'+projection.projection_revision)}`;
  check(manifest.page===`./${directory}/index.html`&&manifest.projection_file===`./${directory}/projection.json`,'A native edition transport path does not match its exact revision.');
  const htmlBytes=await read(`${directory}/index.html`),projectionBytes=await read(`${directory}/projection.json`);
  const individual=JSON.parse((await read(`${directory}/manifest.json`)).toString('utf8'));
  check(isDeepStrictEqual(manifest,individual),'The native standalone manifest differs from the delivered manifest set.');
  check(sha(htmlBytes)===manifest.digest.value,'The native HTML bytes do not match the edition digest.');
  check(isDeepStrictEqual(JSON.parse(projectionBytes.toString('utf8')),projection),'The native Projection download differs from the selected edition.');
  const embedded=htmlBytes.toString('utf8').match(/<script type="application\/json" id="oi-projection">([\s\S]*?)<\/script>/)?.[1];
  check(Boolean(embedded)&&isDeepStrictEqual(JSON.parse(embedded),projection),'The HTML contains a different embedded Projection.');
  editions.push({projection_ref:projection.projection_ref,projection_revision:projection.projection_revision,source:projection.source,html_sha256:sha(htmlBytes),projection_sha256:sha(projectionBytes)});
 }
 const subjects=model.search('', '');
 // Every emitted native subject must resolve to a particular published reading;
 // ambiguity is not resolved by substituting the first unrelated publication.
 for(const item of subjects) model.select(item.ref,item.projection_ref||'');
 const readable=subjects.filter(item=>model.select(item.ref,item.projection_ref||'').readings.some(b=>b.portable_renderer!=='oi.presentation/reference-card/v1'&&Boolean(b.props.text||b.fallback.text))).length;
 const receipt={
  standing:editions.length?'verified-public-edition-bytes':'unavailable-native-corpus',
  observed_at:new Date().toISOString(),seed_sha256:sha(seedBytes),
  native_subjects:subjects.length,native_publications:editions.length,readable_subjects:readable,
  producer_set_verified:sourceSetVerified,editions,
  browser_interaction:'not tested by this byte check',
  native_models_mac_microphone:'not invoked; not prerequisites for public reading',
  completeness:'Byte/set agreement does not establish editorial corpus completeness or owner recognition.'
 };
 if(!allowEmpty)check(editions.length>0&&readable>0,'No admitted native corpus reading is deployed. Public-edition acceptance is not complete.');
 return receipt;
}

async function main() {
 const args=process.argv.slice(2),options={};let allowEmpty=false;
 for(let i=0;i<args.length;i++) {
  if(args[i]==='--allow-empty'){allowEmpty=true;continue;}
  if(!['--directory','--url','--out','--expected-inputs'].includes(args[i])||!args[i+1])throw new Error('Use --directory DIST or --url HTTPS_BASE, with optional --expected-inputs JSON_ARRAY, --out RECEIPT and --allow-empty for preview-only checks.');
  options[args[i].slice(2)]=args[++i];
 }
 check(Boolean(options.directory)!==Boolean(options.url),'Choose exactly one edition directory or public base URL.');
 let read;
 if(options.url) {
  const base=new URL(options.url.endsWith('/')?options.url:options.url+'/');
  check(Boolean(publicAssetUrl(base.href))||(base.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(base.hostname)&&!base.username&&!base.password),'The edition URL must be public HTTPS or an explicitly selected loopback preview.');
  check(!base.search&&!base.hash,'The edition base must not contain a query or fragment.');
  read=async path=>{
   const response=await fetch(new URL(path,base),{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000),cache:'no-store'});
   check(response.ok,`An expected edition resource is unavailable (HTTP ${response.status}).`);
   return Buffer.from(await response.arrayBuffer());
  };
 } else read=path=>readFile(resolve(options.directory,path));
 const inputs=options['expected-inputs'];
 let expectedInputs;
 if(inputs) {
  const paths=JSON.parse(inputs);check(Array.isArray(paths)&&paths.length&&paths.every(p=>typeof p==='string'),'Expected inputs must be a non-empty JSON array of selected native producer output paths.');
  expectedInputs=await Promise.all(paths.map(async p=>JSON.parse(await readFile(p,'utf8'))));
 }
 const receipt=await verifyPublicEdition({read,expectedInputs,allowEmpty});
 if(options.out){await mkdir(dirname(resolve(options.out)),{recursive:true});await writeFile(options.out,JSON.stringify(receipt,null,2)+'\n');}
 console.log(JSON.stringify(receipt,null,2));
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(error=>{console.error(JSON.stringify({standing:'not-accepted',reason:error.message}));process.exitCode=1;});
