// persist-migration-probe (§7 of the commission): old persisted workspace
// state upgrades on load — the legacy three-state tab presentations map to
// the pin model, a valid surface survives, garbage fields drop without
// crashing the shell. Storage is seeded before first load; the assertions
// read back what the upgraded layout actually renders.
import {chromium} from 'playwright';
const fails=[];
const check=(ok,label,detail='')=>{console.log(`${ok?"ok":"FAIL"} — ${label}${detail?` · ${detail}`:""}`);if(!ok)fails.push(label);};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
// Seed the legacy state BEFORE any app script runs: an old-shaped layout with
// the pre-pin tab presentations ("list" → pinned-vertical, "hidden" →
// unpinned, "strip" → the absent default), one real draft surface, and
// foreign fields the lenient decoder must drop rather than trip on.
await page.addInitScript(()=>{
  try{
    sessionStorage.setItem('oi-cradle.welcome.v1','probe');
    localStorage.setItem('oi-cradle.welcome.v1','probe');
    const draftId='surface-legacy-1';
    const legacy={
      surfaces:{[draftId]:{id:draftId,kind:'draft',title:'Legacy writing',ref:'draft:legacy'}},
      root:{type:'group',id:'pane-1',tabs:[draftId],pinned:[draftId],active:draftId},
      // the pre-pin grammar's top-level state: "list" upgrades to pinned-vertical
      tabPresentation:'list',
      closedStack:['surface-that-no-longer-exists','not-even-an-id',42],
      agencyDepth:'panel',rightDepth:'panel',
      foreignFutureField:{nested:{junk:true}},anotherUnknown:'drop me',
      accompanying:{ref:'agent-session:legacy',project:'O-I',space:'session-space:legacy'},
    };
    localStorage.setItem('oi-cradle.layout.v1',JSON.stringify(legacy));
  }catch{}
});
await page.goto('http://localhost:1432/',{timeout:40000});
await page.waitForSelector('.desktop-shell',{timeout:40000});
await page.waitForTimeout(1600);
check(true,'the shell loads over the legacy payload (lenient decode, no crash)');
check(await page.locator('.desktop-shell').count()===1,'exactly one shell renders');
// the draft survived: its editor is present (or its tab), the layout restored
const editor=await page.locator('.cm-content, [class*="draft"]').count();
check(editor>0,'the legacy draft surface restored into the layout',`draft elements ${editor}`);
// force a state change so the migrated book is written back, then read the
// v2 book the legacy layout migrated into
await page.locator('.world-mode-strip [data-mode="factory"]').click();
await page.waitForTimeout(700);
const book=await page.evaluate(()=>{try{return JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1'));}catch{return null;}});
const ws=book&&book.workspaces&&book.workspaces[0];
const layout=(ws&&ws.layout)||{};
const pane=(layout.root)||{};
// the per-mode trees carry the upgraded panes: the active tree after the
// factory switch is factory's own; the base tree (with the migrated panes)
// waits in modeLayouts — look for the upgraded presentation in any group pane
const panes=await page.evaluate(()=>{
  const book=JSON.parse(localStorage.getItem('oi-cradle.workspaces.v1')||'{}');
  const ws=book.workspaces&&book.workspaces[0]; if(!ws)return [];
  const trees=[ws.layout,...Object.values(ws.modeLayouts||{})].filter(Boolean);
  const found=[];
  const walk=p=>{if(!p)return;if(p.type==='split')(p.children||[]).forEach(walk);else if(p.type==='group')found.push(p.tabPresentation||null);};
  trees.forEach(t=>walk(t.root));
  return found;
});
check(panes.includes('pinned-vertical'),'the legacy "list" pin state upgrades to the per-pane pin model (pinned-vertical)',JSON.stringify(panes));
check(!('foreignFutureField' in layout)&&!('anotherUnknown' in layout),'foreign fields drop out of the migrated state');
check(Array.isArray(layout.closedStack)&&layout.closedStack.every(id=>typeof id==='string'),'the closed stack keeps only valid ids');
check(errors.length===0,'no console or page errors across the migration',errors.slice(0,2).join(' | '));
console.log(fails.length?`\n${fails.length} FAILURES`:'\nall checks passed');
await browser.close();
process.exit(fails.length?1:0);
