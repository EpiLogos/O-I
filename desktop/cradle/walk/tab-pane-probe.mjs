import {chromium} from 'playwright';
// Acceptance probe — the pane tab-strip's presentation and fold laws
// (UI-FUNCTION-LANDING B1, "reveal law"; Workbench GroupPane + registry:
// orient flips one pane's orientation, pin/unpin is per pane, and a folded
// strip hides with ZERO remainder in both orientations). Every check is a
// state equality or geometry, never presence alone; failures accumulate and
// the probe exits 1 when any check fails (HARNESS-SETTINGS-RESEARCH-2026-09-22
// §4 negative roster 7 + owner ruling 8).
//
// It reads the standing dev server (PROBE_URL overrides).
const base=process.env.PROBE_URL??'http://localhost:1421/';
const browser=await chromium.launch({headless:true});
const fails=[]; let total=0;
const check=(ok,label,data)=>{
  total++;
  console.log(`${ok?'PASS':'FAIL'}  ${label}`);
  if(!ok)fails.push(data===undefined?{label}:{label,data});
  return !!ok;
};
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  await page.addInitScript(()=>{try{sessionStorage.setItem('oi-cradle.welcome.v1','probe');}catch{}});
  await page.goto(base);
  await page.waitForSelector('.desktop-shell',{timeout:20000});
  await page.waitForTimeout(1500);
  // open the one local surface (the draft — no kernel needed), then split
  await page.getByRole('button',{name:'Start writing'}).click();
  await page.locator('.cm-content').first().waitFor({timeout:15000});
  await page.keyboard.press('Meta+d');await page.waitForTimeout(400);
  // Real panes carry data-tab-presentation; the concealed empty-workspace
  // rest frame (CradleFrame rest-host, mounted-hidden by the never-remount
  // law) also matches .pane.group and must not be read as a pane.
  const panes=page.locator('.pane.group[data-tab-presentation]');
  check(await panes.count()===2,'splitting yields exactly two panes',{count:await panes.count()});
  const first=panes.nth(0),second=panes.nth(1);
  const presOf=async pane=>await pane.getAttribute('data-tab-presentation');
  const presA0=await presOf(first),presA1=await presOf(second);
  check(presA0==='pinned-horizontal'&&presA1==='pinned-horizontal',
    'both panes begin pinned-horizontal',{first:presA0,second:presA1});

  // orientation is per pane: flipping the first moves nothing else
  await first.locator('.pane-tool-orient').click();await page.waitForTimeout(300);
  const presB0=await presOf(first),presB1=await presOf(second);
  check(presB0==='pinned-vertical','the orient tool flips its own pane to pinned-vertical',{first:presB0});
  check(presB1==='pinned-horizontal','the neighbouring pane keeps its own orientation',{second:presB1});
  check(await first.getAttribute('data-tab-orientation')===null,
    'a pinned pane names orientation through its presentation, not an orientation attribute',{attr:await first.getAttribute('data-tab-orientation')});

  // pin the first, move pointer away: its strip folds with ZERO remainder
  await first.locator('.pane-tool-pin').click();await page.waitForTimeout(400);
  check(await presOf(first)==='unpinned','unpinning marks the pane unpinned',{presentation:await presOf(first)});
  check(await first.getAttribute('data-tab-orientation')==='vertical',
    'the unpinned pane carries its vertical orientation on the attribute',{attr:await first.getAttribute('data-tab-orientation')});
  // the pin keeps focus (focus-within holds the reveal open) — a person's next
  // click lands in the surface; only then does the drawer fold away
  await first.locator('.cm-content').click();await page.waitForTimeout(300);
  await page.mouse.move(900,400);await page.waitForTimeout(500);
  const stripBox=await first.locator('.tab-strip').boundingBox();
  const paneBox=await first.boundingBox();
  check(stripBox!==null&&stripBox.width<=1.5,
    'the folded vertical strip hides to at most a hairline of width',{stripWidth:stripBox?.width});
  check(stripBox!==null&&paneBox!==null&&Math.abs(stripBox.x-paneBox.x)<=1.5,
    'the folded vertical strip sits at the pane edge, no remainder',{stripX:stripBox?.x,paneX:paneBox?.x});
  const bodyBox=await first.locator('.surface-body').boundingBox();
  check(bodyBox!==null&&paneBox!==null&&Math.abs(bodyBox.x-paneBox.x)<=1.5,
    'the surface body starts at the pane edge once the drawer folds',{bodyX:bodyBox?.x,paneX:paneBox?.x});

  // back to horizontal, pinned again, then folded: the horizontal drawer also
  // hides with zero remainder. The strip is currently FOLDED (unpinned, zero
  // width) — approach the pane's reveal edge first: the hiding law summons
  // the strip before its tools are clickable.
  await first.hover({position:{x:8,y:30}});await page.waitForTimeout(400);
  await first.locator('.pane-tool-orient').click();await page.waitForTimeout(300);
  check(await presOf(first)==='unpinned','the orient tool on an unpinned pane flips only its recorded orientation',{presentation:await presOf(first)});
  check(await first.getAttribute('data-tab-orientation')==='horizontal',
    'the orientation attribute flips to horizontal',{attr:await first.getAttribute('data-tab-orientation')});
  await first.locator('.pane-tool-pin').click();await page.waitForTimeout(300);
  check(await presOf(first)==='pinned-horizontal','re-pinning records the pane pinned-horizontal',{presentation:await presOf(first)});
  await first.locator('.pane-tool-pin').click();await page.waitForTimeout(300);
  await first.locator('.cm-content').click();await page.waitForTimeout(300);
  await page.mouse.move(900,400);await page.waitForTimeout(500);
  const hStrip=await first.locator('.tab-strip').boundingBox();
  check(hStrip!==null&&hStrip.height<=1.5,
    'the folded horizontal strip hides with zero remainder of height',{stripHeight:hStrip?.height});

  // the second pane never moved through any of it
  check(await presOf(second)==='pinned-horizontal','the second pane never moved',{second:await presOf(second)});
}catch(error){
  check(false,`probe crashed: ${String(error).slice(0,200)}`);
}finally{
  await browser.close();
}
if(fails.length){
  console.error(`FAIL  tab-pane-probe — ${total-fails.length}/${total} checks`);
  console.error(JSON.stringify(fails,null,2));
  process.exitCode=1;
}else{
  console.log(`PASS  tab-pane-probe — ${total}/${total} checks`);
}
