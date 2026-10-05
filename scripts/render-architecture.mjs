#!/usr/bin/env node
/** Render the maintained Mermaid sources with the real browser renderer.
 * Usage: node scripts/render-architecture.mjs --mermaid-dir /path/to/mermaid
 * Optional --inspection-dir /path writes full-size PNGs for visual review.
 * Mermaid is supplied explicitly; this tool never installs packages or fetches media.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'desktop/cradle/package.json'));
const {chromium} = require('playwright');
const option = name => { const i=process.argv.indexOf(name); return i<0?null:process.argv[i+1]; };
const mermaidDir = option('--mermaid-dir');
if (!mermaidDir) throw new Error('--mermaid-dir must name an installed Mermaid package');
const packageJson = JSON.parse(await fs.readFile(path.join(mermaidDir,'package.json'),'utf8'));
const folder = path.join(root,'docs/architecture');
const output = path.join(folder,'rendered');
const inspection = option('--inspection-dir');
await fs.mkdir(output,{recursive:true});
if (inspection) await fs.mkdir(inspection,{recursive:true});
const escape = s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const files = (await fs.readdir(folder)).filter(n=>n.endsWith('.mmd')).sort();
const relationIndex = JSON.parse(await fs.readFile(path.join(folder,'relations.json'),'utf8'));
const seen = new Set();
const sha256 = value => createHash('sha256').update(value).digest('hex');
const browser = await chromium.launch({headless:true});
const rendered=[];
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
  await page.setContent('<!doctype html><html><body style="margin:16px;background:white"><main></main></body></html>');
  await page.addScriptTag({path:path.join(mermaidDir,'dist/mermaid.min.js')});
  await page.evaluate(()=>mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'base',
    themeVariables:{fontFamily:'Arial, sans-serif',fontSize:'16px',lineColor:'#51606c',primaryTextColor:'#222'},
    flowchart:{htmlLabels:true,useMaxWidth:false,nodeSpacing:30,rankSpacing:46,curve:'basis'}}));
  for (const file of files) {
    const text=await fs.readFile(path.join(folder,file),'utf8');
    const headers=Object.fromEntries([...text.matchAll(/^%% (\w+): (.+)$/gm)].map(m=>[m[1],m[2]]));
    for (const key of ['source_id','visual_question','companion_doc','revision','provenance']) {
      if(!headers[key])throw new Error(`${file}: missing ${key}`);
    }
    await fs.access(path.join(folder,headers.companion_doc));
    const expected=relationIndex.relations.filter(r=>r.diagram===file);
    const arrows=text.split('\n').filter(l=>l.includes('-->')||l.includes('-.->'));
    if(arrows.length!==expected.length)throw new Error(`${file}: unindexed or missing arrow`);
    for(const line of arrows){
      const match=line.match(/^\s*(\w+)\s+(-->|-\.->)\|"([A-Z]\d+) · ([^"]+)"\|\s*(\w+)/);
      if(!match)throw new Error(`${file}: arrow lacks exact relation label: ${line}`);
      const [,from,arrow,id,label,to]=match;
      const entry=expected.find(r=>r.id===id);
      if(!entry||entry.from!==from||entry.to!==to||entry.label!==label||seen.has(id))throw new Error(`${file}: stale/duplicate relation ${id}`);
      if(arrow==='-.->'&&entry.standing!=='proposed')throw new Error(`${file}: proposed join has wrong standing`);
      seen.add(id);
    }
    const name=path.basename(file,'.mmd');
    const result=await page.evaluate(async ({text,name})=>{
      await mermaid.parse(text);
      const {svg}=await mermaid.render(`architecture-${name}`,text);
      document.querySelector('main').innerHTML=svg;
      const element=document.querySelector('main svg');
      const box=element.viewBox.baseVal;
      const width=Math.ceil(box.width),height=Math.ceil(box.height);
      element.setAttribute('width',width);element.setAttribute('height',height);
      element.style.maxWidth='none';
      const serialized=new XMLSerializer().serializeToString(element);
      const parsed=new DOMParser().parseFromString(serialized,'image/svg+xml');
      if(parsed.querySelector('parsererror'))throw new Error(`${name}: invalid standalone SVG XML`);
      const image=new Image(width,height);
      image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
      await image.decode();
      if(image.naturalWidth!==width||image.naturalHeight!==height)throw new Error(`${name}: standalone SVG dimensions changed`);
      // Inspect the exported image itself, including its XHTML labels.
      document.querySelector('main').replaceChildren(image);
      return {svg:serialized,width,height};
    },{text,name});
    await fs.writeFile(path.join(output,`${name}.svg`),result.svg+'\n');
    if(inspection){
      await page.setViewportSize({width:Math.min(4096,result.width+32),height:Math.min(4096,result.height+32)});
      await page.locator('main img').screenshot({path:path.join(inspection,`${name}.png`)});
    }
    rendered.push({source:file,source_sha256:sha256(text),output:`${name}.svg`,output_sha256:sha256(result.svg+'\n'),question:headers.visual_question,companion:headers.companion_doc,width:result.width,height:result.height,relations:expected.length});
  }
  if(seen.size!==relationIndex.relations.length)throw new Error('Relations exist without a rendered arrow');
} finally {await browser.close();}
const cards=rendered.map(r=>`<section id="${path.basename(r.source,'.mmd')}"><h2>${escape(r.question)}</h2><p><a href="../${r.companion}">Companion / operations / lifecycle</a> · <a href="../${r.source}">Mermaid source</a> · <a href="${r.output}">Full-size SVG</a></p><div class="diagram"><img src="${r.output}" alt="${escape(r.question)}" width="${r.width}" height="${r.height}"></div></section>`).join('\n');
await fs.writeFile(path.join(output,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>O:I architecture · six operational questions</title><style>body{font:17px/1.6 system-ui,sans-serif;background:#f6f5f1;color:#252b30;margin:0;padding:28px}main{max-width:1500px;margin:auto}h1{font-size:32px}h2{font-size:24px}section{background:white;border:1px solid #d4d8da;margin:36px 0;padding:24px}a{color:#225a88}.diagram{overflow:auto;padding:16px;border-top:1px solid #ddd}.diagram img{max-width:none;display:block}.legend{display:flex;gap:14px;flex-wrap:wrap}.legend span{padding:4px 10px;border:1px solid #aaa}.source{background:#fff0d8}.native{background:#e4efff}.derived{background:#eee7fb}.material{background:#edf0f2}.gap{background:#fff0ee}</style><main><h1>O:I architecture · six operational questions</h1><p>Source-inspected relations, 30 September–4 October 2026. Agent interpretation; no new architecture adoption or whole-programme acceptance.</p><p><a href="../README.md">Canonical navigation</a> · <a href="../relations.json">Every arrow and its source</a> · <a href="../source-basis.json">Exact inspected source revisions</a> · <a href="../verification.md">Checks and independent navigation</a></p><div class="legend"><span class="source">Human / source authority</span><span class="native">Native state / operation</span><span class="derived">Derived context / projection</span><span class="material">Material carrier / presentation</span><span class="gap">Missing join / acceptance</span></div><p>Solid arrows name inspected relations, not installed acceptance. Dashed arrows are proposed joins. Scroll a wide diagram horizontally or open its full-size SVG; labels stay at their rendered size.</p>${cards}</main></html>\n`);
await fs.writeFile(path.join(output,'render-manifest.json'),JSON.stringify({renderer:'Mermaid',version:packageJson.version,inspection:'Full-size browser rendering; visual inspection separately recorded in verification.md',diagrams:rendered},null,2)+'\n');
console.log(JSON.stringify({mermaid:packageJson.version,diagrams:rendered},null,2));
