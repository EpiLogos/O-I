import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import './register-production-sources.mjs';
const root=new URL('../../../',import.meta.url);
const [{sampledSourcePreviewPixels},{computeInkField,sampleImageSource,sampleAlphaSource}]=await Promise.all([
  import(new URL('desktop/cradle/expressions-app/field-studies-journeys/src/sourcePreview.ts',root)),
  import(new URL('desktop/cradle/expressions-app/src/engine/sourceSampling.ts',root)),
]);
const theme={paper:'#ffffff',ink:'#000000'};
function square({shade=80,width=64,height=64,transparent=false}={}) {
  const pixels=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<pixels.length;i+=4){pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=transparent?0:255;}
  for(let y=height/4;y<height*3/4;y++)for(let x=width/4;x<width*3/4;x++){
    const i=(y*width+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=shade;pixels[i+3]=255;
  }
  return {pixels,width,height};
}
const sample=(input,options)=>sampleImageSource(input.pixels,input.width,input.height,options);
const colorAt=(preview,x,y)=>Array.from(preview.pixels.slice((y*preview.width+x)*4,(y*preview.width+x)*4+4));
const projected=(preview,candidate)=>{
  const half=preview.worldUnitsPerPixel*(preview.width-1)/2;
  return [Math.round((candidate.x+half)/preview.worldUnitsPerPixel),Math.round((half-candidate.y)/preview.worldUnitsPerPixel)];
};

test('Sobel preview projects the real sampled boundary and never the unshaped filled center',()=>{
  const input=square(),sampled=sample(input,{mode:'edgeSobel',threshold:.24}),before=structuredClone(sampled),preview=sampledSourcePreviewPixels(sampled.candidates,theme);
  const old=computeInkField(input.pixels,input.width,input.height,{mode:'edgeSobel',threshold:.24});
  assert.ok(old.ink[32*64+32]>.68,'the original preview path had authored-tone ink inside the square');
  assert.equal(sampled.analysis.fallback,false);assert.equal(sampled.candidates.filter(c=>Math.abs(c.x)<10&&Math.abs(c.y)<10).length,0);
  const middle=Math.floor(preview.width/2);assert.deepEqual(colorAt(preview,middle,middle),[255,255,255,255]);
  for(const candidate of sampled.candidates){const [x,y]=projected(preview,candidate);assert.ok(colorAt(preview,x,y)[0]<255);}
  assert.deepEqual(sampled,before,'projection never changes native density, position or analysis');
});

test('silhouette and luminance use their actual distinct candidate densities without gamma or rethresholding',()=>{
  const input=square(),silhouette=sample(input,{mode:'silhouette',threshold:.24}),luminance=sample(input,{mode:'luminance',threshold:.24});
  assert.ok(silhouette.candidates.every(c=>c.density===1));assert.ok(luminance.candidates.every(c=>c.density>.68&&c.density<.69));
  for(const sampled of [silhouette,luminance]){
    const preview=sampledSourcePreviewPixels(sampled.candidates,theme);
    for(const c of sampled.candidates){const [x,y]=projected(preview,c);assert.deepEqual(colorAt(preview,x,y),[...Array(3).fill(Math.round(255*(1-c.density))),255]);}
  }
});

test('ASCII alpha inversion remains producer-defined and transparent cells never acquire preview ink',()=>{
  const input=square({transparent:true}),a=sampleAlphaSource(input.pixels,64,64,{invert:false}),b=sampleAlphaSource(input.pixels,64,64,{invert:true});
  assert.equal(a.analysis.mode,'alpha');assert.deepEqual(a.candidates,b.candidates);assert.deepEqual(sampledSourcePreviewPixels(a.candidates,theme),sampledSourcePreviewPixels(b.candidates,theme));
  const empty=sampleAlphaSource(new Uint8ClampedArray(64*64*4),64,64,{invert:true});assert.equal(empty.candidates.length,0);
  const preview=sampledSourcePreviewPixels(empty.candidates,theme);assert.equal(preview.bounds,null);
  for(let index=0;index<preview.pixels.length;index+=4)assert.deepEqual(Array.from(preview.pixels.slice(index,index+4)),[255,255,255,255]);
});

