import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

// Real canvas sampling and 50k-particle native target baking, without a fake sampler.
const browser=await chromium.launch({headless:true});
const artifacts=process.env.OI_TEST_ARTIFACTS??'walk/artifacts/candidate-cache-native';
mkdirSync(artifacts,{recursive:true});
try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<!doctype html><title>Native candidate retention regression</title>');
 const url=new URL('/field-studies-journeys/build/native-harness.js',process.env.OI_TEST_URL??'http://127.0.0.1:3197');
 url.searchParams.set('candidate-cache-regression',String(Date.now()));
 await page.addScriptTag({url:url.href});
 const result=await page.evaluate(()=>{
  const h=window.NATIVE_TEST,s=h.blankScene('Animated candidate retention');
  s.entities=[h.entity('Animated formation','O'),h.entity('Authored ASCII','Source')];
  const config=h.toNativeConfig(s),[e,source]=config.entities;
  for(const entity of [e,source]){entity.sequence.links=[];entity.sequence.advance='off';}
  const sampler=new h.GlyphSampler(),runtime=new h.EntityRuntime(sampler);
  runtime.allocate(50000,256,256);runtime.layout([e,source]);
  const ascii=sampler.rasterizeAscii('########\n##    ##\n########',{fontFamily:'monospace',fontSize:32}).candidates;
  runtime.setCustomCandidates(source.id,ascii,source.id+'_base');
  const snapshots=[];let frames=0,fontWeight=900;
  const targets=()=>[runtime.textureA.image.data,runtime.textureB.image.data,runtime.noiseTexture.image.data];
  const capture=()=>targets().map(data=>data.slice());
  const same=saved=>saved.every((data,k)=>data.every((v,i)=>v===targets()[k][i]));
  const render=shape=>{
   e.shape=shape;runtime.update([e,source],config.composition,frames++/30,0,0,0,'sans-serif',fontWeight);
   const stats=runtime.getCandidateCacheStats();snapshots.push(stats);
   if(stats.entries>stats.maxEntries||stats.estimatedBytes>stats.maxEstimatedBytes||stats.estimatedBytes<0)throw Error('Candidate retention exceeded its bounds');
   if(!targets().every(data=>data.every(Number.isFinite)))throw Error('Native targets contain nonfinite positions');
  };
  const glyph={kind:'glyph',text:'O'};render(glyph);
  const original=capture();
  const partition=runtime.getPartitions().find(p=>p.entityId===source.id);
  const authored=original.map(data=>data.slice(partition.start*4,partition.end*4));
  const preserved=()=>authored.every((data,k)=>data.every((v,i)=>v===targets()[k][partition.start*4+i]));
  for(let i=0;i<48;i++)render({kind:'cymatic',frequencyHz:80+i*23.71,plateGeometry:'square',dimension:'2D'});
  const frequency=runtime.getCandidateCacheStats();
  const frequencyChanged=!same(original);
  const authoredAfterFrequency=preserved();
  const missesBeforeReplay=frequency.misses;render(glyph);
  const replayed=same(original);
  const regenerated=runtime.getCandidateCacheStats().misses>missesBeforeReplay;
  const evictedReplay=shape=>{
   render(shape);const before=capture();
   for(let i=0;i<48;i++)render({kind:'cymatic',frequencyHz:1600+i*19.71,plateGeometry:'square',dimension:'2D'});
   const misses=runtime.getCandidateCacheStats().misses;render(shape);
   return {exact:same(before),regenerated:runtime.getCandidateCacheStats().misses>misses};
  };
  const cymatic3D=evictedReplay({kind:'cymatic',frequencyHz:243.21,plateGeometry:'volumetric3D',dimension:'3D'});
  // Zero-width space has no ink: exercise the real unrenderable-glyph fallback.
  const fallbackGlyph=evictedReplay({kind:'glyph',text:'\u200b'});
  for(let i=0;i<48;i++)render({kind:'glyph',text:['WW','I','M','O'][i%4]+i});
  const glyphs=runtime.getCandidateCacheStats();
  const authoredAfterGlyphs=preserved();
  // Small, real raster pools exercise the count ceiling independently of bytes.
  fontWeight=100;runtime.setBaseContext('symbol','sans-serif',fontWeight,'vertical');
  const cleared=runtime.getCandidateCacheStats();
  const hot={kind:'glyph',text:'.',frequencyHz:1};render(hot);
  const beforeCount=runtime.getCandidateCacheStats();
  for(let i=0;i<beforeCount.maxEntries+16;i++){
   render(hot);render({kind:'glyph',text:'.',frequencyHz:1000+i});
  }
  const count=runtime.getCandidateCacheStats();
  const missesBeforeHot=count.misses;render(hot);
  const recentHit=runtime.getCandidateCacheStats().misses===missesBeforeHot;
  const authoredAfterCount=preserved();
  // Volume-law changes invalidate pool retention and still bake real solid glyphs.
  runtime.setVolume({...runtime.getVolume(),enabled:true,depth:25});
  const volumeCleared=runtime.getCandidateCacheStats();render(glyph);
  const solid=runtime.textureA.image.data.some((v,i)=>i%4===2&&Math.abs(v)>2);
  runtime.dispose();const disposed=runtime.getCandidateCacheStats();
  return {frames,frequency,glyphs,cleared,count,recentHit,frequencyChanged,replayed,regenerated,cymatic3D,fallbackGlyph,
   authoredAfterFrequency,authoredAfterGlyphs,authoredAfterCount,volumeCleared,solid,disposed,
   peakEstimatedBytes:Math.max(...snapshots.map(s=>s.estimatedBytes)),peakEntries:Math.max(...snapshots.map(s=>s.entries))};
 });
 writeFileSync(artifacts+'/result.json',JSON.stringify(result,null,2));
 assert.ok(result.frequency.evictions>0,'changing actual cymatic frequencies evicts candidate data by bytes');
 assert.ok(result.frequencyChanged,'frequency changes produce different native targets');
 assert.ok(result.replayed&&result.regenerated,'an evicted glyph regenerates its exact original native target');
 assert.ok(result.cymatic3D.exact&&result.cymatic3D.regenerated,'an evicted 3D cymatic shape regenerates both targets and noise exactly');
 assert.ok(result.fallbackGlyph.exact&&result.fallbackGlyph.regenerated,'an evicted unrenderable-glyph fallback regenerates both targets and noise exactly');
 assert.ok(result.authoredAfterFrequency&&result.authoredAfterGlyphs&&result.authoredAfterCount,'authored ASCII targets survive cache pressure');
 assert.equal(result.cleared.entries,0);assert.equal(result.cleared.estimatedBytes,0);
 assert.equal(result.count.entries,result.count.maxEntries,'small glyph pools reach the count ceiling');
 assert.ok(result.count.evictions>result.glyphs.evictions,'count pressure evicts old pools');
 assert.ok(result.recentHit,'a frequently used pool stays cached under pressure');
 assert.equal(result.volumeCleared.entries,0);assert.equal(result.volumeCleared.estimatedBytes,0);
 assert.ok(result.solid,'volume-law invalidation still produces a real solid glyph');
 assert.equal(result.disposed.entries,0);assert.equal(result.disposed.estimatedBytes,0);
 assert.deepEqual(errors,[]);
 console.log(`Native candidate retention passed: ${result.frames} frames, ${result.peakEntries} pools, ${result.peakEstimatedBytes} estimated bytes; exact replay and authored sources preserved.`);
}finally{await browser.close();}
