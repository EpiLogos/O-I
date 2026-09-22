import {chromium} from 'playwright';
import {mkdirSync} from 'fs';
// Acceptance probe — the Desk's full SSSF Run view (UI-FUNCTION-LANDING F1:
// "all four depths, fixture + refused map"; DeskRunView: depths
// Trajectory/Reading/Live/Map, one read per entry, honest refused states).
// Drives the dev scenario's labelled fixture Run ("Sidebar slice — render
// lane"), so the expected content is knowable and every check is content or
// geometry, never presence alone. Failures accumulate and the probe exits 1
// when any check fails (HARNESS-SETTINGS-RESEARCH-2026-09-22 §4 negative
// roster 7 + owner ruling 8).
//
// It reads the standing dev server (PROBE_URL overrides) — the dev scenario
// select exists only in a dev build.
const base=process.env.PROBE_URL??'http://localhost:1432/';
const out='/tmp/desk-shots';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const fails=[]; let total=0;
const check=(ok,label,data)=>{
  total++;
  console.log(`${ok?'PASS':'FAIL'}  ${label}`);
  if(!ok)fails.push(data===undefined?{label}:{label,data});
  return !!ok;
};
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  await page.addInitScript(()=>{try{sessionStorage.setItem('oi-cradle.welcome.v1','probe');localStorage.setItem('oi-cradle.welcome.v1','probe');}catch{}});
  await page.goto(base);
  await page.waitForSelector('.desktop-shell',{timeout:20000});
  await page.waitForTimeout(1500);
  await page.locator('.world-mode-strip [data-mode="factory"]').click();
  await page.waitForTimeout(1200);
  const scenario=page.locator('main.factory-centre select[aria-label="Dev scenario"]');
  if(!await scenario.count()){
    check(false,'the factory centre exposes the dev scenario select');
  }else{
    await scenario.selectOption('desk');
    await page.waitForTimeout(900);
    // Open the parallel-work Run (carries a trajectory)
    const card=page.locator('.desk-card',{hasText:'Sidebar slice — render lane'});
    if(!await card.count()){
      check(false,'the desk board shows the "Sidebar slice — render lane" fixture run card');
    }else{
      await card.locator('.desk-card-open').click();
      await page.waitForTimeout(1200);

      // depths
      const depths=await page.locator('.desk-run-depths button').allTextContents();
      check(JSON.stringify(depths)===JSON.stringify(['Trajectory','Reading','Live','Map']),
        'the run view exposes exactly the four depths, in order',{depths});

      // Trajectory (default)
      await page.screenshot({path:`${out}/rv-1-trajectory.png`});
      const surface=page.locator('.desk-run-view .fb-build-surface');
      const surfaceBox=await surface.boundingBox();
      check(await surface.isVisible()&&surfaceBox!==null&&surfaceBox.width>100&&surfaceBox.height>100,
        'the trajectory depth renders the execution explorer with real geometry',{box:surfaceBox});
      const execCount=await page.locator('.desk-run-view .fb-section-head > span').first().textContent().catch(()=>'');
      check((execCount??'').trim()==='1 execution','the explorer counts the run one execution',{execCount});
      const request=(await page.locator('.desk-run-view .fb-trace-request strong').textContent().catch(()=>''))??'';
      check(request==="Land the Desk board's source reads.",
        'the waterfall names the selected execution request',{request});

      // Reading
      await page.locator('.desk-run-depths button',{hasText:'Reading'}).click();
      await page.waitForTimeout(400);
      await page.screenshot({path:`${out}/rv-2-reading.png`});
      const kicker=(await page.locator('.desk-run-frontier .desk-run-kicker').textContent().catch(()=>''))??'';
      check(kicker==='current frontier · work','the frontier kicker names the frontier mode',{kicker});
      const frontier=(await page.locator('.desk-run-frontier h2').textContent().catch(()=>''))??'';
      check(frontier==="Wire the board's live reads",'the frontier heading names the run current frontier',{frontier});
      const candidatesNote=(await page.locator('section[aria-label="Candidates"] .oi-note').textContent().catch(()=>''))??'';
      check(candidatesNote.trim()==='No candidate is open for this Run.',
        'the candidates section renders its honest empty state',{candidatesNote});
      const claims=page.locator('.desk-run-claim');
      check(await claims.count()===1,'the reading depth shows the run one claim',{count:await claims.count()});
      const claimStatement=(await claims.first().locator('p').textContent().catch(()=>''))??'';
      check(claimStatement==="Board rows read only through the owner's own developmental reads.",
        'the claim carries its statement',{claimStatement});
      const claimState=(await claims.first().locator('.desk-run-state').textContent().catch(()=>''))??'';
      check(claimState==='supported','the claim names its supported status',{claimState});
      const requestsNote=(await page.locator('section[aria-label="Human requests"] .oi-note').textContent().catch(()=>''))??'';
      check(requestsNote.trim()==='No durable human authorship request is open.',
        'the human-requests section is honest about having none',{requestsNote});

      // Live
      await page.locator('.desk-run-depths button',{hasText:'Live'}).click();
      await page.waitForTimeout(400);
      await page.screenshot({path:`${out}/rv-3-live.png`});
      const liveCards=page.locator('.desk-run-live-grid article');
      check(await liveCards.count()===4,'the live world renders the run two agencies and two executions',{count:await liveCards.count()});
      const labels=await page.locator('.desk-run-live-grid h4').allTextContents();
      check(labels.includes('Meredith · implementation')&&labels.includes('Odonata · verification'),
        'the live cards name both fixture agencies',{labels});

      // Map (live read is refused — no kernel transport in the probe; honest state)
      await page.locator('.desk-run-depths button',{hasText:'Map'}).click();
      await page.locator('.desk-run-map .oi-note[role="alert"]').waitFor({timeout:10000}).catch(()=>{});
      await page.screenshot({path:`${out}/rv-4-map.png`});
      const refused=page.locator('.desk-run-map .oi-note[role="alert"]');
      const refusedText=(await refused.textContent().catch(()=>''))??'';
      const prefix='The owner refused this Run\'s map reading:';
      check(await refused.isVisible()&&refusedText.startsWith(prefix)&&refusedText.trim().length>prefix.length+3,
        'the run map refuses honestly and names the reason',{refusedText});

      // no uncaught page errors through all four depths
      check(errors.length===0,'no uncaught page errors through all four depths',{errors});
    }
  }
}catch(error){
  check(false,`probe crashed: ${String(error).slice(0,200)}`);
}finally{
  await browser.close();
}
if(fails.length){
  console.error(`FAIL  desk-run-view-probe — ${total-fails.length}/${total} checks`);
  console.error(JSON.stringify(fails,null,2));
  process.exitCode=1;
}else{
  console.log(`PASS  desk-run-view-probe — ${total}/${total} checks`);
}
