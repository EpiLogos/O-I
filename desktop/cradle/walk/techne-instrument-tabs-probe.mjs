import {chromium} from 'playwright';
const out='/tmp/techne-shots';
import {mkdirSync} from 'fs';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
// Fresh arrangement: the rail's persisted choice must not mask the M0′ default.
await page.addInitScript(()=>{try{
  sessionStorage.setItem('oi-cradle.welcome.v1','probe');
  localStorage.setItem('oi-cradle.welcome.v1','probe');
  localStorage.removeItem('oi-cradle.techne.instrument-rail.v1');
  localStorage.removeItem('oi-cradle.techne.material.v1');
}catch{}});
await page.goto('http://localhost:1432/');
await page.waitForSelector('.desktop-shell',{timeout:20000});
await page.waitForTimeout(1500);
await page.locator('.world-mode-strip [data-mode="techne"]').click();
await page.waitForTimeout(1200);

const fail=(step,detail)=>{console.log(`FAIL ${step}: ${detail}`);};
const tabs=page.locator('.tn-tabbar [role="tablist"] [role="tab"]');
const tabCount=await tabs.count();
console.log('instrument tabs:',tabCount);
if(tabCount!==6)fail('six tabs',`expected 6, saw ${tabCount}`);
const tabIds=await tabs.evaluateAll(nodes=>nodes.map(n=>n.dataset.instrument));
console.log('tab ids:',tabIds.join(','));
if(tabIds.join(',')!=='project,canvas,timeline,journey,place,palace')fail('tab order',tabIds.join(','));

// M0′ is the first view: the project tab selected, the WIKI→EXPRESSION
// PROJECTION mounted (owner direction 2026-09-19) — the register's local
// whole as a real Expression on the stage, never the wiki list browser this
// replaced. Without a kernel transport (this probe's plain dev bundle) the
// projection stands in its honest unavailable state, named — never a
// fabricated overview.
const surface=page.locator('.tn-surface');
const firstSelected=await tabs.first().getAttribute('aria-selected');
const surfaceInstrument=await surface.getAttribute('data-instrument');
console.log('first tab selected:',firstSelected,'surface instrument:',surfaceInstrument);
if(firstSelected!=='true'||surfaceInstrument!=='project')fail('M0 first view',`selected=${firstSelected} instrument=${surfaceInstrument}`);
const projection=page.locator('.wiki-expression');
if(!await projection.count())fail('M0 projection','the wiki→Expression projection is not mounted as Instrument 0\u2019s opening');
const projectionState=await projection.getAttribute('data-state');
console.log('projection state:',projectionState);
if(projectionState!=='ready'&&projectionState!=='unavailable'&&projectionState!=='absent')fail('M0 projection state',`data-state=${projectionState} is not a truthful standing`);
if(projectionState==='unavailable'){
  const basis=await page.locator('.wx-basis').textContent();
  if(!/wiki reading unavailable/.test(basis??''))fail('M0 unavailable naming',`the unavailable state does not name itself: "${basis}"`);
}
if(projectionState==='ready'){
  const expressionRef=await projection.getAttribute('data-expression-ref')??'';
  if(!/^expression:techne-m0\./.test(expressionRef))fail('M0 expression identity',`data-expression-ref=${expressionRef}`);
  if(!await page.locator('.wx-stage-host').count())fail('M0 stage host','the projection does not present through the stage host');
}
// Material is never the gate: with an empty material scene the depth stands
// down (no forced aside) and the projection is the experience either way.
if(await page.locator('.tn-m0-material[data-open="true"]').count()&&!(await page.locator('.wiki-expression').count()))fail('M0 material gate','the material depth is forced open ahead of the experience');
await page.screenshot({path:`${out}/tt-1-m0-first-view.png`});

// The truthful disclosure state line (no subject join, no QL provider wired).
const note=page.locator('.tn-tabbar-note');
const noteText=(await note.textContent())?.trim()??'';
console.log('state line:',noteText);
if(!/no subject selected/.test(noteText))fail('state line',`"${noteText}" does not name the no-subject state`);

// An unimplemented instrument: stated reasons, never simulated content.
await page.locator('.tn-tabbar [role="tab"][data-instrument="timeline"]').click();
await page.waitForTimeout(500);
const slot=page.locator('.tn-slot[data-instrument="timeline"]');
if(!await slot.count())fail('timeline slot','the timeline tab body did not mount');
const slotText=(await slot.textContent())??'';
console.log('timeline slot text:',slotText.replace(/\s+/g,' ').slice(0,160));
if(!/QL reading unavailable|No subject selected/.test(slotText))fail('slot reason','no stated reason in the slot body');
if(!/host slot, not a simulated instrument/.test(slotText))fail('slot honesty','the slot does not name itself a host slot');
if(await slot.locator('canvas,svg.stage,.tn-scene').count())fail('slot simulation','the slot renders simulated instrument content');
await page.screenshot({path:`${out}/tt-2-timeline-slot.png`});