test('actual threshold recovery and image fallback ring reach the preview without a second sampling decision',()=>{
  const faint=sample(square({shade:235}),{mode:'luminance',threshold:.8});assert.equal(faint.analysis.fallback,false);assert.ok(faint.analysis.threshold<.8);
  const preview=sampledSourcePreviewPixels(faint.candidates,theme);
  const c=faint.candidates[0],[x,y]=projected(preview,c);assert.deepEqual(colorAt(preview,x,y),[...Array(3).fill(Math.round(255*(1-c.density))),255]);
  const white=sample(square({shade:255}),{mode:'luminance'});assert.equal(white.analysis.fallback,true);assert.equal(white.candidates.length,500);
  const ring=sampledSourcePreviewPixels(white.candidates,theme),middle=Math.floor(ring.width/2);assert.deepEqual(colorAt(ring,middle,middle),[255,255,255,255]);
  const [rx,ry]=projected(ring,white.candidates[0]);assert.ok(colorAt(ring,rx,ry)[0]<255);
});

test('actual sampled aspect and smaller source scale retain a common spatial frame; larger bounds expand uniformly',()=>{
  const input=square({width:80,height:40}),full=sample(input,{scale:1}),small=sample(input,{scale:.5}),large=sample(input,{scale:3});
  const a=sampledSourcePreviewPixels(full.candidates,theme),b=sampledSourcePreviewPixels(small.candidates,theme),c=sampledSourcePreviewPixels(large.candidates,theme);
  assert.equal(a.worldUnitsPerPixel,b.worldUnitsPerPixel);assert.ok(c.worldUnitsPerPixel>a.worldUnitsPerPixel);
  const span=preview=>({x:preview.bounds.x1-preview.bounds.x0,y:preview.bounds.y1-preview.bounds.y0});
  assert.equal(span(b).x,span(a).x*.5);assert.equal(span(b).y,span(a).y*.5);
  assert.ok(span(a).x/span(a).y>1.9);assert.ok(span(a).x/span(a).y<2.2);
  assert.ok(Math.abs(span(c).x-span(a).x*3)<1e-9);assert.ok(Math.abs(span(c).y-span(a).y*3)<1e-9);
  for(const candidate of large.candidates){const [x,y]=projected(c,candidate);assert.ok(x>=0&&x<c.width&&y>=0&&y<c.height);}
  const high=large.candidates.find(candidate=>candidate.y>0),[x,y]=projected(c,high);assert.ok(y<c.height/2);assert.ok(colorAt(c,x,y)[0]<255,'positive native y projects upward');
});

test('projection is bounded, finite, source-pure and retains strongest actual density when samples share a pixel',()=>{
  const input=square(),sampled=sample(input,{});
  assert.equal(sampledSourcePreviewPixels(sampled.candidates,theme,10000).width,512);
  assert.equal(sampledSourcePreviewPixels(sampled.candidates,theme,-10).width,2);
  assert.equal(sampledSourcePreviewPixels(sampled.candidates,theme,NaN).width,260);
  assert.throws(()=>sampledSourcePreviewPixels([{x:NaN,y:0,density:1}],theme),/non-finite sampled candidate/);
  const preview=sampledSourcePreviewPixels(sampled.candidates,theme,2),max=Math.max(...sampled.candidates.map(c=>c.density));
  assert.ok(Array.from(preview.pixels).some(value=>value===Math.round(255*(1-max))));
});

test('production image and ASCII sourceVisual send their actual sampler candidates to the same renderer',async()=>{
  const source=await readFile(new URL('desktop/cradle/expressions-app/field-studies-journeys/src/sourcePreview.ts',root),'utf8');
  assert.equal((source.match(/candidates = sampled\.candidates/g)||[]).length,2);
  assert.match(source,/previewDataUrl: renderPreview\(candidates, theme\)/);
  assert.doesNotMatch(source,/computeInkField|asciiPreview|asciiLayout/,'there must be no competing shape, polarity or ASCII rasterization law');
  assert.match(source,/SOURCE_WORK_MAX \/ Math\.max\(image\.naturalWidth, image\.naturalHeight\)/);
  assert.match(source,/image\.onerror = \(\) => reject/);
});
