/** Actual Canvas2D text-layout receiving gate. Call in the already owned
 * browser frame after root regeneration/custody; this helper launches nothing.
 * Pages/expectedBody/reference must come from the parent's verified native
 * reading/receipt. Probe variations are layout input only, never native edits
 * or authored answers. No native numerical, pixel-shape, installed or H claim. */
import assert from 'node:assert/strict';
export async function proveCaptureTextLayout(frame,cfg){
 assert.match(cfg.module_sha256,/^[a-f0-9]{64}$/);
 assert.match(cfg.material_receipt_sha256,/^[a-f0-9]{64}$/);
 assert.match(cfg.reference_receipt_sha256,/^[a-f0-9]{64}$/);
 assert.equal(typeof cfg.reference,'string');assert.ok(cfg.reference&& !/\s/u.test(cfg.reference));
 assert.equal(typeof cfg.reference_value_path,'string');assert.ok(cfg.reference_value_path);
 assert.ok(Array.isArray(cfg.pages)&&cfg.pages.length>0);
 for(const page of cfg.pages){assert.ok(page.scene?.text?.length);assert.equal(typeof page.expectedBody,'string');assert.ok(page.expectedBody.length);}
 return frame.evaluate(async cfg=>{
  const require=(test,message)=>{if(!test)throw Error(message);};
  const bytesHash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  const moduleUrl=new URL(cfg.module_url,location.href);require(moduleUrl.origin===location.origin,'Capture module must be the qualified same-origin producer');
  moduleUrl.searchParams.set('capture-layout-proof',cfg.module_sha256);
  const fetchModule=async()=>{const response=await fetch(moduleUrl,{cache:'no-store'});require(response.ok,'Actual capture module read refused');return new Uint8Array(await response.arrayBuffer());};
  require(await bytesHash(await fetchModule())===cfg.module_sha256,'Actual capture module SHA differs');
  const {wrap,paintText,textLayout,captureTextLayers}=await import(moduleUrl.href);
  require([wrap,paintText,textLayout,captureTextLayers].every(value=>typeof value==='function'),'Actual capture exports unavailable');
  await document.fonts.ready;
  const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=900;
  const ctx=canvas.getContext('2d');require(ctx,'Actual Canvas2D unavailable');ctx.font='18px Arial';if('letterSpacing'in ctx)ctx.letterSpacing='0px';
  const width=648,segmenter=new Intl.Segmenter(undefined,{granularity:'grapheme'});
  const verifyParagraph=(value,column)=>{
   const boundaries=new Set([0,value.length]);for(const part of segmenter.segment(value))boundaries.add(part.index);
   const lines=wrap(ctx,value,column);require(lines.join('')===value,'Wrapping dropped or changed literal text');
   let offset=0;for(const line of lines){require(ctx.measureText(line).width<=column,'Wrapped line exceeds its actual font/column');offset+=line.length;require(boundaries.has(offset),'Wrapping split a complete grapheme');}
   return {lines,max_width:Math.max(0,...lines.map(line=>ctx.measureText(line).width)),literal_utf16_length:value.length};
  };
  const referenceWidth=ctx.measureText(cfg.reference).width;require(referenceWidth>width,'Original long-reference overflow was not exercised');
  const reference=verifyParagraph(cfg.reference,width);require(reference.lines.length>1,'Actual oversized reference did not wrap');
  const ordinary='alpha beta gamma',ordinaryWidth=ctx.measureText('alpha beta ').width;
  const ordinaryResult=verifyParagraph(ordinary,ordinaryWidth);require(JSON.stringify(ordinaryResult.lines)===JSON.stringify(['alpha beta ','gamma']),'Ordinary word boundaries changed');
  const unicode='👩🏽‍🚀e\u0301🇬🇧क्ष'.repeat(64),unicodeResult=verifyParagraph(unicode,width);require(unicodeResult.lines.length>1,'Unicode oversized token not exercised');
  const whitespace='  alpha   beta\tgamma\u00a0\u00a0delta  \u0301word  ',whitespaceResult=verifyParagraph(whitespace,ctx.measureText('alpha   beta ').width);
  require(JSON.stringify(wrap(ctx,'first\n\nthird',width))===JSON.stringify(['first','','third']),'Explicit empty paragraph changed');
  let refused=false;try{wrap(ctx,'👩🏽‍🚀',ctx.measureText('👩🏽‍🚀').width/2);}catch(error){refused=/complete text grapheme exceeds/.test(String(error));}require(refused,'An individually unfit grapheme must explicitly refuse');
  const originalFill=ctx.fillText.bind(ctx);let calls=[];
  ctx.fillText=(text,x,y,...tail)=>{calls.push({text:String(text),font:ctx.font,measured_width:ctx.measureText(String(text)).width,x,y});return originalFill(text,x,y,...tail);};
  const receive=(scene,expectedBody)=>{
   calls=[];paintText(ctx,scene,1440,900);
   const grouped=captureTextLayers(scene);require(grouped.length===1,'Expected one complete native answer cohort');
   const layout=textLayout(grouped[0],1440,900),bodyCalls=calls.filter(call=>call.font===layout.body+'px Arial');
   require(layout.body===18,'Native answer typography changed');
   require(bodyCalls.map(call=>call.text).join('')===expectedBody.replace(/\n/g,''),'Actual paintText omitted/changed complete native text');
   for(const call of bodyCalls)require(call.measured_width<=layout.width,'Actual paintText paints outside its native answer column');
   // Direct paragraph checks retain original whitespace and all grapheme boundaries.
   ctx.save();ctx.font=layout.body+'px Arial';if('letterSpacing'in ctx)ctx.letterSpacing='0px';
   for(const paragraph of expectedBody.split('\n'))verifyParagraph(paragraph,layout.width);ctx.restore();
   return {scene_id:scene.id,column:layout.width,body_size:layout.body,lines:bodyCalls.length,max_width:Math.max(0,...bodyCalls.map(call=>call.measured_width)),literal_utf16_length:expectedBody.length,
    vertical_extent:Math.max(0,...bodyCalls.map(call=>call.y+layout.body)),calls_outside_fixed_viewport:bodyCalls.filter(call=>call.y+layout.body>900).length};
  };
  const pages=cfg.pages.map(page=>receive(page.scene,page.expectedBody));
  const first=cfg.pages[0].scene,layer=first.text[0];
  require(/^nara-answer-[a-f0-9]{64}:(primary|source)$/.test(layer.role),'Actual native reading layer basis unavailable');
  const probeBody=cfg.reference+'\n'+unicode+'\n'+whitespace;
  // Controlled variations of layout input never enter a native document/store.
  const probe={...first,text:[{...layer,role:layer.role.replace(/:source$/,':primary'),body:probeBody,bodySize:18,visible:true}]};
  const paintedProbe=receive(probe,probeBody);require(paintedProbe.column===width,'Original1440px/648px answer column changed');
  // These are layout-only variations of the same parent's actual native text,
  // not native edits or replacement answers. Role names cannot change the font,
  // column, literal text or complete paint trace of explicit authored typography.
  const authoredTrace=calls.map(call=>({...call})),authoredRoleProbes=[];
  require(Math.max(...authoredTrace.filter(call=>call.font==='18px Arial').map(call=>call.measured_width))>230,'The former230px role cap was not discriminated');
  for(const role of ['resultText','caption',undefined]){
   const varied={...first,text:[{...layer,role,body:probeBody,bodySize:18,visible:true}]};
   const received=receive(varied,probeBody);
   require(received.column===width&&received.body_size===18,'Explicit authored typography/column changed by role');
   require(JSON.stringify(calls)===JSON.stringify(authoredTrace),'Role changed the complete actual native-text paint trace');
   authoredRoleProbes.push({role:role??null,...received});
  }
  // Omitting bodySize preserves the pre-existing legacy paragraph default.
  const legacy={...first,text:[{...layer,role:'caption',body:probeBody,bodySize:undefined,visible:true}]};
  calls=[];paintText(ctx,legacy,1440,900);
  const legacyLayout=textLayout(legacy.text[0],1440,900),legacyColumn=Math.min(legacyLayout.width,230),legacyCalls=calls.filter(call=>call.font===legacyLayout.body+'px Arial');
  require(legacyLayout.body===11,'Legacy body-size default changed');
  ctx.save();ctx.font=legacyLayout.body+'px Arial';if('letterSpacing'in ctx)ctx.letterSpacing='0px';
  const legacyExpected=probeBody.split('\n').flatMap(paragraph=>wrap(ctx,paragraph,legacyColumn));ctx.restore();
  require(JSON.stringify(legacyCalls.map(call=>call.text))===JSON.stringify(legacyExpected),'Legacy default paragraph column changed');
  require(legacyCalls.map(call=>call.text).join('')===probeBody.replace(/\n/g,''),'Legacy receiving changed literal text');
  for(const call of legacyCalls)require(call.measured_width<=legacyColumn,'Legacy default paints outside its existing column');
  require(await bytesHash(await fetchModule())===cfg.module_sha256,'Capture module changed during receiving proof');
  return {schema:'oi.capture-text-layout-receiving/v1',passed:true,module:{url:moduleUrl.href,sha256:cfg.module_sha256},source_material:{receipt_sha256:cfg.material_receipt_sha256,reference_receipt_sha256:cfg.reference_receipt_sha256,value_path:cfg.reference_value_path},
   environment:{user_agent:navigator.userAgent,device_pixel_ratio:devicePixelRatio,font:'18px Arial',fonts_status:document.fonts.status,canvas:[1440,900]},reference:{literal:cfg.reference,original_measured_width:referenceWidth,...reference},ordinary:ordinaryResult,unicode:unicodeResult,whitespace:whitespaceResult,pages,painted_probe:paintedProbe,authored_role_probes:authoredRoleProbes,legacy_default:{column:legacyColumn,body_size:legacyLayout.body,lines:legacyCalls.length},
   excludes:['Native attribution is separately parent-verified; supplied source hashes are not native authority','No whole-world/native numerical/GPU/audio/installed/H claim','Horizontal fit/full literal layout only; fixed viewport vertical clipping is disclosed and unchanged','Canvas text measurement/draw calls do not prove glyph shape or human legibility']};
 },cfg);
}