// Tab switch preserves state: the lens host is presentation state that must
// survive leaving the M0′ tab and returning (the scene store keeps the rest).
await page.locator('.tn-tabbar [role="tab"][data-instrument="project"]').click();
await page.waitForTimeout(400);
// the material depth surfaces itself when material exists; without material
// the depth stays folded — the wiki web is the experience either way
const materialDepth=page.locator('.tn-m0-material');
const lensTool=page.locator('.tn-scene-bar-tools [aria-label="Lens host"]');
if(await materialDepth.count()===0){console.log('material depth: folded (no material) — the lens round-trip needs material; skipped in this state');}
if(await materialDepth.count()){
  const lensOpen=(await lensTool.getAttribute('aria-pressed'))==='true';
  await page.locator('.tn-tabbar [role="tab"][data-instrument="journey"]').click();
  await page.waitForTimeout(400);
  await page.locator('.tn-tabbar [role="tab"][data-instrument="project"]').click();
  await page.waitForTimeout(400);
  const lensOpenAfter=(await page.locator('.tn-scene-bar-tools [aria-label="Lens host"]').getAttribute('aria-pressed'))==='true';
  console.log('lens host open before/after tab round-trip:',lensOpen,lensOpenAfter);
  if(lensOpen!==lensOpenAfter)fail('state preserved',`lens host was ${lensOpen?'open':'closed'} and returned ${lensOpenAfter}`);
}

// The shared tab grammar: pin cycles to unpinned with its reveal edge, and
// orientation flips to the pinned-vertical list.
await page.locator('.tn-tabbar .pane-tool-pin').click();
await page.waitForTimeout(300);
const presentation=await surface.getAttribute('data-tab-presentation');
console.log('presentation after pin toggle:',presentation);
if(presentation!=='unpinned')fail('unpin',`data-tab-presentation=${presentation}`);
if(!await page.locator('.tn-surface > .tab-reveal-zone').count())fail('reveal edge','an unpinned rail has no reveal zone');
// The reveal answers approach from outside (the pane's own law): the clicked
// tool keeps focus-within open (the keyboard law), so step away with focus
// AND pointer, then approach the edge.
await page.locator('.tn-m0, .wiki-expression').first().click({position:{x:20,y:20}}).catch(()=>{});
await page.mouse.move(400,600);
await page.waitForTimeout(400);
const foldedHeight=await page.locator('.tn-tabbar').evaluate(node=>node.getBoundingClientRect().height);
console.log('folded strip height:',foldedHeight);
if(foldedHeight>2)fail('fold','the unpinned rail does not fold away');
await page.locator('.tn-surface > .tab-reveal-zone').hover();
await page.waitForTimeout(400);
const revealedHeight=await page.locator('.tn-tabbar').evaluate(node=>node.getBoundingClientRect().height);
console.log('revealed strip height:',revealedHeight);
if(revealedHeight<20)fail('reveal','the unpinned rail does not reveal on approach');
await page.locator('.tn-tabbar .pane-tool-orient').click();
await page.waitForTimeout(300);
const vertical=await surface.getAttribute('data-tab-presentation');
console.log('presentation after orient (from unpinned):',vertical);
await page.locator('.tn-tabbar .pane-tool-pin').click();
await page.waitForTimeout(300);
const pinned=await surface.getAttribute('data-tab-presentation');
console.log('presentation after pin:',pinned);
if(pinned!=='pinned-vertical')fail('pin vertical',`data-tab-presentation=${pinned}`);
if(!await page.locator('.tn-surface > .tab-list-resizer').count())fail('vertical resizer','the pinned-vertical rail has no width resizer');
await page.screenshot({path:`${out}/tt-3-vertical-rail.png`});
await page.locator('.tn-tabbar .pane-tool-orient').click();
await page.waitForTimeout(300);
console.log('presentation back to horizontal:',await surface.getAttribute('data-tab-presentation'));

