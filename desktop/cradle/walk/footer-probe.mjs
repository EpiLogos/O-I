import {chromium} from 'playwright';
// Acceptance probe — the workspace footer's reveal law (UI-FUNCTION-LANDING
// B1: "edge 3px→24px on hover, actions summary reachable"). Every check is
// content or geometry, never presence alone; failures accumulate and the
// probe exits 1 when any check fails (HARNESS-SETTINGS-RESEARCH-2026-09-22
// §4 negative roster 7 + owner ruling 8: a probe without a failure path is
// print-as-verification).
//
// It reads the standing dev server (PROBE_URL overrides); the former
// ephemeral server (configFile:false) predates the workspace engine deps
// (`three` from packages/oi-design-system) and can no longer resolve them.
const base=process.env.PROBE_URL??'http://localhost:1432/';
const VP={width:1280,height:800};
const browser=await chromium.launch({headless:true});
const fails=[]; let total=0;
const check=(ok,label,data)=>{
  total++;
  console.log(`${ok?'PASS':'FAIL'}  ${label}`);
  if(!ok)fails.push(data===undefined?{label}:{label,data});
  return !!ok;
};
try{
  const page=await browser.newPage({viewport:VP});
  await page.goto(base);
  await page.waitForSelector('.workspace-footer-edge',{timeout:20000});
  // dismiss welcome if standing
  const enter=page.locator('.oi-welcome-enter');
  if(await enter.count()){await enter.click({force:true});await page.waitForTimeout(3200);}
  const edge=page.locator('.workspace-footer-edge');
  check(await edge.count()===1,'exactly one workspace footer edge hosts the status row');

  // Collapsed, the footer is the 3px reveal strip (--oi-footer-edge).
  const collapsedH=(await edge.boundingBox())?.height;
  check(collapsedH!==undefined&&Math.abs(collapsedH-3)<=0.5,
    'collapsed, the footer is the 3px reveal strip',{height:collapsedH});

  // Hover reveals the full status row: 24px (--oi-footer-height), not just
  // "the box changed".
  await edge.hover();
  await page.waitForTimeout(450);
  const revealedH=(await edge.boundingBox())?.height;
  check(revealedH!==undefined&&Math.abs(revealedH-24)<=0.5,
    'hovering the edge reveals the full 24px status row',{height:revealedH});

  // Revealed means painted and interactive — opacity 1, pointer-events auto.
  const arrangement=page.locator('footer.canvas-arrangement');
  const reveal=await arrangement.evaluate(el=>({
    opacity:getComputedStyle(el).opacity,
    pointerEvents:getComputedStyle(el).pointerEvents,
    rendered:!!(el.offsetWidth||el.offsetHeight)}));
  check(reveal.opacity==='1'&&reveal.pointerEvents==='auto'&&reveal.rendered,
    'the revealed status row is painted and interactive',{...reveal});

  // The actions summary is reachable inside the revealed band at the bottom
  // of the viewport (geometry, not existence).
  const s=page.locator('summary[aria-label="Workspace actions"]');
  const sb=await s.boundingBox();
  check(await s.isVisible()&&sb!==null&&sb.y>=VP.height-24-1&&sb.y+sb.height<=VP.height+1,
    'the workspace-actions summary is reachable within the revealed footer band',{box:sb});

  // Hit tests: bottom-centre and bottom-right land inside the footer edge,
  // not on an invisible overlay.
  const hits=await page.evaluate(([w,h])=>[[w/2,h-5],[w-40,h-5]].map(([x,y])=>{
    const el=document.elementFromPoint(x,y);
    return {x:Math.round(x),y:Math.round(y),hit:!!(el&&el.closest('.workspace-footer-edge')),at:el?String(el.className||el.tagName):'none'};
  }),[VP.width,VP.height]);
  check(hits.every(point=>point.hit),
    'points across the revealed footer band hit the footer, not an overlay',{hits});

  // Reachable means usable: the summary opens the workspace-actions menu.
  await s.click();
  const item=page.getByRole('button',{name:'New workspace'});
  check(await item.isVisible(),'the workspace-actions menu opens with its entries reachable');
}catch(error){
  check(false,`probe crashed: ${String(error).slice(0,200)}`);
}finally{
  await browser.close();
}
if(fails.length){
  console.error(`FAIL  footer-probe — ${total-fails.length}/${total} checks`);
  console.error(JSON.stringify(fails,null,2));
  process.exitCode=1;
}else{
  console.log(`PASS  footer-probe — ${total}/${total} checks`);
}
