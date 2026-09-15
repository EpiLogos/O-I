import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const server=await createServer({server:{port:Number(process.env.KNOWLEDGE_GEOMETRY_PORT??4334),strictPort:true},appType:'custom'});
server.middlewares.use((req,res,next)=>{if(req.url!=='/geometry')return next();res.setHeader('content-type','text/html');res.end('<!doctype html><title>Native knowledge projection geometry verification</title>');});
let browser;
try{
  await server.listen();
  browser=await chromium.launch(process.env.OI_CHROMIUM?{executablePath:process.env.OI_CHROMIUM}:{channel:'chrome'});
  const page=await browser.newPage();await page.goto(new URL('/geometry',server.resolvedUrls.local[0]).href);
  const failures=await projectionGeometry(page);
  assert.deepEqual(failures,[],'Native glyph and camera bounds must retain 1–10 new members inside narrow and wide artboards');
  console.log('Knowledge projection geometry: native glyph sampler + camera fit all 1–10 member cardinalities at 300×220, 600×200 and 900×600; single subject remains centred.');
}finally{await browser?.close();await server.close();}

/** Use the shipped glyph sampler and camera over the real projection output.
 * This tests viewport containment for every admitted local-whole cardinality. */
export async function projectionGeometry(page){
  return page.evaluate(async()=>{
    const {projectionChanges}=await import('/src/knowledge/expressionProjection.ts');
    const {GlyphSampler}=await import('/node_modules/@epilogos/oi-design-system/expressions-engine/engine/GlyphSampler.mjs');
    const {project,defaultCamera}=await import('/node_modules/@epilogos/oi-design-system/expressions-engine/shell/camera.mjs');
    const sampler=new GlyphSampler();
    // These are the unnormalised native glyph formation's material units:
    // EntityRuntime BASE_SCALE=.56 and shell WORLD_SCALE=400.
    const candidates=sampler.rasterizeSpatialNode({shape:'glyph',glyphText:'○'},'symbol').candidates;
    const local={left:Math.min(...candidates.map(p=>p.x))*.56,right:Math.max(...candidates.map(p=>p.x))*.56,top:Math.max(...candidates.map(p=>p.y))*.56,bottom:Math.min(...candidates.map(p=>p.y))*.56};
    const failures=[];
    for(let count=1;count<=10;count++){
      const expression_ref=`expression:bounds-${count}`,members=Array.from({length:count},(_,i)=>({node:{ref:`wiki:${i}`,kind:'wiki-node',label:`Subject ${i}`,native_owner:'central',provenance:{source:'owner'},actions:[]},reading:{resource:`wiki:${i}`,provider:'semantic-wiki',revision:'1',authority:'owner',evidence:[]}}));
      const changes=await projectionChanges({expression_ref,scenes:[],entities:{},selection:{}},{locus:'wiki:0',members,grammar:{state:'unavailable'}});
      const values=new Map();for(const change of changes)if(change.change==='parameter_set')values.set(change.entity_ref,{...values.get(change.entity_ref),[change.parameter]:change.value});
      for(const value of values.values())for(const [width,height] of [[300,220],[600,200],[900,600]])for(const x of [local.left,local.right])for(const y of [local.bottom,local.top]){
        const screen=project({x:(value.x+x*value.scale)/400,y:(value.y+y*value.scale)/400,z:0},defaultCamera(),width,height);
        if(screen.x<width*.03||screen.x>width*.97||screen.y<height*.03||screen.y>height*.97)failures.push({count,width,height,screen});
      }
      if(count===1&&[...values.values()].some(value=>value.x!==0||value.y!==0))failures.push({count,reason:'single subject displaced'});
    }
    return failures;
  });
}