// The arrangement restores with the mode: leaving and returning keeps the
// rail's tab (and nothing resets — the surface is the same binding).
await page.locator('.tn-tabbar [role="tab"][data-instrument="palace"]').click();
await page.waitForTimeout(300);
await page.locator('.world-mode-strip, .mode-strip-host .world-mode-strip').first().locator('[data-mode="factory"]').click();
await page.waitForTimeout(900);
await page.locator('.mode-strip-host .world-mode-strip [data-mode="techne"], .world-mode-strip [data-mode="techne"]').first().click();
await page.waitForTimeout(900);
const restored=await page.locator('.tn-surface').getAttribute('data-instrument');
const restoredCount=await page.locator('.tn-tabbar [role="tab"]').count();
console.log('restored instrument after mode round-trip:',restored,'tabs:',restoredCount);
if(restored!=='palace')fail('arrangement restore',`instrument=${restored}`);
if(restoredCount!==6)fail('arrangement restore tabs',`${restoredCount}`);
await page.screenshot({path:`${out}/tt-4-restored-arrangement.png`});

// Keyboard: End from the first tab walks to the last (the pane strip grammar).
await page.locator('.tn-tabbar [role="tab"][data-instrument="project"]').focus();
await page.keyboard.press('End');
await page.waitForTimeout(300);
const endSelected=await page.locator('.tn-surface').getAttribute('data-instrument');
console.log('after End key:',endSelected);
if(endSelected!=='palace')fail('keyboard End',`instrument=${endSelected}`);
await page.keyboard.press('Home');
await page.waitForTimeout(300);
const homeSelected=await page.locator('.tn-surface').getAttribute('data-instrument');
console.log('after Home key:',homeSelected);
if(homeSelected!=='project')fail('keyboard Home',`instrument=${homeSelected}`);

console.log('errors:',errors.length?errors:'none');

// The disclosure contract binding, exercised on the live module: a
// wire-shaped ql.techne/v1 reading (QL-MEF main dbff5cc schema) parses, maps
// to per-instrument states with reasons verbatim, and a reading that breaks
// the unavailable-reason law is refused whole. This is the binding the tabs
// will read through the provider seam once the QL join lands — checked here
// at its own pure functions, never dressed into the UI as native content.
const contract=await page.evaluate(async()=>{
  const module=await import('/src/techne/techneReading.ts');
  const wire={contract:'ql.techne/v1',reading_ref:'ql:techne:reading:test-1',
    snapshot:{revision:'fnv1a64/v1:120:abc',basis_ref:null},
    subject:{subject_ref:'central:source:test/subject.md',native_owner:'aikit-knowledge',native_revision:'v1:12:cd',readings:[],kind:'source',standing:null},
    disclosure:{instruments:[
      {instrument:'project',available:true,m_prime:0,reading:'4:2-deep'},
      {instrument:'canvas',available:false,reason:'no canvas composition is registered for this subject',m_prime:1,reading:'4:2-deep'},
      {instrument:'timeline',available:true,m_prime:2,reading:'4:2-deep'},
    ],degraded:[{instrument:'journey',reason:'journey facets partial: two scenes carry no source'}],suggestions:[{instrument:'palace',reason:'a whole is bound; the palace reading is suggested'}]}};
  const parsed=module.parseTechneReading(wire);
  const canvas=module.instrumentStanding(parsed?{standing:'read',reading:parsed}:{standing:'no-subject'},'canvas');
  const journey=module.instrumentStanding(parsed?{standing:'read',reading:parsed}:{standing:'no-subject'},'journey');
  const project=module.instrumentStanding(parsed?{standing:'read',reading:parsed}:{standing:'no-subject'},'project');
  const place=module.instrumentStanding(parsed?{standing:'read',reading:parsed}:{standing:'no-subject'},'place');
  const unlawful=module.parseTechneReading({...wire,disclosure:{instruments:[{instrument:'place',available:false}],degraded:[],suggestions:[]}});
  return {
    parsed:!!parsed&&parsed.readingRef==='ql:techne:reading:test-1'&&parsed.revision==='fnv1a64/v1:120:abc',
    canvas:{available:canvas.available,reason:canvas.reason},
    journeyDegraded:journey.degraded,
    projectAvailable:project.available&&project.disclosed,
    placeUndisclosed:place.disclosed===false&&place.available===true,
    unlawfulRefused:unlawful===null,
  };
});
console.log('contract binding:',JSON.stringify(contract));
if(!contract.parsed)fail('contract parse','the wire reading did not parse');
if(contract.canvas.available||contract.canvas.reason!=='no canvas composition is registered for this subject')fail('contract reason','the unavailable reason did not travel verbatim');
if(contract.journeyDegraded[0]!=='journey facets partial: two scenes carry no source')fail('contract degraded','the degraded reason did not travel verbatim');
if(!contract.projectAvailable)fail('contract available','the project instrument did not stand available');
if(!contract.placeUndisclosed)fail('contract undisclosed','an unlisted instrument should stand undisclosed-yet-open');
if(!contract.unlawfulRefused)fail('contract law','an unavailable instrument without a reason must refuse the reading');

await browser.close();
